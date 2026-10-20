import * as THREE from 'three'
import { AerialPerspectiveEffect } from '@takram/three-atmosphere'
import { describe, expect, it } from 'vitest'

import { patchAerialPerspectiveShader } from '../rendering/AtmosphereShaderPatches'

function patchedFragment(sunLight: boolean, skyLight: boolean) {
  const effect = new AerialPerspectiveEffect(new THREE.PerspectiveCamera())
  effect.sunLight = sunLight
  effect.skyLight = skyLight
  effect.normalBuffer = new THREE.Texture()
  patchAerialPerspectiveShader(effect, new THREE.Color())
  return (effect as unknown as { getFragmentShader(): string }).getFragmentShader()
}

describe('patchAerialPerspectiveShader point-cloud lighting', () => {
  it('keeps degenerate normals unlit without injecting custom weak lighting', () => {
    const fragmentShader = patchedFragment(true, true)

    expect(fragmentShader).toContain(
      'if (!degenerateNormal) {\n    radiance = getSunSkyIrradiance'
    )
    expect(fragmentShader).toContain(
      '} else {\n    radiance = inputColor.rgb;\n  }'
    )
    expect(fragmentShader).not.toContain('earthscenePointCloudEnvMix')
    expect(fragmentShader).not.toContain('earthscenePointCloudToneMappingExposure')
    expect(fragmentShader).not.toContain('earthscenePointColor')
    expect(fragmentShader).not.toContain('vec3 earthsceneGlobeN =')
    expect(fragmentShader).not.toContain('earthsceneNdotL')
    expect(fragmentShader).toContain(
      'if (!earthsceneUnlitPointCloud) {\n    applyTransmittanceInscatter'
    )
  })

  it('does not guess self-lit pixels from luma', () => {
    const fragmentShader = patchedFragment(true, true)

    expect(fragmentShader).not.toContain('earthsceneSelfLitMask')
    expect(fragmentShader).not.toContain('earthsceneSelfLitRadiance')
    expect(fragmentShader).not.toContain('earthsceneSceneLuma')
  })

  it('does not scale already-lit light-source radiance by dayLightFactor', () => {
    const fragmentShader = patchedFragment(false, false)

    expect(fragmentShader).toContain('earthsceneGlobeLightingMask')
    expect(fragmentShader).toContain(
      'radiance = mix(inputColor.rgb, radiance, earthsceneGlobeLightingMask)'
    )
    expect(fragmentShader).not.toMatch(
      /#endif \/\/ defined\(SUN_LIGHT\) \|\| defined\(SKY_LIGHT\)\s+if \(!degenerateNormal\) \{\s+float earthsceneDayLightFactor/
    )
    expect(fragmentShader).toContain(
      '#if defined(SUN_LIGHT) || defined(SKY_LIGHT)\n  if (!degenerateNormal) {\n    radiance *= earthscenePostProcessDayLightFactor;'
    )
  })

  it('keeps local lighting-mask pixels as inputColor after globe night lighting', () => {
    const fragmentShader = patchedFragment(true, true)

    expect(fragmentShader).toContain('uniform sampler2D earthsceneLightingMaskBuffer;')
    expect(fragmentShader).toContain(
      'float earthsceneGlobeLightingMask = texture(earthsceneLightingMaskBuffer, uv).r;'
    )
    expect(fragmentShader).toContain('earthsceneNightRadiance *= earthsceneGlobeLightingMask;')
  })
})

describe('patchAerialPerspectiveShader sky over unwritten depth', () => {
  it('composites scene color over sky on far-plane pixels instead of replacing it', () => {
    const fragmentShader = patchedFragment(false, false)

    expect(fragmentShader).toContain(
      'outputColor.rgb = inputColor.rgb + outputColor.rgb * (1.0 - inputColor.a);'
    )
    expect(fragmentShader).toContain('outputColor.rgb = getSkyRadiance(')
  })

  it('keeps empty far-plane pixels as sky by using coverage alpha rather than luma', () => {
    const fragmentShader = patchedFragment(false, false)

    expect(fragmentShader).not.toContain('earthsceneSceneLuma')
    expect(fragmentShader).not.toContain('earthsceneSelfLitMask')
    const skyBranch = fragmentShader.slice(
      fragmentShader.indexOf('if (depth >= 1.0 - 1e-8)'),
      fragmentShader.indexOf('depth = reverseLogDepth')
    )
    expect(skyBranch).toContain('inputColor.rgb + outputColor.rgb * (1.0 - inputColor.a)')
    expect(skyBranch).not.toContain('outputColor.rgb = inputColor.rgb;')
  })
})
