> EarthScene is maintained independently at `AliYa-chen/earthscene`, with `https://earth.2t.hk` as its website. Its npm package is named `earthscene`. The default npm entry and `earthscene/cesium` expose Cesium extensions; `earthscene/engine` provides the complete Three.js engine, still used by the homepage and existing examples.

# Contributing to EarthScene

[中文](./CONTRIBUTING.md) | English

Thank you for your interest in EarthScene. Contributions are welcome through issues, pull requests, documentation, and examples.

EarthScene is an open-source 3D Earth engine for the web, for building digital globes, digital twins, 3D maps, and other 3D Earth applications on real geographic coordinates and physical scale. This guide explains how to set up the project, validate changes, and submit a contribution.

## 🚀 Development setup

EarthScene uses Node.js, pnpm, TypeScript, Vite, and Vitest.

```bash
cd /path/to/earthscene-cesium
pnpm install
```

### Pinned source dependencies for examples

Required example dependencies are included under `vendor/` and installed through `file:vendor/...` entries in `package.json`. Run `pnpm install`; no sibling repositories are required.

| Package | Project directory | Used for |
| --- | --- | --- |
| `leva-vanilla` | `vendor/leva-vanilla` | Example control panels |
| `three-stylized` | `vendor/three-stylized` | Grass effects in `atmosphere-local-meadow` |

Each directory's `UPSTREAM.json` records its source and pinned commit, and `LICENSE` retains the upstream terms. Update source, provenance and verification together when changing a snapshot. See [vendor/README.md](./vendor/README.md) for its scope.

Common commands:

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the examples and documentation sites |
| `pnpm type-check` | Run TypeScript type checking |
| `pnpm test:run` | Run tests |
| `pnpm build` | Build library output and declarations |
| `pnpm build:examples` | Build the documentation and examples site |
| `pnpm docs:build` | Build the VitePress documentation only |

## 🗂️ Project structure

- `src/index.ts`: The complete Three.js engine and public APIs, published as `earthscene/engine`; `src/cesium/index.ts` supplies the default npm entry and `earthscene/cesium` extension APIs.
- `vendor/`: Pinned example dependency source and provenance.
- `examples/`: Standalone examples, the homepage, and Sandcastle.
- `docs/`: User-facing guides, API documentation, and capability references.
- `theme/`: Shared accent tokens for the docs site and examples site.
- `notes/`: Maintainer architecture notes, research, and implementation records.
- `dist/`: Build output; update it only when release artifacts need to be refreshed.

Put user-facing tutorials, API documentation, and capability references in `docs/`. Put project architecture, research, and maintenance records in `notes/`. The `examples/public/docs/` directory contains generated documentation output and must not be edited manually.

## 📝 Submitting code

1. Create a short-lived branch from the latest default branch. Use a name that describes the purpose of the change.
2. Keep each commit focused on one clear logical change.
3. Run `pnpm type-check` after changing TypeScript behavior and `pnpm test:run` after changing tests.
4. Run `pnpm build` when changing build output, export paths, or release content.
5. Before opening a pull request, inspect `git diff` and make sure it contains no `.env` files, secrets, temporary files, or unrelated formatting changes.

### Commit messages

This project follows [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/). Commit messages are validated by commitlint and Husky:

```text
<type>(<scope>): <subject>
```

Common types include:

- `feat`: a new feature
- `fix`: a bug fix
- `docs`: documentation changes
- `refactor`: a refactor
- `test`: test changes
- `chore`: build, tooling, or dependency changes

Examples:

```text
feat(viewer): 新增运行时地形切换
fix(camera): 飞行时保留目标俯仰角
docs: 说明 WebGPU 能力边界
```

## 🔀 Pull requests

A pull request description should explain:

- What problem is being solved or what capability is being added.
- Which implementation approach was chosen and any compatibility or performance considerations.
- How the change was verified, including the commands that were actually run.
- Whether the change affects the public API, documentation, examples, or build output.

When changing a public API, update the relevant TypeScript JSDoc and `docs/api/` or `docs/guide/` content, and keep the API shape clear in examples. For changes involving the examples site or Sandcastle, read the [examples, docs, and Sandcastle architecture notes](notes/architecture/examples文档与Sandcastle架构.md) first.

## 📚 Documentation and examples

EarthScene examples serve both as feature demonstrations and API tutorials. When adding a regular example, check the following:

- `examples/<id>.html` and `examples/<id>.ts` can run independently.
- `examples/vite.config.ts` is updated if a new HTML entry must be registered.
- The Sandcastle registry is updated when categories, titles, descriptions, or tag rules need changes.
- Key Viewer configuration remains visible in the example instead of being hidden inside a shared helper.

## 🎨 Code style

- Follow existing module boundaries, type naming, and configuration grouping patterns.
- Add bilingual JSDoc to public TypeScript APIs, with Chinese first and English second.
- Follow the project coordinate convention: tuple inputs use `[longitude, latitude, height]`, with angles in degrees and heights in meters.
- Add comments only when they explain a non-obvious design reason; do not restate what the code already says.

## 🐛 Reporting issues

When opening an issue, include the EarthScene version, Three.js and relevant peer dependency versions, runtime environment, minimal reproduction steps, and any useful console errors or screenshots. For Cesium Ion, WMS, WMTS, or other external services, also include the data source configuration and relevant authorization conditions.

## ⚖️ License

Code and documentation contributed to EarthScene are released under the project [MIT License](./LICENSE).
