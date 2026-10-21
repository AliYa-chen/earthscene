import { afterEach, describe, expect, it } from 'vitest'
import { Texture } from 'three'

import { earthsceneConfig } from '../config'
import { earthsceneAssetUrls } from '../assets'
import { createWaterAreaNormalTextures } from './WaterAreaNormalTexture'

describe('createWaterAreaNormalTextures', () => {
  afterEach(() => {
    earthsceneConfig.baseUrl = ''
  })

  it('uses the inlined package normal maps by default', () => {
    const loadedUrls: string[] = []
    createWaterAreaNormalTextures({
      load: (url) => {
        loadedUrls.push(url)
        return new Texture()
      }
    })

    expect(loadedUrls).toEqual([
      earthsceneAssetUrls.waterNormal1,
      earthsceneAssetUrls.waterNormal2
    ])
    expect(loadedUrls.every((url) => url.startsWith('data:image/jpeg;base64,'))).toBe(true)
  })

  it('applies a configured baseUrl when textures are created', () => {
    earthsceneConfig.baseUrl = 'https://cdn.example.test/earthscene-assets/'
    const loadedUrls: string[] = []

    createWaterAreaNormalTextures({
      load: (url) => {
        loadedUrls.push(url)
        return new Texture()
      }
    })

    expect(loadedUrls).toEqual([
      'https://cdn.example.test/earthscene-assets/water/Water_1_M_Normal.jpg',
      'https://cdn.example.test/earthscene-assets/water/Water_2_M_Normal.jpg'
    ])
  })
})
