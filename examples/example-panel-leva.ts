/**
 * 示例 Leva 面板：`leva-vanilla` 原生 GUI + EarthScene accent 主题（见 `styles.css`）。
 *
 * Example Leva panels: native leva-vanilla GUI with EarthScene accent overrides in `styles.css`.
 * Locale changes rebuild the panel from {@link schemaFactory} and restore control values.
 */

import { leva } from "leva-vanilla"
import { mountDOM } from "leva-vanilla/gui"
import type { LevaGUI } from "leva-vanilla/gui"
import type { AnyController, LevaPosition, Schema, ValidateSchema } from "leva-vanilla/src/core/types"

import { onLocaleChange } from "./i18n"

export type EarthScenePanelOptions<T extends Schema = Schema> = {
  id?: string
  /** 面板标题；传函数可在 locale 重建时重新取文案。 */
  title: string | (() => string)
  container?: HTMLElement
  position?: LevaPosition
  /** 点分路径，例如 `status.message`，供 {@link EarthScenePanel.setStatus} 写入。 */
  statusPath?: string
  /**
   * 面板初次挂载与每次 locale 重建后调用；返回清理函数（下次重建 / dispose 前执行）。
   * Called after initial mount and each locale rebuild; return a cleanup for effects/listeners.
   */
  onRebuild?: (panel: EarthScenePanel<T>) => void | (() => void)
}

export type EarthScenePanelControls<T extends Schema> = ReturnType<typeof leva<T>> & {
  effect: (fn: () => void) => () => void
  visibility: (path: string, visible: boolean) => void
  dispose: () => void
}

export type EarthScenePanel<T extends Schema = Schema> = {
  root: HTMLElement
  readonly controls: EarthScenePanelControls<T>
  setStatus: (message: string) => void
  setFieldDisabled: (path: string, disabled: boolean) => void
  getFieldElement: (path: string) => HTMLElement | null
  dispose: () => void
}

type InternalStore = EarthScenePanelControls<Schema> & {
  _controllers: Record<string, AnyController>
}

export function createEarthScenePanel<T extends Schema>(
  schemaFactory: () => T,
  options: EarthScenePanelOptions<T>
): EarthScenePanel<T> {
  const container =
    options.container ??
    document.querySelector<HTMLElement>(".viewer-shell") ??
    document.body

  let gui: LevaGUI | null = null
  let controls = null as unknown as EarthScenePanelControls<T>
  let rebuildCleanup: (() => void) | undefined
  let disposed = false

  const getFieldElement = (path: string) => {
    const key = path.split(".").pop()
    if (!key) return null
    return container.querySelector<HTMLElement>(`.leva__input[name="${key}"]`)
  }

  const setFieldDisabled = (path: string, disabled: boolean) => {
    const element = getFieldElement(path)
    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLButtonElement ||
      element instanceof HTMLSelectElement ||
      element instanceof HTMLTextAreaElement
    ) {
      element.disabled = disabled
    }
  }

  const setStatus = (message: string) => {
    if (!options.statusPath) return
    setControlValue(controls, options.statusPath, message)
  }

  const runRebuildHook = () => {
    rebuildCleanup?.()
    rebuildCleanup = undefined
    if (!options.onRebuild) return
    const cleanup = options.onRebuild(panel)
    if (typeof cleanup === "function") {
      rebuildCleanup = cleanup
    }
  }

  const mountPanel = (snapshot?: Record<string, unknown>) => {
    const schema = schemaFactory()
    const mountedControls = leva<T>(schema as T & ValidateSchema<T> & Parameters<typeof leva<T>>[0], { gui: false })
    controls = mountedControls as EarthScenePanelControls<T>
    // 上游返回类型隐藏内部字段，但 mountDOM 消费同一个 store 上的非枚举字段。
    // The store return type hides the non-enumerable fields consumed by mountDOM.
    gui = mountDOM(mountedControls as typeof mountedControls & Parameters<typeof mountDOM>[0], {
      title: resolvePanelTitle(options.title),
      panel: options.id ?? "default",
      container,
      position: options.position ?? { top: 12, left: 12 },
    })
    gui.root.dataset.earthscenePanel = options.id ?? "default"

    if (snapshot) {
      restoreControlSnapshot(controls, snapshot)
    }
  }

  const rebuildForLocale = () => {
    if (disposed) return

    const snapshot = captureControlSnapshot(controls)
    rebuildCleanup?.()
    rebuildCleanup = undefined
    gui?.dispose()
    controls.dispose()
    mountPanel(snapshot)
    runRebuildHook()
  }

  mountPanel()

  let unsubscribeLocale: (() => void) | undefined

  const panel: EarthScenePanel<T> = {
    get root() {
      return gui!.root
    },
    get controls() {
      return controls
    },
    setStatus,
    setFieldDisabled,
    getFieldElement,
    dispose: () => {
      if (disposed) return
      disposed = true
      unsubscribeLocale?.()
      rebuildCleanup?.()
      rebuildCleanup = undefined
      gui?.dispose()
      controls.dispose()
      gui = null
    },
  }

  runRebuildHook()

  unsubscribeLocale = onLocaleChange(() => {
    rebuildForLocale()
  })

  return panel
}

function resolvePanelTitle(title: string | (() => string)) {
  return typeof title === "function" ? title() : title
}

function captureControlSnapshot(
  controls: EarthScenePanelControls<Schema>
): Record<string, unknown> {
  const store = controls as InternalStore
  const snapshot: Record<string, unknown> = {}

  for (const path in store._controllers) {
    snapshot[path] = readControlValue(controls, path)
  }

  return snapshot
}

function restoreControlSnapshot(
  controls: EarthScenePanelControls<Schema>,
  snapshot: Record<string, unknown>
) {
  for (const path in snapshot) {
    setControlValue(controls, path, snapshot[path])
  }
}

function readControlValue(controls: Record<string, unknown>, path: string) {
  const keys = path.split(".")
  let cursor: unknown = controls
  for (const key of keys) {
    cursor = (cursor as Record<string, unknown>)[key]
  }
  return cursor
}

function setControlValue(
  controls: Record<string, unknown>,
  path: string,
  value: unknown
) {
  const keys = path.split(".")
  let cursor = controls
  for (let index = 0; index < keys.length - 1; index++) {
    cursor = cursor[keys[index]!] as Record<string, unknown>
  }
  cursor[keys[keys.length - 1]!] = value
}
