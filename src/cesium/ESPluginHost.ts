import type { Viewer as CesiumViewer } from 'cesium'
import type { CesiumPlugin, InstalledPlugin } from './Plugin'

/**
 * 管理已有 Cesium Viewer 上的 EarthScene 扩展，不拥有原生场景。
 * Manage EarthScene extensions attached to an existing Cesium Viewer without owning the scene.
 */
export class ESPluginHost {
  private readonly installed = new Map<string, InstalledPlugin<unknown>>()
  private destroyed = false

  /**
   * 关联应用提供的原生 Viewer；初始化失败只释放已经安装的插件。
   * Attach to an application-owned native Viewer; failed initialization disposes only installed plugins.
   */
  constructor(
    readonly cesiumViewer: CesiumViewer,
    plugins: readonly CesiumPlugin[] = [],
  ) {
    if (cesiumViewer.isDestroyed()) throw new Error('Cannot attach to a destroyed Cesium Viewer.')
    try {
      for (const plugin of plugins) this.use(plugin)
    } catch (error) {
      try { this.destroy() } catch { /* Preserve the initialization error after cleanup. */ }
      throw error
    }
  }

  /**
   * 安装插件并返回其运行时对象；同一标识不能重复安装。
   * Install a plugin and return its runtime object; identifiers cannot be installed twice.
   */
  use<T>(plugin: CesiumPlugin<T>): T {
    if (this.destroyed) throw new Error('ESPluginHost has been destroyed.')
    if (this.cesiumViewer.isDestroyed()) throw new Error('Cesium Viewer has been destroyed.')
    if (this.installed.has(plugin.id)) throw new Error(`Plugin already installed: ${plugin.id}`)
    const instance = plugin.install(this.cesiumViewer)
    this.installed.set(plugin.id, instance)
    return instance.value
  }

  /**
   * 移除并释放指定插件，原生 Viewer 继续运行。
   * Remove and dispose of a plugin while the native Viewer continues running.
   */
  removePlugin(id: string): boolean {
    const instance = this.installed.get(id)
    if (!instance) return false
    this.installed.delete(id)
    instance.destroy()
    return true
  }

  /**
   * 逆序释放所有插件；不会销毁、暂停或修改原生 Viewer，可以重复调用。
   * Dispose of all plugins in reverse order; never destroy, pause, or modify the native Viewer. Idempotent.
   */
  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    let disposalError: unknown
    for (const instance of [...this.installed.values()].reverse()) {
      try { instance.destroy() } catch (error) { disposalError ??= error }
    }
    this.installed.clear()
    if (disposalError) throw disposalError
  }
}
