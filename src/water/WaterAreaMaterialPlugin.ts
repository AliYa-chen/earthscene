import {
  Camera, Color, Matrix3, Matrix4, Mesh, Vector3,
  type IUniform, type Object3D, type Texture,
} from 'three'
import type { TilesRenderer } from '3d-tiles-renderer'
import {
  normalizeWaterAreaAppearance,
  type ResolvedWaterAreaAppearance,
  type WaterAreaAppearance,
  type WaterAreaAppearanceOptions,
} from './WaterAreaAppearance'
import {
  normalizeWaterAreaOptics,
  type ResolvedWaterAreaOptics,
  type WaterAreaOptics,
  type WaterAreaOpticsOptions,
} from './WaterAreaOptics'
import { createWaterAreaNormalTextures, type WaterAreaNormalTextures } from './WaterAreaNormalTexture'
import { advanceValveWaterFlowPhase } from './WaterAreaFlow'
import {
  createWaterAreaWaveFrame,
  DEFAULT_WATER_AREA_WAVE_ORIGIN,
  type WaterAreaWaveFrame,
} from './WaterAreaWaveFrame'
import { wrapWaterAreaMaterial } from './wrapWaterAreaMaterial'

/** WebGL 水面状态，与原案例共用参数。 / WebGL water state sharing the original options. */
export class WaterAreaEffect implements WaterAreaAppearance {
  readonly uniforms: Record<string, IUniform>
  readonly optics: WaterAreaOptics
  private state: ResolvedWaterAreaAppearance
  private opticsState: ResolvedWaterAreaOptics
  private readonly cleanups = new Map<Mesh, Set<() => void>>()
  private readonly ecefToWorld = new Matrix4()
  private readonly ecefToView = new Matrix4()
  private readonly viewToECEF = new Matrix4()
  private readonly sunECEF = new Vector3(1, 0, 0)
  private disposed = false

  constructor(
    options: WaterAreaAppearanceOptions,
    readonly waveFrame: WaterAreaWaveFrame,
    readonly normalTextures: WaterAreaNormalTextures,
    opticsOptions: WaterAreaOpticsOptions,
  ) {
    this.state = normalizeWaterAreaAppearance(options)
    this.opticsState = normalizeWaterAreaOptics(opticsOptions)
    this.uniforms = {
      waterWeight: { value: 1 }, waterColor: { value: new Color() },
      waterColorMix: { value: 0 }, waterRoughness: { value: 0 },
      waterWaveStrength: { value: 0 }, waterWaveScale: { value: 1 },
      waterWaveDirection: { value: 0 }, waterFlowPhase: { value: 0 },
      waterNormal0: { value: normalTextures[0] }, waterNormal1: { value: normalTextures[1] },
      waterOriginView: { value: new Vector3() },
      waterEastView: { value: new Vector3(1, 0, 0) },
      waterNorthView: { value: new Vector3(0, 1, 0) },
      waterSunView: { value: new Vector3(0, 1, 0) },
      waterViewToWorld: { value: new Matrix3() },
      waterViewToECEF: { value: new Matrix3() },
      waterECEFToView: { value: new Matrix3() },
      waterCameraECEF: { value: new Vector3() },
      waterEnvironment: { value: null }, waterEnvironmentWeight: { value: 0 },
      waterSunIntensity: { value: 0.65 },
    }
    const owner = this
    this.optics = {
      environment: {
        get enabled() { return owner.opticsState.environment.enabled },
        set enabled(value: boolean) { owner.assignOptics({ environment: { enabled: value } }) },
        get intensity() { return owner.opticsState.environment.intensity },
        set intensity(value: number) { owner.assignOptics({ environment: { intensity: value } }) },
      },
      assign(options) { owner.assignOptics(options) },
      toJSON() { return { environment: { ...owner.opticsState.environment } } },
    }
    this.syncAppearance()
  }

  get show() { return this.state.show }
  set show(value: boolean) { this.assign({ show: value }) }
  get color() { return this.state.color }
  set color(value: string) { this.assign({ color: value }) }
  get colorMix() { return this.state.colorMix }
  set colorMix(value: number) { this.assign({ colorMix: value }) }
  get roughness() { return this.state.roughness }
  set roughness(value: number) { this.assign({ roughness: value }) }
  get waveStrength() { return this.state.waveStrength }
  set waveStrength(value: number) { this.assign({ waveStrength: value }) }
  get waveScale() { return this.state.waveScale }
  set waveScale(value: number) { this.assign({ waveScale: value }) }
  get waveSpeed() { return this.state.waveSpeed }
  set waveSpeed(value: number) { this.assign({ waveSpeed: value }) }
  get waveDirection() { return this.state.waveDirection }
  set waveDirection(value: number) { this.assign({ waveDirection: value }) }

  assign(options: WaterAreaAppearanceOptions): void {
    this.state = normalizeWaterAreaAppearance({ ...this.state, ...options })
    this.syncAppearance()
  }
  toJSON(): ResolvedWaterAreaAppearance { return { ...this.state } }

  /** 接入外部管理的线性 HDR 天空 cubemap；不取得纹理所有权。 / Bind an externally owned linear HDR sky cubemap. */
  setEnvironment(texture: Texture | null): void {
    if (texture && !(texture as Texture & { isCubeTexture?: boolean }).isCubeTexture) {
      throw new Error('Water sky environment must be a CubeTexture.')
    }
    this.uniforms.waterEnvironment.value = texture
    this.syncEnvironment()
  }

  /** 按真实帧间隔推进波纹，太阳方向使用 ECEF。 / Advance waves with real frame time and an ECEF sun direction. */
  update(deltaSeconds: number, sunDirectionECEF?: Vector3, worldToECEF?: Matrix4): void {
    if (this.disposed) return
    this.uniforms.waterFlowPhase.value = advanceValveWaterFlowPhase(
      this.uniforms.waterFlowPhase.value as number,
      Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0,
      this.waveSpeed,
    )
    if (sunDirectionECEF) this.setSunDirection(sunDirectionECEF)
    if (worldToECEF) this.ecefToWorld.copy(worldToECEF).invert()
  }

  /** 更新 ECEF 太阳单位向量。 / Update the ECEF sun unit vector. */
  setSunDirection(direction: Vector3): void {
    if (direction.lengthSq() > 0) this.sunECEF.copy(direction).normalize()
  }

  /** 每个 Mesh 绘制前同步相机，避免 ECEF 大坐标波纹抖动。 / Sync camera per mesh draw to avoid wave jitter at ECEF magnitudes. */
  syncCamera(camera: Camera): void {
    this.ecefToView.multiplyMatrices(camera.matrixWorldInverse, this.ecefToWorld)
    this.viewToECEF.copy(this.ecefToView).invert()
    ;(this.uniforms.waterOriginView.value as Vector3).copy(this.waveFrame.originECEF).applyMatrix4(this.ecefToView)
    ;(this.uniforms.waterEastView.value as Vector3).copy(this.waveFrame.eastECEF).transformDirection(this.ecefToView)
    ;(this.uniforms.waterNorthView.value as Vector3).copy(this.waveFrame.northECEF).transformDirection(this.ecefToView)
    ;(this.uniforms.waterSunView.value as Vector3).copy(this.sunECEF).transformDirection(this.ecefToView)
    ;(this.uniforms.waterViewToWorld.value as Matrix3).setFromMatrix4(camera.matrixWorld)
    ;(this.uniforms.waterViewToECEF.value as Matrix3).setFromMatrix4(this.viewToECEF)
    ;(this.uniforms.waterECEFToView.value as Matrix3).setFromMatrix4(this.ecefToView)
    ;(this.uniforms.waterCameraECEF.value as Vector3).setFromMatrixPosition(this.viewToECEF)
  }
  registerCleanup(mesh: Mesh, cleanup: () => void): void {
    let callbacks = this.cleanups.get(mesh)
    if (!callbacks) {
      callbacks = new Set()
      this.cleanups.set(mesh, callbacks)
    }
    callbacks.add(cleanup)
  }
  releaseMesh(mesh: Mesh): void {
    const callbacks = this.cleanups.get(mesh)
    if (!callbacks) return
    this.cleanups.delete(mesh)
    for (const cleanup of callbacks) cleanup()
  }
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.uniforms.waterWeight.value = 0
    for (const mesh of this.cleanups.keys()) this.releaseMesh(mesh)
    for (const texture of this.normalTextures) texture.dispose()
    this.uniforms.waterEnvironment.value = null
  }

  private assignOptics(options: WaterAreaOpticsOptions): void {
    this.opticsState = normalizeWaterAreaOptics({
      environment: { ...this.opticsState.environment, ...options.environment },
    })
    this.syncEnvironment()
  }
  private syncEnvironment(): void {
    this.uniforms.waterEnvironmentWeight.value = this.opticsState.environment.enabled && this.uniforms.waterEnvironment.value
      ? this.opticsState.environment.intensity : 0
  }
  private syncAppearance(): void {
    this.uniforms.waterWeight.value = this.show ? 1 : 0
    ;(this.uniforms.waterColor.value as Color).set(this.color)
    this.uniforms.waterColorMix.value = this.colorMix
    this.uniforms.waterRoughness.value = this.roughness
    this.uniforms.waterWaveStrength.value = this.waveStrength
    this.uniforms.waterWaveScale.value = this.waveScale
    this.uniforms.waterWaveDirection.value = this.waveDirection * Math.PI / 180
  }
}

/** 在当前地形原材质后追加水面外观，保留影像与大气后处理。 / Append water shading to terrain materials, preserving imagery and atmosphere. */
export class WaterAreaMaterialPlugin {
  readonly name = 'EARTHSCENE_WATER_AREA_MATERIAL_PLUGIN'
  // 原地形材质、影像和昼夜 hook 就绪后再追加。
  readonly priority = -5
  private readonly effect: WaterAreaEffect
  constructor(
    options: WaterAreaAppearanceOptions = {},
    waveFrame = createWaterAreaWaveFrame(DEFAULT_WATER_AREA_WAVE_ORIGIN.longitude, DEFAULT_WATER_AREA_WAVE_ORIGIN.latitude),
    normalTextures = createWaterAreaNormalTextures(),
    opticsOptions: WaterAreaOpticsOptions = {},
  ) { this.effect = new WaterAreaEffect(options, waveFrame, normalTextures, opticsOptions) }
  get appearance(): WaterAreaEffect { return this.effect }
  get optics(): WaterAreaOptics { return this.effect.optics }
  get show(): boolean { return this.effect.show }
  set show(value: boolean) { this.effect.show = value }
  setEnvironment(texture: Texture | null): void { this.effect.setEnvironment(texture) }
  setSunDirection(direction: Vector3): void { this.effect.setSunDirection(direction) }
  update(deltaSeconds: number, sunDirectionECEF?: Vector3, worldToECEF?: Matrix4): void {
    this.effect.update(deltaSeconds, sunDirectionECEF, worldToECEF)
  }
  init(tiles: TilesRenderer): void { tiles.forEachLoadedModel(scene => this.processTileModel(scene)) }
  processTileModel(scene: Object3D): void {
    scene.traverse(object => {
      if (object instanceof Mesh) wrapWaterAreaMaterial(object.material, object, this.effect)
    })
  }
  disposeTile(tile: { engineData?: { scene?: Object3D | null } }): void {
    // 瓦片从 LRU 释放时立即解除闭包引用，不能等到整个水域实例销毁。
    tile.engineData?.scene?.traverse(object => {
      if (object instanceof Mesh) this.effect.releaseMesh(object)
    })
  }
  dispose(): void { this.effect.dispose() }
}
