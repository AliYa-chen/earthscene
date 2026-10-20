import {
  Cartesian3,
  Ellipsoid,
  OrthographicFrustum,
  OrthographicOffCenterFrustum,
  PostProcessStage,
  PostProcessStageComposite,
  PostProcessStageSampleMode,
  SceneMode,
  type Viewer,
} from 'cesium'

/**
 * 云的渲染质量；控制采样次数；云缓冲固定为半分辨率。
 * Cloud quality, controlling ray samples; the cloud buffer remains at half resolution.
 */
export type CloudQuality = 'low' | 'medium' | 'high' | 'ultra'

/**
 * 体积云参数。高度、厚度以米为单位，风速以米/秒为单位。
 * Volumetric cloud options. Heights are in meters and wind speed in meters/second.
 */
export interface CloudOptions {
  /** 是否启用云。 / Whether clouds are enabled. */
  enabled: boolean
  /** 云覆盖率，0 到 1。 / Cloud coverage, from 0 to 1. */
  coverage: number
  /** 云底相对椭球的高度。 / Cloud base altitude above the ellipsoid. */
  altitude: number
  /** 云层厚度。 / Cloud layer thickness. */
  thickness: number
  /** 使用真实经过时间推进的风速。 / Wind speed advanced using real elapsed time. */
  windSpeed: number
  /** 云的渲染质量。 / Cloud render quality. */
  quality: CloudQuality
  /** 是否采样小尺度细节。 / Whether to sample small-scale detail. */
  detail: boolean
  /** 是否扰动云形。 / Whether to perturb cloud shapes. */
  turbulence: boolean
  /** 是否在可见不透明表面上估算云影。 / Estimate cloud shadows on visible opaque surfaces. */
  shadows: boolean
  /** 是否加入近似空气透视。 / Whether to add approximate aerial perspective. */
  haze: boolean
  /** 是否在雾中估算受云遮挡的日照散射。 / Estimate cloud-occluded sunlight scattering in haze. */
  lightShafts: boolean
}

const defaults: CloudOptions = {
  enabled: true,
  coverage: 0.35,
  altitude: 2500,
  thickness: 650,
  windSpeed: 15,
  quality: 'medium',
  detail: true,
  turbulence: true,
  shadows: true,
  haze: true,
  lightShafts: false,
}

const presets = {
  low: { samples: 32, lightSamples: 3 },
  medium: { samples: 56, lightSamples: 4 },
  high: { samples: 88, lightSamples: 5 },
  ultra: { samples: 128, lightSamples: 6 },
} as const

// Work in kilometers to keep ECEF arithmetic away from meter-scale large numbers.
// No shader below depends on renderer internals or a second WebGL context.
const CLOUD_TEXTURE_SCALE = 0.5

const sharedShader = /* glsl */ `
uniform sampler2D depthTexture;
uniform vec3 u_cameraKm;
uniform vec3 u_radiiKm;
uniform vec3 u_windKm;
uniform float u_altitudeKm;
uniform float u_thicknessKm;
uniform float u_coverage;
uniform float u_detail;
uniform float u_turbulence;
uniform float u_lightSamples;

float hash31(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

float noise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash31(i), hash31(i + vec3(1,0,0)), f.x),
        mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x),
        mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y), f.z);
}

float fbm(vec3 p) {
  return 0.57 * noise3(p) + 0.28 * noise3(p * 2.03 + 17.0)
    + 0.15 * noise3(p * 4.07 - 11.0);
}

// Ellipsoidal shells approximate geodetic heights; no flat cloud plane at the horizon.
float altitudeKm(vec3 p) {
  float scaledRadius = length(p / u_radiiKm);
  return length(p) * (1.0 - 1.0 / max(scaledRadius, 0.00001));
}

vec2 intersectEllipsoid(vec3 ro, vec3 rd, vec3 radii) {
  vec3 o = ro / radii;
  vec3 d = rd / radii;
  float a = dot(d, d);
  float b = dot(o, d);
  float c = dot(o, o) - 1.0;
  float discriminant = b * b - a * c;
  if (discriminant < 0.0) return vec2(1.0, -1.0);
  float root = sqrt(discriminant);
  return vec2((-b - root) / a, (-b + root) / a);
}

vec2 cloudSegment(vec3 ro, vec3 rd, float maxDistance) {
  vec2 outer = intersectEllipsoid(ro, rd, u_radiiKm + u_altitudeKm + u_thicknessKm);
  float start = max(outer.x, 0.0);
  float end = min(outer.y, maxDistance);
  if (end <= start) return vec2(1.0, -1.0);
  vec2 inner = intersectEllipsoid(ro, rd, u_radiiKm + u_altitudeKm);
  if (inner.y > start && inner.x < end) {
    if (inner.x > start) end = min(end, inner.x);
    else start = max(start, inner.y);
  }
  return vec2(start, end);
}

float density(vec3 p, bool fine) {
  if (u_coverage <= 0.0001) return 0.0;
  float h = (altitudeKm(p) - u_altitudeKm) / u_thicknessKm;
  if (h <= 0.0 || h >= 1.0) return 0.0;
  float profile = smoothstep(0.0, 0.12, h) * (1.0 - smoothstep(0.58, 1.0, h));
  vec3 q = (p + u_windKm) * 0.65;
  if (u_turbulence > 0.5) q += vec3(noise3(q * 0.47 + 3.1) - 0.5) * 0.65;
  float weather = noise3((p + u_windKm) * 0.075);
  float shape = fbm(q) * 0.82 + weather * 0.18;
  float threshold = 0.82 - u_coverage * 0.65;
  float body = smoothstep(threshold - 0.08, threshold + 0.16, shape);
  if (fine && u_detail > 0.5) body -= (1.0 - noise3(q * 7.7)) * 0.18 * (1.0 - body);
  return max(body, 0.0) * profile * 1.5;
}

vec3 rayDirection(vec2 uv) {
  vec4 eye = czm_inverseProjection * vec4(uv * 2.0 - 1.0, 1.0, 1.0);
  return normalize(mat3(czm_inverseView) * normalize(eye.xyz));
}

float opaqueDistanceKm(vec2 uv) {
  // A PostProcessStage receives the raw depth-stencil texture (not RGBA packed depth).
  float depth = texture(depthTexture, uv).r;
  if (depth >= 1.0 || depth <= 0.0) return 120.0;
  vec2 windowXY = czm_viewport.xy + uv * czm_viewport.zw;
  // This overload reverses logarithmic depth itself. Do not reverse it twice.
  vec4 positionEC = czm_windowToEyeCoordinates(windowXY, depth);
  return min(length(positionEC.xyz / positionEC.w) * 0.001, 120.0);
}

float sceneDistanceKm(vec2 uv, vec3 rd) {
  float distanceKm = opaqueDistanceKm(uv);
  vec2 planet = intersectEllipsoid(u_cameraKm, rd, u_radiiKm);
  if (planet.x > 0.0) distanceKm = min(distanceKm, planet.x);
  return distanceKm;
}

float sunlight(vec3 p) {
  vec3 sun = normalize(czm_sunDirectionWC);
  if (dot(normalize(p / (u_radiiKm * u_radiiKm)), sun) < -0.02) return 0.0;
  vec2 segment = cloudSegment(p, sun, 40.0);
  if (segment.y <= segment.x) return 1.0;
  float stepLength = (segment.y - segment.x) / u_lightSamples;
  float opticalDepth = 0.0;
  for (int i = 0; i < 6; i++) {
    if (float(i) >= u_lightSamples) break;
    float t = segment.x + (float(i) + 0.5) * stepLength;
    opticalDepth += density(p + sun * t, false) * stepLength * 4.0;
  }
  return exp(-min(opticalDepth, 20.0));
}
`

const cloudShader = sharedShader + /* glsl */ `
in vec2 v_textureCoordinates;
uniform float u_samples;

void main() {
  vec2 uv = v_textureCoordinates;
  vec3 rd = rayDirection(uv);
  vec2 segment = cloudSegment(u_cameraKm, rd, sceneDistanceKm(uv, rd));
  if (segment.y <= segment.x || u_coverage <= 0.0001) {
    out_FragColor = vec4(0.0);
    return;
  }
  float stepLength = (segment.y - segment.x) / u_samples;
  // Stable spatial jitter: no temporal history is assumed by this first implementation.
  float jitter = fract(dot(floor(gl_FragCoord.xy), vec2(0.75487766, 0.56984029)));
  vec3 radiance = vec3(0.0);
  float transmittance = 1.0;
  vec3 sun = normalize(czm_sunDirectionWC);
  float mu = dot(rd, sun);
  float forward = 0.18 / pow(max(1.0 + 0.36 - 1.2 * mu, 0.08), 1.5);
  for (int i = 0; i < 128; i++) {
    if (float(i) >= u_samples || transmittance < 0.015) break;
    float t = segment.x + (float(i) + jitter) * stepLength;
    vec3 p = u_cameraKm + rd * t;
    float d = density(p, true);
    if (d < 0.001) continue;
    float daylight = smoothstep(-0.08, 0.18, dot(normalize(p), sun));
    float lit = sunlight(p);
    vec3 ambient = mix(vec3(0.018, 0.028, 0.055), vec3(0.23, 0.29, 0.36), daylight);
    vec3 sunColor = mix(vec3(1.0, 0.36, 0.12), vec3(1.0, 0.94, 0.83),
      smoothstep(0.02, 0.35, dot(normalize(p), sun)));
    vec3 illumination = ambient + sunColor * lit * daylight * (0.8 + forward);
    // Tone map only cloud radiance: Cesium has already tone mapped the background.
    vec3 cloudColor = 1.0 - exp(-illumination * 1.7);
    float opacity = 1.0 - exp(-d * stepLength * 4.0);
    radiance += transmittance * opacity * cloudColor;
    transmittance *= 1.0 - opacity;
  }
  out_FragColor = vec4(radiance, 1.0 - transmittance);
}
`

const compositeShader = sharedShader + /* glsl */ `
in vec2 v_textureCoordinates;
uniform sampler2D colorTexture;
uniform sampler2D u_cloudTexture;
uniform vec3 u_cloudTexel;
uniform float u_shadows;
uniform float u_haze;
uniform float u_lightShafts;

void main() {
  vec2 uv = v_textureCoordinates;
  vec4 original = texture(colorTexture, uv);
  vec3 rd = rayDirection(uv);
  float distanceKm = sceneDistanceKm(uv, rd);
  vec3 p = u_cameraKm + rd * distanceKm;
  vec3 base = pow(max(original.rgb, vec3(0.0)), vec3(2.2));
  float daylight = smoothstep(-0.08, 0.18, dot(normalize(p), normalize(czm_sunDirectionWC)));
  if (u_shadows > 0.5 && distanceKm < 119.0 && altitudeKm(p) < u_altitudeKm) {
    base *= mix(1.0, 0.48 + 0.52 * sunlight(p), daylight);
  }
  if (u_haze > 0.5 && distanceKm < 119.0) {
    float fog = min(1.0 - exp(-distanceKm * 0.013), 0.32) * daylight;
    vec3 haze = vec3(0.34, 0.47, 0.63);
    if (u_lightShafts > 0.5 && u_coverage > 0.0001) {
      float lit = 0.0;
      for (int i = 0; i < 4; i++) {
        vec3 samplePosition = u_cameraKm + rd * (distanceKm * (float(i) + 0.5) / 4.0);
        lit += sunlight(samplePosition) * 0.25;
      }
      float facing = pow(max(dot(rd, normalize(czm_sunDirectionWC)), 0.0), 8.0);
      haze += vec3(0.7, 0.55, 0.32) * lit * facing;
      fog *= 0.35 + 0.65 * lit;
    }
    base = mix(base, haze, fog);
  }
  // Four-tap depth-aware upscale keeps reduced cloud resolution off foreground edges.
  vec4 clouds = vec4(0.0);
  float weightSum = 0.0;
  for (int y = 0; y < 2; y++) {
    for (int x = 0; x < 2; x++) {
      vec2 tap = clamp(uv + (vec2(float(x), float(y)) - 0.5) * u_cloudTexel.xy,
        vec2(0.0), vec2(1.0));
      float sampleDistance = opaqueDistanceKm(tap);
      float weight = exp(-abs(sampleDistance - opaqueDistanceKm(uv)) /
        max(0.02, distanceKm * 0.015));
      clouds += texture(u_cloudTexture, tap) * weight;
      weightSum += weight;
    }
  }
  clouds /= max(weightSum, 0.0001);
  vec2 segment = cloudSegment(u_cameraKm, rd, distanceKm);
  if (segment.y <= segment.x) clouds = vec4(0.0);
  vec3 color = clouds.rgb + base * (1.0 - clouds.a);
  out_FragColor = vec4(pow(max(color, vec3(0.0)), vec3(1.0 / 2.2)), original.a);
}
`

let nextId = 0

function finiteClamp(value: number, fallback: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : fallback))
}

/**
 * 使用 Cesium 公共后处理接口渲染球壳体积云，支持地形深度遮挡。
 * Render ellipsoidal volumetric clouds with terrain depth occlusion using public Cesium APIs.
 */
export class ESClouds {
  /**
   * 可直接修改的运行时参数；每帧读取，质量变化只调整采样，不改变其它后处理的顺序。
   * Mutable runtime options, read every frame; quality changes adjust samples without reordering other stages.
   */
  readonly options: CloudOptions
  private readonly cameraKm = new Cartesian3()
  private readonly radiiKm = new Cartesian3()
  private readonly windKm = new Cartesian3()
  private readonly cloudTexel = new Cartesian3()
  private composite: PostProcessStageComposite | undefined
  private removePostUpdate: (() => void) | undefined
  private lastFrameTime = performance.now()
  private lastOptions = ''
  private destroyed = false

  /**
   * 将云阶段装入现有 Cesium Viewer；不接管相机、时间或原生大气。
   * Attach cloud stages to an existing Cesium Viewer without taking over its camera, clock, or atmosphere.
   */
  constructor(private readonly viewer: Viewer, options: Partial<CloudOptions> = {}) {
    if (viewer.isDestroyed()) throw new Error('Cannot attach to a destroyed Cesium Viewer.')
    this.options = { ...defaults, ...options }
    const scene = viewer.scene
    Cartesian3.multiplyByScalar((scene.globe?.ellipsoid ?? Ellipsoid.WGS84).radii, 0.001, this.radiiKm)
    this.normalizeOptions()
    try {
      this.attachStages()
      this.update()
      this.removePostUpdate = scene.postUpdate.addEventListener(() => this.update())
    } catch (error) {
      this.destroy()
      throw error
    }
  }

  /**
   * 切换采样质量，不重建阶段或调整使用方的后处理顺序。
   * Change sampling quality without rebuilding stages or reordering application effects.
   */
  setQuality(quality: CloudQuality): void {
    if (this.destroyed) throw new Error('ESClouds has been destroyed.')
    if (!Object.prototype.hasOwnProperty.call(presets, quality)) {
      throw new RangeError(`Unknown cloud quality: ${quality}`)
    }
    this.options.quality = quality
    this.viewer.scene.requestRender()
  }

  /**
   * 释放监听器、纹理与后处理阶段；可以重复调用。
   * Release listeners, textures, and post-process stages; safe to call repeatedly.
   */
  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.removePostUpdate?.()
    if (!this.viewer.isDestroyed() && this.composite) {
      this.viewer.scene.postProcessStages.remove(this.composite)
      this.viewer.scene.requestRender()
    }
    this.composite = undefined
  }

  private normalizeOptions(): void {
    const o = this.options
    o.coverage = finiteClamp(o.coverage, defaults.coverage, 0, 1)
    o.altitude = finiteClamp(o.altitude, defaults.altitude, 100, 20000)
    o.thickness = finiteClamp(o.thickness, defaults.thickness, 50, 10000)
    o.windSpeed = finiteClamp(o.windSpeed, defaults.windSpeed, -100, 100)
    if (!Object.prototype.hasOwnProperty.call(presets, o.quality)) o.quality = defaults.quality
  }

  private update(): void {
    if (this.destroyed) return
    this.normalizeOptions()
    const scene = this.viewer.scene
    const now = performance.now()
    const delta = Math.min((now - this.lastFrameTime) * 0.001, 0.1)
    this.lastFrameTime = now
    this.windKm.x = (this.windKm.x + this.options.windSpeed * delta * 0.001) % 4096
    this.windKm.y = this.windKm.x * 0.37
    Cartesian3.multiplyByScalar(this.viewer.camera.positionWC, 0.001, this.cameraKm)
    const scale = CLOUD_TEXTURE_SCALE
    this.cloudTexel.x = 1 / Math.max(1, Math.ceil(scene.drawingBufferWidth * scale))
    this.cloudTexel.y = 1 / Math.max(1, Math.ceil(scene.drawingBufferHeight * scale))
    if (this.composite) {
      this.composite.enabled = this.options.enabled && scene.mode === SceneMode.SCENE3D
        && !(this.viewer.camera.frustum instanceof OrthographicFrustum)
        && !(this.viewer.camera.frustum instanceof OrthographicOffCenterFrustum)
        && this.viewer.camera.positionCartographic.height < 100000
    }
    const snapshot = JSON.stringify(this.options)
    if (snapshot !== this.lastOptions || (this.composite?.enabled && this.options.windSpeed !== 0)) {
      scene.requestRender()
      this.lastOptions = snapshot
    }
  }

  private attachStages(): void {
    const scene = this.viewer.scene
    const name = `earthscene-clouds-${nextId++}`
    const sharedUniforms = {
      u_cameraKm: () => this.cameraKm,
      u_radiiKm: () => this.radiiKm,
      u_windKm: () => this.windKm,
      u_altitudeKm: () => this.options.altitude * 0.001,
      u_thicknessKm: () => this.options.thickness * 0.001,
      u_coverage: () => this.options.coverage,
      u_detail: () => Number(this.options.detail),
      u_turbulence: () => Number(this.options.turbulence),
      u_lightSamples: () => presets[this.options.quality].lightSamples,
    }
    const clouds = new PostProcessStage({
      name,
      fragmentShader: cloudShader,
      textureScale: CLOUD_TEXTURE_SCALE,
      sampleMode: PostProcessStageSampleMode.LINEAR,
      uniforms: { ...sharedUniforms, u_samples: () => presets[this.options.quality].samples },
    })
    const combine = new PostProcessStage({
      name: `${name}-composite`,
      fragmentShader: compositeShader,
      sampleMode: PostProcessStageSampleMode.LINEAR,
      uniforms: {
        ...sharedUniforms,
        u_cloudTexture: name,
        u_cloudTexel: () => this.cloudTexel,
        u_shadows: () => Number(this.options.shadows),
        u_haze: () => Number(this.options.haze),
        u_lightShafts: () => Number(this.options.lightShafts),
      },
    })
    const replacement = new PostProcessStageComposite({
      name: `${name}-pipeline`,
      stages: [clouds, combine],
      inputPreviousStageTexture: false,
    })
    scene.postProcessStages.add(replacement)
    this.composite = replacement
  }
}
