import type { TilesetLayer } from "../src"
import earthscene from "../src"
import { bootExampleI18n, t } from "./i18n"
import { createEarthScenePanel, type EarthScenePanel } from "./example-panel-leva"
import { exampleMapServiceConfig, defaultCesiumIonToken } from "./shared"

bootExampleI18n()

// CesiumGS official RGB point-cloud test fixture, pinned for reproducibility.
// Synthetic sample: 1,000 points, not a city scan and no ion credentials required.
const PUBLIC_POINT_CLOUD_URL =
  "https://raw.githubusercontent.com/CesiumGS/cesium/621826db344eb7f1248f6bd50ed4770563127f12/Specs/Data/Cesium3DTiles/PointCloud/PointCloudRGB/tileset.json"
const DEFAULT_ASSET_ID = import.meta.env.VITE_CESIUM_ION_POINT_CLOUD_ASSET_ID ?? ""
const DEFAULT_ION_TOKEN = defaultCesiumIonToken
const INITIAL_VIEW = {
  latitude: 40.0386,
  longitude: -75.6133,
  height: 120,
  heading: 25,
  pitch: -22,
  roll: 0,
}

const container = document.querySelector("#viewer")

if (!(container instanceof HTMLElement)) {
  throw new Error("Viewer container not found.")
}

const initialClockTime = new Date()
initialClockTime.setUTCHours(2, 0, 0, 0)

const viewer = new earthscene.Viewer(container, {
  clock: {
    currentTime: initialClockTime,
  },
  // The synthetic fixture is positioned above the ellipsoid, not real terrain.
  overlays: exampleMapServiceConfig.createOverlays(),
  camera: {
    destination: {
      longitude: INITIAL_VIEW.longitude,
      latitude: INITIAL_VIEW.latitude,
      height: INITIAL_VIEW.height,
    },
    orientation: {
      heading: INITIAL_VIEW.heading,
      pitch: INITIAL_VIEW.pitch,
      roll: INITIAL_VIEW.roll,
    },
  },
  scene: {
    atmosphere: {
      lighting: {
        mode: "post-process",
      },
    },
    clouds: {
      show: false,
    },
  },
  widgets: {
    timeline: true,
  },
})

;(window as any).viewer = viewer

let panel: EarthScenePanel<ReturnType<typeof pointCloudSchema>> | undefined
let activeLayer: TilesetLayer | null = null
let isPublicSample = false

function setStatus(message: string) {
  panel?.setStatus(message)
}

function getMaximumAttenuation(currentPanel: EarthScenePanel<ReturnType<typeof pointCloudSchema>>) {
  const size = currentPanel.controls.shading.pointSize
  return Number.isFinite(size) ? Math.min(32, Math.max(1, size)) : 8
}

function syncPointCloudShading(currentPanel: EarthScenePanel<ReturnType<typeof pointCloudSchema>>) {
  if (!activeLayer) return
  const { shading } = currentPanel.controls
  const shadingState = activeLayer.pointCloudShading
  shadingState.attenuation = shading.attenuation
  shadingState.eyeDomeLighting = shading.edl
  shadingState.eyeDomeLightingStrength = 0.55
  shadingState.eyeDomeLightingRadius = 1.0
  shadingState.maximumAttenuation = getMaximumAttenuation(currentPanel)
  shadingState.geometricErrorScale = 1
}

function flyToPointCloud() {
  if (!activeLayer) return
  viewer.flyToTarget(activeLayer.tileset, {
    offset: {
      heading: 30,
      pitch: -25,
      ...(isPublicSample ? { distance: 25 } : {}),
    },
  })
}

function loadPointCloudTileset() {
  if (!panel) return
  const assetId = panel.controls.load.assetId.trim() || DEFAULT_ASSET_ID
  const apiToken = panel.controls.load.token.trim() || DEFAULT_ION_TOKEN
  const usesIon = panel.controls.load.source === "ion"
  const url = panel.controls.load.url.trim()

  if ((usesIon && (!assetId || !apiToken)) || (!usesIon && !url)) {
    setStatus(
      usesIon ? t({
        zh: "请先输入 Cesium Ion asset id 和 token，或打开右上角设置填写 token。",
        en: "Enter Cesium Ion asset id and token, or open Settings and paste a token.",
      }) : t({
        zh: "请输入可访问的点云 tileset.json URL。",
        en: "Enter an accessible point-cloud tileset.json URL.",
      })
    )
    return
  }

  activeLayer?.remove()
  isPublicSample = !usesIon && url === PUBLIC_POINT_CLOUD_URL
  activeLayer = viewer.tilesets.add({
    source: usesIon ? {
      type: "cesium-ion",
      assetId: assetId,
      apiToken: apiToken,
    } : {
      type: "url",
      url,
    },
    id: "example-point-cloud-3d-tiles",
    pointCloudShading: {
      attenuation: panel.controls.shading.attenuation,
      eyeDomeLighting: panel.controls.shading.edl,
      eyeDomeLightingStrength: 0.55,
      eyeDomeLightingRadius: 1.0,
      geometricErrorScale: 1,
      maximumAttenuation: getMaximumAttenuation(panel),
      normalShading: true,
    },
  })

  const layer = activeLayer
  layer.tileset.addEventListener("load-root-tileset", () => {
    if (activeLayer !== layer) return
    setStatus(t({
      zh: "点云目录已加载，正在加载点数据。可调整点大小、距离衰减和 EDL。",
      en: "Point-cloud tileset loaded; loading point data. Adjust point size, attenuation and EDL.",
    }))
  })
  layer.tileset.addEventListener("load-model", () => {
    if (activeLayer !== layer) return
    setStatus(t({
      zh: "点云已显示。可调整点大小、距离衰减和 EDL。",
      en: "Point cloud displayed. Adjust point size, attenuation and EDL.",
    }))
  })
  layer.tileset.addEventListener("load-error", (event) => {
    if (activeLayer !== layer) return
    const error = event.error as unknown
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "error" in error
          ? String((error as { error: unknown }).error)
          : String(error ?? "unknown")
    setStatus(
      t(
        {
          zh: "点云加载失败：{message}。请检查 URL；Ion 资产还需确认账户权限和 token 的资产授权。",
          en: "Point cloud loading failed: {message}. Check the URL; ion assets also require account access and token authorization.",
        },
        { message }
      )
    )
  })

  flyToPointCloud()

  setStatus(
    t({
      zh: "正在加载点云 3D Tiles...",
      en: "Loading point cloud 3D Tiles...",
    })
  )
}

function getInitialStatus() {
  return t({
    zh: "默认加载 Cesium 官方 1,000 点 RGB 测试样本，无需 token。",
    en: "Loads Cesium's official 1,000-point RGB test fixture without a token.",
  })
}

const pointCloudSchema = () =>
  ({
    load: {
      $: { label: t({ zh: "加载", en: "Load" }) },
      hint: {
        type: "hint" as const,
        value: t({
          zh: "官方公开 RGB 合成点云，非城市扫描；使用椭球地面。也可加载自有 URL 或 Ion 资产。",
          en: "Official synthetic RGB points, not a city scan; uses the ellipsoid surface. Custom URLs and ion assets are also supported.",
        }),
      },
      source: {
        value: "url",
        options: {
          [t({ zh: "公开 / 自定义 URL", en: "Public / custom URL" })]: "url",
          "Cesium Ion": "ion",
        },
        label: t({ zh: "来源", en: "Source" }),
      },
      url: {
        value: PUBLIC_POINT_CLOUD_URL,
        label: "tileset.json URL",
      },
      assetId: {
        value: DEFAULT_ASSET_ID,
        label: t({ zh: "Cesium Ion asset id", en: "Cesium Ion asset id" }),
      },
      token: {
        value: "",
        label: t({ zh: "Cesium Ion token", en: "Cesium Ion token" }),
      },
      loadTileset: {
        onClick: () => loadPointCloudTileset(),
        label: t({ zh: "加载", en: "Load" }),
      },
      flyTo: {
        onClick: () => flyToPointCloud(),
        label: t({ zh: "定位点云", en: "Fly to point cloud" }),
      },
    },
    shading: {
      $: { label: t({ zh: "点云着色", en: "Point cloud shading" }) },
      pointSize: {
        value: 8,
        min: 1,
        max: 32,
        step: 1,
        label: t({ zh: "点大小", en: "Point size" }),
      },
      attenuation: {
        value: true,
        label: t({ zh: "距离衰减", en: "Attenuation" }),
      },
      edl: {
        value: true,
        label: t({ zh: "眼穹光照 EDL", en: "Eye-dome lighting" }),
      },
    },
    status: {
      $: { label: t({ zh: "状态", en: "Status" }) },
      message: {
        type: "hint" as const,
        value: getInitialStatus(),
      },
    },
  }) as const

function bindPanelInteractions(
  currentPanel: EarthScenePanel<ReturnType<typeof pointCloudSchema>>
) {
  const { controls } = currentPanel
  return controls.effect(() => {
    const usesIon = controls.load.source === "ion"
    controls.visibility("load.url", !usesIon)
    controls.visibility("load.assetId", usesIon)
    controls.visibility("load.token", usesIon)
    void controls.shading.pointSize
    void controls.shading.attenuation
    void controls.shading.edl
    syncPointCloudShading(currentPanel)
  })
}

panel = createEarthScenePanel(pointCloudSchema, {
  id: "point-cloud-panel",
  title: () => t({ zh: "点云 3D Tiles", en: "Point cloud 3D Tiles" }),
  statusPath: "status.message",
  onRebuild: bindPanelInteractions,
})

loadPointCloudTileset()

window.addEventListener("beforeunload", () => {
  panel?.dispose()
  viewer.destroy()
})
