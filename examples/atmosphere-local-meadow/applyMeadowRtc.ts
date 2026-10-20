import * as THREE from "three"
import { RTCAutoUniforms } from "../../src"
import {
  createEncodedCartesian3,
  encodeCartesian3,
} from "../../src/utils/EncodedCartesian3"

const MEADOW_RTC_KEY = "earthsceneMeadowRtc"
const MEADOW_RTC_CACHE_KEY = "earthscene-meadow-object-rtc"

const RTC_HELPERS = /* glsl */ `
uniform vec3 u_earthsceneObjectHigh;
uniform vec3 u_earthsceneObjectLow;
uniform vec3 u_cameraHigh;
uniform vec3 u_cameraLow;
uniform mat4 u_viewMatrixRTE;
uniform mat4 u_projectionMatrix;

vec3 earthsceneObjectRtcOffset() {
  return (u_earthsceneObjectHigh - u_cameraHigh) + (u_earthsceneObjectLow - u_cameraLow);
}

vec4 earthsceneProjectRtc(vec3 localWorld) {
  vec3 worldPosRTE = earthsceneObjectRtcOffset() + localWorld;
  return u_projectionMatrix * u_viewMatrixRTE * vec4(worldPosRTE, 1.0);
}
`

const PROJECT_VERTEX = /* glsl */ `
	vec4 mvPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		mvPosition = batchingMatrix * mvPosition;
	#endif
	#ifdef USE_INSTANCING
		mvPosition = instanceMatrix * mvPosition;
	#endif
	vec3 localWorld = ( modelMatrix * mvPosition ).xyz;
	gl_Position = earthsceneProjectRtc( localWorld );
`

type ShaderWithUniforms = {
  vertexShader: string
  fragmentShader: string
  uniforms: Record<string, THREE.IUniform>
}

export type MeadowRtcState = {
  rtcUniforms: RTCAutoUniforms
  objectHigh: THREE.IUniform<THREE.Vector3>
  objectLow: THREE.IUniform<THREE.Vector3>
}

/**
 * 草地物体级 RTC：平移走 high/low，顶点留在局部坐标，避免 ECEF 大数抖动。
 *
 * Object-level RTC for the meadow: origin is encoded high/low while vertices
 * stay in local space, avoiding ECEF jitter.
 */
export function createMeadowRtc(camera: THREE.Camera): MeadowRtcState {
  return {
    rtcUniforms: new RTCAutoUniforms(camera),
    objectHigh: { value: new THREE.Vector3() },
    objectLow: { value: new THREE.Vector3() },
  }
}

export function setMeadowRtcOrigin(state: MeadowRtcState, origin: THREE.Vector3) {
  const encoded = createEncodedCartesian3()
  encodeCartesian3(origin, encoded)
  state.objectHigh.value.copy(encoded.high)
  state.objectLow.value.copy(encoded.low)
}

export function injectMeadowRtcShader(
  shader: ShaderWithUniforms,
  state: MeadowRtcState
) {
  Object.assign(shader.uniforms, {
    ...state.rtcUniforms.uniforms,
    u_earthsceneObjectHigh: state.objectHigh,
    u_earthsceneObjectLow: state.objectLow,
  })
  if (shader.vertexShader.includes("earthsceneProjectRtc")) return

  shader.vertexShader = `${RTC_HELPERS}\n${shader.vertexShader}`

  if (shader.vertexShader.includes("#include <project_vertex>")) {
    shader.vertexShader = shader.vertexShader.replace(
      "#include <project_vertex>",
      PROJECT_VERTEX
    )
  }

  shader.vertexShader = shader.vertexShader.replace(
    "vWorldPosition = (instanceWorldMatrix * vec4(transformed, 1.0)).xyz;",
    `vec3 earthsceneLocalWorld = (instanceWorldMatrix * vec4(transformed, 1.0)).xyz;
    vWorldPosition = u_cameraHigh + u_cameraLow + earthsceneObjectRtcOffset() + earthsceneLocalWorld;`
  )
  shader.vertexShader = shader.vertexShader.replace(
    "gl_Position = projectionMatrix * viewMatrix * worldPosition;",
    shader.vertexShader.includes("earthsceneLocalWorld")
      ? "gl_Position = earthsceneProjectRtc(earthsceneLocalWorld);"
      : "gl_Position = earthsceneProjectRtc(worldPosition.xyz);"
  )

  if (
    shader.vertexShader.includes("#include <project_vertex>") ||
    shader.vertexShader.includes("gl_Position = projectionMatrix * viewMatrix * worldPosition;")
  ) {
    console.error("[EarthScene] meadow RTC did not patch the vertex projection path.")
  }
}

export function applyMeadowRtc(root: THREE.Object3D, state: MeadowRtcState) {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.frustumCulled = false
    patchMaterial(mesh.material, state)
    if (mesh.customDepthMaterial) patchMaterial(mesh.customDepthMaterial, state)
  })
}

function patchMaterial(material: THREE.Material | THREE.Material[], state: MeadowRtcState) {
  const materials = Array.isArray(material) ? material : [material]
  for (const item of materials) {
    if (item.userData[MEADOW_RTC_KEY]) continue
    item.userData[MEADOW_RTC_KEY] = true
    const previousOnBeforeCompile = item.onBeforeCompile
    const previousCacheKey = item.customProgramCacheKey.bind(item)
    item.onBeforeCompile = function (
      this: THREE.Material,
      shader: THREE.WebGLProgramParametersWithUniforms,
      renderer: THREE.WebGLRenderer
    ) {
      previousOnBeforeCompile.call(this, shader, renderer)
      injectMeadowRtcShader(shader, state)
    }
    item.customProgramCacheKey = () => `${previousCacheKey()}|${MEADOW_RTC_CACHE_KEY}`
    item.needsUpdate = true
  }
}
