import * as THREE from 'three'
import type { ImageOverlay } from '3d-tiles-renderer/plugins'
import type { ImageryLayerStyleOptions } from '../types'

const OVERLAY_DAY_NIGHT_PARAMS = Symbol('earthsceneOverlayDayNight')
const OVERLAY_DAY_NIGHT_SHADER_CACHE_KEY = 'earthscene-overlay-day-night'
const OVERLAY_OPACITY_APPLY =
  'tint.rgba *= layerInfo[ i ].opacity * wOpacity;'

/** ImageOverlayPlugin 的 unroll 上限是 10 层。The overlay shader unrolls at most 10 layers. */
export const OVERLAY_DAY_NIGHT_MAX_LAYERS = 10

/**
 * 昼夜混合的太阳高度点积区间，与大气夜景默认 `transitionRange` 对齐。
 *
 * Sun-dot range for the day/night mix, matching atmosphere night `transitionRange`.
 */
export const OVERLAY_DAY_NIGHT_TRANSITION_RANGE = [-0.08, 0.05] as const

export type OverlayDayNightFields = {
  dayOpacity: number
  nightOpacity: number
}

export type OverlayDayNightParams = {
  earthsceneSunDirection: THREE.IUniform<THREE.Vector3>
  earthsceneWorldToECEF: THREE.IUniform<THREE.Matrix4>
  earthsceneDayOpacities: THREE.IUniform<number[]>
  earthsceneNightOpacities: THREE.IUniform<number[]>
}

type WrappedOnBeforeCompile = {
  (
    this: THREE.Material,
    shader: THREE.WebGLProgramParametersWithUniforms,
    renderer: THREE.WebGLRenderer
  ): void
  [OVERLAY_DAY_NIGHT_PARAMS]?: OverlayDayNightParams
}

type OverlayDayNightMaterial = THREE.Material & {
  [OVERLAY_DAY_NIGHT_PARAMS]?: OverlayDayNightParams
}

export function createOverlayDayNightParams(): OverlayDayNightParams {
  return {
    earthsceneSunDirection: { value: new THREE.Vector3(1, 0, 0) },
    earthsceneWorldToECEF: { value: new THREE.Matrix4() },
    earthsceneDayOpacities: {
      value: Array.from({ length: OVERLAY_DAY_NIGHT_MAX_LAYERS }, () => 1)
    },
    earthsceneNightOpacities: {
      value: Array.from({ length: OVERLAY_DAY_NIGHT_MAX_LAYERS }, () => 1)
    }
  }
}

export function clampOverlayOpacity(value: number | undefined, fallback = 1) {
  if (value === undefined || !Number.isFinite(value)) return fallback
  return THREE.MathUtils.clamp(value, 0, 1)
}

export function applyOverlayDayNightStyle(
  overlay: ImageOverlay,
  style: ImageryLayerStyleOptions
) {
  const dayNight = overlay as ImageOverlay & OverlayDayNightFields
  dayNight.dayOpacity = clampOverlayOpacity(style.dayOpacity)
  dayNight.nightOpacity = clampOverlayOpacity(style.nightOpacity)
}

/**
 * `opacity * mix(nightOpacity, dayOpacity, sunFactor)`。
 * `sunFactor` 来自 ECEF 位置与太阳方向的点积。
 *
 * Final overlay alpha is `opacity * mix(nightOpacity, dayOpacity, sunFactor)`,
 * where `sunFactor` is the geocentric sun-dot at the fragment.
 */
export function mixOverlayLightingOpacity(
  dayOpacity: number,
  nightOpacity: number,
  sunDot: number
) {
  const [nightEnd, dayStart] = OVERLAY_DAY_NIGHT_TRANSITION_RANGE
  const factor = THREE.MathUtils.smoothstep(sunDot, nightEnd, dayStart)
  return THREE.MathUtils.lerp(nightOpacity, dayOpacity, factor)
}

export function syncOverlayDayNightOpacities(
  params: OverlayDayNightParams,
  overlays: ReadonlyArray<unknown>
) {
  const day = params.earthsceneDayOpacities.value
  const night = params.earthsceneNightOpacities.value
  for (let index = 0; index < OVERLAY_DAY_NIGHT_MAX_LAYERS; index += 1) {
    const overlay = overlays[index] as Partial<OverlayDayNightFields> | undefined
    day[index] = clampOverlayOpacity(overlay?.dayOpacity)
    night[index] = clampOverlayOpacity(overlay?.nightOpacity)
  }
}

export function getOverlayDayNightParams(
  material: THREE.Material
): OverlayDayNightParams | undefined {
  return (material as OverlayDayNightMaterial)[OVERLAY_DAY_NIGHT_PARAMS]
}

/**
 * 在 ImageOverlayPlugin 把 `layerInfo[i].opacity` 写入片元之后，再乘昼夜透明度。
 * 本 hook 必须包在 overlay `onBeforeCompile` 外侧，才能改到那一行。
 *
 * Multiply overlay opacity by day/night lighting after ImageOverlayPlugin writes
 * `layerInfo[i].opacity`. This hook must wrap overlay `onBeforeCompile` so the
 * tint line exists before we replace it.
 */
export function wrapOverlayDayNightMaterial(
  material: THREE.Material,
  params: OverlayDayNightParams
) {
  const overlayMaterial = material as OverlayDayNightMaterial
  const existing = overlayMaterial[OVERLAY_DAY_NIGHT_PARAMS]
    ?? (overlayMaterial.onBeforeCompile as WrappedOnBeforeCompile | undefined)?.[OVERLAY_DAY_NIGHT_PARAMS]
  if (existing) {
    overlayMaterial[OVERLAY_DAY_NIGHT_PARAMS] = existing
    return existing
  }

  const previousOnBeforeCompile = overlayMaterial.onBeforeCompile
  const previousCacheKey = overlayMaterial.customProgramCacheKey.bind(overlayMaterial)

  const hook: WrappedOnBeforeCompile = function (shader, renderer) {
    previousOnBeforeCompile?.call(this, shader, renderer)
    injectOverlayDayNight(shader, params)
  }
  hook[OVERLAY_DAY_NIGHT_PARAMS] = params

  overlayMaterial[OVERLAY_DAY_NIGHT_PARAMS] = params
  overlayMaterial.onBeforeCompile = hook
  overlayMaterial.customProgramCacheKey = () =>
    `${previousCacheKey()}|${OVERLAY_DAY_NIGHT_SHADER_CACHE_KEY}`
  overlayMaterial.needsUpdate = true
  return params
}

export function applyOverlayDayNightToObject(
  root: THREE.Object3D,
  params: OverlayDayNightParams
) {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (!mesh.material) return

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const material of materials) {
      wrapOverlayDayNightMaterial(material, params)
    }
  })
}

/**
 * 在 overlay 合成之后注入昼夜透明度。priority 高于 ImageOverlayPlugin（-15），
 * 这样 `processTileModel` 同步阶段里 overlay 已经 wrap 过材质。
 *
 * Injects day/night opacity after overlay compositing. Priority is higher than
 * ImageOverlayPlugin (-15), so overlay wrapping already ran in the synchronous
 * `processTileModel` pass.
 */
export class OverlayDayNightPlugin {
  readonly name = 'EARTHSCENE_OVERLAY_DAY_NIGHT'
  readonly priority = -5

  constructor(private readonly params: OverlayDayNightParams) {}

  processTileModel(scene: THREE.Object3D) {
    applyOverlayDayNightToObject(scene, this.params)
  }
}

function injectOverlayDayNight(
  shader: THREE.WebGLProgramParametersWithUniforms,
  params: OverlayDayNightParams
) {
  shader.uniforms.earthsceneSunDirection = params.earthsceneSunDirection
  shader.uniforms.earthsceneWorldToECEF = params.earthsceneWorldToECEF
  shader.uniforms.earthsceneDayOpacities = params.earthsceneDayOpacities
  shader.uniforms.earthsceneNightOpacities = params.earthsceneNightOpacities

  if (!shader.vertexShader.includes('vEarthSceneWorldPosition')) {
    shader.vertexShader = `varying vec3 vEarthSceneWorldPosition;\n${shader.vertexShader}`
    if (shader.vertexShader.includes('#include <project_vertex>')) {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <project_vertex>',
        `#include <project_vertex>\nvEarthSceneWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      )
    }
  }

  if (!shader.fragmentShader.includes('earthsceneSunDirection')) {
    shader.fragmentShader = `uniform vec3 earthsceneSunDirection;
uniform mat4 earthsceneWorldToECEF;
varying vec3 vEarthSceneWorldPosition;
${shader.fragmentShader}`
  }

  if (shader.fragmentShader.includes('uniform LayerInfo layerInfo[ LAYER_COUNT ];')
    && !shader.fragmentShader.includes('earthsceneDayOpacities')) {
    shader.fragmentShader = shader.fragmentShader.replace(
      'uniform LayerInfo layerInfo[ LAYER_COUNT ];',
      `uniform LayerInfo layerInfo[ LAYER_COUNT ];
					uniform float earthsceneDayOpacities[ LAYER_COUNT ];
					uniform float earthsceneNightOpacities[ LAYER_COUNT ];`
    )
  }

  // ImageOverlayPlugin 用 `#pragma unroll_loop` 复制循环体；太阳点积必须写在
  // 循环外，否则两层 overlay 会重复声明 `earthsceneSunDot` 导致片元着色器编译失败。
  // The overlay plugin unrolls this loop; keep sun-dot locals outside it.
  if (shader.fragmentShader.includes('float wOpacity;')
    && !shader.fragmentShader.includes('earthsceneDayFactor')) {
    const [nightEnd, dayStart] = OVERLAY_DAY_NIGHT_TRANSITION_RANGE
    shader.fragmentShader = shader.fragmentShader.replace(
      'float wOpacity;',
      `float wOpacity;
					float earthsceneSunDot = dot(normalize((earthsceneWorldToECEF * vec4(vEarthSceneWorldPosition, 1.0)).xyz), earthsceneSunDirection);
					float earthsceneDayFactor = smoothstep(${formatGlslFloat(nightEnd)}, ${formatGlslFloat(dayStart)}, earthsceneSunDot);`
    )
  }

  if (shader.fragmentShader.includes(OVERLAY_OPACITY_APPLY)
    && !shader.fragmentShader.includes('earthsceneDayOpacities[ i ]')) {
    shader.fragmentShader = shader.fragmentShader.replace(
      OVERLAY_OPACITY_APPLY,
      'tint.rgba *= layerInfo[ i ].opacity * mix(earthsceneNightOpacities[ i ], earthsceneDayOpacities[ i ], earthsceneDayFactor) * wOpacity;'
    )
  }
}

function formatGlslFloat(value: number) {
  return Number.isInteger(value) ? `${value}.0` : String(value)
}
