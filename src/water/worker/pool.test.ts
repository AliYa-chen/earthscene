import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WaterAreaWorkerPool } from './pool'
import type { WaterAreaWorkerResponse } from './types'

vi.mock('./worker?worker&inline', () => ({
  default: class {
    constructor(options: WorkerOptions) { return new Worker('inline-water', options) }
  },
}))

class FakeWorker {
  static instances: FakeWorker[] = []
  messages: unknown[] = []
  terminated = false
  onmessage: ((event: MessageEvent<WaterAreaWorkerResponse>) => void) | null = null
  onerror: ((event: { preventDefault(): void }) => void) | null = null
  onmessageerror: (() => void) | null = null
  constructor() { FakeWorker.instances.push(this) }
  postMessage(message: unknown) { this.messages.push(message) }
  terminate() { this.terminated = true }
  get taskId() { return (this.messages[this.messages.length - 1] as { id: number }).id }
  respond(response: Omit<WaterAreaWorkerResponse, 'id'>) {
    this.onmessage?.({ data: { id: this.taskId, ...response } } as MessageEvent<WaterAreaWorkerResponse>)
  }
}

beforeEach(() => {
  FakeWorker.instances = []
  vi.stubGlobal('Worker', FakeWorker)
  vi.stubGlobal('navigator', { hardwareConcurrency: 8 })
})
afterEach(() => vi.unstubAllGlobals())

describe('WaterAreaWorkerPool', () => {
  it('starts lazily, initializes each worker once, and reuses it for sequential tasks', async () => {
    const pool = new WaterAreaWorkerPool({ type: 'osm' })
    expect(FakeWorker.instances).toHaveLength(0)
    const first = pool.run({ x: 0, y: 0, z: 0 })
    const worker = FakeWorker.instances[0]
    expect(worker.messages[0]).toEqual({ type: 'init', source: { type: 'osm' } })
    worker.respond({ result: { solid: 'land' } })
    await expect(first).resolves.toEqual({ solid: 'land' })
    const second = pool.run({ x: 1, y: 0, z: 1 })
    expect(FakeWorker.instances).toHaveLength(1)
    expect(worker.messages).toHaveLength(3)
    worker.respond({ result: { solid: 'water' } })
    await expect(second).resolves.toEqual({ solid: 'water' })
    pool.dispose()
  })

  it('limits concurrency to four workers and allows queued cancellation', async () => {
    const pool = new WaterAreaWorkerPool({ type: 'osm' })
    const tasks = Array.from({ length: 6 }, () => pool.run({ x: 0, y: 0, z: 0 }))
    const completed = tasks.map(task => task.catch(error => error as Error))
    expect(FakeWorker.instances).toHaveLength(4)
    tasks[4].cancel()
    FakeWorker.instances[0].respond({ result: { solid: 'land' } })
    expect(FakeWorker.instances[0].messages).toHaveLength(3)
    pool.dispose()
    const results = await Promise.all(completed)
    expect(results[0]).toEqual({ solid: 'land' })
    expect((results[4] as Error).name).toBe('AbortError')
  })

  it('terminates the worker of a running cancelled task and continues other work', async () => {
    vi.stubGlobal('navigator', { hardwareConcurrency: 2 })
    const pool = new WaterAreaWorkerPool({ type: 'osm' })
    const first = pool.run({ x: 0, y: 0, z: 0 })
    const firstResult = first.catch(error => error as Error)
    const second = pool.run({ x: 0, y: 0, z: 0 })
    first.cancel()
    expect(FakeWorker.instances[0].terminated).toBe(true)
    expect(FakeWorker.instances).toHaveLength(2)
    FakeWorker.instances[1].respond({ result: { solid: 'water' } })
    expect((await firstResult as Error).name).toBe('AbortError')
    await expect(second).resolves.toEqual({ solid: 'water' })
    pool.dispose()
  })

  it('disposes active and queued work, and rejects work after disposal', async () => {
    vi.stubGlobal('navigator', { hardwareConcurrency: 2 })
    const pool = new WaterAreaWorkerPool({ type: 'osm' })
    const results = [pool.run({ x: 0, y: 0, z: 0 }), pool.run({ x: 0, y: 0, z: 0 })]
      .map(task => task.catch(error => error as Error))
    pool.dispose()
    pool.dispose()
    expect(FakeWorker.instances.every(worker => worker.terminated)).toBe(true)
    expect((await Promise.all(results)).map(error => (error as Error).name)).toEqual(['AbortError', 'AbortError'])
    await expect(pool.run({ x: 0, y: 0, z: 0 })).rejects.toHaveProperty('name', 'AbortError')
  })

  it('contains worker startup errors without exposing a credential URL', async () => {
    vi.stubGlobal('Worker', class { constructor() { throw new Error('https://user:secret@test.invalid') } })
    const pool = new WaterAreaWorkerPool({ type: 'osm' })
    await expect(pool.run({ x: 0, y: 0, z: 0 })).rejects.toThrow('Water-area worker could not start.')
    pool.dispose()
  })

  it('recovers after worker errors instead of leaving the queue stalled', async () => {
    vi.stubGlobal('navigator', { hardwareConcurrency: 2 })
    const pool = new WaterAreaWorkerPool({ type: 'osm' })
    const first = pool.run({ x: 0, y: 0, z: 0 })
    const firstResult = first.catch(error => error as Error)
    const second = pool.run({ x: 0, y: 0, z: 0 })
    FakeWorker.instances[0].onerror?.({ preventDefault() {} })
    expect((await firstResult as Error).message).toBe('Water-area worker failed.')
    FakeWorker.instances[1].respond({ result: { solid: 'land' } })
    await expect(second).resolves.toEqual({ solid: 'land' })
    pool.dispose()
  })
})
