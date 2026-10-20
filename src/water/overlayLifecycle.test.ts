import { describe, expect, it, vi } from 'vitest'
import { EventDispatcher } from 'three'
import type { TilesRenderer } from '3d-tiles-renderer'
import type { WaterAreaTilesOverlay } from './WaterAreaImageOverlay'
import { WaterAreaOverlayPlugin } from './WaterAreaOverlayPlugin'

function fixture() {
  const events = new EventDispatcher<{
    'tile-visibility-change': { tile: object; visible: boolean }
    'update-after': Record<string, never>
    'tile-download-start': { tile: object; url: string }
  }>()
  const tiles = Object.assign(events, {
    forEachLoadedModel: vi.fn(),
    visibleTiles: new Set(),
    downloadQueue: { priorityCallback: () => 0 },
    recalculateBytesUsed: vi.fn(),
  })
  const plugin = new WaterAreaOverlayPlugin({ overlays: [] })
  plugin.init(tiles as unknown as TilesRenderer)
  const internals = plugin as unknown as {
    overlayInfo: Map<WaterAreaTilesOverlay, { tileInfo: Map<object, { range: number[] | null }> }>
  }
  const region = vi.fn()
  const overlay = { setRegionVisible: region } as unknown as WaterAreaTilesOverlay
  const tileInfo = new Map<object, { range: number[] | null }>()
  internals.overlayInfo.set(overlay, { tileInfo })
  return { plugin, tiles, tileInfo, region }
}

describe('water overlay visibility lifecycle', () => {
  it('ignores late fade events for disposed tiles and tiles whose range is not ready', () => {
    const { plugin, tiles, tileInfo, region } = fixture()
    const tile = {}
    expect(() => tiles.dispatchEvent({ type: 'tile-visibility-change', tile, visible: false })).not.toThrow()
    tileInfo.set(tile, { range: null })
    expect(() => tiles.dispatchEvent({ type: 'tile-visibility-change', tile, visible: true })).not.toThrow()
    const range = [0, 0, 1, 1]
    tileInfo.set(tile, { range })
    tiles.dispatchEvent({ type: 'tile-visibility-change', tile, visible: true })
    expect(region).toHaveBeenCalledTimes(1)
    expect(region).toHaveBeenCalledWith(range, true)
    tileInfo.delete(tile)
    expect(() => tiles.dispatchEvent({ type: 'tile-visibility-change', tile, visible: false })).not.toThrow()
    expect(region).toHaveBeenCalledTimes(1)
    plugin.dispose()
  })

  it('lets parent disposal remove the replacement listener and remains idempotent', () => {
    const { plugin, tiles, tileInfo, region } = fixture()
    const tile = {}
    tileInfo.set(tile, { range: [0, 0, 1, 1] })
    plugin.dispose()
    plugin.dispose()
    tiles.dispatchEvent({ type: 'tile-visibility-change', tile, visible: false })
    expect(region).not.toHaveBeenCalled()
  })
})
