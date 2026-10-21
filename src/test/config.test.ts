import { afterEach, describe, expect, it } from 'vitest'

import { getEarthSceneAssetUrl, earthsceneConfig } from '../config'
import { earthsceneAssetFileNames, earthsceneAssetUrls } from '../assets'

describe('getEarthSceneAssetUrl', () => {
  afterEach(() => {
    earthsceneConfig.baseUrl = ''
  })

  it('returns the packaged asset url when baseUrl is empty', () => {
    earthsceneConfig.baseUrl = '   '

    expect(getEarthSceneAssetUrl('stars')).toBe(earthsceneAssetUrls.stars)
    expect(getEarthSceneAssetUrl('dracoWasm')).toMatch(/^data:/)
    expect(getEarthSceneAssetUrl('basisWasm')).toMatch(/^data:/)
    expect(getEarthSceneAssetUrl('waterNormal1')).toMatch(/^data:/)
  })

  it('resolves the asset filename under the configured baseUrl', () => {
    earthsceneConfig.baseUrl = '/earthscene-assets'

    expect(getEarthSceneAssetUrl('stbn')).toBe('/earthscene-assets/stbn.bin')
  })

  it('keeps a single slash between baseUrl and asset filename', () => {
    earthsceneConfig.baseUrl = '/earthscene-assets/'

    expect(getEarthSceneAssetUrl('shapeDetail')).toBe('/earthscene-assets/shape_detail.bin')
  })

  it('includes every built-in file in the public resource map', () => {
    expect(Object.keys(earthsceneAssetUrls)).toEqual(Object.keys(earthsceneAssetFileNames))
    expect(earthsceneAssetFileNames).toMatchObject({
      dracoWasm: 'draco/draco_decoder.wasm',
      basisWasm: 'basis/basis_transcoder.wasm',
      waterNormal1: 'water/Water_1_M_Normal.jpg',
      waterNormal2: 'water/Water_2_M_Normal.jpg'
    })
  })
})
