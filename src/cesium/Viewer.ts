import { EllipsoidTerrainProvider, Viewer as CesiumViewer } from 'cesium'
import type { CesiumPlugin, InstalledPlugin } from './Plugin'

/**
 * 保留 Cesium 原生构造选项，额外接收可选插件。
 * Preserve native Cesium constructor options, with optional plugins.
 */
export type ViewerOptions = NonNullable<ConstructorParameters<typeof CesiumViewer>[1]> & {
  /** 初始化时安装的插件。 / Plugins installed during initialization. */
  plugins?: CesiumPlugin[]
}

/**
 * Cesium 迁移适配器：原生能力直接使用 raw，特效按插件安装。
 * A Cesium migration adapter: access native features through raw and install effects as plugins.
 */
export class Viewer {
  /** 原生 Cesium 实例。 / The native Cesium instance. */
  readonly raw: CesiumViewer
  private readonly installed = new Map<string, InstalledPlugin<unknown>>()
  private destroyed = false

  /**
   * 创建 Cesium 场景；默认不请求 Ion 数据，也不自动启用特效。
   * Create a Cesium scene without requesting Ion data or enabling effects by default.
   */
  constructor(container: string | Element, options: ViewerOptions = {}) {
    const { plugins = [], ...nativeOptions } = options
    this.raw = new CesiumViewer(container, {
      baseLayer: false,
      terrainProvider: new EllipsoidTerrainProvider(),
      baseLayerPicker: false,
      geocoder: false,
      ...nativeOptions,
    })
    try {
      for (const plugin of plugins) this.use(plugin)
    } catch (error) {
      try { this.destroy() } catch { /* Preserve the initialization error after cleanup. */ }
      throw error
    }
  }

  /**
   * 安装可选插件并返回运行时对象；同一标识不能重复安装。
   * Install an optional plugin and return its runtime; identifiers cannot be installed twice.
   */
  use<T>(plugin: CesiumPlugin<T>): T {
    if (this.destroyed) throw new Error('Viewer has been destroyed.')
    if (this.installed.has(plugin.id)) throw new Error(`Plugin already installed: ${plugin.id}`)
    const instance = plugin.install(this.raw)
    this.installed.set(plugin.id, instance)
    return instance.value
  }

  /**
   * 移除并释放指定插件，场景本身继续运行。
   * Remove and dispose of a plugin while keeping the scene running.
   */
  removePlugin(id: string): boolean {
    const instance = this.installed.get(id)
    if (!instance) return false
    this.installed.delete(id)
    instance.destroy()
    return true
  }

  /**
   * 先逆序释放插件，再释放原生场景；可以重复调用。
   * Dispose of plugins in reverse order, then destroy the native scene; idempotent.
   */
  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    let disposalError: unknown
    for (const instance of [...this.installed.values()].reverse()) {
      try { instance.destroy() } catch (error) { disposalError ??= error }
    }
    this.installed.clear()
    if (!this.raw.isDestroyed()) this.raw.destroy()
    if (disposalError) throw disposalError
  }
}
