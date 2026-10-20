import type { Viewer } from 'cesium'

/**
 * 已安装的插件及其资源释放入口。
 * An installed plugin and its resource disposal entry point.
 */
export interface InstalledPlugin<T> {
  /** 插件的运行时对象。 / The plugin runtime object. */
  value: T
  /** 释放插件拥有的资源。 / Release resources owned by this plugin. */
  destroy(): void
}

/**
 * 只依赖原生 Cesium Viewer 的可选插件。
 * An optional plugin depending only on a native Cesium Viewer.
 */
export interface CesiumPlugin<T = unknown> {
  /** 同一管理器内唯一的插件标识。 / A plugin identifier unique within its host. */
  readonly id: string
  /** 安装插件；失败时由插件清理部分初始化资源。 / Install; clean up partial initialization on failure. */
  install(viewer: Viewer): InstalledPlugin<T>
}
