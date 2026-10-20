import type { Viewer } from '../Viewer'
import { SkyMaterial, getMoonDirectionECEF, type StarsMaterial } from '@takram/three-atmosphere'
import {
  CubeCamera, HalfFloatType, LinearMipmapLinearFilter, Mesh,
  PlaneGeometry, Scene, Vector3, WebGLCubeRenderTarget,
  type Material, type Texture, type WebGLRenderer,
} from 'three'

/**
 * 使用场景已有的公开大气材质与 LUT，生成水面天空反射。
 * Generate sky reflections from the scene's existing public atmosphere material and LUTs.
 */
export class WaterAreaSkyEnvironment {
  private readonly scene = new Scene()
  private readonly material = new SkyMaterial({ sun: false, moon: true, ground: false })
  private readonly geometry = new PlaneGeometry(2, 2)
  private readonly target = new WebGLCubeRenderTarget(64, {
    type: HalfFloatType, generateMipmaps: true, minFilter: LinearMipmapLinearFilter,
  })
  private readonly camera = new CubeCamera(1, 100, this.target)
  private readonly previousPosition = new Vector3(Infinity, Infinity, Infinity)
  private readonly moonDirection = new Vector3()
  private lastUpdate = -Infinity
  private previousDate = NaN
  private source: StarsMaterial | null = null
  private ready = false

  constructor(private readonly viewer: Viewer) {
    const mesh = new Mesh(this.geometry, this.material)
    mesh.frustumCulled = false
    this.scene.add(mesh)
  }

  update(time: Date): Texture | null {
    if (!this.viewer.scene.atmosphere.show) return null
    if (!this.source) {
      // 仅从公开 raw scene 检索材质，不访问 Viewer 私有大气管理器。
      this.viewer.scene.raw.traverse(object => {
        const material = (object as Mesh).material
        for (const item of (Array.isArray(material) ? material : [material])) {
          if ((item as Material | undefined)?.name === 'StarsMaterial') this.source = item as StarsMaterial
        }
      })
    }
    const source = this.source
    if (!source?.scatteringTexture || !source.transmittanceTexture || !source.irradianceTexture) return null
    const position = this.viewer.camera.raw.position
    const now = performance.now()
    const dateDelta = Math.abs(time.getTime() - this.previousDate)
    if (this.ready && now - this.lastUpdate < 1000 && dateDelta < 60000 && position.distanceToSquared(this.previousPosition) < 1000000) {
      return this.target.texture
    }
    this.material.scatteringTexture = source.scatteringTexture
    this.material.transmittanceTexture = source.transmittanceTexture
    this.material.irradianceTexture = source.irradianceTexture
    this.material.singleMieScatteringTexture = source.singleMieScatteringTexture
    this.material.higherOrderScatteringTexture = source.higherOrderScatteringTexture
    for (const key of ['ATMOSPHERE', 'SUN_SPECTRAL_RADIANCE_TO_LUMINANCE', 'SKY_SPECTRAL_RADIANCE_TO_LUMINANCE']) {
      this.material.uniforms[key].value = source.uniforms[key].value
    }
    this.material.worldToECEFMatrix.copy(this.viewer.scene.atmosphere.getWorldToECEFMatrix())
    this.material.sunDirection.copy(source.sunDirection)
    this.material.moon = this.viewer.scene.atmosphere.sky.moon
    getMoonDirectionECEF(time, this.moonDirection)
    this.material.moonDirection.copy(this.moonDirection)
    this.camera.position.copy(position)
    // Render targets bypass Three.js canvas post-processing automatically.
    // 不改 setEffects；离屏天空不会重复经过主场景云／大气合成。
    this.camera.update(this.viewer.renderer.raw as WebGLRenderer, this.scene)
    this.previousPosition.copy(position)
    this.previousDate = time.getTime()
    this.lastUpdate = now
    this.ready = true
    return this.target.texture
  }

  dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
    this.target.dispose()
  }
}
