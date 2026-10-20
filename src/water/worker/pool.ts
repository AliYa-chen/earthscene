import type { WaterAreaSource } from '../WaterAreaSource'
import type {
  WaterAreaTileCoordinate,
  WaterAreaTileImageResult,
  WaterAreaTileTask,
  WaterAreaWorkerResponse,
} from './types'
import WaterAreaWorker from './worker?worker&inline'

interface Job {
  id: number
  coordinate: WaterAreaTileCoordinate
  resolve(result: WaterAreaTileImageResult): void
  reject(error: Error): void
}
interface Slot { worker: Worker; job?: Job }

function abortError(): Error {
  return new DOMException('Water-area task cancelled.', 'AbortError')
}

/** 每个水域图像源独享的原生 Worker 池；不依赖宿主构建插件或 Node.js。 / A native Worker pool owned by one water image source, without host build plugins or Node.js. */
export class WaterAreaWorkerPool {
  private readonly slots = new Set<Slot>()
  private readonly queue: Job[] = []
  private readonly maxWorkers = Math.min(4, Math.max(1,
    typeof navigator === 'undefined' ? 2 : (navigator.hardwareConcurrency || 2) - 1,
  ))
  private nextId = 1
  private disposed = false

  constructor(private readonly source: WaterAreaSource) {}

  /** 排队生成水域掩膜；cancel 同时取消排队或正在运行的任务。 / Queue a water mask; cancel stops either a queued or running task. */
  run(coordinate: WaterAreaTileCoordinate): WaterAreaTileTask {
    let job!: Job
    const promise = new Promise<WaterAreaTileImageResult>((resolve, reject) => {
      job = { id: this.nextId++, coordinate: { ...coordinate }, resolve, reject }
    }) as WaterAreaTileTask
    promise.cancel = () => this.cancel(job)
    if (this.disposed) {
      job.reject(abortError())
      return promise
    }
    this.queue.push(job)
    this.dispatch()
    return promise
  }

  /** 立即终止所有线程并取消全部任务；可重复调用。 / Immediately terminate workers and cancel every task; idempotent. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const job of this.queue.splice(0)) job.reject(abortError())
    for (const slot of this.slots) {
      slot.worker.terminate()
      slot.worker.onmessage = null
      slot.worker.onerror = null
      slot.worker.onmessageerror = null
      slot.job?.reject(abortError())
    }
    this.slots.clear()
  }

  private cancel(job: Job): void {
    const index = this.queue.indexOf(job)
    if (index !== -1) {
      this.queue.splice(index, 1)
      job.reject(abortError())
      return
    }
    for (const slot of this.slots) {
      if (slot.job !== job) continue
      this.removeSlot(slot)
      job.reject(abortError())
      this.dispatch()
      return
    }
  }

  private dispatch(): void {
    if (this.disposed) return
    while (this.queue.length) {
      let slot = [...this.slots].find(item => !item.job)
      if (!slot) {
        if (this.slots.size >= this.maxWorkers) return
        try {
          const worker = new WaterAreaWorker({ name: 'earthscene-water' })
          slot = { worker }
          this.slots.add(slot)
          const currentSlot = slot
          worker.onmessage = event => this.receive(currentSlot, event.data as WaterAreaWorkerResponse)
          worker.onerror = event => {
            event.preventDefault()
            this.failSlot(currentSlot)
          }
          worker.onmessageerror = () => this.failSlot(currentSlot)
          worker.postMessage({ type: 'init', source: this.source })
        } catch {
          // 不透传 Worker 加载地址或源模板中的凭据。
          if (slot) this.removeSlot(slot)
          this.queue.shift()!.reject(new Error('Water-area worker could not start.'))
          continue
        }
      }
      const job = this.queue.shift()!
      slot.job = job
      try {
        slot.worker.postMessage({ type: 'run', id: job.id, coordinate: job.coordinate })
      } catch {
        this.removeSlot(slot)
        job.reject(new Error('Water-area task could not be sent to its worker.'))
      }
    }
  }

  private receive(slot: Slot, message: WaterAreaWorkerResponse): void {
    const job = slot.job
    if (!this.slots.has(slot) || !job || message.id !== job.id) {
      message.result?.image?.close()
      return
    }
    slot.job = undefined
    if (message.error) {
      const error = new Error(message.error.message)
      error.name = message.error.name
      job.reject(error)
    } else if (message.result) {
      job.resolve(message.result)
    } else {
      job.reject(new Error('Water-area worker returned no mask.'))
    }
    this.dispatch()
  }

  private failSlot(slot: Slot): void {
    if (!this.slots.has(slot)) return
    const job = slot.job
    this.removeSlot(slot)
    job?.reject(new Error('Water-area worker failed.'))
    this.dispatch()
  }

  private removeSlot(slot: Slot): void {
    slot.worker.onmessage = null
    slot.worker.onerror = null
    slot.worker.onmessageerror = null
    slot.worker.terminate()
    this.slots.delete(slot)
  }
}
