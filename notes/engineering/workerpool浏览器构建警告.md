# workerpool 浏览器构建警告

2026-10-20 对 EdgePages 的生产构建警告排查。`workerpool@10.0.3` 的 browser 字段已经选用 `dist/workerpool.js`，但该通用 UMD 包仍含 Node 后端的条件 require，Vite 静态扫描后会报告 worker_threads、os、child_process 外部化。换 min 文件仍有同类引用。

水域 worker pool 显式指定 `workerType: 'web'`。示例 Vite 插件仅在导入方位于 workerpool 包内时将三个 Node 内建模块映射至延迟报错的浏览器替身；浏览器分支不调用它们，误用 Node 后端则明确失败。不影响其它包的解析，也不关闭通用警告或为宿主安装 polyfill。

主页面构建与独立 Worker 构建分别注册插件。完整示例构建通过，三项外部化警告消失；8项插件范围与失败行为测试、原有pool配置测试通过。真实Chromium执行构建后的Worker并处理可控空MVT响应，返回 solid:land、无错误。库本身与npm包无workerpool依赖，本次不发npm版本。
