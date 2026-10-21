import { describe, expect, it, vi } from 'vitest'
import {
  builtinTranscoderPaths,
  createBuiltinDracoLoader,
  createBuiltinKTX2Loader,
  initializeBuiltinKTX2Support
} from '../loaders/builtinTranscoders'
import type { EarthSceneRenderer } from '../rendering/RendererAdapter'

vi.mock('../config', () => ({
  getEarthSceneAssetUrl: (assetName: string) => `package-asset://${assetName}`
}))

describe('built-in glTF transcoders', () => {
  it('maps only the built-in Draco decoder URLs to packaged assets', () => {
    const loader = createBuiltinDracoLoader()

    expect(loader.manager.resolveURL(`${builtinTranscoderPaths.draco}draco_decoder.js`))
      .toBe('package-asset://dracoDecoder')
    expect(loader.manager.resolveURL(`${builtinTranscoderPaths.draco}draco_wasm_wrapper.js`))
      .toBe('package-asset://dracoWasmWrapper')
    expect(loader.manager.resolveURL(`${builtinTranscoderPaths.draco}draco_decoder.wasm`))
      .toBe('package-asset://dracoWasm')

    const businessUrl = 'https://example.com/models/draco_decoder.js'
    expect(loader.manager.resolveURL(businessUrl)).toBe(businessUrl)
    loader.dispose()
  })

  it('preserves an explicitly configured Draco decoder path without package URL rewriting', () => {
    const loader = createBuiltinDracoLoader('/custom/draco/')
    const customUrl = '/custom/draco/draco_decoder.wasm'

    expect((loader as unknown as { decoderPath: string }).decoderPath).toBe('/custom/draco/')
    expect(loader.manager.resolveURL(customUrl)).toBe(customUrl)
    loader.dispose()
  })

  it('maps only the built-in Basis transcoder URLs to packaged assets', () => {
    const loader = createBuiltinKTX2Loader()

    expect(loader.manager.resolveURL(`${builtinTranscoderPaths.basis}basis_transcoder.js`))
      .toBe('package-asset://basisTranscoder')
    expect(loader.manager.resolveURL(`${builtinTranscoderPaths.basis}basis_transcoder.wasm`))
      .toBe('package-asset://basisWasm')

    const businessUrl = 'https://example.com/models/basis_transcoder.wasm'
    expect(loader.manager.resolveURL(businessUrl)).toBe(businessUrl)
    loader.dispose()
  })

  it('waits for WebGPU initialization before detecting Basis output formats', async () => {
    const loader = createBuiltinKTX2Loader()
    const detectSupport = vi.spyOn(loader, 'detectSupport').mockReturnValue(loader)
    let finishInitialization!: () => void
    const rendererReady = new Promise<void>((resolve) => { finishInitialization = resolve })
    const renderer = { isWebGPURenderer: true } as unknown as EarthSceneRenderer

    const supportReady = initializeBuiltinKTX2Support(loader, renderer, rendererReady)
    expect(detectSupport).not.toHaveBeenCalled()

    finishInitialization()
    await supportReady
    expect(detectSupport).toHaveBeenCalledWith(renderer)
    loader.dispose()
  })

  it('skips deferred detection after the owner is destroyed', async () => {
    const loader = createBuiltinKTX2Loader()
    const detectSupport = vi.spyOn(loader, 'detectSupport').mockReturnValue(loader)
    const renderer = { isWebGPURenderer: true } as unknown as EarthSceneRenderer

    await initializeBuiltinKTX2Support(loader, renderer, Promise.resolve(), () => true)

    expect(detectSupport).not.toHaveBeenCalled()
    loader.dispose()
  })
})
