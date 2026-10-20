# EarthScene

[官网 / Website](https://earth.2t.hk) · [GitHub](https://github.com/AliYa-chen/earthscene)

English | [中文](./README.md)

EarthScene is a new, independent 3D Earth project. It retains the complete homepage, documentation, Sandcastle, examples and feature organization while moving suitable capabilities to **CesiumJS** incrementally. Rendering effects that Cesium does not provide directly are exposed as libraries or plugins, with **Three.js** available where useful.

Versioning starts at `0.1.0`. Source, tests, examples and assets have been copied into this independent project and renamed. **The default entry still uses the existing Three.js implementation; the full project has not been migrated to Cesium.** New Cesium adapters and effect plugins are available separately through `earthscene/cesium` for use with native Cesium APIs. They do not replace the homepage or introduce a separate default cloud scene. See [project status](https://github.com/AliYa-chen/earthscene/blob/main/docs/guide/project-status.md).

## Install in your project

For native Cesium extensions:

```bash
npm install earthscene cesium@1.146.0
```

```ts
import { VolumetricClouds } from 'earthscene/cesium'
const clouds = new VolumetricClouds(cesiumViewer, { coverage: 0.5 })
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

## Project boundaries

### Use as a Cesium extension

The `earthscene/cesium` entry can attach directly to an application-owned native viewer:

```ts
import { VolumetricClouds } from 'earthscene/cesium'

const clouds = new VolumetricClouds(nativeViewer, { coverage: 0.5 })
clouds.options.altitude = 2500
clouds.destroy() // Disposes of this extension only.
```

The checked CesiumJS version is `1.146.0`. This entry does not import Three.js or replace terrain, imagery, camera, or clock settings. Applications own Cesium asset deployment and scene lifecycle. See the [extension guide](https://github.com/AliYa-chen/earthscene/blob/main/docs/guide/cesium-migration.md).

The package name is `earthscene`, with `0.1.0` as its first public version. Maintainers run `pnpm release:check` before publishing; `pnpm pack --pack-destination artifacts` produces a local package for integration testing.

### Retained project structure

- `src/index.ts` remains the default package entry, retaining the existing Viewer, domain APIs and complete example organization.
- `src/cesium/index.ts` / `earthscene/cesium` is the separate adapter and plugin entry for native Cesium scenes; capabilities are migrated module by module.
- The default renderer remains Three.js for now. Assess Cesium support from its implementation and verification results, not from the existing API surface.
- The project is maintained independently at `AliYa-chen/earthscene`, with `https://earth.2t.hk` as its website. The npm package uses the same `earthscene` name; obsolete deployment and CDN scripts have been removed.
- Some examples still use external images, models and map services as data sources.

## License

[MIT](https://github.com/AliYa-chen/earthscene/blob/main/LICENSE). The inherited source's original copyright and license remain verbatim in [third_party/licenses/upstream-MIT.txt](https://github.com/AliYa-chen/earthscene/blob/main/third_party/licenses/upstream-MIT.txt), the sole exception to the naming cleanup. Renaming the project does not transfer ownership of third-party code.
