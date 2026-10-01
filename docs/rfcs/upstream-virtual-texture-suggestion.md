# Ready-to-post upstream suggestion

Target: https://github.com/mrdoob/three.js/issues/new?template=feature_request.yml

## Title

Examples: Add virtual texture streaming for textures larger than GPU limits

## Description

Three.js can upload and sample large textures, but a single logical surface is still bounded by the device's physical texture dimensions and practical GPU residency.

This matters for use cases such as scanned artwork, scientific imagery, maps, CAD/inspection surfaces, and other sources where the logical image can be hundreds of megapixels or several gigapixels while only a small region is visible at full detail.

KTX2 / GPU compression reduces transfer and residency cost, but does not remove the maximum texture-dimension limit or make residency proportional to the visible region. Splitting the surface into many scene meshes works, but exposes texture paging as scene structure.

There was an older virtual-texturing discussion in #2587, and #28101 discussed tiled uploads for large textures. Current Three.js now has enough public primitives that I think a useful first step can be demonstrated without adding a renderer API.

## Solution

Would an example demonstrating virtual texture streaming be useful?

I have a downstream prototype:

- source: https://github.com/kvnloo/three.js/blob/rfc/virtual-texture-gigapixel/examples/webgpu_virtual_texture.html
- commit-stable demo: https://rawcdn.githack.com/kvnloo/three.js/ccd584e8ef7f2506fddd5f1a2799bd0c210ba09d/examples/webgpu_virtual_texture.html
- downstream design notes: https://github.com/kvnloo/three.js/blob/rfc/virtual-texture-gigapixel/docs/rfcs/virtual-texture-streaming.md

The prototype intentionally changes **no core API**. It uses:

- `WebGPURenderer` + TSL;
- a 65,536 x 65,536 logical source (~4.3 gigapixels);
- 256 x 256 virtual pages;
- a fixed 2048 x 2048 RGBA8 physical atlas (16 MiB);
- 64 bounded resident page slots;
- a 256 x 256 page table;
- visible-UV-driven page demand;
- LRU eviction;
- stale-request rejection;
- an always-resident coarse fallback;
- `Renderer.copyTextureToTexture()` for page uploads.

The source is procedural so the example does not require committing a huge asset. The procedural levels are generated from the same continuous function with frequency filtering, so refinement represents the same source rather than unrelated images.

The first contribution would stay example-only unless the experiment exposes a specific missing public primitive or there is interest in extracting a reusable addon.

## Alternatives

### KTX2 / compressed textures

Useful and complementary, but compression does not allow one physical texture to exceed device limits and does not by itself provide bounded visible-region residency.

### ImageBitmap / asynchronous decode

Helps move decode work off the main thread, but does not provide virtual addressing or paging.

### Multiple textured meshes

Works for tiled maps and terrain, but makes page boundaries part of scene geometry. The goal here is for one material surface to address a much larger logical texture.

### 3D Tiles / external streaming libraries

Appropriate for spatial scene/geometry streaming. This example is narrower: virtualizing texture memory and sampling.

## Additional context

The initial prototype deliberately keeps demand calculation on the CPU for one plane. GPU feedback for arbitrary geometry, DZI/IIIF adapters, KTX2 pages, predictive prefetch, and any reusable `VirtualTextureNode`-style abstraction would be follow-up experiments rather than part of the initial contribution.

I would prefer to establish whether the small example itself is useful before proposing any core abstraction.

### Local synthetic-provider sanity check

The first procedural generator measured ~19 ms/tile in Node 22 and was rejected. Precomputing the separable 1D basis reduced the same 256² tile generation to ~2.35 ms median / ~2.82 ms p95 over 20 warm runs on the available runner.

This is only a generator microbenchmark, not a browser/GPU performance claim. Browser frame/upload/residency measurements still need to be collected before an implementation PR.
