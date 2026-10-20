import { Cartesian3, Ellipsoid, Event, SceneMode, PostProcessStage, PostProcessStageComposite, OrthographicFrustum, type Viewer } from 'cesium'
import { describe, expect, it, vi } from 'vitest'
import { ESClouds, type CloudQuality } from './ESClouds'

function nativeViewer() {
  const stages: PostProcessStageComposite[] = []
  const postUpdate = new Event()
  const requestRender = vi.fn()
  let dead = false
  const viewer = {
    isDestroyed: () => dead,
    scene: {
      globe: { ellipsoid: Ellipsoid.WGS84 },
      mode: SceneMode.SCENE3D,
      drawingBufferWidth: 1200,
      drawingBufferHeight: 800,
      postUpdate,
      requestRender,
      postProcessStages: {
        add(stage: PostProcessStageComposite) { stages.push(stage); return stage },
        remove(stage: PostProcessStageComposite) {
          const index = stages.indexOf(stage)
          if (index < 0) return false
          stages.splice(index, 1)
          stage.destroy()
          return true
        },
      },
    },
    camera: {
      positionWC: Cartesian3.fromDegrees(103.58, 31.05, 1600),
      positionCartographic: { height: 1600 },
    },
  }
  return { viewer: viewer as unknown as Viewer, stages, postUpdate, requestRender, markDead: () => { dead = true } }
}

describe('ESClouds lifecycle', () => {
  it('bounds invalid runtime options and rejects inherited quality names', () => {
    const fake = nativeViewer()
    const clouds = new ESClouds(fake.viewer, {
      coverage: 0, altitude: Number.NaN, thickness: -1, quality: 'constructor' as CloudQuality,
    })
    expect(clouds.options).toMatchObject({ coverage: 0, altitude: 2500, thickness: 50, quality: 'medium' })
    expect(() => clouds.setQuality('toString' as CloudQuality)).toThrow(RangeError)
    clouds.destroy()
  })

  it('adjusts quality without rebuilding or reordering application stages', () => {
    const fake = nativeViewer()
    const makeStage = (name: string) => new PostProcessStageComposite({
      name,
      stages: [new PostProcessStage({ fragmentShader: 'void main() { out_FragColor = vec4(1.0); }' })],
    })
    const before = makeStage('application-before')
    const after = makeStage('application-after')
    fake.stages.push(before)
    const clouds = new ESClouds(fake.viewer)
    const first = fake.stages[1]
    fake.stages.push(after)
    clouds.setQuality('high')
    fake.postUpdate.raiseEvent()
    expect(fake.stages).toEqual([before, first, after])
    expect(first.isDestroyed()).toBe(false)
    expect(fake.requestRender).toHaveBeenCalled()
    clouds.destroy()
    expect(fake.stages).toEqual([before, after])
    expect(before.isDestroyed()).toBe(false)
    expect(after.isDestroyed()).toBe(false)
    expect(fake.postUpdate.numberOfListeners).toBe(0)
    expect(() => clouds.destroy()).not.toThrow()
    before.destroy()
    after.destroy()
  })

  it('does not overwrite native scene settings, methods, or caller resources', () => {
    const fake = nativeViewer()
    const scene = fake.viewer.scene
    const existingListener = vi.fn()
    const removeListener = scene.postUpdate.addEventListener(existingListener)
    const requestRender = scene.requestRender
    const nativeDestroy = vi.fn()
    Object.assign(fake.viewer, { destroy: nativeDestroy })
    Object.assign(scene, {
      requestRenderMode: true,
      highDynamicRange: true,
      fog: Object.freeze({ enabled: true, density: 0.0005 }),
      skyAtmosphere: Object.freeze({ show: true }),
    })
    Object.freeze(fake.viewer.camera)
    Object.freeze(scene.globe)
    Object.freeze(scene)
    const clouds = new ESClouds(fake.viewer)
    clouds.options.enabled = false
    fake.postUpdate.raiseEvent()
    clouds.destroy()
    expect(scene.requestRender).toBe(requestRender)
    expect(scene.postUpdate.numberOfListeners).toBe(1)
    expect(existingListener).toHaveBeenCalledOnce()
    expect(nativeDestroy).not.toHaveBeenCalled()
    removeListener()
  })

  it('wakes explicit-render scenes when options change but lets stationary clouds settle', () => {
    const fake = nativeViewer()
    const clouds = new ESClouds(fake.viewer, { windSpeed: 0 })
    fake.requestRender.mockClear()
    fake.postUpdate.raiseEvent()
    expect(fake.requestRender).not.toHaveBeenCalled()
    clouds.options.coverage = 0.7
    fake.postUpdate.raiseEvent()
    expect(fake.requestRender).toHaveBeenCalledOnce()
    clouds.options.enabled = false
    fake.postUpdate.raiseEvent()
    expect(fake.stages[0].enabled).toBe(false)
    clouds.destroy()
  })

  it('disables cloud passes in 2D and resumes them in 3D', () => {
    const fake = nativeViewer()
    const clouds = new ESClouds(fake.viewer)
    fake.viewer.scene.mode = SceneMode.SCENE2D
    fake.postUpdate.raiseEvent()
    expect(fake.stages[0].enabled).toBe(false)
    fake.viewer.scene.mode = SceneMode.SCENE3D
    fake.postUpdate.raiseEvent()
    expect(fake.stages[0].enabled).toBe(true)
    clouds.destroy()
  })

  it('leaves a native orthographic camera untouched and disables the perspective effect', () => {
    const fake = nativeViewer()
    const frustum = new OrthographicFrustum({ width: 1000, aspectRatio: 1 })
    fake.viewer.camera.frustum = frustum
    const clouds = new ESClouds(fake.viewer)
    expect(fake.stages[0].enabled).toBe(false)
    expect(fake.viewer.camera.frustum).toBe(frustum)
    clouds.destroy()
  })
})
