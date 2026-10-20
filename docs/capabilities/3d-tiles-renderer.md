> 实现范围：本文描述完整 Three.js 引擎入口 `earthscene/engine`；其中的 API 和能力不表示已由 Cesium 实现。npm 默认入口 `earthscene` 提供 Cesium 扩展，接入方式见[Cesium 扩展指南](/guide/cesium-migration)。

# 3D Tiles Renderer 能力参考

EarthScene 基于 `3d-tiles-renderer` 提供 3D Tiles 和地形能力封装。这里先记录 EarthScene 使用侧最相关的能力，完整调研可继续参考仓库中的能力文档。

## 当前关注点

- 3D Tiles 场景加载：`tileset.json`、Cesium Ion endpoint。
- Cesium quantized-mesh terrain：地形根目录或 `layer.json`。
- 影像 overlay：XYZ、WMS、WMTS、GeoJSON、MVT 等图层贴到地形或裸球表面。
- LOD 与缓存：通过 tiles renderer 的更新流程参与主渲染循环。
- 采样：结合已加载瓦片、地形 availability 和临时局部加载区域做高度查询。

## EarthScene 封装边界

EarthScene 主要做 API 使用侧的易用性封装，不重新实现底层 3D Tiles 解析、瓦片调度或地理坐标转换核心。

更底层的插件、overlay 和 renderer 能力仍以 `3d-tiles-renderer` 文档和源码为准。
