# AGENTS.md

EarthScene 是一个全新的独立三维地球项目，包名 `earthscene`，版本起点 `0.1.0`。保留原有首页、文档、Sandcastle、示例与功能组织，逐项将适合的能力迁移到 CesiumJS；其余渲染效果以方法库或插件扩展，允许使用 Three.js。默认入口为 `src/index.ts`，当前默认渲染仍是现有 Three.js 实现。`src/cesium/index.ts` / `earthscene/cesium` 是独立的 Cesium 适配与插件入口，不取代默认入口；不能把现有 API 或效果宣传为已经完成的 Cesium 功能。

## 硬约束

- 默认用中文回答。
- 面向用户的 TypeScript API 使用中英双语 JSDoc，中文在前。
- 新 API 按领域对象分组，初始化路径与运行时路径尽量同构，不暴露无必要的内部实现步骤。
- 保持完整项目的首页、示例与功能组织。`pnpm dev` 使用 `scripts/dev.mjs`；不新增默认云场景或把迁移说明插入核心产品流程，开发者迁移信息放文档。
- Cesium 子模块面向原生 Cesium API，扩展效果以方法或插件接入；迁移按能力逐项验证，不把现有 Three.js 路径作为单纯归档。
- 源仓库只作为只读参考，不要回写、提交、发布或部署源仓库。
- 只使用新项目名称、模块名、CSS 前缀、存储 key 和资源路径。唯一例外是 `third_party/licenses/upstream-MIT.txt`：为保留合法的原始版权与 MIT 条款，此文件必须逐字保留，不得清理其中的原始标识。
- 本项目公开仓库为 `https://github.com/AliYa-chen/earthscene`，官网为 `https://earth.2t.hk`。尚未发布 npm；旧发布/部署脚本已删除。部署到官网仍需明确任务授权。
- 修改 TypeScript 行为后运行 `pnpm type-check`；修改导出或构建链路后运行 `pnpm build`。按影响范围运行必要测试，不为每次小改重复全量检查。
- 不自行启动示例服务或做浏览器验证，除非用户明确要求。跳过与本次修改有关的验证时，在回复中说明。
- 用户可见行为、公开路径或示例变化时，同步 `docs/`、`.agents/skills/earthscene/` 和 `README*.md`。
- 提交信息使用中文 Conventional Commits，不添加签名 trailer；只有用户要求时才提交。默认分支为 `main`。

## 维护资料

先读 [项目状态](docs/guide/project-status.md) 区分 Cesium 已实现能力与继承材料。`notes/` 记录按主题检索：`architecture/` 为架构、`decisions/` 为决策、`engineering/` 为工程陷阱、`research/` 为调研、`archive/` 为历史材料。

修改继承的主页、文档站、示例或 Sandcastle 前，先读 `notes/architecture/examples文档与Sandcastle架构.md`。面向用户的说明放 `docs/`，维护者笔记放 `notes/`，不要手改生成目录 `examples/public/docs/`。
