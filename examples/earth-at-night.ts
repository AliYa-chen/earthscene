import earthscene, { type ImageryLayerSourceOptions } from "../src"
import { bootExampleI18n, t } from "./i18n"
import { createEarthScenePanel, type EarthScenePanel } from "./example-panel-leva"
import { CESIUM_ION_WORLD_TERRAIN_ASSET_ID } from "./map-sources.config"
import { defaultCesiumIonToken } from "./shared"

bootExampleI18n()

const CESIUM_ION_BING_AERIAL_ASSET_ID = 2

const container = document.querySelector("#viewer")
if (!(container instanceof HTMLElement)) {
  throw new Error("Viewer container not found.")
}

function createIonImagerySource(assetId: number): ImageryLayerSourceOptions | undefined {
  if (!defaultCesiumIonToken) return undefined
  return {
    type: "cesium-ion",
    assetId,
    apiToken: defaultCesiumIonToken,
  }
}

const daySource = createIonImagerySource(CESIUM_ION_BING_AERIAL_ASSET_ID)
// NASA GIBS 提供公开夜光瓦片，不依赖私有 Ion 资产权限。
// Public NASA GIBS night imagery does not depend on private Ion asset access.
const nightSource: ImageryLayerSourceOptions = {
  type: "wmts",
  url: "https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/VIIRS_CityLights_2012/default/2012-01-01/500m/{TileMatrix}/{TileRow}/{TileCol}.jpg",
  layer: "VIIRS_CityLights_2012",
  tileMatrixSet: "500m",
  format: "image/jpeg",
  projection: "EPSG:4326",
  tileDimension: 512,
  // GIBS 的矩阵不是标准 2×1 倍增网格；数值来自官方 GetCapabilities。
  // GIBS uses a nonstandard matrix; these values come from its GetCapabilities.
  tileMatrices: [[2, 1], [3, 2], [5, 3], [10, 5], [20, 10], [40, 20], [80, 40], [160, 80]]
    .map(([matrixWidth, matrixHeight], level) => {
      const span = 288 / 2 ** level
      const radians = Math.PI / 180
      return {
        identifier: String(level), matrixWidth, matrixHeight,
        tileWidth: 512, tileHeight: 512,
        tileBounds: [-180, 90 - matrixHeight * span, -180 + matrixWidth * span, 90]
          .map(value => value * radians) as [number, number, number, number],
      }
    }),
}

const initialClockTime = new Date()
initialClockTime.setUTCHours(12, 0, 0, 0)

const viewer = new earthscene.Viewer(container, {
  clock: {
    currentTime: initialClockTime,
    shouldAnimate: true,
    multiplier: 3600,
  },
  terrain: defaultCesiumIonToken
    ? {
        type: "cesium-ion",
        assetId: CESIUM_ION_WORLD_TERRAIN_ASSET_ID,
        apiToken: defaultCesiumIonToken,
        tileLoading: { enableTileSplitting: true },
      }
    : undefined,
  overlays: [
    ...(daySource
      ? [{ id: "day", name: "Daytime", source: daySource }]
      : []),
    ...(nightSource
      ? [
          {
            id: "night",
            name: "Night lights",
            source: nightSource,
            style: { dayOpacity: 0 },
          },
        ]
      : []),
  ],
  camera: {
    destination: {
      longitude: 20,
      latitude: 20,
      height: 18000000,
    },
    orientation: {
      heading: 0,
      pitch: -90,
    },
    projection: {
      far: 40000000,
    },
  },
  scene: {
    atmosphere: {
      lighting: {
        mode: "light-source",
      },
      night: {
        enabled: true,
        moonLight: true,
      },
      sky: {
        stars: {
          show: true,
        },
      },
    },
    clouds: {
      show: false,
    },
  },
})

const dayLayer = viewer.overlays.get("day")
const nightLayer = viewer.overlays.get("night")
;(window as any).viewer = viewer

const overlaySchema = () =>
  ({
    day: {
      $: { label: t({ zh: "白天底图", en: "Daytime imagery" }) },
      opacity: {
        value: dayLayer?.getStyle().opacity ?? 1,
        min: 0,
        max: 1,
        step: 0.01,
        label: "opacity",
      },
      dayOpacity: {
        value: dayLayer?.getStyle().dayOpacity ?? 1,
        min: 0,
        max: 1,
        step: 0.01,
        label: "dayOpacity",
      },
      nightOpacity: {
        value: dayLayer?.getStyle().nightOpacity ?? 1,
        min: 0,
        max: 1,
        step: 0.01,
        label: "nightOpacity",
      },
    },
    night: {
      $: { label: t({ zh: "夜光", en: "Night lights" }) },
      opacity: {
        value: nightLayer?.getStyle().opacity ?? 1,
        min: 0,
        max: 1,
        step: 0.01,
        label: "opacity",
      },
      dayOpacity: {
        value: nightLayer?.getStyle().dayOpacity ?? 0,
        min: 0,
        max: 1,
        step: 0.01,
        label: "dayOpacity",
      },
      nightOpacity: {
        value: nightLayer?.getStyle().nightOpacity ?? 1,
        min: 0,
        max: 1,
        step: 0.01,
        label: "nightOpacity",
      },
    },
    clock: {
      $: { label: t({ zh: "时钟", en: "Clock" }) },
      playing: {
        value: viewer.clock.shouldAnimate,
        label: t({ zh: "播放", en: "Play" }),
      },
      multiplier: {
        value: viewer.clock.multiplier,
        min: 0,
        max: 20000,
        step: 100,
        label: "clock.multiplier",
      },
    },
    status: {
      $: { label: t({ zh: "状态", en: "Status" }) },
      message: {
        type: "hint" as const,
        value: defaultCesiumIonToken
          ? t({
              zh: "白天 Bing 航空（Ion 2），夜光 NASA GIBS VIIRS（2012），地形 World Terrain（Ion 1）。",
              en: "Daytime Bing Aerial (Ion 2), night lights NASA GIBS VIIRS (2012), World Terrain (Ion 1).",
            })
          : t({
              zh: "夜光使用公开 NASA GIBS 瓦片；白天影像与地形需要在右上角设置 Ion token。",
              en: "Night lights use public NASA GIBS tiles; daytime imagery and terrain require an Ion token in Settings.",
            }),
      },
    },
  }) as const

function bindPanelInteractions(
  currentPanel: EarthScenePanel<ReturnType<typeof overlaySchema>>
) {
  const { controls } = currentPanel
  return controls.effect(() => {
    dayLayer?.setStyle({
      opacity: controls.day.opacity,
      dayOpacity: controls.day.dayOpacity,
      nightOpacity: controls.day.nightOpacity,
    })
    nightLayer?.setStyle({
      opacity: controls.night.opacity,
      dayOpacity: controls.night.dayOpacity,
      nightOpacity: controls.night.nightOpacity,
    })
    viewer.clock.shouldAnimate = controls.clock.playing
    viewer.clock.multiplier = controls.clock.multiplier
  })
}

createEarthScenePanel(overlaySchema, {
  id: "earth-at-night",
  title: () => t({ zh: "昼夜影像", en: "Day / night overlays" }),
  statusPath: "status.message",
  onRebuild: bindPanelInteractions,
})

window.addEventListener("beforeunload", () => {
  viewer.destroy()
})
