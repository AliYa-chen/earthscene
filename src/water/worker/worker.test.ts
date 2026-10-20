import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const compute = vi.hoisted(() => vi.fn())
vi.mock('./tasks/computeWaterAreaTileImage', () => ({ computeWaterAreaTileImage: compute }))

beforeEach(() => {
  vi.resetModules()
  compute.mockReset()
  vi.stubGlobal('onmessage', null)
  vi.stubGlobal('postMessage', vi.fn())
})
afterEach(() => vi.unstubAllGlobals())

async function send(message: unknown) {
  const handler = (globalThis as unknown as { onmessage(event: { data: unknown }): void }).onmessage
  handler({ data: message })
  await Promise.resolve()
}

describe('water worker protocol', () => {
  it('uses the initialized source and transfers ImageBitmap ownership', async () => {
    const image = { close: vi.fn() } as unknown as ImageBitmap
    compute.mockResolvedValue({ image })
    await import('./worker')
    const source = { type: 'geojson', data: { type: 'FeatureCollection', features: [] } }
    await send({ type: 'init', source })
    await send({ type: 'run', id: 7, coordinate: { x: 0, y: 0, z: 0 } })
    expect(compute).toHaveBeenCalledWith({ x: 0, y: 0, z: 0 }, source)
    expect(globalThis.postMessage).toHaveBeenCalledWith({ id: 7, result: { image } }, [image])
  })

  it('returns an error message without forwarding secret URL details', async () => {
    compute.mockRejectedValue(new Error('https://user:secret@maps.invalid/?token=credential'))
    await import('./worker')
    await send({ type: 'init', source: { type: 'osm' } })
    await send({ type: 'run', id: 8, coordinate: { x: 0, y: 0, z: 0 } })
    expect(globalThis.postMessage).toHaveBeenCalledWith({
      id: 8,
      error: { name: 'Error', message: 'Water-area mask could not be generated. Check source data or network access.' },
    })
  })
})
