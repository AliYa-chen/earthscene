import type { Viewer } from '../Viewer'
import type { TilesRenderer } from '3d-tiles-renderer'
import { getSunDirectionECEF } from '@takram/three-atmosphere'
import { Matrix4, Vector3 } from 'three'
import { normalizeWaterAreaAppearance, type WaterAreaAppearance, type WaterAreaAppearanceOptions } from './WaterAreaAppearance'
import { normalizeWaterAreaOptics, type WaterAreaOptics, type WaterAreaOpticsOptions } from './WaterAreaOptics'
import { WaterAreaTilesOverlay } from './WaterAreaImageOverlay'
import { WaterAreaMaterialPlugin } from './WaterAreaMaterialPlugin'
import { WaterAreaOverlayPlugin } from './WaterAreaOverlayPlugin'
import { createWaterAreaNormalTextures } from './WaterAreaNormalTexture'
import { createWaterAreaWaveFrame } from './WaterAreaWaveFrame'
import { WaterAreaSkyEnvironment } from './WaterAreaSkyEnvironment'
import type { WaterAreaSource } from './WaterAreaSource'

/** 完整引擎水域配置。 / Water-area options for the full engine. */
export interface WaterAreaOptions {
  /** 水域多边形或 OSM Shortbread 服务；不会更换地图数据。 / Water polygons or an OSM Shortbread service; map data is not replaced. */
  source: WaterAreaSource
  /** 水色与波纹。 / Water color and waves. */
  appearance?: WaterAreaAppearanceOptions
  /** 天空环境镜面。 / Sky environment reflection. */
  optics?: WaterAreaOpticsOptions
}

/** 水域掩膜加载状态；不等同于当前视野中一定有水面。 / Mask loading state; it does not imply visible water in the current view. */
export interface WaterAreaStatus {
  /** 已生成的掩膜瓦片数。 / Number of generated mask tiles. */
  readonly loadedTiles: number
  /** 含水域的掩膜瓦片数。 / Number of mask tiles containing water. */
  readonly waterTiles: number
  /** 失败的瓦片数。 / Number of failed tiles. */
  readonly failedTiles: number
  /** 实例是否已释放。 / Whether the instance has been destroyed. */
  readonly destroyed: boolean
}

/**
 * 为已有完整引擎 WebGL Viewer 增加水色、波纹、太阳镜面与天空倒影。
 * 不创建 Viewer，不更换底图或地形；销毁后原 Viewer 继续由应用管理。
 *
 * Add water color, waves, sun glint and sky reflections to an existing full-engine WebGL Viewer.
 * Does not create a Viewer or replace map data. The application retains ownership of the Viewer.
 */
export class WaterArea {
  /** 水色、显隐与波纹运行时设置。 / Runtime water appearance and wave settings. */
  readonly appearance: WaterAreaAppearance
  /** 天空倒影运行时设置。 / Runtime sky-reflection settings. */
  readonly optics: WaterAreaOptics
  private readonly environment: WaterAreaSkyEnvironment
  private readonly sunDirection = new Vector3()
  private readonly worldToECEF = new Matrix4()
  private currentSource: WaterAreaSource
  private tileset: TilesRenderer | null = null
  private material: WaterAreaMaterialPlugin | null = null
  private overlay: WaterAreaOverlayPlugin | null = null
  private generation = 0
  private loaded = 0
  private waterLoaded = 0
  private failed = 0
  private disposed = false

  constructor(private readonly viewer: Viewer, options: WaterAreaOptions) {
    if (viewer.renderer.type !== 'webgl') throw new Error('WaterArea requires an earthscene/engine WebGL Viewer.')
    this.currentSource = validateSource(options.source)
    const appearance: WaterAreaAppearance = {
      ...normalizeWaterAreaAppearance(options.appearance),
      assign(options) { Object.assign(appearance, normalizeWaterAreaAppearance({ ...appearance, ...options })) },
      toJSON() { return normalizeWaterAreaAppearance(appearance) },
    }
    const optics: WaterAreaOptics = {
      ...normalizeWaterAreaOptics(options.optics),
      assign(options) {
        Object.assign(optics.environment, normalizeWaterAreaOptics({
          environment: { ...optics.environment, ...options.environment },
        }).environment)
      },
      toJSON() { return normalizeWaterAreaOptics(optics) },
    }
    this.appearance = appearance
    this.optics = optics
    this.environment = new WaterAreaSkyEnvironment(viewer)
    try {
      this.update({ currentTime: viewer.clock.currentTime, simulationDeltaSeconds: 0 })
      viewer.clock.on('tick', this.update)
    } catch (error) {
      this.destroy()
      throw error
    }
  }

  /** 水域边界来源；赋新值会重新生成掩膜，保留外观。 / Boundary source; assigning it regenerates masks while preserving appearance. */
  get source(): WaterAreaSource { return this.currentSource }
  set source(value: WaterAreaSource) {
    if (this.disposed) throw new Error('WaterArea has been destroyed.')
    const next = validateSource(value)
    if (next === this.currentSource) return
    this.currentSource = next
    this.releasePlugins()
  }

  /** 当前实例的加载统计副本。 / A snapshot of this instance's loading statistics. */
  get status(): WaterAreaStatus {
    return { loadedTiles: this.loaded, waterTiles: this.waterLoaded, failedTiles: this.failed, destroyed: this.disposed }
  }

  /**
   * 释放本实例的材质、掩膜、Worker 与反射纹理；请先于 Viewer 销毁调用。
   * Release this instance's materials, masks, workers and reflections before destroying the Viewer.
   */
  destroy(): void {
    if (this.disposed) return
    this.disposed = true
    this.viewer.clock.off('tick', this.update)
    this.releasePlugins()
    this.environment.dispose()
  }

  private releasePlugins(): void {
    this.generation++
    if (this.tileset === this.viewer.globe.raw) {
      if (this.overlay) this.tileset.unregisterPlugin(this.overlay)
      if (this.material) this.tileset.unregisterPlugin(this.material)
    }
    // 地形重建已由引擎释放旧插件；dispose 幂等，兼容实例主动销毁。
    this.overlay?.dispose()
    this.material?.dispose()
    this.tileset = null
    this.overlay = null
    this.material = null
  }

  private syncTileset(): void {
    const tileset = this.viewer.globe.raw
    if (this.tileset === tileset) return
    this.releasePlugins()
    this.tileset = tileset
    this.loaded = this.waterLoaded = this.failed = 0
    const version = ++this.generation
    const origin = this.viewer.camera.getState().destination
    this.material = new WaterAreaMaterialPlugin(
      this.appearance.toJSON(), createWaterAreaWaveFrame(origin.longitude, origin.latitude),
      createWaterAreaNormalTextures(), this.optics.toJSON(),
    )
    this.overlay = new WaterAreaOverlayPlugin({
      overlays: [new WaterAreaTilesOverlay({
        source: this.currentSource,
        onTile: result => {
          if (version !== this.generation) return
          this.loaded++
          if (result.image || result.solid === 'water') this.waterLoaded++
        },
        onError: () => { if (version === this.generation) this.failed++ },
      })],
      enableTileSplitting: false,
    })
    tileset.registerPlugin(this.material)
    tileset.registerPlugin(this.overlay)
  }

  private readonly update = (event: { currentTime: Date; simulationDeltaSeconds: number }): void => {
    if (this.disposed) return
    this.syncTileset()
    this.material!.appearance.assign(this.appearance.toJSON())
    this.material!.optics.assign(this.optics.toJSON())
    getSunDirectionECEF(event.currentTime, this.sunDirection)
    this.viewer.scene.atmosphere.getWorldToECEFMatrix(this.worldToECEF)
    this.material!.update(event.simulationDeltaSeconds, this.sunDirection, this.worldToECEF)
    this.material!.setEnvironment(this.appearance.show && this.optics.environment.enabled ? this.environment.update(event.currentTime) : null)
  }
}

function validateSource(source: WaterAreaSource): WaterAreaSource {
  if (!source || (source.type !== 'geojson' && source.type !== 'osm')) throw new Error('WaterArea source must be geojson or osm.')
  if (source.type === 'geojson' && (!source.data || typeof source.data !== 'object')) throw new Error('WaterArea requires polygon GeoJSON data.')
  if (source.type === 'osm' && source.url && !['{z}', '{x}', '{y}'].every(token => source.url!.includes(token))) {
    throw new Error('WaterArea OSM URL must contain {z}, {x} and {y}.')
  }
  return source
}
