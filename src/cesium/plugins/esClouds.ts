import { ESClouds, type CloudOptions } from '../ESClouds'
import type { CesiumPlugin } from '../Plugin'

/**
 * 创建可选体积云插件；不替换 Cesium 的地球、相机或原生大气。
 * Create an optional volumetric cloud plugin without replacing Cesium's globe, camera, or atmosphere.
 */
export function esClouds(options: Partial<CloudOptions> = {}): CesiumPlugin<ESClouds> {
  return {
    id: 'earthscene:clouds',
    install(viewer) {
      const value = new ESClouds(viewer, options)
      return { value, destroy: () => value.destroy() }
    },
  }
}
