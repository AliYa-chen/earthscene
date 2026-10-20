/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 示例默认令牌，浏览器设置可覆盖。 / Example default, overridable in browser settings. */
  readonly VITE_CESIUM_ION_TOKEN?: string
  /** 本地开发时文档站 origin；由 `pnpm dev`（scripts/dev.mjs）注入。 */
  readonly VITE_EARTHSCENE_DOCS_ORIGIN?: string
}
