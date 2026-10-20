/** 水面天空环境反射参数。 / Sky-environment reflection options for water. */
export interface WaterAreaEnvironmentOptions {
  /** 是否启用天空反射。 / Whether to enable sky reflections. */
  enabled?: boolean
  /** 天空反射强度，范围 0–2。 / Sky-reflection intensity, from 0 to 2. */
  intensity?: number
}

/** 水面光学参数。 / Water optics options. */
export interface WaterAreaOpticsOptions {
  /** 天空环境反射。 / Sky-environment reflection. */
  environment?: WaterAreaEnvironmentOptions
}

export interface ResolvedWaterAreaOptics {
  environment: Required<WaterAreaEnvironmentOptions>
}

export interface WaterAreaEnvironment
  extends Required<WaterAreaEnvironmentOptions> {}

/** 可在运行时更新的水面光学状态。 / Runtime water optics controls. */
export interface WaterAreaOptics {
  /** 天空反射状态。 / Sky-reflection state. */
  readonly environment: WaterAreaEnvironment
  /** 合并并应用光学参数。 / Merge and apply optics options. */
  assign(options: WaterAreaOpticsOptions): void
  /** 返回当前参数的副本。 / Return a copy of the current options. */
  toJSON(): ResolvedWaterAreaOptics
}

const DEFAULT_WATER_AREA_ENVIRONMENT = Object.freeze({
  enabled: true,
  intensity: 1
})

export const DEFAULT_WATER_AREA_OPTICS: Readonly<ResolvedWaterAreaOptics> =
  Object.freeze({
    environment: DEFAULT_WATER_AREA_ENVIRONMENT
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

export function normalizeWaterAreaOptics(
  options: WaterAreaOpticsOptions = {}
): ResolvedWaterAreaOptics {
  return {
    environment: {
      enabled:
        options.environment?.enabled ??
        DEFAULT_WATER_AREA_OPTICS.environment.enabled,
      intensity: normalizeNumber(
        options.environment?.intensity,
        0,
        2,
        DEFAULT_WATER_AREA_OPTICS.environment.intensity
      )
    }
  }
}
