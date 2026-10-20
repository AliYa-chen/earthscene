import { VolumetricClouds, type CloudOptions } from '../VolumetricClouds'
import type { CesiumPlugin } from '../Plugin'

/**
 * 创建可选体积云插件；不替换 Cesium 的地球、相机或原生大气。
 * Create an optional volumetric cloud plugin without replacing Cesium's globe, camera, or atmosphere.
 */
export function volumetricClouds(options: Partial<CloudOptions> = {}): CesiumPlugin<VolumetricClouds> {
  return {
    id: 'volumetric-clouds',
    install(viewer) {
      const value = new VolumetricClouds(viewer, options)
      return { value, destroy: () => value.destroy() }
    },
  }
}
