import type { Viewer as CesiumViewer } from 'cesium'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ESPluginHost } from './ESPluginHost'
import type { CesiumPlugin } from './Plugin'

const calls: string[] = []
function nativeViewer() {
  return { isDestroyed: () => false, destroy: vi.fn(), scene: {}, camera: {}, clock: {} } as unknown as CesiumViewer
}

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

describe('ESPluginHost ownership', () => {
  beforeEach(() => calls.splice(0))

  it('attaches to the supplied viewer and never owns or changes it', () => {
    const native = nativeViewer()
    const scene = native.scene
    const camera = native.camera
    const clock = native.clock
    const host = new ESPluginHost(native)
    const install = vi.fn(() => ({ value: 42, destroy: vi.fn() }))
    expect(host.use({ id: 'custom', install })).toBe(42)
    expect(install).toHaveBeenCalledWith(native)
    host.destroy()
    expect(native.destroy).not.toHaveBeenCalled()
    expect(native.scene).toBe(scene)
    expect(native.camera).toBe(camera)
    expect(native.clock).toBe(clock)
  })

  it('rejects duplicate installation and disposes remaining plugins in reverse order', () => {
    const native = nativeViewer()
    const host = new ESPluginHost(native, [plugin('a'), plugin('b'), plugin('c')])
    expect(() => host.use(plugin('a'))).toThrow('already installed')
    expect(host.removePlugin('b')).toBe(true)
    expect(host.removePlugin('b')).toBe(false)
    host.destroy()
    host.destroy()
    expect(calls).toEqual(['b', 'c', 'a'])
    expect(native.destroy).not.toHaveBeenCalled()
  })

  it('rolls back plugins after initialization failure while preserving the native scene', () => {
    const native = nativeViewer()
    const bad: CesiumPlugin = { id: 'bad', install: () => { throw new Error('install failed') } }
    expect(() => new ESPluginHost(native, [plugin('a'), bad])).toThrow('install failed')
    expect(calls).toEqual(['a'])
    expect(native.destroy).not.toHaveBeenCalled()
  })

  it('continues plugin cleanup after errors without destroying the native scene', () => {
    const native = nativeViewer()
    const host = new ESPluginHost(native, [plugin('a'), plugin('b', true)])
    expect(() => host.destroy()).toThrow('dispose failed')
    expect(calls).toEqual(['b', 'a'])
    expect(native.destroy).not.toHaveBeenCalled()
    expect(() => host.destroy()).not.toThrow()
    expect(() => host.use(plugin('c'))).toThrow('destroyed')
  })

  it('rejects an already destroyed native viewer', () => {
    const native = nativeViewer()
    vi.spyOn(native, 'isDestroyed').mockReturnValue(true)
    expect(() => new ESPluginHost(native)).toThrow('destroyed Cesium Viewer')
  })
})
