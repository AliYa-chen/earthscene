> 实现范围：本文描述完整 Three.js 引擎入口 `earthscene/engine`；其中的 API 和能力不表示已由 Cesium 实现。npm 默认入口 `earthscene` 提供 Cesium 扩展，接入方式见[Cesium 扩展指南](/guide/cesium-migration)。

# 高亮

EarthScene 提供统一的 `viewer.highlighter` 门面：按目标类型自动选择实现，调用方不必关心是描边还是贴膜。

| 目标 | 视觉 | 实现 |
| --- | --- | --- |
| `Object3D`（模型根节点、自定义 mesh 等） | 轮廓描边 | WebGL 后处理 `OutlineEffect` |
| `HismPickResult` / `ViewerPickResult`（`hismInstance`） | 轮廓描边 | 不可见 proxy Mesh + `OutlineEffect` |
| `Picked3DTilesFeature` / `ViewerPickResult`（`tilesFeature`） | 半透明叠加几何 | 按 featureId 抽三角面或整 mesh 贴膜 |
| `ViewerPickResult`（`entity`） | （无） | 当前忽略 |

样式在 `scene.highlight`，与初始化配置同构。

## 快速上手

```ts
viewer.on('click', (event) => {
  if (event.pick) {
    viewer.highlighter.set(event.pick)
    return
  }
  viewer.highlighter.clear()
})

viewer.on('mousemove', (event) => {
  viewer.highlighter.setHover(event.pick)
})
```

整对象描边（传入 `root` 时默认只测 object 层）：

```ts
const hit = viewer.pick(event.position, { root: model.root })
if (hit?.type === 'object') viewer.highlighter.set(model.root)
// 或显式：
viewer.highlighter.set({ type: 'object', object: mesh })
```

HISM 单实例描边（描当前 LOD 下该实例的全部 parts）：

```ts
const pick = viewer.pick(event.position, { layers: ['hismInstance'] })
if (pick) viewer.highlighter.set(pick)
else viewer.highlighter.clear()
```

关闭黄色命中点标记（与描边并用时建议关闭）：

```ts
new earthscene.Viewer(container, {
  hism: { showPickMarker: false }
})
```

## 配置

```ts
const viewer = new earthscene.Viewer(container, {
  scene: {
    highlight: {
      outline: {
        enabled: true,
        color: '#7cff5b',
        hiddenColor: '#7cff5b',
        edgeStrength: 1.5,
        xray: true
      },
      overlay: {
        enabled: true,
        color: '#7cff5b',
        opacity: 0.55,
        hoverColor: '#38bdf8',
        hoverOpacity: 0.42
      }
    }
  }
})
```

运行时：

```ts
viewer.highlighter.outline.color = '#38bdf8'
viewer.highlighter.overlay.opacity = 0.4
```

## API

| 方法 | 说明 |
| --- | --- |
| `set(target)` | 设置选中高亮（单选，替换） |
| `clear()` | 清除选中 |
| `setHover(target \| null)` | 设置或清除悬停高亮 |
| `get()` / `getHover()` | 读取当前目标 |

`HighlightTarget` 可为：

- `THREE.Object3D`
- `HismPickResult`
- `Picked3DTilesFeature`
- `{ type: 'object', object }`
- `{ type: 'hismInstance', pick }`
- `{ type: 'tilesFeature', feature }`

## 能力边界

- **描边仅 WebGL**：WebGPU 下 `outline` 为 no-op；Tiles feature **叠加**仍可用。
- P0 为单选；悬停与选中可并存，悬停同一目标时不重复叠加。
- HISM 描边贴合实例变换矩阵，**不**同步 PositionPipeline 风摆顶点形变。
- 3D Tiles 叠加依赖瓦片几何上的 `_BATCHID` / `_FEATURE_ID_*` 等属性；没有 feature id 时退化为整 mesh 贴膜或包围盒。

完整交互示例见 [`3d-tiles-picking.html`](../../3d-tiles-picking.html)、[`hism/hism-forest.html`](../../hism/hism-forest.html)。


拾取示例默认从公开 URL 加载 Cesium 官方 `BatchedWithBatchTable` 数据，固定到一个上游提交，不需要 Ion token。该数据含 10 个 feature，属性包括 `id`、`Longitude`、`Latitude`、`Height`、`info` 和 `rooms`。面板也可以切换到 Cesium Ion，输入自己的 asset id 和 token。

此合成样例的建筑位于椭球高度 0–20 米，示例使用椭球底面，避免真实地形遮住建筑。图层的根索引加载后自动定位；模型加载完成后才显示可拾取状态，加载或解码失败会显示错误并移除失败图层。公开数据仍需要网络访问。
