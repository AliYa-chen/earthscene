import earthscene from "../src"
import type {
  Picked3DTilesFeature,
  TilesetLayer,
  ViewerClickEvent,
  ViewerMouseMoveEvent,
} from "../src"
import { bootExampleI18n, t } from "./i18n"
import { createEarthScenePanel, type EarthScenePanel } from "./example-panel-leva"
import { exampleMapServiceConfig, defaultCesiumIonToken } from "./shared"
import { mountLocationReadout } from "./location-readout"

bootExampleI18n()

// 固定 Cesium 官方数据版本，样例包含 10 个可读取批量属性的 feature。
// Pin the official Cesium sample, including batch properties for ten features.
const DEFAULT_TILESET_URL =
  "https://cdn.jsdelivr.net/gh/CesiumGS/cesium@621826db344eb7f1248f6bd50ed4770563127f12/Apps/SampleData/Cesium3DTiles/Batched/BatchedWithBatchTable/tileset.json"
const DEFAULT_TOKEN = defaultCesiumIonToken

const viewerContainer = document.querySelector("#viewer")
const hoverOverlay = document.querySelector<HTMLElement>("#feature-hover")
const popupOverlay = document.querySelector<HTMLElement>("#feature-popup")

if (!(viewerContainer instanceof HTMLElement)) {
  throw new Error("Viewer container not found.")
}

if (!hoverOverlay || !popupOverlay) {
  throw new Error("3D Tiles picking overlays not found.")
}

const container: HTMLElement = viewerContainer
const hoverElement: HTMLElement = hoverOverlay
const popupElement: HTMLElement = popupOverlay

const initialClockTime = new Date()
initialClockTime.setUTCHours(16, 0, 0, 0)

const viewer = new earthscene.Viewer(container, {
  clock: {
    currentTime: initialClockTime,
  },
  // 官方样例位于椭球高度 0–20 米，真实地形会遮住这些合成建筑。
  // The synthetic buildings use ellipsoid heights of 0–20 m; terrain would bury them.
  overlays: exampleMapServiceConfig.createOverlays(),
  camera: {
    destination: {
      longitude: -75.6121,
      latitude: 40.0405,
      height: 300,
    },
    orientation: {
      heading: 0,
      pitch: -35,
      roll: 0,
    },
  },
  scene: {
    atmosphere: {
      lighting: {
        mode: "light-source",
      },
    },
    clouds: {
      show: false,
    }
  },
  highlighter: {
      overlay: {
        color: "#7cff5b",
        opacity: 0.58,
        hoverColor: "#38bdf8",
        hoverOpacity: 0.42,
      },
    },
})

;(window as any).viewer = viewer

let panel: EarthScenePanel<ReturnType<typeof pickingSchema>> | undefined
let activeLayer: TilesetLayer | null = null
let detachLayerEvents: (() => void) | null = null
let selectedKey: string | null = null
let hoverKey: string | null = null

const locationReadout = mountLocationReadout(viewer, {
  parent: container.parentElement ?? document.body,
  position: "left-bottom",
})

function setStatus(message: string) {
  panel?.setStatus(message)
}

function getFeatureKey(feature: Picked3DTilesFeature) {
  return `${feature.layerId}:${feature.object.uuid}:${feature.featureId ?? "object"}`
}

function clearHover() {
  hoverKey = null
  viewer.highlighter.setHover(null)
  hoverElement.hidden = true
}

function clearSelection() {
  selectedKey = null
  viewer.highlighter.clear()
  popupElement.hidden = true
}

function clearActiveLayer() {
  clearHover()
  clearSelection()
  detachLayerEvents?.()
  detachLayerEvents = null
  const previousLayer = activeLayer
  activeLayer = null
  previousLayer?.remove()
}

function failTileset(error: unknown) {
  clearActiveLayer()
  // 请求错误可能带有 token URL，只提取 HTTP 状态码展示。
  // Request errors may contain token-bearing URLs; only display the HTTP code.
  const message = error instanceof Error ? error.message : String(error)
  const code = message.match(/(?:status|code|HTTP)\s*[:=]?\s*(\d{3})/i)?.[1]
  setStatus(code
    ? t({
        zh: "3D Tiles 加载失败（HTTP {code}），请检查数据地址、权限或网络。",
        en: "3D Tiles failed to load (HTTP {code}). Check the URL, access permissions or network.",
      }, { code })
    : t({
        zh: "3D Tiles 加载或解析失败，请检查数据地址、权限、网络和数据格式。",
        en: "3D Tiles failed to load or parse. Check the URL, permissions, network and data format.",
      }))
}

function loadTileset() {
  if (!panel) return
  const sourceType = panel.controls.load.source as "url" | "cesium-ion"
  const url = panel.controls.load.tilesetUrl.trim()
  const assetId = panel.controls.load.assetId.trim()
  const apiToken = panel.controls.load.token.trim() || DEFAULT_TOKEN

  if (sourceType === "url" && !url) {
    setStatus(t({ zh: "请先输入 tileset.json URL。", en: "Enter a tileset.json URL first." }))
    return
  }
  if (sourceType === "cesium-ion" && (!assetId || !apiToken)) {
    setStatus(
      t({
        zh: "请先输入 Cesium Ion asset id 和 token，或打开右上角设置填写 token。",
        en: "Enter asset id and token, or open Settings and paste a token.",
      })
    )
    return
  }

  clearActiveLayer()
  setStatus(getInitialStatus())
  try {
    const layer = viewer.tilesets.add({
      source: sourceType === "url"
        ? { type: "url", url }
        : { type: "cesium-ion", assetId, apiToken },
      id: "example-3d-tiles-picking",
    })
    activeLayer = layer
    let hasModel = false
    const onRootLoaded = () => {
      if (activeLayer !== layer) return
      viewer.flyToTarget(layer.tileset, {
        offset: { heading: 15, pitch: -35 },
        duration: 1.2,
      })
      if (!hasModel) setStatus(t({
        zh: "3D Tiles 索引已加载，正在加载模型。",
        en: "3D Tiles index loaded; loading models.",
      }))
    }
    const onModelLoaded = () => {
      if (activeLayer !== layer || hasModel) return
      hasModel = true
      setStatus(t({
        zh: "3D Tiles 模型已加载。移动鼠标拾取 feature，点击查看属性。",
        en: "3D Tiles model loaded. Hover to pick features; click to view properties.",
      }))
    }
    const onLoadError = (event: { error: unknown }) => {
      if (activeLayer !== layer) return
      failTileset(event.error)
    }
    layer.tileset.addEventListener("load-root-tileset", onRootLoaded)
    layer.tileset.addEventListener("load-model", onModelLoaded)
    layer.tileset.addEventListener("load-error", onLoadError)
    detachLayerEvents = () => {
      layer.tileset.removeEventListener("load-root-tileset", onRootLoaded)
      layer.tileset.removeEventListener("load-model", onModelLoaded)
      layer.tileset.removeEventListener("load-error", onLoadError)
    }
  } catch (error) {
    failTileset(error)
  }
}

function handleMouseMove(event: ViewerMouseMoveEvent) {
  const feature =
    event.pick?.type === "tilesFeature" ? event.pick.feature : null
  if (!feature) {
    clearHover()
    return
  }

  const nextHoverKey = getFeatureKey(feature)
  hoverElement.textContent = getFeatureTitle(feature)
  hoverElement.hidden = false
  positionFloatingElement(hoverElement, event.position.x + 12, event.position.y + 12)

  if (nextHoverKey === selectedKey) {
    hoverKey = nextHoverKey
    viewer.highlighter.setHover(null)
    return
  }

  if (nextHoverKey !== hoverKey) {
    hoverKey = nextHoverKey
    viewer.highlighter.setHover(event.pick)
  }
}

function handleClick(event: ViewerClickEvent) {
  const pick = event.pick
  if (pick?.type !== "tilesFeature") {
    clearSelection()
    return
  }

  const feature = pick.feature
  selectedKey = getFeatureKey(feature)
  viewer.highlighter.set(pick)
  if (hoverKey === selectedKey) {
    viewer.highlighter.setHover(null)
  }
  renderFeaturePopup(feature)
}

function renderFeaturePopup(feature: Picked3DTilesFeature) {
  popupElement.replaceChildren()

  const title = document.createElement("h2")
  title.textContent = getFeatureTitle(feature)
  popupElement.appendChild(title)

  const meta = document.createElement("p")
  meta.textContent = t(
    {
      zh: "图层 {layerId} · feature {featureId}",
      en: "Layer {layerId} · feature {featureId}",
    },
    {
      layerId: feature.layerId,
      featureId: feature.featureId ?? "-",
    }
  )
  popupElement.appendChild(meta)

  const rows = [
    ...Object.entries(feature.properties),
    ["Longitude", feature.cartographic.longitude],
    ["Latitude", feature.cartographic.latitude],
    ["Height", feature.cartographic.height],
  ].slice(0,  18)

  if (rows.length === 0) {
    const empty = document.createElement("p")
    empty.className = "feature-empty"
    empty.textContent = t({
      zh: "当前命中对象没有可读取的 feature 属性。",
      en: "No readable feature properties on this hit.",
    })
    popupElement.appendChild(empty)
  } else {
    const table = document.createElement("table")
    table.className = "feature-properties"
    const tbody = document.createElement("tbody")
    rows.forEach(([key, value]) => {
      const row = document.createElement("tr")
      const th = document.createElement("th")
      const td = document.createElement("td")
      th.textContent = String(key)
      td.textContent = formatValue(value)
      row.append(th, td)
      tbody.appendChild(row)
    })
    table.appendChild(tbody)
    popupElement.appendChild(table)
  }

  popupElement.hidden = false
}

function getFeatureTitle(feature: Picked3DTilesFeature) {
  const properties = feature.properties
  for (const key of ["BIN", "NAME", "Name", "name", "DOITT_ID", "SOURCE_ID", "id"]) {
    const value = properties[key]
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value)
    }
  }

  return feature.featureId === null
    ? "Picked 3D Tiles object"
    : `Feature ${feature.featureId}`
}

function formatValue(value: unknown) {
  if (value === null || value === undefined) return "-"
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(6)
  }
  if (typeof value === "string" || typeof value === "boolean") return String(value)
  if (ArrayBuffer.isView(value)) {
    return Array.from(value as unknown as ArrayLike<number | bigint>).slice(0, 8).join(", ")
  }

  try {
    const text = JSON.stringify(value)
    return text.length > 120 ? `${text.slice(0, 117)}...` : text
  } catch {
    return String(value)
  }
}

function positionFloatingElement(element: HTMLElement, x: number, y: number) {
  const shell = container.parentElement ?? container
  const margin = 16
  const maxX = Math.max(margin, shell.clientWidth - element.offsetWidth - margin)
  const maxY = Math.max(margin, shell.clientHeight - element.offsetHeight - margin)
  element.style.left = `${Math.min(Math.max(x, margin), maxX)}px`
  element.style.top = `${Math.min(Math.max(y, margin), maxY)}px`
}

function getInitialStatus() {
  return t({
    zh: "正在加载 3D Tiles；模型加载完成后可拾取 feature。",
    en: "Loading 3D Tiles; feature picking becomes available after the model loads.",
  })
}

const pickingSchema = () =>
  ({
    load: {
      $: { label: t({ zh: "加载", en: "Load" }) },
      hint: {
        type: "hint" as const,
        value: t({
          zh: "默认加载 Cesium 官方批量属性样例，无需 Ion token。移动鼠标高亮，点击查看属性。",
          en: "The default official Cesium batch-table sample needs no Ion token. Hover to highlight; click to view properties.",
        }),
      },
      source: {
        value: "url",
        label: t({ zh: "数据来源", en: "Source" }),
        options: {
          [t({ zh: "公开 tileset.json", en: "Public tileset.json" })]: "url",
          [t({ zh: "Cesium Ion", en: "Cesium Ion" })]: "cesium-ion",
        },
      },
      tilesetUrl: {
        value: DEFAULT_TILESET_URL,
        label: "tileset.json URL",
      },
      assetId: {
        value: "",
        label: t({ zh: "Cesium Ion asset id", en: "Cesium Ion asset id" }),
      },
      token: {
        value: "",
        label: t({ zh: "Cesium Ion token", en: "Cesium Ion token" }),
      },
      loadTileset: {
        onClick: () => loadTileset(),
        label: t({ zh: "加载", en: "Load" }),
      },
      clearSelection: {
        onClick: () => {
          clearHover()
          clearSelection()
        },
        label: t({ zh: "清除选择", en: "Clear selection" }),
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

panel = createEarthScenePanel(pickingSchema, {
  id: "3d-tiles-picking-panel",
  title: () => t({ zh: "拾取与高亮", en: "Pick & highlight" }),
  statusPath: "status.message",
})

viewer.on("mousemove", handleMouseMove)
viewer.on("click", handleClick)

loadTileset()

window.addEventListener("beforeunload", () => {
  viewer.off("mousemove", handleMouseMove)
  viewer.off("click", handleClick)
  clearActiveLayer()
  locationReadout.destroy()
  panel?.dispose()
  viewer.destroy()
})
