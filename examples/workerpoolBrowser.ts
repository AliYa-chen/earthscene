import type { Plugin } from 'vite'

const prefix = '\0earthscene:workerpool-browser:'
const nodeBackends = new Set(['worker_threads', 'os', 'child_process'])

/**
 * 只将 workerpool 的 Node.js 后端隔离在示例浏览器构建之外。
 * Isolate only workerpool's Node.js backends from the example browser builds.
 */
export function workerpoolBrowser(): Plugin {
  return {
    name: 'earthscene-workerpool-browser',
    enforce: 'pre',
    resolveId(source, importer) {
      const builtin = source.replace(/^node:/, '')
      if (!nodeBackends.has(builtin) || !importer) return null
      const path = importer.replace(/\\/g, '/')
      if (!path.includes('/node_modules/workerpool/')) return null
      return prefix + builtin
    },
    load(id) {
      if (!id.startsWith(prefix)) return null
      const builtin = id.slice(prefix.length)
      if (!nodeBackends.has(builtin)) return null
      const message = JSON.stringify(`workerpool: Node.js backend '${builtin}' is unavailable in browser examples; use workerType: 'web'.`)
      const fail = `function unsupported() { throw new Error(${message}); }`
      switch (builtin) {
        case 'os':
          return `${fail}\nexport const cpus = unsupported; export default { cpus };`
        case 'child_process':
          return `${fail}\nexport const fork = unsupported; export default { fork };`
        case 'worker_threads':
          return `${fail}\nexport const Worker = unsupported; export const parentPort = null; export const isMainThread = true; export default { Worker, parentPort, isMainThread };`
      }
      return null
    },
  }
}
