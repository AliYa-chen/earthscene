import { BufferAttribute, Mesh, type IUniform, type Material, type Texture } from 'three'
import type { WaterAreaEffect } from './WaterAreaMaterialPlugin'

export const WATER_AREA_UV_ATTRIBUTE = 'earthscene_water_uv'
const MESH_PARAMS = Symbol('earthscene-water-mask')
const MATERIAL_HOOK = Symbol('earthscene-water-material')
const MESH_HOOK = Symbol('earthscene-water-camera')
export interface WaterAreaOverlayParams {
  waterMaskMap: IUniform<Texture | null>
  waterMaskReady: IUniform<number>
  waterMaskFlipY: IUniform<number>
}
type WaterMesh = Mesh & {
  [MESH_PARAMS]?: WaterAreaOverlayParams
  [MESH_HOOK]?: { effect: WaterAreaEffect }
}
type WaterMaterial = Material & {
  [MATERIAL_HOOK]?: {
    effect: WaterAreaEffect; mesh: Mesh
    previousCompile: Material['onBeforeCompile']
    previousCacheKey: Material['customProgramCacheKey']
    hook: Material['onBeforeCompile']
  }
}

/** 共享独立 mask uniforms，并在原 shader 后追加水面合成。 / Share independent mask uniforms and append water shading to the original shader. */
export function wrapWaterAreaMaterial(
  material: Material | Material[], mesh: Mesh, effect?: WaterAreaEffect,
): WaterAreaOverlayParams {
  const host = mesh as WaterMesh
  const params = host[MESH_PARAMS] ??= {
    waterMaskMap: { value: null }, waterMaskReady: { value: 0 }, waterMaskFlipY: { value: 0 },
  }
  if (!mesh.geometry.getAttribute(WATER_AREA_UV_ATTRIBUTE)) {
    const count = mesh.geometry.getAttribute('position')?.count ?? 0
    mesh.geometry.setAttribute(WATER_AREA_UV_ATTRIBUTE, new BufferAttribute(new Float32Array(count * 3), 3))
  }
  if (!effect) return params
  function patch(source: Material): Material {
    let target = source as WaterMaterial
    const existing = target[MATERIAL_HOOK]
    if (existing && existing.effect === effect && existing.mesh === mesh) return target
    // 多 Mesh 共享材质时，各自 mask 纹理需要独立 uniform。
    if (existing && existing.mesh !== mesh) {
      target = source.clone() as WaterMaterial
      target.onBeforeCompile = existing.previousCompile
      target.customProgramCacheKey = existing.previousCacheKey
    }
    const previousCompile = target.onBeforeCompile
    const previousCacheKey = target.customProgramCacheKey
    const hook: Material['onBeforeCompile'] = function (this: Material, shader, renderer) {
      previousCompile.call(this, shader, renderer)
      Object.assign(shader.uniforms, effect!.uniforms, params)
      shader.vertexShader = VERTEX_DECLARATIONS + shader.vertexShader.replace(
        '#include <project_vertex>',
        `#include <project_vertex>\nvWaterViewPos = mvPosition.xyz;\nvWaterMaskUv = ${WATER_AREA_UV_ATTRIBUTE};`,
      )
      shader.fragmentShader = FRAGMENT_DECLARATIONS + shader.fragmentShader.replace(
        '#include <opaque_fragment>', WATER_COMPOSITION + '\n#include <opaque_fragment>',
      )
    }
    target[MATERIAL_HOOK] = { effect: effect!, mesh, previousCompile, previousCacheKey, hook }
    target.onBeforeCompile = hook
    target.customProgramCacheKey = function () { return previousCacheKey.call(this) + '|earthscene-water-webgl-v1' }
    target.needsUpdate = true
    const patched = target
    effect!.registerCleanup(mesh, () => {
      if (patched.onBeforeCompile !== hook) return
      patched.onBeforeCompile = previousCompile
      patched.customProgramCacheKey = previousCacheKey
      delete patched[MATERIAL_HOOK]
      patched.needsUpdate = true
    })
    return target
  }
  mesh.material = Array.isArray(material) ? material.map(patch) : patch(material)
  if (host[MESH_HOOK]?.effect !== effect) {
    const previousRender = mesh.onBeforeRender
    const hook: Mesh['onBeforeRender'] = function (this: Mesh, renderer, scene, camera, geometry, currentMaterial, group) {
      previousRender.call(this, renderer, scene, camera, geometry, currentMaterial, group)
      effect!.syncCamera(camera)
      // 光照模式切换可能重建原地形材质。
      if ((currentMaterial as WaterMaterial)[MATERIAL_HOOK]?.effect !== effect) {
        wrapWaterAreaMaterial(mesh.material, mesh, effect)
      }
    }
    mesh.onBeforeRender = hook
    host[MESH_HOOK] = { effect }
    effect.registerCleanup(mesh, () => {
      if (mesh.onBeforeRender === hook) mesh.onBeforeRender = previousRender
      delete host[MESH_HOOK]
    })
  }
  return params
}

const VERTEX_DECLARATIONS = /* glsl */`
attribute vec3 earthscene_water_uv;
varying vec3 vWaterMaskUv;
varying vec3 vWaterViewPos;
`
const FRAGMENT_DECLARATIONS = /* glsl */`
varying vec3 vWaterMaskUv;
varying vec3 vWaterViewPos;
uniform sampler2D waterMaskMap;
uniform float waterMaskReady;
uniform float waterMaskFlipY;
uniform float waterWeight;
uniform vec3 waterColor;
uniform float waterColorMix;
uniform float waterRoughness;
uniform float waterWaveStrength;
uniform float waterWaveScale;
uniform float waterWaveDirection;
uniform float waterFlowPhase;
uniform sampler2D waterNormal0;
uniform sampler2D waterNormal1;
uniform vec3 waterOriginView;
uniform vec3 waterEastView;
uniform vec3 waterNorthView;
uniform vec3 waterSunView;
uniform mat3 waterViewToWorld;
uniform mat3 waterViewToECEF;
uniform mat3 waterECEFToView;
uniform vec3 waterCameraECEF;
uniform samplerCube waterEnvironment;
uniform float waterEnvironmentWeight;
uniform float waterSunIntensity;
`
const WATER_COMPOSITION = /* glsl */`
// 原影像与地形材质完成后合成，关闭时不修改 outgoingLight。
if (waterWeight > 0.0 && waterMaskReady > 0.0) {
  vec2 waterMaskUV = vWaterMaskUv.xy;
  waterMaskUV.y = mix(waterMaskUV.y, 1.0 - waterMaskUV.y, waterMaskFlipY);
  float waterBoundaryWidth = max(fwidth(vWaterMaskUv.z), 1e-7);
  float waterBoundary = smoothstep(-waterBoundaryWidth, 0.0, vWaterMaskUv.z)
    * (1.0 - smoothstep(1.0, 1.0 + waterBoundaryWidth, vWaterMaskUv.z));
  float waterMask = smoothstep(0.05, 0.95, texture2D(waterMaskMap, waterMaskUV).r)
    * waterBoundary * waterWeight;
  if (waterMask > 0.001) {
    vec3 waterRelativeView = vWaterViewPos - waterOriginView;
    vec2 waterBaseUV = vec2(dot(waterRelativeView, waterEastView), dot(waterRelativeView, waterNorthView))
      / max(1.0, waterWaveScale * 700.0);
    vec2 waterFlow = vec2(sin(waterWaveDirection), cos(waterWaveDirection));
    float waterPhase1 = mod(waterFlowPhase + 0.075, 0.15);
    float waterBlend = abs(0.075 - waterFlowPhase) / 0.075;
    vec3 waterNormalA = texture2D(waterNormal0, waterBaseUV + waterFlow * waterFlowPhase).xyz * 2.0 - 1.0;
    vec3 waterNormalB = texture2D(waterNormal1, waterBaseUV + waterFlow * waterPhase1).xyz * 2.0 - 1.0;
    vec2 waterSlope = mix(waterNormalA, waterNormalB, waterBlend).xy * waterWaveStrength * 0.62
      * (1.0 - smoothstep(160000.0, 650000.0, length(vWaterViewPos)));
    // 与原案例一致，水面采用 WGS84 椭球法线，不依赖 Basic 材质 normal 宏或地形坡度。
    vec3 waterECEFPosition = waterViewToECEF * vWaterViewPos + waterCameraECEF;
    vec3 waterUpECEF = normalize(waterECEFPosition * vec3(1.0, 1.0, 1.00673949674));
    vec3 waterUp = normalize(waterECEFToView * waterUpECEF);
    vec3 waterEast = normalize(waterEastView - waterUp * dot(waterEastView, waterUp));
    vec3 waterNorth = normalize(cross(waterUp, waterEast));
    vec3 waterN = normalize(waterUp + waterEast * waterSlope.x + waterNorth * waterSlope.y);
    vec3 waterV = normalize(-vWaterViewPos);
    if (dot(waterN, waterV) < 0.0) waterN = -waterN;
    float waterNdotV = max(0.02, dot(waterN, waterV));
    float waterFresnel = 0.02037 + 0.97963 * pow(1.0 - waterNdotV, 5.0);
    vec3 waterRadiance = mix(outgoingLight, waterColor, waterColorMix);
    if (waterEnvironmentWeight > 0.0) {
      vec3 waterReflectionWorld = normalize(waterViewToWorld * reflect(-waterV, waterN));
      vec3 waterSkyRadiance = textureCube(waterEnvironment, waterReflectionWorld, waterRoughness * 6.0).rgb;
      waterRadiance = waterRadiance * (1.0 - waterFresnel)
        + waterSkyRadiance * waterFresnel * waterEnvironmentWeight;
    }
    vec3 waterL = normalize(waterSunView);
    vec3 waterH = normalize(waterL + waterV);
    float waterNdotL = max(0.0, dot(waterN, waterL));
    float waterNdotH = max(0.0, dot(waterN, waterH));
    float waterAlpha = max(0.015, waterRoughness * waterRoughness);
    float waterAlpha2 = waterAlpha * waterAlpha;
    float waterDenom = waterNdotH * waterNdotH * (waterAlpha2 - 1.0) + 1.0;
    float waterD = waterAlpha2 / max(1e-6, 3.14159265 * waterDenom * waterDenom);
    float waterGlint = min(12.0, waterD * 0.02037 * waterNdotL / max(0.1, 4.0 * waterNdotV))
      * smoothstep(-0.02, 0.03, dot(waterUp, waterL));
    waterRadiance += vec3(1.0, 0.94, 0.82) * waterGlint * waterSunIntensity;
    outgoingLight = mix(outgoingLight, waterRadiance, waterMask);
  }
}
`
