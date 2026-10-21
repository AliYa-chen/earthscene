import { LoadingManager } from 'three'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js'
import { getEarthSceneAssetUrl } from '../config'
import type { EarthSceneRenderer } from '../rendering/RendererAdapter'

const BUILTIN_DRACO_PATH = 'earthscene-internal://draco/'
const BUILTIN_BASIS_PATH = 'earthscene-internal://basis/'

function createAssetManager(assets: Record<string, string>) {
  const manager = new LoadingManager()
  manager.setURLModifier((url) => assets[url] ?? url)
  return manager
}

/** 创建 Draco 解码器，只替换其内部资源地址。 / Create a Draco decoder resolving only its own internal resource URLs. */
export function createBuiltinDracoLoader(decoderPath?: string) {
  const useBuiltinAssets = decoderPath === undefined
  const manager = useBuiltinAssets
    ? createAssetManager({
        [`${BUILTIN_DRACO_PATH}draco_decoder.js`]: getEarthSceneAssetUrl('dracoDecoder'),
        [`${BUILTIN_DRACO_PATH}draco_wasm_wrapper.js`]: getEarthSceneAssetUrl('dracoWasmWrapper'),
        [`${BUILTIN_DRACO_PATH}draco_decoder.wasm`]: getEarthSceneAssetUrl('dracoWasm')
      })
    : new LoadingManager()

  return new DRACOLoader(manager).setDecoderPath(decoderPath ?? BUILTIN_DRACO_PATH)
}

/** 创建随包提供的 Basis 转码器。 / Create the packaged Basis transcoder. */
export function createBuiltinKTX2Loader() {
  const manager = createAssetManager({
    [`${BUILTIN_BASIS_PATH}basis_transcoder.js`]: getEarthSceneAssetUrl('basisTranscoder'),
    [`${BUILTIN_BASIS_PATH}basis_transcoder.wasm`]: getEarthSceneAssetUrl('basisWasm')
  })

  return new KTX2Loader(manager).setTranscoderPath(BUILTIN_BASIS_PATH)
}

/** 等待 renderer 初始化后探测转码目标格式。 / Detect transcoding formats only after the renderer is initialized. */
export function initializeBuiltinKTX2Support(
  loader: KTX2Loader,
  renderer: EarthSceneRenderer,
  rendererReady: Promise<void>,
  isDisposed: () => boolean = () => false
) {
  return rendererReady.then(() => {
    if (!isDisposed()) loader.detectSupport(renderer)
  })
}

export const builtinTranscoderPaths = {
  draco: BUILTIN_DRACO_PATH,
  basis: BUILTIN_BASIS_PATH
} as const
