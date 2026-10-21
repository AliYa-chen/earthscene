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
   * 默认资源已随 npm 包内联，消费项目无需部署静态目录。设置后，所有内置纹理和 Draco/Basis 解码资源改从
   * 此目录加载，文件名见 `earthsceneAssetFileNames`。留空时使用包内置资源。
   *
   * Parent directory for EarthScene static assets.
   *
   * Built-in assets are inlined into the npm package by default, so consumers do not need to deploy a static directory.
   * When set, all built-in textures and Draco/Basis decoder resources are loaded from this directory; see
   * `earthsceneAssetFileNames` for the relative file names. Leave it empty to use packaged assets.
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
