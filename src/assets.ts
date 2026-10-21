import localWeather from './assets/earthscene/local_weather.png?inline'
import turbulence from './assets/earthscene/turbulence.png?inline'
import shape from './assets/earthscene/shape.bin?inline'
import shapeDetail from './assets/earthscene/shape_detail.bin?inline'
import stbn from './assets/earthscene/stbn.bin?inline'
import stars from './assets/earthscene/stars.bin?inline'
import dracoDecoder from 'three/examples/jsm/libs/draco/draco_decoder.js?inline'
import dracoWasmWrapper from 'three/examples/jsm/libs/draco/draco_wasm_wrapper.js?inline'
import dracoWasm from 'three/examples/jsm/libs/draco/draco_decoder.wasm?inline'
import basisTranscoder from 'three/examples/jsm/libs/basis/basis_transcoder.js?inline'
import basisWasm from 'three/examples/jsm/libs/basis/basis_transcoder.wasm?inline'
import waterNormal1 from './water/assets/Water_1_M_Normal.jpg?inline'
import waterNormal2 from './water/assets/Water_2_M_Normal.jpg?inline'

/**
 * EarthScene 内置运行资源名称。
 *
 * Built-in EarthScene runtime asset names.
 */
export type EarthSceneAssetName =
  | 'localWeather'
  | 'turbulence'
  | 'shape'
  | 'shapeDetail'
  | 'stbn'
  | 'stars'
  | 'dracoDecoder'
  | 'dracoWasmWrapper'
  | 'dracoWasm'
  | 'basisTranscoder'
  | 'basisWasm'
  | 'waterNormal1'
  | 'waterNormal2'

/**
 * EarthScene 内置运行资源相对目录。
 *
 * Relative paths for built-in EarthScene runtime assets.
 */
export const earthsceneAssetFileNames: Record<EarthSceneAssetName, string> = {
  localWeather: 'local_weather.png',
  turbulence: 'turbulence.png',
  shape: 'shape.bin',
  shapeDetail: 'shape_detail.bin',
  stbn: 'stbn.bin',
  stars: 'stars.bin',
  dracoDecoder: 'draco/draco_decoder.js',
  dracoWasmWrapper: 'draco/draco_wasm_wrapper.js',
  dracoWasm: 'draco/draco_decoder.wasm',
  basisTranscoder: 'basis/basis_transcoder.js',
  basisWasm: 'basis/basis_transcoder.wasm',
  waterNormal1: 'water/Water_1_M_Normal.jpg',
  waterNormal2: 'water/Water_2_M_Normal.jpg'
}

/**
 * EarthScene 内置运行资源 URL。默认内容随 npm 包内联，使用方无需部署静态资源目录。
 *
 * Built-in EarthScene runtime asset URLs. Contents are inlined into the npm package by default,
 * so consumers do not need to deploy a separate static asset directory.
 */
export const earthsceneAssetUrls: Record<EarthSceneAssetName, string> = {
  localWeather,
  turbulence,
  shape,
  shapeDetail,
  stbn,
  stars,
  dracoDecoder,
  dracoWasmWrapper,
  dracoWasm,
  basisTranscoder,
  basisWasm,
  waterNormal1,
  waterNormal2
}
