# NormalMapGenerator — Improvement Tasks

Analysis of `react-components/src/NormalMapGenerator/` (index.tsx, decode.ts, selection.ts, brush.ts, types.ts, generate.ts, light.ts). Tasks are grouped by category and ordered roughly by impact. Each task lists the symptom, the location, and a concrete fix.

**Status:** ✅ done — A1, A3, A4, A5, B1, B2, C1. Partial — C2 (perf split landed; full edit preservation deferred). Open — A2*, B3, B4, B5, C3, C4, D1, D2, E1, E2.

---

## A. Correctness / bugs

### A1. WebGL init failure has no Canvas2D fallback (high) — ✅ done

`light.ts` — `initGl()` now wraps compile/link in try/catch, sets a `glDisabled` flag (no per-frame retry), and assigns `this.gl` only on full success so `shade()` drops to `shade2d`.

<details><summary>original</summary>

`light.ts` — `LitRenderer.shade()` does `if (this.initGl()) return this.shadeGl(p)`, but `initGl()` **throws** on shader compile or program-link failure (`compile()` throws; the link check throws). So on a driver that returns a context but fails to compile/link, the whole render throws instead of dropping to `shade2d`. The 2d fallback only runs when `getContext` returns null.

- Wrap the compile/link path in try/catch inside `initGl()`; on failure `this.gl = null`, dispose partial resources, and return `false` so `shade()` uses `shade2d`.
- Add a `glDisabled` flag so a one-time failure doesn't retry `initGl()` every frame.
</details>

### A2. `decodeSource` rejection is unhandled (high) — ✅ done

Both the decode effect and `handleGenerate()` now catch decode errors, clear buffers, and fire the new `onError?: (error: unknown) => void` prop (added to `types.ts`); the preview clears to `background`.

<details><summary>original</summary>

`index.tsx` — `regenerate()` does `await decodeSource(source)` with no try/catch. A corrupt/invalid `source` makes `createImageBitmap` reject → unhandled promise rejection, and the component is stuck with no source feedback.

- try/catch around `decodeSource`; on error clear buffers, call `renderRef.current()`, and surface via a new `onError?: (err: unknown) => void` prop (and/or render the `background` only).
- Same guard in `handleGenerate()` (line ~717), which also awaits `decodeSource`.
</details>

### A3. Blob construction drops MIME type (medium) — ✅ done (documented)

`decode.ts` line 7 — `new Blob([src as BlobPart])` with no `type`. `createImageBitmap` sniffs bytes so PNG/JPEG usually work, but passing the known type is safer and avoids ambiguity for formats that need it.

- Accept an optional mime hint, or require callers to pass a `Blob` for non-PNG. At minimum document the supported encodings in `NormalMapSource`.

### A4. `smooth` brush samples wrong horizontal neighbor at row edges (low) — ✅ done

`brush.ts` smooth case (lines ~231) — `working[(idx - 1) * 4]` and `working[(idx + 1) * 4]` index the flat buffer without an `x`-bounds check, so at `x === 0` the "left" neighbor is the previous row's last pixel and at `x === w-1` the "right" is the next row's first pixel. Causes a faint wrap artifact down the column edges when smoothing.

- Guard with `x > 0` / `x < w - 1` (mirror the vertical `y` guards already present), falling back to `cur`.

### A5. `getContext('2d')` not flagged `willReadFrequently` (low) — ✅ done

`decode.ts` and `index.tsx` `rgbaToCanvas` create 2d contexts that are immediately read via `getImageData` / used as upload sources. Chromium warns and may keep these on the GPU, slowing `getImageData`.

- Pass `{ willReadFrequently: true }` to the decode context (it is read once but the warning is benign; the bigger win is reusing the canvas — see B1).

---

## B. Performance

### B2. Every option change re-decodes the source (high) — ✅ done

Decoded pixels now cache in `rawSourceRef`. A decode effect keyed on `[source, onError]` runs `createImageBitmap` only when `source` changes; a separate effect keyed on the options rebuilds from the cache (via a `rebuildRef` so option changes never re-trigger a decode). `handleGenerate` reuses the cache too.

<details><summary>original</summary>

`index.tsx` — `regenerate` deps are `[source, buildOptions]`, and `buildOptions` changes identity whenever `strength`, `embossHeight`, `blur`, `invertX`, … change. So dragging the *strength* slider re-runs `decodeSource` (a full `createImageBitmap` + canvas readback) on **every** frame, even though the decoded RGBA is identical.

- Split into two effects: (1) decode only when `source` changes → cache `sourceRef` + dims; (2) rebuild heightmap/normals when options change, reusing the cached RGBA. Skip the `await` path entirely when source is unchanged.
- This also removes the main reason edits get wiped on unrelated prop changes (see C2).
</details>

### B1. `normal`/`albedo` preview allocates a fresh canvas + ImageData every frame (high) — ✅ done

`renderModeCanvas` now blits into a persistent canvas (`previewSrcCanvasRef`) reusing one `ImageData`, gated by a `${mode}:${dims}:${version}` key so `putImageData` runs only when the buffer actually changes.

<details><summary>original</summary>

`index.tsx` `rgbaToCanvas` is called from `renderModeCanvas` for the `normal` and `albedo` modes on every `renderPreview`. During a brush stroke that's a new `<canvas>` element + `createImageData` + `data.set` per rAF.

- Keep a single reusable offscreen canvas in a ref (one per mode, or reuse the lit-path `LitRenderer` pattern). Only re-`putImageData` when the working buffer version changes.
</details>

### B3. Heavy generation runs on the main thread (medium)

`generate.ts` — distance transform (`alphaToDistance`, two full passes), Sobel (`normalsFromHeight`), and box blur are all synchronous and O(w·h). For large sprites this janks the UI thread on every option change.

- Move `buildHeightmap` + `normalsFromHeight` into a Web Worker (transferable `ArrayBuffer`s) with the existing functions reused verbatim (they're already pure/DOM-free). Fall back to inline when `Worker`/`OffscreenCanvas` is unavailable.

### B4. History stores full-resolution snapshots (medium)

`index.tsx` `snapshot()` clones the entire working `rgba` + `combined` Float32Array + `heightDelta` Float32Array per stroke, up to `MAX_HISTORY = 20`. For a 1024² sprite that's ~20 × (4 MB + 4 MB + 4 MB) = ~240 MB worst case.

- Store per-stroke dirty-rect diffs instead of full buffers (the brush already returns a `HeightRect`; accumulate the stroke bounds and snapshot only that region).

### B5. `optionsRef`/`buildOptions` re-run twice per render (low)

`index.tsx` lines 205–206 call `buildOptions()` immediately after defining it, then assign again every render. Minor allocation churn.

- Build once with `useMemo` keyed on the option props, and write the ref from an effect.

---

## C. Architecture / API

### C1. No tests anywhere in react-components (high) — ✅ done

Added `react-components/test/` with 40 specs across 4 files (`normal-map-{decode,generate,selection,brush}.test.ts`): heightmap/normal math, `hexToRgb` edge cases, mask helpers, `featherMask`, `pack`/`unpack` round-trip, `applyBrush` modes + selection/alpha gating. Root `vitest run` discovers them (no per-package config needed).

### C2. Any unrelated prop change wipes brush edits + undo history (medium) — ⚠️ partial

The perf half landed with B2 (no more re-decode). The **edit-preservation** half is intentionally deferred: only height-brush edits are reconstructable from `heightDelta`; vector brushes (`direction`/`smooth`/`structure`/`erase`) mutate the working RGBA in place with no replay log, and preserving undo entries across a base change would leave them referencing a stale heightmap. Full fix is coupled to B4 (per-stroke edit log) — do them together.

- Depends on B4. Then: on option change, re-derive auto normals, replay the recorded edit log onto the new base, and keep `undoStack`/`redoStack`.

### C3. Selection mutations are not undoable (medium)

`commitSelection`, `selectAll`, `clearSelection`, `setSelection` don't push history. Brush strokes undo; selections don't. Inconsistent.

- Include `selectionRef` (+ `antsEdgesRef`) in `HistoryEntry`, or add a parallel selection-history stack.

### C4. `EditorTool` couples brush + selection into one prop (low)

`tool` mixes `'brush'` with `'rect' | 'lasso' | 'wand'`. Works, but means you can't keep a brush configured while temporarily selecting; switching tools is all-or-nothing.

- Optional: separate `mode: 'paint' | 'select'` from `selectionTool`, or document the current single-prop contract clearly in SKILL.md.

---

## D. Accessibility

### D1. Canvas editing has no keyboard/AT story (medium)

`index.tsx` root gets `tabIndex` only when interactive and handles just `p`/`r` keys. No `role`, no `aria-label`, no announcement of tool/brush/selection state. Pointer-only brush + selection are unusable without a mouse.

- Add `role="application"` (or `img` for non-interactive) + `aria-label`, expose current tool/mode via `aria-live` status text, and document that fine pixel editing is pointer-first.
- Per CLAUDE.md: touch targets ≥ 44px under `@media (pointer: coarse)` — verify the light gizmo / brush cursor hit areas.

### D2. Light gizmo & brush cursor are `aria-hidden` decorations only (low)

Acceptable (they're visual), but the keyboard `p` (place light) / `r` (rotate) shortcuts are undiscoverable.

- Document shortcuts in SKILL.md and optionally render a visually-hidden hint.

---

## E. Docs / packaging

### E1. SKILL.md + demo coverage (medium)

Per CLAUDE.md, a component needs `examples/src/react-components/<Name>Demo.tsx` (present: `NormalMapGeneratorDemo.tsx`, untracked) registered in the demo index, plus an `examples/public/react-components/SKILL.md` entry. Verify all preview modes, brush modes, selection tools, and the imperative handle (`generate`/`undo`/`redo`/`reset`/`exportLit`/`selectAll`/`clearSelection`/`setSelection`) are documented and demoed.

### E2. CSS prefix table entry (low)

CLAUDE.md keeps a per-component CSS custom-property prefix table. Confirm `_normal-map-generator.scss` uses a registered prefix and follows the no-`border-radius` rule (the brush cursor is intentionally circular → allowed; document it).

---

## Suggested order

Done this pass: A1, A2, A3, A4, A5, B1, B2, C1 (perf split + robustness + tests).

Remaining, by priority:

1. B4 (per-stroke edit log + dirty-rect history) → unblocks C2's edit preservation.
2. C2 (replay edits across option changes; keep undo/redo) — once B4 lands.
3. B3 (Web Worker offload for `buildHeightmap`/`normalsFromHeight`).
4. C3, D1 (selection undo, accessibility).
5. B5, C4, D2, E1, E2 (low-priority cleanups + docs).
