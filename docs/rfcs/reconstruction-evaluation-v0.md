# Reconstruction Evaluation v0

Status: downstream experiment only

## Goal

Provide a deterministic Three.js evaluation surface for img2threejs reconstruction experiments, while keeping streamed-detail performance separate from reconstruction quality.

```
procedural scene
  -> fixed reference camera + fixed lighting
  -> deterministic render
  -> screenshot / runtime receipt
```

## Two questions, two score families

1. **Reconstruction quality:** did geometry/material state get closer to the reference?
2. **Runtime/detail quality:** did streamed detail improve visible fidelity without destabilizing frame/upload behavior?

Do not combine them into one scalar.

## Required run receipt

- Three.js revision
- scene revision
- camera transform and projection
- viewport and DPR
- renderer backend
- screenshot hash
- frame p50 / p95
- texture/page upload count
- upload time
- resident texture/atlas bytes
- virtual-texture enabled/disabled
- optional reference metrics supplied by img2threejs

## Reconstruction A/B

Use ordinary resident textures first so virtual texturing cannot confound geometry/material evaluation.

- R0: reference-only img2threejs output
- R1: evidence-assisted img2threejs output

Same camera, lighting, viewport, renderer backend, and texture residency policy.

## Streamed-detail A/B

Once reconstruction comparison is stable:

- A0: ordinary resident textures
- A1: VT path present, streaming disabled
- B: VT streaming enabled

Required gates:

- no stale page reveal after camera changes
- bounded residency during long pan/zoom traces
- real-browser WebGPU acceptance
- real-browser WebGL fallback acceptance
- frame/upload timings recorded separately
- visual fallback remains available while sharper pages stream

## Relationship to PR #1

PR #1 remains an example-first virtual-texture prototype. This benchmark supplies the real-browser and workload evidence missing from the synthetic tile-provider microbenchmark.

The implementation should continue to avoid a core `VirtualTexture` API until the example proves the primitive mix is useful.
