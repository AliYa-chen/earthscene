import { ImageOverlayPlugin } from '3d-tiles-renderer/plugins'
import { Mesh, type BufferAttribute, type Object3D, type Texture } from 'three'
import { WaterAreaTilesOverlay } from './WaterAreaImageOverlay'
import {
  WATER_AREA_UV_ATTRIBUTE, wrapWaterAreaMaterial, type WaterAreaOverlayParams,
} from './wrapWaterAreaMaterial'

export type { WaterAreaOverlayParams } from './wrapWaterAreaMaterial'
export interface WaterAreaOverlayPluginOptions {
  overlays: WaterAreaTilesOverlay[]
  enableTileSplitting?: boolean
}
type TileLike = { engineData?: { scene?: Object3D | null } }
type OverlayInternals = {
  overlays: WaterAreaTilesOverlay[]
  meshParams: WeakMap<Mesh, WaterAreaOverlayParams>
  pendingTiles: Map<unknown, Object3D>
  tileControllers: Map<unknown, AbortController>
  overlayInfo: Map<WaterAreaTilesOverlay, {
    tileInfo: Map<unknown, { target: Texture | null; meshInfo: Map<Mesh, { attribute: BufferAttribute }> }>
  }>
  tiles?: { recalculateBytesUsed(tile: unknown): void; dispatchEvent(event: { type: string }): void }
}

/** 单独绑定水域掩膜与 UV，不覆盖底图 overlay 的状态。 / Bind independent water masks and UVs without overwriting imagery overlays. */
export class WaterAreaOverlayPlugin extends ImageOverlayPlugin {
  name = 'EARTHSCENE_WATER_AREA_MASK_PLUGIN'
  private readonly waterAreaOverlays: WaterAreaTilesOverlay[]
  private disposed = false
  constructor(options: WaterAreaOverlayPluginOptions) {
    // 底图负责几何拆分，水域只复用其几何。
    super({ ...options, enableTileSplitting: false, resolution: 128 } as unknown as ConstructorParameters<typeof ImageOverlayPlugin>[0])
    this.waterAreaOverlays = options.overlays
  }
  _wrapMaterials(scene: Object3D): void {
    const internals = this as unknown as OverlayInternals
    scene.traverse(object => {
      if (object instanceof Mesh) internals.meshParams.set(object, wrapWaterAreaMaterial(object.material, object))
    })
  }
  processTileModel(scene: Object3D, tile: TileLike): void {
    // 水域是可选外观：外网 mask 挂起或失败都不能阻塞地形 parseQueue。
    void this._processTileModel(scene, tile)
  }
  async _processTileModel(scene: Object3D, tile: TileLike, initialization = false): Promise<void> {
    try {
      await (ImageOverlayPlugin.prototype as unknown as {
        _processTileModel(this: ImageOverlayPlugin, scene: Object3D, tile: TileLike, initialization: boolean): Promise<void>
      })._processTileModel.call(this, scene, tile, initialization)
      if (!this.disposed) (this as unknown as OverlayInternals).tiles?.dispatchEvent({ type: 'needs-render' })
    } catch {
      // 同时覆盖原 init() 对已有模型的直接 _processTileModel 调用，避免未处理 rejection。
      const internals = this as unknown as OverlayInternals
      internals.pendingTiles.delete(tile)
      scene.traverse(object => {
        if (!(object instanceof Mesh)) return
        const params = internals.meshParams.get(object)
        if (params) { params.waterMaskMap.value = null; params.waterMaskReady.value = 0 }
      })
    }
  }
  _updateLayers(tile: TileLike): void {
    const internals = this as unknown as OverlayInternals
    const controller = internals.tileControllers.get(tile)
    if (!controller || controller.signal.aborted) return
    internals.tiles?.recalculateBytesUsed(tile)
    const overlay = this.waterAreaOverlays.find(item => internals.overlays.includes(item))
    const tileInfo = overlay ? internals.overlayInfo.get(overlay)?.tileInfo.get(tile) : undefined
    if (!tileInfo) {
      tile.engineData?.scene?.traverse(object => {
        if (!(object instanceof Mesh)) return
        const params = internals.meshParams.get(object)
        if (params) { params.waterMaskMap.value = null; params.waterMaskReady.value = 0 }
      })
      return
    }
    tileInfo.meshInfo.forEach(({ attribute }, mesh) => {
      const params = internals.meshParams.get(mesh)
      if (!params) return
      if (mesh.geometry.getAttribute(WATER_AREA_UV_ATTRIBUTE) !== attribute) {
        mesh.geometry.setAttribute(WATER_AREA_UV_ATTRIBUTE, attribute)
        mesh.geometry.dispose()
      }
      params.waterMaskMap.value = tileInfo.target
      params.waterMaskReady.value = tileInfo.target ? 1 : 0
      params.waterMaskFlipY.value = typeof ImageBitmap !== 'undefined' && tileInfo.target?.image instanceof ImageBitmap ? 1 : 0
    })
  }
  _removeVirtualChildren(_tile: unknown): void {
    // 底图拥有虚拟节点，水域释放不能删除其它插件创建的节点。
  }
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    ;(ImageOverlayPlugin.prototype as unknown as { dispose(this: ImageOverlayPlugin): void }).dispose.call(this)
    for (const overlay of this.waterAreaOverlays) overlay.dispose()
  }
}
