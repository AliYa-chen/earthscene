# EarthScene 示例依赖

这些目录保留运行示例实际需要的上游源码，不包含上游工具链、示例应用、测试、缓存或 `node_modules`。主项目通过 `file:vendor/...` 安装，Vite 负责处理 TypeScript 与 CSS，不依赖任何同级工作区。

| 目录 | 上游固定提交 | 内容 |
| --- | --- | --- |
| `leva-vanilla` | `4a4eebf76681cf923f0c082c093b141c600bc289` | 控件状态、DOM GUI、图标和全部引用样式 |
| `three-stylized` | `8eb0dde5a8e7eae985d69f923b627b0cf253bed5` | `src/grass` 的程序化草地、地形、花朵和着色器 |

每个目录的 `UPSTREAM.json` 记录源码地址和固定提交，`LICENSE` 与 `third_party/licenses/` 保存未经改动的上游 MIT 文本。

## 本地适配

- 两个 `package.json` 提供直接指向 TypeScript 源码的 ESM 导出，去掉只服务上游开发的安装脚本与依赖。
- `leva-vanilla` 增加 `gui`、`src/core/types` 和 `styles.css` 子路径导出；补齐 `LevaPosition` 的 `top/right/bottom/left` 像素定位，保留 `x/y` 偏移行为。
- `three-stylized` 将 Three.js 声明为 peer dependency，以共享主项目的渲染器实例；草地模块不依赖上游示例的 `lil-gui` 或贴图。

这里只保证源码来源、所需导出和静态依赖闭包；草地视觉、GUI 交互及 Three.js 版本兼容性仍需实际页面验证。
