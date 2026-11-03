# RFC: virtual texture streaming for gigapixel-class surfaces

## Status

Downstream umbrella RFC. Keep this document as the long-term architecture and experiment tracker; upstream work should be split into small, independently useful slices.

## Goal

Let Three.js render **logically multi-gigapixel surfaces** while keeping physical GPU texture dimensions, residency, decode work, and uploads bounded.

The target is not "load a very large image". The target is a virtual/sparse texture abstraction:

```text
logical texture (e.g. 65536 x 65536)
        |
        v
multiresolution tile source
        |
        +-- visibility / screen-space demand
        +-- async fetch + decode
        +-- bounded residency
        +-- parent fallback
        v
fixed physical atlas + page table
        |
        v
TSL sampling node
```

A 65,536² RGBA source is ~4.3 gigapixels logically. The runtime should never require a 65,536² physical texture.

## Why this is grounded

Quackles already exercised the relevant failure modes with ~201 MP and 1 GP-class image pyramids:

- only visible detail should refine;
- higher resolution must not silently switch authored source families;
- decode/cache churn can make a higher-fidelity implementation feel worse;
- camera/input responsiveness owns the frame budget;
- stale async work must never publish pixels;
- mobile requires explicit residency/decode/concurrency budgets;
- refinement should look like `same image -> sharper image`, not a representation change.

Relevant Quackles research:

- https://github.com/kvnloo/quackles/issues/42 — real-time 3D + streamed gigapixel-class detail
- https://github.com/kvnloo/quackles/issues/44 — canonical 1GP source compiler
- https://github.com/kvnloo/quackles/issues/45 — perceptually invisible refinement runtime
- https://github.com/kvnloo/quackles/issues/43 — source-family correctness
- https://github.com/kvnloo/quackles/issues/50 — directness / decode-churn acceptance gate

Three.js also has prior virtual-texturing history:

- https://github.com/mrdoob/three.js/issues/2587
- https://github.com/mrdoob/three.js/issues/28101
- https://github.com/mrdoob/three.js/issues/29160

Current Three.js already exposes useful primitives such as `Renderer.copyTextureToTexture()`, WebGPU/WebGL backend parity, TSL, array/3D textures, and mature async loading utilities. The first experiment should therefore require **zero new core renderer API**.

## Contribution strategy

Match current Three.js contribution style:

1. prove the capability in a small example;
2. avoid core changes until a concrete missing primitive is demonstrated;
3. keep source-format concerns outside the sampling primitive;
4. measure correctness, frame impact, upload cost, and memory;
5. split reusable follow-ups into separate PRs;
6. treat API/naming as a consequence of a working implementation, not the starting point.

The recent Gaussian Splat work is the model: minimal renderer/loader/example first, then bounds, raycasting, optimization, naming, and follow-up API work as separate changes.

## Initial slice

Prototype one example:

`examples/webgpu_virtual_texture.html`

Properties:

- `WebGPURenderer` + TSL;
- logical source >= 65,536 x 65,536;
- 256² pages;
- fixed atlas, initially 2048² / 64 resident pages;
- parent/low-resolution fallback always present;
- visible-demand-driven page loading;
- bounded LRU residency;
- no committed gigapixel asset;
- deterministic procedural tile provider for the upstream example;
- optional Quackles/DZI provider only in downstream experiments;
- debug metrics for logical resolution, resident pages, misses, uploads, and requested LOD.

The first upstream PR should be an example only unless maintainers explicitly ask for extraction.

## Minimal runtime contract

### Logical address

```js
{
  width,
  height,
  tileSize,
  levels
}
```

### Provider

```js
async function loadTile( level, x, y, signal ) {
  // returns an ImageBitmap / Texture-compatible source
}
```

### Runtime invariants

1. A valid coarse representation remains visible during refinement.
2. Camera motion never waits on refinement.
3. Residency is bounded independently of logical source size.
4. Stale fetch/decode/upload work is rejected by generation.
5. Publication is atomic: a page becomes addressable only after upload completes.
6. Missing children sample a valid ancestor.
7. Page replacement never exposes uninitialized atlas contents.
8. Source identity is stable across all levels.

## Initial architecture

### Page table

Map virtual page coordinates + mip level to physical atlas slot.

Start with the simplest representation that works across WebGPU and the WebGL fallback. Do not optimize page-table representation before profiling.

### Physical atlas

A normal bounded Three.js texture updated with `renderer.copyTextureToTexture()`.

Initial target:

- atlas: 2048²;
- page: 256²;
- 8 x 8 = 64 resident pages.

A later sweep should compare 128/256/512 pages.

### Demand calculation

Initial example calculates demand on CPU from a plane's visible UV crop.

Do **not** make GPU feedback a prerequisite for the first slice.

Later arbitrary-geometry work can evaluate GPU feedback / visibility buffers.

### Scheduling

Separate budgets for:

```text
fetch
-> decode
-> staging
-> upload
-> residency
-> publication
```

Camera/render work wins every frame. Refinement uses remaining budget.

## What the first slice intentionally does not solve

- DZI / IIIF parsing;
- KTX2/Basis page compression;
- arbitrary mesh feedback;
- terrain/3D Tiles integration;
- texture compiler tooling;
- persistent CacheStorage;
- predictive camera-path prefetch;
- cross-material shared residency;
- Cycles anchor handoff;
- Gaussian/neural residuals;
- a new core `Texture` subclass.

Those belong to later slices only after the basic experiment proves value.

## Follow-up RFC ladder

### Slice 2 — reusable TSL addon

Candidate abstraction:

```js
const virtualTexture = new VirtualTextureNode( {
  width: 65536,
  height: 65536,
  tileSize: 256,
  maxResidentTiles: 64,
  loadTile
} );

material.colorNode = virtualTexture.sample( uv() );
```

Naming is intentionally provisional. In particular, avoid `GigapixelTexture`: the capability is generic and the object is not a conventional physical GPU texture.

### Slice 3 — source adapters

Downstream first:

- DZI;
- IIIF;
- custom URL pyramids.

Keep these outside the sampling core.

### Slice 4 — compressed pages

Evaluate KTX2/Basis pages and GPU-native compressed residency.

Question: does compressed residency improve upload latency enough to justify constraints on atlas/page formats?

### Slice 5 — arbitrary-geometry feedback

Evaluate GPU-generated page demand for arbitrary meshes.

Acceptance:

- no large CPU UV/visibility walk;
- stable feedback under motion;
- bounded readback or fully GPU-resident demand path;
- no feedback loop that costs more than the texture savings.

### Slice 6 — predictive scheduling

Use camera velocity / recent demand to prefetch likely pages, while preserving strict cancellation and bounded work.

### Slice 7 — core primitive, only if required

Only propose a core renderer/API change after the addon/example identifies a concrete missing primitive that cannot be implemented cleanly using current Three.js public APIs.

## Evaluation matrix

Every architecture should be compared on:

- first useful frame;
- time to requested sharpness;
- p50/p95/p99 frame time while refining;
- main-thread long tasks;
- upload time;
- network bytes;
- decode count;
- cache hit rate;
- evictions;
- resident GPU bytes;
- visual seams;
- stale-page publication errors;
- WebGPU;
- WebGL fallback;
- constrained mobile profile.

## Kill / pivot conditions

Do not push this toward core if:

- the example requires invasive renderer hooks;
- page-table sampling is too expensive relative to ordinary textures;
- WebGL fallback needs a substantially different user-facing API;
- the implementation is primarily useful for one mapping/DZI use case;
- an existing Three.js primitive can already express the same capability more simply.

In those cases, keep it as an addon/example or external library.

## Upstream posture

Do not open this full RFC upstream.

Upstream sequence:

1. one `Suggestion` issue describing the concrete >GPU-limit texture problem and zero-core-API example;
2. link a working branch/demo;
3. ask whether the example is useful enough to include;
4. merge the example if accepted;
5. extract only what maintainers request or what repeated follow-up use cases justify.
