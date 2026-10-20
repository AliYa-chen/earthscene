import { earthsceneAssetFileNames, earthsceneAssetUrls, type EarthSceneAssetName } from './assets'

/**
 * EarthScene 全局配置。
 *
 * Global EarthScene configuration.
 */
export interface EarthSceneConfig {
  /**
   * EarthScene 静态资源父级目录。
   *
   * 现代打包器默认会自动打包 EarthScene 内置资源。设置后，内置云、STBN 和星空资源会改从该目录加载
   * `local_weather.png`、`turbulence.png`、`shape.bin`、`shape_detail.bin`、`stbn.bin` 和 `stars.bin`。
   * 留空时使用 EarthScene 包内置资源。
   *
   * Parent directory for EarthScene static assets.
   *
   * Modern bundlers automatically bundle EarthScene built-in assets by default. When set, built-in cloud,
   * STBN, and star field assets are loaded from this directory:
   * `local_weather.png`, `turbulence.png`, `shape.bin`, `shape_detail.bin`, `stbn.bin`, and `stars.bin`.
   * Leave it empty to use EarthScene packaged assets.
   */
  baseUrl: string
}

export const earthsceneConfig: EarthSceneConfig = {
  baseUrl: ''
}

export function getEarthSceneAssetUrl(assetName: EarthSceneAssetName): string {
  const baseUrl = earthsceneConfig.baseUrl.trim()
  if (baseUrl.length === 0) return earthsceneAssetUrls[assetName]

  const fileName = earthsceneAssetFileNames[assetName]
  const separator = baseUrl.endsWith('/') ? '' : '/'
  return `${baseUrl}${separator}${fileName}`
}
