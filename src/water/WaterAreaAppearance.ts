/** 水域材质与波纹参数。 / Water material and wave options. */
export interface WaterAreaAppearanceOptions {
  /** 是否显示水域外观。 / Whether to show the water appearance. */
  show?: boolean
  /** 水面颜色，使用六位十六进制格式。 / Water color as a six-digit hexadecimal string. */
  color?: string
  /** 水色与原影像的混合比例，范围 0–1。 / Water-color blend with original imagery, from 0 to 1. */
  colorMix?: number
  /** 水面粗糙度，范围 0.05–0.8。 / Water roughness, from 0.05 to 0.8. */
  roughness?: number
  /** 波纹强度，范围 0–1。 / Wave strength, from 0 to 1. */
  waveStrength?: number
  /** 波纹尺度，范围 0.25–4。 / Wave scale, from 0.25 to 4. */
  waveScale?: number
  /** 波纹流动速度，范围 0–2。 / Wave-flow speed, from 0 to 2. */
  waveSpeed?: number
  /** 波纹流动方向，单位为度。 / Wave-flow direction in degrees. */
  waveDirection?: number
}

/** 解析并归一化后的水域参数。 / Resolved and normalized water appearance options. */
export interface ResolvedWaterAreaAppearance {
  show: boolean
  color: string
  colorMix: number
  roughness: number
  waveStrength: number
  waveScale: number
  waveSpeed: number
  waveDirection: number
}

/** 可在运行时更新的水域外观。 / Runtime water appearance controls. */
export interface WaterAreaAppearance extends ResolvedWaterAreaAppearance {
  /** 合并并应用外观参数。 / Merge and apply appearance options. */
  assign(options: WaterAreaAppearanceOptions): void
  /** 返回当前参数的副本。 / Return a copy of the current options. */
  toJSON(): ResolvedWaterAreaAppearance
}

export const DEFAULT_WATER_AREA_APPEARANCE: Readonly<ResolvedWaterAreaAppearance> =
  Object.freeze({
    show: true,
    color: '#06172d',
    colorMix: 0.8,
    roughness: 0.11,
    waveStrength: 0.8,
    waveScale: 0.3,
    waveSpeed: 0.5,
    waveDirection: 160
  })

function normalizeNumber(
  value: number | undefined,
  minimum: number,
  maximum: number,
  fallback: number
): number {
  return Number.isFinite(value)
    ? Math.min(Math.max(value as number, minimum), maximum)
    : fallback
}

function normalizeDirection(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_WATER_AREA_APPEARANCE.waveDirection
  }
  return (((value as number) % 360) + 360) % 360
}

function normalizeColor(value: string | undefined): string {
  return typeof value === 'string' && /^#[\da-f]{6}$/i.test(value)
    ? value.toLowerCase()
    : DEFAULT_WATER_AREA_APPEARANCE.color
}

export function normalizeWaterAreaAppearance(
  options: WaterAreaAppearanceOptions = {}
): ResolvedWaterAreaAppearance {
  return {
    show: options.show ?? DEFAULT_WATER_AREA_APPEARANCE.show,
    color: normalizeColor(options.color),
    colorMix: normalizeNumber(
      options.colorMix,
      0,
      1,
      DEFAULT_WATER_AREA_APPEARANCE.colorMix
    ),
    roughness: normalizeNumber(
      options.roughness,
      0.05,
      0.8,
      DEFAULT_WATER_AREA_APPEARANCE.roughness
    ),
    waveStrength: normalizeNumber(
      options.waveStrength,
      0,
      1,
      DEFAULT_WATER_AREA_APPEARANCE.waveStrength
    ),
    waveScale: normalizeNumber(
      options.waveScale,
      0.25,
      4,
      DEFAULT_WATER_AREA_APPEARANCE.waveScale
    ),
    waveSpeed: normalizeNumber(
      options.waveSpeed,
      0,
      2,
      DEFAULT_WATER_AREA_APPEARANCE.waveSpeed
    ),
    waveDirection: normalizeDirection(options.waveDirection)
  }
}
