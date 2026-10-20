import { Cartesian3, Ellipsoid, Event, SceneMode, type Viewer, type PostProcessStageComposite } from 'cesium'
import { describe, expect, it, vi } from 'vitest'
import { VolumetricClouds, type CloudQuality } from './VolumetricClouds'

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

describe('VolumetricClouds lifecycle', () => {
  it('bounds invalid runtime options and rejects inherited quality names', () => {
    const fake = nativeViewer()
    const clouds = new VolumetricClouds(fake.viewer, {
      coverage: 0, altitude: Number.NaN, thickness: -1, quality: 'constructor' as CloudQuality,
    })
    expect(clouds.options).toMatchObject({ coverage: 0, altitude: 2500, thickness: 50, quality: 'medium' })
    expect(() => clouds.setQuality('toString' as CloudQuality)).toThrow(RangeError)
    clouds.destroy()
  })

  it('rebuilds only the cloud pipeline on quality changes and releases the old pipeline', () => {
    const fake = nativeViewer()
    const clouds = new VolumetricClouds(fake.viewer)
    const first = fake.stages[0]
    clouds.setQuality('high')
    fake.postUpdate.raiseEvent()
    expect(fake.stages).toHaveLength(1)
    expect(fake.stages[0]).not.toBe(first)
    expect(first.isDestroyed()).toBe(true)
    expect(fake.requestRender).toHaveBeenCalled()
    clouds.destroy()
    expect(fake.stages).toHaveLength(0)
    expect(fake.postUpdate.numberOfListeners).toBe(0)
    expect(() => clouds.destroy()).not.toThrow()
  })

  it('wakes explicit-render scenes when options change but lets stationary clouds settle', () => {
    const fake = nativeViewer()
    const clouds = new VolumetricClouds(fake.viewer, { windSpeed: 0 })
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
    const clouds = new VolumetricClouds(fake.viewer)
    fake.viewer.scene.mode = SceneMode.SCENE2D
    fake.postUpdate.raiseEvent()
    expect(fake.stages[0].enabled).toBe(false)
    fake.viewer.scene.mode = SceneMode.SCENE3D
    fake.postUpdate.raiseEvent()
    expect(fake.stages[0].enabled).toBe(true)
    clouds.destroy()
  })
})
