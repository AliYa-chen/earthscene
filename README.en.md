# EarthScene

[官网 / Website](https://earth.2t.hk) · [GitHub](https://github.com/AliYa-chen/earthscene) · [npm](https://www.npmjs.com/package/earthscene)

English | [中文](./README.md)

EarthScene is a new, independent 3D Earth project. It retains the complete homepage, documentation, Sandcastle, examples and feature organization while moving suitable capabilities to **CesiumJS** incrementally. Rendering effects that Cesium does not provide directly are exposed as libraries or plugins, with **Three.js** available where useful.

Versioning starts at `0.1.0`. **The default npm entry, `earthscene`, provides Cesium extensions and exports the `ES` namespace by default.** The complete Three.js engine is retained under `earthscene/engine`; the existing homepage and examples still use it and have not been fully migrated to Cesium. `earthscene/cesium` exposes the same extension APIs as the default entry. See [project status](https://github.com/AliYa-chen/earthscene/blob/main/docs/guide/project-status.md).

## Install in your project

For native Cesium extensions:

```bash
npm install earthscene cesium@1.146.0
```

```ts
import { ESClouds } from 'earthscene'
const clouds = new ESClouds(cesiumViewer, { coverage: 0.5 })
clouds.destroy() // The native viewer continues running.
```

For the complete Three.js engine, install its optional peers:

```bash
npm install earthscene three@^0.184.0 3d-tiles-renderer@^0.4.27 postprocessing@6.39.1 \
  @takram/three-atmosphere@0.19.1 @takram/three-clouds@0.7.6 \
  @takram/three-geospatial@0.9.1 @takram/three-geospatial-effects@0.6.4 \
  @mapbox/tiny-sdf@^2.2.0 three-mesh-bvh@0.9.0
```


TypeScript projects also need `npm install -D @types/three@^0.184.1`.

Import the complete engine from its dedicated subpath:

```ts
import earthscene from 'earthscene/engine'

const viewer = new earthscene.Viewer('viewer', options)
```

Peers are optional so one entry does not automatically install the other renderer. The last two utilities are bundled at runtime but are referenced by full-engine declarations. They are not needed for the Cesium entry.

## Local development

```bash
pnpm install
pnpm dev
```

`pnpm dev` continues to run `scripts/dev.mjs`, starting the existing examples and documentation sites. Open the homepage at `http://127.0.0.1:5173/`; use the terminal's reported port if it is occupied. The complete example collection remains accessible through the homepage and Sandcastle.

```bash
pnpm type-check
pnpm test:run
pnpm build
```

Pinned source snapshots of `leva-vanilla` and `three-stylized` are included under `vendor/` and installed through `file:vendor/...`. No sibling repositories are required. See [CONTRIBUTING.en.md](https://github.com/AliYa-chen/earthscene/blob/main/CONTRIBUTING.en.md). Supply tokens required by your map services; keep private credentials out of source code.


Examples read an optional default from `VITE_CESIUM_ION_TOKEN` in `.env.local`; Settings can override or reset it. The token is not included in the npm library output.

Example production builds use browser Web Workers. The workerpool Node.js backends are isolated only in the example build; EdgePages does not need Node builtin polyfills.

## Project boundaries

### Use as a Cesium extension

The default `earthscene` entry attaches to an application-owned native `Cesium.Viewer`. Extension classes use the EarthScene abbreviation `ES`; this entry does not export `Viewer`:

```ts
import { ESClouds } from 'earthscene'

const clouds = new ESClouds(nativeViewer, { coverage: 0.5 })
clouds.options.altitude = 2500
clouds.destroy() // Disposes of this extension only.
```

Alternatively, use `import ES from 'earthscene'` and `new ES.Clouds(nativeViewer)`. For shared plugin lifecycle management, use `new ESPluginHost(nativeViewer)`; it manages plugins without creating or destroying the native viewer.

The checked CesiumJS version is `1.146.0`. This entry does not import Three.js or replace terrain, imagery, camera, or clock settings. Applications own Cesium asset deployment and scene lifecycle. See the [extension guide](https://github.com/AliYa-chen/earthscene/blob/main/docs/guide/cesium-migration.md).

The package name is `earthscene`, with `0.1.0` as its first public version. Maintainers run `pnpm release:check` before publishing; `pnpm pack --pack-destination artifacts` produces a local package for integration testing.

### Retained project structure

- The default npm entry, `earthscene`, and `earthscene/cesium` both map to `src/cesium/index.ts` and expose extensions for native Cesium scenes.
- `src/index.ts` retains the complete Three.js engine's Viewer and domain APIs, published through `earthscene/engine`; source examples still import from `../src`.
- The default renderer remains Three.js for now. Assess Cesium support from its implementation and verification results, not from the existing API surface.
- The project is maintained independently at `AliYa-chen/earthscene`, with `https://earth.2t.hk` as its website. The npm package uses the same `earthscene` name; obsolete deployment and CDN scripts have been removed.
- Some examples still use external images, models and map services as data sources.

## License

[MIT](https://github.com/AliYa-chen/earthscene/blob/main/LICENSE). The inherited source's original copyright and license remain verbatim in [third_party/licenses/upstream-MIT.txt](https://github.com/AliYa-chen/earthscene/blob/main/third_party/licenses/upstream-MIT.txt), the sole exception to the naming cleanup. Renaming the project does not transfer ownership of third-party code.
