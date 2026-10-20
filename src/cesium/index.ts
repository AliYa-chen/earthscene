import { ESPluginHost } from './ESPluginHost'
import { ESClouds } from './ESClouds'
import { esClouds } from './plugins/esClouds'

export { ESPluginHost, ESClouds, esClouds }
export type { CloudOptions, CloudQuality } from './ESClouds'
export type { CesiumPlugin, InstalledPlugin } from './Plugin'

/**
 * EarthScene 扩展命名空间；只接入已有 Cesium 场景，不创建或替换 Viewer。
 * EarthScene extension namespace; attaches to existing Cesium scenes without creating or replacing a Viewer.
 */
export const ES = { Clouds: ESClouds, PluginHost: ESPluginHost, clouds: esClouds }

export default ES
