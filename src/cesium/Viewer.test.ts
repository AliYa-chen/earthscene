import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Viewer } from './Viewer'
import type { CesiumPlugin } from './Plugin'

const calls = vi.hoisted(() => [] as string[])
vi.mock('cesium', () => ({
  EllipsoidTerrainProvider: class {},
  Viewer: class {
    dead = false
    isDestroyed() { return this.dead }
    destroy() { this.dead = true; calls.push('viewer') }
  },
}))

function plugin(id: string, failDispose = false): CesiumPlugin<{ id: string }> {
  return {
    id,
    install: () => ({
      value: { id },
      destroy: () => {
        calls.push(id)
        if (failDispose) throw new Error('dispose failed')
      },
    }),
  }
}

describe('Cesium plugin ownership', () => {
  beforeEach(() => calls.splice(0))

  it('returns the plugin runtime and rejects duplicate installation', () => {
    const viewer = new Viewer('container')
    expect(viewer.use(plugin('clouds'))).toEqual({ id: 'clouds' })
    expect(() => viewer.use(plugin('clouds'))).toThrow('already installed')
    viewer.destroy()
    expect(calls).toEqual(['clouds', 'viewer'])
  })

  it('removes a plugin exactly once and destroys remaining plugins in reverse order', () => {
    const viewer = new Viewer('container', { plugins: [plugin('a'), plugin('b'), plugin('c')] })
    expect(viewer.removePlugin('b')).toBe(true)
    expect(viewer.removePlugin('b')).toBe(false)
    viewer.destroy()
    viewer.destroy()
    expect(calls).toEqual(['b', 'c', 'a', 'viewer'])
  })

  it('rolls back installed plugins and the native viewer when initialization fails', () => {
    const bad: CesiumPlugin = { id: 'bad', install: () => { throw new Error('install failed') } }
    expect(() => new Viewer('container', { plugins: [plugin('a'), bad] })).toThrow('install failed')
    expect(calls).toEqual(['a', 'viewer'])
  })

  it('continues cleanup when one plugin disposer throws', () => {
    const viewer = new Viewer('container', { plugins: [plugin('a'), plugin('b', true)] })
    expect(() => viewer.destroy()).toThrow('dispose failed')
    expect(calls).toEqual(['b', 'a', 'viewer'])
    expect(() => viewer.destroy()).not.toThrow()
    expect(() => viewer.use(plugin('c'))).toThrow('destroyed')
  })
})
