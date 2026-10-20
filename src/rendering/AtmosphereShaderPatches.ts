import * as THREE from 'three'
import type { CloudsEffect } from '@takram/three-clouds'
import type { AerialPerspectiveEffect, StarsMaterial } from '@takram/three-atmosphere'

export const INSCATTER_INTENSITY_UNIFORM = 'earthsceneInscatterIntensity'
export const INSCATTER_HORIZON_BLEND_UNIFORM = 'earthsceneInscatterHorizonBlend'
export const INSCATTER_HORIZON_RANGE_UNIFORM = 'earthsceneInscatterHorizonRange'
export const POST_PROCESS_NIGHT_MOON_INTENSITY_UNIFORM = 'earthscenePostProcessNightMoonIntensity'
export const POST_PROCESS_NIGHT_AMBIENT_INTENSITY_UNIFORM = 'earthscenePostProcessNightAmbientIntensity'
export const POST_PROCESS_NIGHT_COLOR_UNIFORM = 'earthscenePostProcessNightColor'
export const POST_PROCESS_NIGHT_SKY_INTENSITY_UNIFORM = 'earthscenePostProcessNightSkyIntensity'
export const POST_PROCESS_NIGHT_MOON_GLOW_INTENSITY_UNIFORM = 'earthscenePostProcessNightMoonGlowIntensity'
export const POST_PROCESS_DAY_LIGHT_FACTOR_UNIFORM = 'earthscenePostProcessDayLightFactor'
export const LIGHTING_MASK_BUFFER_UNIFORM = 'earthsceneLightingMaskBuffer'
export const CLOUDS_NIGHT_MOON_INTENSITY_UNIFORM = 'earthsceneCloudsNightMoonIntensity'
export const CLOUDS_NIGHT_AMBIENT_INTENSITY_UNIFORM = 'earthsceneCloudsNightAmbientIntensity'
export const CLOUDS_NIGHT_COLOR_UNIFORM = 'earthsceneCloudsNightColor'
export const CLOUDS_NIGHT_MOON_DIRECTION_UNIFORM = 'earthsceneCloudsNightMoonDirection'
export const CLOUDS_DAY_LIGHT_FACTOR_UNIFORM = 'earthsceneCloudsDayLightFactor'
export const STARS_DAY_LIGHT_FACTOR_UNIFORM = 'earthsceneStarsDayLightFactor'

interface PatchableEffectShader {
  getFragmentShader(): string
  setFragmentShader(fragmentShader: string): void
  setChanged(): void
}

interface PatchableShaderMaterial {
  fragmentShader: string
  uniforms: Record<string, THREE.Uniform>
  needsUpdate: boolean
}

type DynamicUniforms = Map<string, THREE.Uniform>

let defaultLightingMaskTexture: THREE.DataTexture | null = null

function getDefaultLightingMaskTexture() {
  if (!defaultLightingMaskTexture) {
    defaultLightingMaskTexture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
    defaultLightingMaskTexture.needsUpdate = true
  }
  return defaultLightingMaskTexture
}

export function getEffectUniform<T>(effect: AerialPerspectiveEffect, name: string) {
  return ((effect.uniforms as unknown as DynamicUniforms).get(name) ?? null) as THREE.Uniform<T> | null
}

export function getCloudsMaterialUniform(cloudsEffect: CloudsEffect, name: string) {
  const material = cloudsEffect.cloudsPass.currentMaterial as unknown as PatchableShaderMaterial
  return material.uniforms[name] ?? null
}

export function getStarsMaterialUniform(starsMaterial: StarsMaterial, name: string) {
  const material = starsMaterial as unknown as PatchableShaderMaterial
  return material.uniforms[name] ?? null
}

export function patchStarsRendering(starsMaterial: StarsMaterial) {
  const material = starsMaterial as unknown as PatchableShaderMaterial
  material.uniforms[STARS_DAY_LIGHT_FACTOR_UNIFORM] = new THREE.Uniform(1)

  if (material.fragmentShader.includes(STARS_DAY_LIGHT_FACTOR_UNIFORM)) return

  const withUniform = material.fragmentShader.replace(
    'uniform vec3 sunDirection;',
    [
      'uniform vec3 sunDirection;',
      `uniform float ${STARS_DAY_LIGHT_FACTOR_UNIFORM};`
    ].join('\n')
  )
  if (withUniform === material.fragmentShader) {
    console.warn('EarthScene stars shader patch failed: uniform hook was not found.')
    material.needsUpdate = true
    return
  }

  const withPointMask = withUniform.replace(
    'in vec3 vColor;\n\nvoid main() {',
    [
      'in vec3 vColor;',
      '',
      'void main() {',
      '  vec2 earthsceneStarPoint = gl_PointCoord * 2.0 - 1.0;',
      '  float earthsceneStarPointRadius = dot(earthsceneStarPoint, earthsceneStarPoint);',
      '  if (earthsceneStarPointRadius > 1.0) {',
      '    discard;',
      `  }`,
      '  float earthsceneStarSoftMask = 1.0 - smoothstep(0.18, 1.0, earthsceneStarPointRadius);',
      '  float earthsceneStarBrightness = max(max(vColor.r, vColor.g), vColor.b);',
      '  float earthsceneStarVisibility = smoothstep(0.006, 0.035, earthsceneStarBrightness);',
      '  if (earthsceneStarVisibility <= 0.0) {',
      '    discard;',
      '  }',
      '  vec3 earthsceneStarColor = vec3(1.0) * earthsceneStarSoftMask * (0.75 + 0.75 * earthsceneStarVisibility);'
    ].join('\n')
  )
  if (withPointMask === withUniform) {
    console.warn('EarthScene stars shader patch failed: point mask hook was not found.')
    material.needsUpdate = true
    return
  }

  const withBackgroundStarColor = withPointMask.replace(
    '  radiance += transmittance * vColor;',
    [
      `  radiance *= ${STARS_DAY_LIGHT_FACTOR_UNIFORM};`,
      `  radiance += mix(vec3(1.0), transmittance, ${STARS_DAY_LIGHT_FACTOR_UNIFORM}) * earthsceneStarColor;`
    ].join('\n')
  )
  if (withBackgroundStarColor === withPointMask) {
    console.warn('EarthScene stars shader patch failed: background color hook was not found.')
    material.needsUpdate = true
    return
  }

  const patchedShader = withBackgroundStarColor.replace(
    '  outputColor = vec4(vColor, 1.0);',
    '  outputColor = vec4(earthsceneStarColor, 1.0);'
  )

  material.fragmentShader = patchedShader
  material.needsUpdate = true
}

export function patchAerialPerspectiveShader(effect: AerialPerspectiveEffect, nightColor: THREE.Color) {
  const uniforms = effect.uniforms as unknown as DynamicUniforms
  uniforms.set(INSCATTER_INTENSITY_UNIFORM, new THREE.Uniform(1))
  uniforms.set(INSCATTER_HORIZON_BLEND_UNIFORM, new THREE.Uniform(1))
  uniforms.set(INSCATTER_HORIZON_RANGE_UNIFORM, new THREE.Uniform(new THREE.Vector2(0, 0.6)))
  uniforms.set(POST_PROCESS_NIGHT_MOON_INTENSITY_UNIFORM, new THREE.Uniform(0))
  uniforms.set(POST_PROCESS_NIGHT_AMBIENT_INTENSITY_UNIFORM, new THREE.Uniform(0))
  uniforms.set(POST_PROCESS_NIGHT_COLOR_UNIFORM, new THREE.Uniform(nightColor.clone()))
  uniforms.set(POST_PROCESS_NIGHT_SKY_INTENSITY_UNIFORM, new THREE.Uniform(0))
  uniforms.set(POST_PROCESS_NIGHT_MOON_GLOW_INTENSITY_UNIFORM, new THREE.Uniform(0))
  uniforms.set(POST_PROCESS_DAY_LIGHT_FACTOR_UNIFORM, new THREE.Uniform(1))
  uniforms.set(LIGHTING_MASK_BUFFER_UNIFORM, new THREE.Uniform(getDefaultLightingMaskTexture()))

  const shaderEffect = effect as unknown as PatchableEffectShader
  const fragmentShader = shaderEffect.getFragmentShader()
  if (fragmentShader.includes(INSCATTER_INTENSITY_UNIFORM)) return

  const withUniform = fragmentShader.replace(
    'uniform float albedoScale;',
    [
      'uniform float albedoScale;',
      `uniform float ${INSCATTER_INTENSITY_UNIFORM};`,
      `uniform float ${INSCATTER_HORIZON_BLEND_UNIFORM};`,
      `uniform vec2 ${INSCATTER_HORIZON_RANGE_UNIFORM};`,
      `uniform float ${POST_PROCESS_NIGHT_MOON_INTENSITY_UNIFORM};`,
      `uniform float ${POST_PROCESS_NIGHT_AMBIENT_INTENSITY_UNIFORM};`,
      `uniform vec3 ${POST_PROCESS_NIGHT_COLOR_UNIFORM};`,
      `uniform float ${POST_PROCESS_NIGHT_SKY_INTENSITY_UNIFORM};`,
      `uniform float ${POST_PROCESS_NIGHT_MOON_GLOW_INTENSITY_UNIFORM};`,
      `uniform float ${POST_PROCESS_DAY_LIGHT_FACTOR_UNIFORM};`,
      `uniform sampler2D ${LIGHTING_MASK_BUFFER_UNIFORM};`
    ].join('\n')
  )
  if (withUniform === fragmentShader) {
    console.warn('EarthScene atmosphere shader patch failed: uniform hook was not found.')
    shaderEffect.setChanged()
    return
  }

  const withDaySky = withUniform.replace(
    '    outputColor.rgb = getSkyRadiance(\n      vCameraPosition,\n      rayDirection,\n      shadowLength,\n      sunDirection,\n      moonDirection,\n      moonAngularRadius,\n      lunarRadianceScale,\n      fragmentAngle\n    );',
    [
      '    outputColor.rgb = getSkyRadiance(',
      '      vCameraPosition,',
      '      rayDirection,',
      '      shadowLength,',
      '      sunDirection,',
      '      moonDirection,',
      '      moonAngularRadius,',
      '      lunarRadianceScale,',
      '      fragmentAngle',
      '    );',
      `    outputColor.rgb *= ${POST_PROCESS_DAY_LIGHT_FACTOR_UNIFORM};`
    ].join('\n')
  )
  if (withDaySky === withUniform) {
    console.warn('EarthScene atmosphere shader patch failed: day sky hook was not found.')
  }

  const shaderWithDaySky = withDaySky === withUniform ? withUniform : withDaySky
  const withNightSky = shaderWithDaySky.replace(
    '    outputColor.a = 1.0;\n    #else // SKY',
    [
      `    if (${POST_PROCESS_NIGHT_SKY_INTENSITY_UNIFORM} > 0.0 || ${POST_PROCESS_NIGHT_MOON_GLOW_INTENSITY_UNIFORM} > 0.0) {`,
      '      vec3 earthsceneSkyNormal = normalize(vCameraPosition / vEllipsoidRadiiSquared);',
      '      float earthsceneRayUp = clamp(dot(rayDirection, earthsceneSkyNormal), 0.0, 1.0);',
      '      float earthsceneHorizonGlow = pow(1.0 - earthsceneRayUp, 1.7);',
      '      float earthsceneZenithGlow = pow(earthsceneRayUp, 0.35);',
      '      float earthsceneMoonViewDot = max(dot(rayDirection, moonDirection), 0.0);',
      '      float earthsceneMoonHalo = pow(earthsceneMoonViewDot, 64.0) * 0.55 + pow(earthsceneMoonViewDot, 512.0) * 2.2;',
      '      float earthsceneMoonDiscRadius = max(moonAngularRadius * 1.35, fragmentAngle);',
      '      float earthsceneMoonDisc = smoothstep(cos(earthsceneMoonDiscRadius + fragmentAngle), cos(max(0.0, moonAngularRadius - fragmentAngle)), earthsceneMoonViewDot);',
      `      vec3 earthsceneNightSkyRadiance = ${POST_PROCESS_NIGHT_COLOR_UNIFORM} * ${POST_PROCESS_NIGHT_SKY_INTENSITY_UNIFORM} * (0.18 + 0.62 * earthsceneHorizonGlow + 0.28 * earthsceneZenithGlow);`,
      `      earthsceneNightSkyRadiance += ${POST_PROCESS_NIGHT_COLOR_UNIFORM} * ${POST_PROCESS_NIGHT_MOON_GLOW_INTENSITY_UNIFORM} * earthsceneMoonHalo;`,
      `      earthsceneNightSkyRadiance += vec3(1.0, 0.96, 0.86) * ${POST_PROCESS_NIGHT_MOON_GLOW_INTENSITY_UNIFORM} * earthsceneMoonDisc * 2.0;`,
      '      outputColor.rgb += earthsceneNightSkyRadiance;',
      '    }',
      '    outputColor.a = 1.0;',
      '    #else // SKY'
    ].join('\n')
  )
  if (withNightSky === shaderWithDaySky) {
    console.warn('EarthScene atmosphere shader patch failed: night sky hook was not found.')
  }

  const shaderWithNightSky = withNightSky === shaderWithDaySky ? shaderWithDaySky : withNightSky

  // 高斯泼溅等不写深度的场景内容会落在天空像素上（深度仍为远平面 1.0）。上游天空
  // 分支会用天空辐射度整像素覆盖并丢掉 inputColor，暗部与软边看起来像被大气盖住。
  // 在覆盖率 alpha 上做预乘 over：空像素 a=0 仍是纯天空，不透明无深度内容（含暗面）保留。
  //
  // Scene content that does not write depth (Gaussian splats, particles) lands on sky
  // pixels whose depth is still the far plane. Upstream replaces those texels with sky
  // radiance and drops inputColor, so dark interiors and soft edges look atmosphere-covered.
  // Premultiplied over by coverage alpha keeps empty pixels as sky and preserves opaque
  // no-depth shading, including dark surfaces.
  const withSkyOverUnwrittenDepth = shaderWithNightSky.replace(
    '    outputColor.a = 1.0;\n    #else // SKY',
    [
      '    outputColor.rgb = inputColor.rgb + outputColor.rgb * (1.0 - inputColor.a);',
      '    outputColor.a = 1.0;',
      '    #else // SKY'
    ].join('\n')
  )
  if (withSkyOverUnwrittenDepth === shaderWithNightSky) {
    console.warn('EarthScene atmosphere shader patch failed: sky-over-unwritten-depth hook was not found.')
  }

  const shaderWithSkyOverUnwrittenDepth =
    withSkyOverUnwrittenDepth === shaderWithNightSky ? shaderWithNightSky : withSkyOverUnwrittenDepth
  const withPostProcessNightLighting = shaderWithSkyOverUnwrittenDepth.replace(
    '#endif // defined(SUN_LIGHT) || defined(SKY_LIGHT)\n\n  #if defined(TRANSMITTANCE) || defined(INSCATTER)',
    [
      '#endif // defined(SUN_LIGHT) || defined(SKY_LIGHT)',
      '',
      `  float earthsceneGlobeLightingMask = texture(${LIGHTING_MASK_BUFFER_UNIFORM}, uv).r;`,
      '  #if defined(SUN_LIGHT) || defined(SKY_LIGHT)',
      '  if (!degenerateNormal) {',
      `    radiance *= ${POST_PROCESS_DAY_LIGHT_FACTOR_UNIFORM};`,
      '  }',
      '  #endif // defined(SUN_LIGHT) || defined(SKY_LIGHT)',
      '  radiance = mix(inputColor.rgb, radiance, earthsceneGlobeLightingMask);',
      `  if (!degenerateNormal && (${POST_PROCESS_NIGHT_MOON_INTENSITY_UNIFORM} > 0.0 || ${POST_PROCESS_NIGHT_AMBIENT_INTENSITY_UNIFORM} > 0.0)) {`,
      '    vec3 earthsceneNightDiffuse = inputColor.rgb * albedoScale * RECIPROCAL_PI;',
      '    float earthsceneNightMoonDiffuse = max(dot(normalize(normalECEF), moonDirection), 0.0);',
      `    vec3 earthsceneNightRadiance = earthsceneNightDiffuse * ${POST_PROCESS_NIGHT_COLOR_UNIFORM} * (${POST_PROCESS_NIGHT_AMBIENT_INTENSITY_UNIFORM} + ${POST_PROCESS_NIGHT_MOON_INTENSITY_UNIFORM} * earthsceneNightMoonDiffuse);`,
      '    earthsceneNightRadiance *= earthsceneGlobeLightingMask;',
      '    radiance += earthsceneNightRadiance;',
      '  }',
      '',
      '  #if defined(TRANSMITTANCE) || defined(INSCATTER)'
    ].join('\n')
  )
  if (withPostProcessNightLighting === shaderWithSkyOverUnwrittenDepth) {
    console.warn('EarthScene atmosphere shader patch failed: post-process night lighting hook was not found.')
  }

  const shaderWithNightLighting =
    withPostProcessNightLighting === shaderWithSkyOverUnwrittenDepth
      ? shaderWithSkyOverUnwrittenDepth
      : withPostProcessNightLighting

  // 无法线点云是 unlit 内容：NormalPass 用零 alpha 明确标记这类像素，避免全局
  // 空气透视在材质着色之后再次改变原始 RGB。这里只做后处理排除，不重建法线、
  // 不注入近似光照；有真实法线且启用 normalShading 的点云仍走标准大气路径。
  const withUnlitPointCloudMask = shaderWithNightLighting.replace(
    '  #if defined(TRANSMITTANCE) || defined(INSCATTER)\n  applyTransmittanceInscatter(positionECEF, shadowLength, radiance);\n  #endif // defined(TRANSMITTANCE) || defined(INSCATTER)',
    [
      '  #ifdef HAS_NORMALS',
      '  bool earthsceneUnlitPointCloud = degenerateNormal && texture(normalBuffer, uv).a < 0.5;',
      '  #else // HAS_NORMALS',
      '  bool earthsceneUnlitPointCloud = false;',
      '  #endif // HAS_NORMALS',
      '',
      '  #if defined(TRANSMITTANCE) || defined(INSCATTER)',
      '  if (!earthsceneUnlitPointCloud) {',
      '    applyTransmittanceInscatter(positionECEF, shadowLength, radiance);',
      '  }',
      '  #endif // defined(TRANSMITTANCE) || defined(INSCATTER)'
    ].join('\n')
  )
  if (withUnlitPointCloudMask === shaderWithNightLighting) {
    console.warn('EarthScene atmosphere shader patch failed: unlit point-cloud mask hook was not found.')
  }

  const shaderWithUnlitPointCloudMask =
    withUnlitPointCloudMask === shaderWithNightLighting
      ? shaderWithNightLighting
      : withUnlitPointCloudMask
  const patchedShader = shaderWithUnlitPointCloudMask.replace(
    'radiance = radiance + inscatter;',
    [
      'vec3 earthsceneGlobeNormal = normalize(positionECEF / vEllipsoidRadiiSquared);',
      'float earthsceneViewNormalCos = clamp(dot(earthsceneGlobeNormal, normalize(vCameraPosition - positionECEF)), 0.0, 1.0);',
      `float earthsceneHorizonMask = 1.0 - smoothstep(${INSCATTER_HORIZON_RANGE_UNIFORM}.x, ${INSCATTER_HORIZON_RANGE_UNIFORM}.y, earthsceneViewNormalCos);`,
      `float earthsceneInscatterMask = mix(1.0, earthsceneHorizonMask, ${INSCATTER_HORIZON_BLEND_UNIFORM});`,
      `radiance = radiance + inscatter * ${INSCATTER_INTENSITY_UNIFORM} * earthsceneInscatterMask * ${POST_PROCESS_DAY_LIGHT_FACTOR_UNIFORM};`
    ].join('\n  ')
  )

  if (patchedShader === shaderWithUnlitPointCloudMask) {
    console.warn('EarthScene atmosphere shader patch failed: inscatter intensity hook was not found.')
    shaderEffect.setChanged()
    return
  }

  shaderEffect.setFragmentShader(patchedShader)
}

export function patchCloudsNightLighting(cloudsEffect: CloudsEffect, nightColor: THREE.Color) {
  const material = cloudsEffect.cloudsPass.currentMaterial as unknown as PatchableShaderMaterial
  material.uniforms[CLOUDS_NIGHT_MOON_INTENSITY_UNIFORM] = new THREE.Uniform(0)
  material.uniforms[CLOUDS_NIGHT_AMBIENT_INTENSITY_UNIFORM] = new THREE.Uniform(0)
  material.uniforms[CLOUDS_NIGHT_COLOR_UNIFORM] = new THREE.Uniform(nightColor.clone())
  material.uniforms[CLOUDS_NIGHT_MOON_DIRECTION_UNIFORM] = new THREE.Uniform(new THREE.Vector3())
  material.uniforms[CLOUDS_DAY_LIGHT_FACTOR_UNIFORM] = new THREE.Uniform(1)

  if (material.fragmentShader.includes(CLOUDS_NIGHT_MOON_INTENSITY_UNIFORM)) return

  const withUniform = material.fragmentShader.replace(
    'uniform float powderExponent;',
    [
      'uniform float powderExponent;',
      `uniform float ${CLOUDS_NIGHT_MOON_INTENSITY_UNIFORM};`,
      `uniform float ${CLOUDS_NIGHT_AMBIENT_INTENSITY_UNIFORM};`,
      `uniform vec3 ${CLOUDS_NIGHT_COLOR_UNIFORM};`,
      `uniform vec3 ${CLOUDS_NIGHT_MOON_DIRECTION_UNIFORM};`,
      `uniform float ${CLOUDS_DAY_LIGHT_FACTOR_UNIFORM};`
    ].join('\n')
  )
  if (withUniform === material.fragmentShader) {
    console.warn('EarthScene clouds shader patch failed: uniform hook was not found.')
    material.needsUpdate = true
    return
  }

  const withGroundDayLight = withUniform.replace(
    '  vec3 skyIrradiance;\n  vec3 sunIrradiance = getGroundSunSkyIrradiance(position, surfaceNormal, height, skyIrradiance);',
    [
      '  vec3 skyIrradiance;',
      '  vec3 sunIrradiance = getGroundSunSkyIrradiance(position, surfaceNormal, height, skyIrradiance);',
      `  sunIrradiance *= ${CLOUDS_DAY_LIGHT_FACTOR_UNIFORM};`,
      `  skyIrradiance *= ${CLOUDS_DAY_LIGHT_FACTOR_UNIFORM};`
    ].join('\n')
  )
  if (withGroundDayLight === withUniform) {
    console.warn('EarthScene clouds shader patch failed: ground day lighting hook was not found.')
  }

  const shaderWithGroundDayLight =
    withGroundDayLight === withUniform ? withUniform : withGroundDayLight
  const withCloudDayLight = shaderWithGroundDayLight.replace(
    '      vec3 skyIrradiance;\n      vec3 sunIrradiance = getCloudsSunSkyIrradiance(position, height, skyIrradiance);',
    [
      '      vec3 skyIrradiance;',
      '      vec3 sunIrradiance = getCloudsSunSkyIrradiance(position, height, skyIrradiance);',
      `      sunIrradiance *= ${CLOUDS_DAY_LIGHT_FACTOR_UNIFORM};`,
      `      skyIrradiance *= ${CLOUDS_DAY_LIGHT_FACTOR_UNIFORM};`
    ].join('\n')
  )
  if (withCloudDayLight === shaderWithGroundDayLight) {
    console.warn('EarthScene clouds shader patch failed: cloud day lighting hook was not found.')
  }

  const shaderWithCloudDayLight =
    withCloudDayLight === shaderWithGroundDayLight ? shaderWithGroundDayLight : withCloudDayLight
  const withHazeDayLight = shaderWithCloudDayLight.replace(
    '  vec3 skyIrradiance = vGroundIrradiance.sky;\n  vec3 sunIrradiance = vGroundIrradiance.sun;',
    [
      `  vec3 skyIrradiance = vGroundIrradiance.sky * ${CLOUDS_DAY_LIGHT_FACTOR_UNIFORM};`,
      `  vec3 sunIrradiance = vGroundIrradiance.sun * ${CLOUDS_DAY_LIGHT_FACTOR_UNIFORM};`
    ].join('\n')
  )
  if (withHazeDayLight === shaderWithCloudDayLight) {
    console.warn('EarthScene clouds shader patch failed: haze day lighting hook was not found.')
  }

  const shaderWithHazeDayLight =
    withHazeDayLight === shaderWithCloudDayLight ? shaderWithCloudDayLight : withHazeDayLight
  const withAerialPerspectiveDayLight = shaderWithHazeDayLight.replace(
    '  color.rgb = color.rgb * transmittance + inscatter * color.a;',
    `  color.rgb = color.rgb * transmittance + inscatter * color.a * ${CLOUDS_DAY_LIGHT_FACTOR_UNIFORM};`
  )
  if (withAerialPerspectiveDayLight === shaderWithHazeDayLight) {
    console.warn('EarthScene clouds shader patch failed: aerial perspective day lighting hook was not found.')
  }

  const shaderWithDayLighting =
    withAerialPerspectiveDayLight === shaderWithHazeDayLight ? shaderWithHazeDayLight : withAerialPerspectiveDayLight
  const patchedShader = shaderWithDayLighting.replace(
    'radiance += skyIrradiance * RECIPROCAL_PI4 * skyGradient * skyLightScale;',
    [
      'radiance += skyIrradiance * RECIPROCAL_PI4 * skyGradient * skyLightScale;',
      `if (${CLOUDS_NIGHT_MOON_INTENSITY_UNIFORM} > 0.0 || ${CLOUDS_NIGHT_AMBIENT_INTENSITY_UNIFORM} > 0.0) {`,
      `  float earthsceneCloudMoonDiffuse = max(dot(surfaceNormal, ${CLOUDS_NIGHT_MOON_DIRECTION_UNIFORM}), 0.0);`,
      `  float earthsceneCloudMoonPhase = approximateMultipleScattering(opticalDepth * 0.35, dot(${CLOUDS_NIGHT_MOON_DIRECTION_UNIFORM}, rayDirection));`,
      `  vec3 earthsceneCloudNightRadiance = ${CLOUDS_NIGHT_COLOR_UNIFORM} * ${CLOUDS_NIGHT_AMBIENT_INTENSITY_UNIFORM} * (0.35 + 0.85 * skyGradient);`,
      `  earthsceneCloudNightRadiance += ${CLOUDS_NIGHT_COLOR_UNIFORM} * ${CLOUDS_NIGHT_MOON_INTENSITY_UNIFORM} * (0.25 + 0.75 * earthsceneCloudMoonDiffuse) * earthsceneCloudMoonPhase;`,
      '  radiance += earthsceneCloudNightRadiance;',
      '}'
    ].join('\n      ')
  )
  if (patchedShader === shaderWithDayLighting) {
    console.warn('EarthScene clouds shader patch failed: night lighting hook was not found.')
    material.needsUpdate = true
    return
  }

  material.fragmentShader = patchedShader
  material.needsUpdate = true
}
