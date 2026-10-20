import { afterEach, describe, expect, it } from 'vitest'

import { getEarthSceneAssetUrl, earthsceneConfig } from '../config'
import { earthsceneAssetUrls } from '../assets'

describe('getEarthSceneAssetUrl', () => {
  afterEach(() => {
    earthsceneConfig.baseUrl = ''
  })

  it('returns the packaged asset url when baseUrl is empty', () => {
    earthsceneConfig.baseUrl = '   '

    expect(getEarthSceneAssetUrl('stars')).toBe(earthsceneAssetUrls.stars)
  })

  it('resolves the asset filename under the configured baseUrl', () => {
    earthsceneConfig.baseUrl = '/earthscene-assets'

    expect(getEarthSceneAssetUrl('stbn')).toBe('/earthscene-assets/stbn.bin')
  })

  it('keeps a single slash between baseUrl and asset filename', () => {
    earthsceneConfig.baseUrl = '/earthscene-assets/'

    expect(getEarthSceneAssetUrl('shapeDetail')).toBe('/earthscene-assets/shape_detail.bin')
  })
})
