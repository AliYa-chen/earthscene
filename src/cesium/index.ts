import { Viewer } from "./Viewer"
import { VolumetricClouds } from "./VolumetricClouds"
import { volumetricClouds } from "./plugins/volumetricClouds"

export { Viewer, VolumetricClouds, volumetricClouds }
export type { ViewerOptions } from "./Viewer"
export type { CloudOptions, CloudQuality } from "./VolumetricClouds"
export type { CesiumPlugin, InstalledPlugin } from "./Plugin"

/**
 * EarthScene 的 Cesium 入口。
 * The Cesium entry point for EarthScene.
 */
const EarthScene = { Viewer, VolumetricClouds, volumetricClouds }

export default EarthScene
