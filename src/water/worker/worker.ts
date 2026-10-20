import type { WaterAreaSource } from '../WaterAreaSource'
import type { WaterAreaTileCoordinate, WaterAreaWorkerResponse } from './types'
import { computeWaterAreaTileImage } from './tasks/computeWaterAreaTileImage'

type Request = { type: 'init'; source: WaterAreaSource } | {
  type: 'run'; id: number; coordinate: WaterAreaTileCoordinate
}
const workerScope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<Request>) => void) | null
  postMessage(message: WaterAreaWorkerResponse, transfer?: Transferable[]): void
}
let source: WaterAreaSource | undefined

workerScope.onmessage = ({ data }) => {
  if (data.type === 'init') { source = data.source; return }
  if (data.type !== 'run') return
  void execute(data)
}

async function execute({ id, coordinate }: Extract<Request, { type: 'run' }>): Promise<void> {
  try {
    if (!source) throw new Error('Water-area source is unavailable.')
    const result = await computeWaterAreaTileImage(coordinate, source)
    workerScope.postMessage({ id, result }, result.image ? [result.image] : [])
  } catch {
    // URL 可能含查询凭据：不将底层 fetch/解码错误回传到应用日志。
    workerScope.postMessage({ id, error: { name: 'Error', message: 'Water-area mask could not be generated. Check source data or network access.' } })
  }
}
