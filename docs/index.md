---
layout: home

hero:
  name: EarthScene
  text: Cesium 扩展与视觉效果
  tagline: 接入已有 Cesium 场景，按需增强；完整 Three.js 引擎独立提供。
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/getting-started
    - theme: alt
      text: 接入 Cesium
      link: /guide/cesium-migration

features:
  - title: 原生 Cesium 场景
    details: npm 默认入口直接接入已有 Cesium.Viewer，场景创建、地形、影像、相机和时钟仍由应用管理。
  - title: 按需安装特效
    details: 通过 ESClouds 增加体积云，可用 ESPluginHost 管理插件生命周期，释放插件后原生场景继续运行。
  - title: ES 命名空间
    details: 默认导出 ES，支持 new ES.Clouds(viewer)；也可按需导入带 ES 前缀的扩展类。
  - title: 完整引擎独立提供
    details: earthscene/engine 保留 Three.js 地球、数据加载、大气与后处理能力；现有完整示例继续使用该实现。
---

## 文档定位

EarthScene 文档面向库使用者。使用原生 Cesium 时，从[快速开始](/guide/getting-started)和[Cesium 扩展指南](/guide/cesium-migration)接入；npm 默认入口为 `earthscene`，`earthscene/cesium` 提供相同扩展 API。

完整 Three.js 引擎通过 `earthscene/engine` 单独导入。其 Viewer、相机、地形影像、3D Tiles、实体和效果文档在页首标明适用入口，不能据此认定相同能力已迁移到 Cesium。

- **指南** 解释常见工作流和推荐写法。
- **API 文档** 记录完整引擎 TypeScript API 的参数、返回值和生命周期。
- **能力参考** 汇总完整引擎的底层依赖能力。
- **项目状态与能力边界** 区分各入口的实现范围和限制，选型前建议先看。
