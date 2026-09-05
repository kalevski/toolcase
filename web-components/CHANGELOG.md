# Changelog — @toolcase/web-components

Entries start at `5.0.19`. Earlier versions are not covered here.

## Unreleased

Fixes found while consuming `5.0.19` from the app, plus the desktop pass below.
The `desktop` attribute is additive but new API surface, so this is now a
**minor** (5.1.0) rather than the patch the fixes alone would have been.

### Added — twenty-six elements harvested from the consuming apps

Lifted out of polovni.mk, webgame.cloud and mindmap, the three apps that consume
this library: 1235, 1002 and ~700 `tc-*` call sites, and 183 components of their
own between them. The rule for inclusion was evidence rather than taste — a
component three apps wrote separately is proven, one app's good idea is a
proposal — and anything domain-shaped stayed where it was.

**Present in all three apps, within two lines of each other.** These were an
existing shared library nobody had extracted:

| Tag                      | What it is                                                          |
| ------------------------ | ------------------------------------------------------------------- |
| `tc-lock-chip`           | The padlock badge marking a paywalled row                           |
| `tc-locked-action`       | An action that opens the upgrade path instead, while locked         |
| `tc-upgrade-nudge`       | The inline paywall pitch: chip, one sentence, CTA                   |
| `tc-floating-action-bar` | The selection bar that floats over a list, lined up with its column |

**From polovni.mk** — the largest set, and the one whose components carry
docstrings naming the gap each was filling:

| Tag                    | Replaces                                         | Why it earned an element                                                                                                                                   |
| ---------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tc-hint-tip`          | `HintTip`                                        | A sentence a heading can carry without spending a line on it. Its trigger is `click`, not the library default `hover focus` — there is no hover on a phone |
| `tc-filter-trigger`    | `FilterTrigger`                                  | Six pages had drawn this button byte for byte, each reaching into one page's stylesheet for the class                                                      |
| `tc-results-header`    | `ResultsHeader`                                  | Five browse pages had copied `.home__heading` out of the home page's stylesheet                                                                            |
| `tc-sign-in-gate`      | `SignInGate`                                     | The member wall as a page BODY — it renders instead of the data, never over it                                                                             |
| `tc-search-bar`        | `SearchBar`                                      | Four browse pages, character for character. `enterkeyhint="search"` is a decision about the app, not about six call sites                                  |
| `tc-segmented-toggle`  | `CurrencyToggle` + `LocaleToggle`                | The same 47 lines twice, differing only in the option list                                                                                                 |
| `tc-confirm-sheet`     | `ConfirmSheet`                                   | `window.confirm` names the browser rather than the product. Extends `tc-bottom-sheet`, so the whole surface contract is inherited                          |
| `tc-facet-picker`      | `FacetPicker`                                    | One dimension as chips: single-select, and re-tapping the picked chip clears it                                                                            |
| `tc-range-field`       | `RangeField`                                     | Four sheets carried a numeric range and only one was complete. Distinct from `tc-range-slider`, which cannot express "no upper bound"                      |
| `tc-value-in-range`    | `SpecScale` + `PriceSpanRail` + `PriceRangeBars` | One element with three skins. The library's chart set had no equivalent — and this is not a chart                                                          |
| `tc-tree-picker`       | `LocationPicker` + `LocationTree`                | 423 lines with the place vocabulary taken out. Distinct from `tc-tree-view`, which SHOWS a hierarchy rather than picking out of one                        |
| `tc-condition-builder` | `RuleEditor` + four siblings                     | A nested and/or tree of field · operator · value leaves. Nothing in the 388 covered it, and webgame.cloud's `SchemaEditor` is the adjacent shape           |
| `tc-qr-scan-sheet`     | `QrScanSheet`                                    | The scanning is the easy half; the states — refused, absent, in use, insecure origin — are why it is 161 lines                                             |

**From webgame.cloud and mindmap** — the editor set both apps ship, plus the two
filter and preview shapes:

| Tag                                | Replaces                                                                                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tc-editor-shell`                  | `EditorShell` (both apps) **and** `ToolShell` + `ToolWorkspace` + `ToolControls` — the same grid under a different vocabulary, so one element rather than two |
| `tc-design-canvas` + `tc-artboard` | `EditorStage` + `DesignArtboard`                                                                                                                              |
| `tc-zoom-control`                  | `EditorZoom` (identical in both)                                                                                                                              |
| `tc-preview-frame`                 | `ProjectPreview`'s frame half                                                                                                                                 |
| `tc-filter-bar`                    | `FilterBar` — the desktop sibling of `tc-filter-trigger` + a sheet                                                                                            |

**From mindmap:**

| Tag               | Replaces                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------- |
| `tc-graph-sigil`  | `GraphSigil` — a thumbnail drawn from the data rather than a screenshot or a letter          |
| `tc-bead-trail`   | The recent-cards trail — depth as beads, so "fifth of five" is legible before a name is read |
| `tc-graph-canvas` | `NoteGraphCanvas` + `helpers/graphLayout.ts` — the radial layout maths, which is domain-free |

**Every one of them conforms to the five React-safety rules**, and the CI ratchet
is what keeps that true: 76 of 414 elements conform, up from 49 of 388, and all
26 new ones are in the conforming set. None re-parents a consumer child, none
rewrites `this.innerHTML`, every list-driven one takes a JS property and renders
into a container it owns outright.

**Deliberately NOT added.** `StockBoard` is listed as a candidate but its generic
half is `tc-advanced-table` plus the new `tc-value-in-range`, and its specific
half is listings vocabulary. `RouteTabs` needs nothing: it is `tc-tab-bar` with a
`navigate()` call, and the call is the app's. `PageChrome` and `ErrorBoundary` are
React-only helpers. `useAuth` / `useCan` / `useFeature` / `useLock` are in all
three apps and stay there — they are shaped by each app's permission model.

### Added — four hooks and pull-to-refresh

`@toolcase/web-components/react` gained `useVisiblePoll`, `useKeyboardReveal`,
`useEditorShortcuts` and `useFeatureGate`. Each is about the browser or about
this library's own surface; the app-shaped hooks stayed in the apps.

`useFeatureGate` returns `{ enabled, pending, refresh }`, and `pending` is the
point: a boolean-only flag hook cannot tell "off" from "not answered yet", so
every gated route flashed its fallback for a frame. A gate that fails to resolve
is **closed** — failing open would let a network error hand out a feature.

**`tc-mobile-shell` gained `pull-to-refresh`**, which is where polovni.mk's
`usePullToRefresh` belongs rather than beside it: the gesture is the pane's and
only the shell knows which child that is, `overscroll-behavior-y: none` is
already set globally by this library so something has to give the gesture back,
and the indicator sits above the pane and below the app bar. `refreshing` is the
consumer's state — the element fires `tc-refresh` and never decides when the work
is done.

### Added — the `marker` theme

polovni.mk's own skin, lifted in. That app consumes this library and had been
carrying the whole retint as a local `--sun-*` override block; carrying the same
140 lines in every consumer is what a theme layer exists to stop.

It is named for what it is rather than for the product, like the other six: a
page of paper with one highlighter on it. The brand yellow is unchanged; the
ground under it moved — cool paper white instead of cream, graphite ink instead
of brown, cool shadows, a hairline that is a line rather than a smudge. Yellow
read as _dusty_ on cream because both were warm; on paper it reads as a marker.

The rules it keeps, each of which is a contrast measurement rather than a
preference: the yellow is a **fill, never small text** (yellow on white cannot
carry 12px type, so the warning WORD is `#7a5a00` and every yellow fill carries
dark ink at 11:1); links and focus take the instrument green, because the lead as
text on paper is ~1.6:1; and the highlighter appears on a **closed list** of
surfaces, because a theme whose whole idea is one marked colour has to say which
things get marked.

Ships the standard eleven accent variants. `--mk-on-lead` — the label on the
fill — is chosen per variant rather than fixed, since a marked thing with an
unreadable label is the one failure this theme cannot afford.

### Fixed — two gaps in the JSX type generator

Both found by the new elements, both affecting existing ones:

- **A subclass lost every attribute it inherited.** `static get
observedAttributes() { return [...Base.observedAttributes, …] }` was not
  resolved, so `tc-confirm-sheet` and `tc-qr-scan-sheet` had no `open`, no
  `heading` and no `snap`. The generator now follows the spread, and follows it
  for the attribute TYPES too — otherwise a subclass would inherit an attribute's
  name but not its tri-state-ness, and two spellings of one attribute is exactly
  the drift these generators exist to prevent.
- **Tri-state attributes were typed `string | number`.** `dismissible`, `handle`,
  `blur-behind` and `autohide` default to ON and carry the string `"false"` to
  turn off — and `handle={false}`, the spelling a React author reaches for and the
  one every setter coerces, was a compile error. They are now
  `boolean | 'true' | 'false'`.

### Fixed — the last eight elements that broke under React

The `check:react-safety` ratchet stood at 406 of 414 for a release. The eight it
excused were the ones whose chrome genuinely has to CONTAIN the consumer's
content — a dropdown menu is one positioned box, an accordion body is one
collapsible box, a `<tr>` is only a row inside a `<tbody>` — and the documented
advice was to hand those elements a single stable child and not render
conditionally inside them. **All 414 now conform, and that advice is withdrawn.**

Found by driving every element from React in the browser: mount with a keyed
child list, then perform the four operations react-dom performs on a host it owns
(attribute write, insert, reorder, remove) and unmount — 1242 cases across three
child vocabularies, plus 828 remount cases, 414 property-coercion sweeps and all
393 demos.

**Adoption, for the seven that need a wrapper** (`internal/adopt-children.ts`).
They still move the children once; the host now forwards `appendChild`,
`insertBefore` and `removeChild` to wherever the child actually went, so
react-dom's next `host.removeChild(node)` succeeds instead of throwing
`NotFoundError` and taking the route down with it. Nodes the element created
itself stay on the native path, so a render is unaffected. Adoption is a declared
state the checker reports and tracks, not a silent exception: moving children by
hand still fails rule 1.

`tc-carousel` needed more than a forward, because each child gets its own slide:
slides are now keyed off the child (not its index, which follows the wrong child
through a reorder), created and positioned on demand, renumbered and swept once
per task, and whitespace between elements no longer counts as a slide.

**`tc-select` was never moving anything** — it reads `<tc-option>` children as
data — and was failing the check because `fd.append(name, value)` on a `FormData`
matched the re-parenting regex. Fixed in the checker, along with folding
`patch-html`'s own `insertBefore` into every component that imports it.

**A `patchHtml` defect behind it all.** The walk matched owned nodes by position,
so when a template changed SHAPE — `split` growing a second toggle, then losing
it again — a later template node met an incompatible node in its slot, a
duplicate was created, and the trailing sweep deleted the original. When the
original was the element's container, the consumer's children went with it. The
walk now looks ahead for a node it can re-dress before building a new one, and
**never removes an owned node that holds consumer content at any depth** — rule 1
applied transitively, which protects every one of the 304 elements that patch.

`compatible()` matches on tag name, so two optional same-tag siblings could be
re-dressed into each other: switching `indicators` on made the carousel's track
become the indicator box, slides and all. Its three regions are now named.

### Fixed — derived state going stale when React changes children

A render runs from `attributeChangedCallback`. React changes children without
touching an attribute, so anything an element COPIED out of the consumer's
content was never refreshed. Eight elements were affected, and no app code could
work around it — there was no attribute to poke.

- `tc-button`, `tc-metal-button`, `tc-cool-button`, `tc-chip`, `tc-tag`,
  `tc-link`, `tc-dropdown-item`, `tc-nav-item` and `tc-breadcrumb-item` take the
  accessible name of their hit overlay from the label text. A relabelled button
  kept announcing the previous label to every screen reader.
- `tc-code-snippet` copies its children into the block it highlights, so it kept
  showing code that was no longer in the tree.
- `tc-select` re-derived its `<select>` when an option's ATTRIBUTE changed, which
  missed the option's label — a text child.

`internal/content-observer.ts` closes it: `observeContent` watches the consumer's
content, ignores mutations in the element's own markup (so a render cannot
trigger the next one) and coalesces to one callback per task. Derived labels now
read `consumerText(host)` rather than `this.textContent`, which after the first
render also contains the element's own text — a `tc-button` with
`help="Required"` had been naming itself "Save Required".

This is now rule 6 in `internal/tc-element.ts`.

### Changed — React compatibility

Derived from a study of how the three consuming apps actually use this library:
1235, 1002 and ~700 `tc-*` call sites, carrying 445 `useTc`/`useTcEvents` calls, a
2682-line hand-written adapter, and ~450 `|| undefined` guards against a bug that
does not exist. None of them renders these elements plainly, and no two of them
build the missing layer the same way. Verified line by line against
`react-dom` 19.2.7 (`setPropOnCustomElement`, `setValueForAttribute`), not from
memory.

**BREAKING (types): every generated `onTcXxx` prop is gone, because every one of
them was dead.** react-dom turns an unrecognised `on*` prop on a custom element
into `addEventListener(key.slice(2), value)` with **no case conversion**, so
`onTcChange={fn}` listened for an event named `TcChange` — which nothing in this
library has ever fired. It compiled, it ran, and it did nothing, with no warning.
The library's own `LoadMoreDemo` was shipping one. The generated typings now emit
the hyphenated form, which react-dom resolves correctly today with zero runtime
code:

```tsx
<tc-load-more ontc-load-more={load} /> // → addEventListener('tc-load-more', load)
```

A typed prop that compiles and does nothing is worse than no prop, so the
camelCase spelling is not emitted as a deprecated alias — the compiler now points
at every call site that had it.

**Typings gained real types.** `scripts/gen-react-types.mjs` and the new
`scripts/gen-react-components.mjs` share one extraction pass
(`scripts/component-manifest.mjs`), so the two generated files cannot disagree:

- 190 attributes are typed with the union the setter declares (`ButtonVariant`,
  `FieldState`, `TextAs`, …) instead of `string | number`. A misspelt variant is
  now a compile error. This found four real mistakes in this repo's own demos,
  including `variant="outline-secondary"` (there is no such variant — it is
  `variant="secondary" outline`) and `size="small"` on `tc-button` four times.
- 151 of 278 event props carry a typed `event.detail`.
- `ref` is typed as the element's own class, so `ref.current?.show()` needs no
  cast on the seventeen overlay elements. It still accepts a plain
  `useRef<HTMLElement>(null)` — narrowing it to the class alone would have made
  every existing one a compile error for no gain.
- JS-only properties (`value` on the form elements, `options`, `columns`,
  `validate`) are typed as JSX props too, because react-dom writes a prop as a
  _property_ whenever the name exists on the upgraded instance. `<tc-form-input
value={state}>` is the first thing a React author writes and it now compiles.

**`tc-form-input` supports a controlled React input.** `attributeChangedCallback`
called `render()` unconditionally for every observed attribute — so showing a
validation message while someone typed rebuilt the field under them and dropped
the caret to the end. One consuming app documents the consequence in its own
source: _"The field is UNCONTROLLED on purpose."_ Now only `type` and `loading`
rebuild (both change _which_ control exists); `value`, `error`, `help`,
`disabled`, `required`, `placeholder`, `label`, `min`/`max`/`step`, `rows` and the
keyboard hints all patch in place. Assigning `value` writes the inner control
directly and only when it differs, and never emits `tc-change` — so a controlled
field cannot feed back into itself.

**Every element now survives a pre-upgrade property write.** A property assigned
before `customElements.define` ran became an own data property that permanently
shadowed the accessor installed at upgrade; the setter never ran again.
`register()`'s `define()` wraps `connectedCallback` for all 388 elements
(`installPropertyReplay`, `src/internal/tc-element.ts`), so the shadow is dropped
and the value replayed through the real setter. This was latent in any app calling
`register()` before `createRoot`, and live in any app registering via dynamic
import — which is exactly what the README recommends for Next.js.

**New: `@toolcase/web-components/react/components`** — one typed React wrapper per
element, generated from the same manifest. camelCase attributes and handlers,
JS-only props assigned rather than stringified, a `ref` typed as the element's
class. Type-only imports throughout, so importing a wrapper pulls in no element
implementation and `register()` still does the defining. This is also the only way
to reach the 137 `on*` callback _properties_ from JSX, since react-dom sends those
names to `addEventListener` instead. Each of them also fires a `tc-*` event, which
remains the API to prefer.

**Gap 8 (re-parented children → `NotFoundError`) is closed for five elements.**
`tc-badge`, `tc-empty-state`, `tc-alert`, `tc-text` and `tc-label` no longer render
a wrapper: the classes are on the host, the nodes the element owns are prepended or
appended, and ordering is CSS. `scripts/check-react-safety.mjs` scores all 388
elements against the five rules in `src/internal/tc-element.ts` and runs in CI as a
**ratchet** — report-only, but a newly non-conforming element fails the build.
49 of 388 conform today.

DOM contract changes that follow, for a consumer styling internals:

| Element          | Was                                                       | Now                                                                                                                            |
| ---------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `tc-badge`       | `<span class="badge"><span class="tc-badge-content">`     | classes on the host; `text="…"` renders a prepended `.tc-badge-text` and hides other children                                  |
| `tc-empty-state` | `.tc-empty-state` div with `__body` / `__action` wrappers | classes on the host; `slot="action"` is a REGION (one element you supply), ordered last by CSS                                 |
| `tc-alert`       | `<span class="tc-alert-content">` around your children    | children untouched; the dismiss button is appended                                                                             |
| `tc-text`        | `<p                                                       | span                                                                                                                           | small | div class="tc-text">` | classes on the host; `as` is a `[as]` CSS selector, not a tag — a custom element cannot be a `<p>` |
| `tc-label`       | `<label class="form-label tc-label" for>`                 | classes on the host; `for` now works through a click handler + `aria-labelledby`, since a custom element cannot be a `<label>` |

`setHostClass` was rewritten while doing this: it now tracks what the _component_
wrote and treats everything else on the host as the consumer's, and those five
elements observe `class` so they can re-assert themselves after react-dom
overwrites `className` wholesale. That was a latent bug for every element that owns
its host class.

**Docs.** The `false`-is-safe rule is documented (`disabled={false}` has always
worked — react-dom removes the attribute for a boolean `false`, and the setter does
the same on an upgraded element), the tri-state exceptions are named, and the
`|| undefined` guard is gone from the demos and the SKILL reference.

Still open: gap 9 (one entry point, one stylesheet) is untouched, and 339 elements
still rebuild `innerHTML` on an attribute change or re-parent their children. The
ratchet is how those close.

### Added — desktop layout for the mobile set

The 5.0.19 mobile components grown desktop-friendly, keeping the phone output
byte-identical: every new rule sits inside `up(lg)` (992px) blocks, and the
structural ones are additionally scoped to a new opt-in.

- **`tc-mobile-shell` gained a boolean `desktop` attribute.** Absent, nothing
  anywhere changes — the published centred-480px wide-viewport default stays.
  Present, from `lg` up: the frame widens to
  `--bs-mobile-shell-max-width-desktop` (1280px, still centred and
  hairline-framed); a slotted dock's strip is reserved as `padding-left`
  (`:has(> [slot='dock'])`, so dockless screens get the full width back). The
  rail width is one shell-owned token (`--bs-mobile-shell-rail-width`, 88px)
  that both the shell's reservation and the dock's rail box read, so the two
  cannot drift. Deliberately padding + an absolutely positioned rail rather
  than a grid: the header region is one or MORE children (bar + band is the
  shipped pattern), and grid auto-placement cannot span "however many header
  children exist". The flex column the phone uses survives untouched, which is
  also what keeps the pane-resolution JS and every consumer selector true.
- **`tc-tab-dock` inside `tc-mobile-shell[desktop]` renders as a left nav
  rail**: same items, icon-over-label, badges and events, rotated into a
  full-height `auto/min-content` grid with a trailing hairline instead of the
  bottom bar's top rule + lift shadow. Fine-pointer hover tint
  (`--bs-tab-dock-rail-hover-bg`) and an optional active plate
  (`--bs-tab-dock-rail-active-bg`, transparent by default). `[data-hidden]`
  (auto-hide) is neutralised in rail mode — hiding primary navigation that
  covers nothing is a usability bug, and the JS cannot see layout. Keyboard:
  the tablist now answers ArrowUp/ArrowDown alongside Left/Right,
  unconditionally — costs nothing horizontally, required vertically.
- **`tc-bottom-sheet` inside a `[desktop]` shell's overlay renders as a
  centred dialog**: all-corner radius (`--bs-bottom-sheet-desktop-radius`),
  downward shadow, `min(--bs-bottom-sheet-desktop-width, 100% − 96px)` wide
  (560px default), content height capped at `100% − 96px` — snap ratios are a
  thumb-reach contract and are ignored here. Entrance is a 24px settle + fade
  instead of the full-height slide. **Drag-to-dismiss is off in this mode**
  (`_dialogMode()` in `src/BottomSheet.ts` mirrors the CSS scope): a mouse
  selecting body text is indistinguishable from a drag, and the handle —
  now a lie — is hidden with it. Scrim tap, Escape and the sheet's own
  actions remain. When a rail is present the dialog centres in the CONTENT
  column, not the frame.
- **`tc-action-bar`** in a `[desktop]` shell centres its tracks into a
  640px column (`--bs-action-bar-desktop-max`; `100%` disables) via a
  `max()` on its own inline padding — surface, rule and elevation stay
  full-width.
- **`tc-app-bar`** in a `[desktop]` shell takes `--bs-app-bar-desktop-inline`
  (24px) as its inline gutter — one physical longhand, so every variant keeps
  its vertical recipe.
- **`tc-fab`** in a `[desktop]` shell drops `--bs-fab-offset` to 32px — the
  104px default is the phone's dock clearance and the dock is now a rail. An
  explicit `offset` attribute still wins (inline property).
- **`tc-step-pager`** caps its content column at
  `--bs-step-pager-desktop-max` (720px, `100%` disables) at `lg` by growing
  its two gutter tokens — NOT scoped to the shell, because cooking mode is a
  body-level fixed overlay in the reference consumer. The one unscoped
  desktop default in this set.
- **`tc-page-tabs`** gained a fine-pointer hover (resting tab darkens to the
  active ink, weight and underline untouched), which also cancels the reset's
  `a:hover` underline on route tabs. Unscoped: it is pointer-gated, not
  width-gated.

### Added — `tc-extended-select` items take `keywords`

- **`ExtendedSelectItem.keywords?: string[]`** — extra search terms the menu's
  search field matches (case-insensitive containment, alongside `label` and
  `description`) and never renders. Same field and same contract as
  `ComboOption.keywords`, which the combo box has always honoured; the two
  elements disagreeing was the bug: a consumer that transliterated its option
  labels into `keywords` got Latin search inside a `tc-combo-box` and nothing
  inside a `tc-extended-select`, with no signal that the field was ignored.
  Additive — items without the field filter exactly as before.

Fixes found while consuming `5.0.19` from the app. Nothing in the list below
changes an API.

### Fixed

- **`tc-macro-grid` ignored `columns="3"` written as a string** and silently
  rendered four tracks. react-dom writes a JSX prop as a **property** whenever
  one exists on the instance, so the string `'3'` reached the setter and
  `[2, 3, 4].includes('3')` was false — the `: 4` fallback then applied. The
  setter now coerces with `Number(v)`, the same handling the tri-state boolean
  setters already do. Found on JADI.mk screen `1i`, where the extra track made
  each macro cell 76px instead of 105px and wrapped „јаглехидрати" onto two
  lines. The element's own documented example uses the string form, so any
  consumer following it was affected. Additive — a caller already passing a
  number behaves identically.

- **`tc-icon` failed to resolve a kebab-case name** (`src/Icon.ts`).
- **`tc-step-pager`** geometry and behaviour fixes (`src/StepPager.ts`,
  `style/components/_step-pager.scss`).

> ⚠️ **All three fixes above exist in this local checkout only — they are NOT in
> the published `5.0.19`.** JADI.mk's closing gate (`rm -rf node_modules && npm ci`)
> resolves the registry tarball, which drops the symlink to this checkout, so the
> app must work without them — and was verified to. Anything the app genuinely
> needs from here has to be published first, not re-linked.

### Known gaps — the scope of 5.0.20

Found while consuming `5.0.19` from JADI.mk (tasks `32`, `34`, `40`). **None was
fixed**, deliberately: the app's dependency is the published version and a local
edit would not survive a clean install. Each is worked around app-side today, and
each workaround carries a comment pointing here.

| #   | Gap                                                                                                                                                                                                                                                                                                                                                                                                                                 | Consequence for the consumer                                                                                                                                                                                                                | Workaround in JADI.mk                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **`tc-extended-select`'s popup is sized from its trigger with a minimum**, so it renders 385px wide at a 320px viewport and hangs off the right edge.                                                                                                                                                                                                                                                                               | Measured on `/admin/settings`, where two of them sit in a 304px card.                                                                                                                                                                       | `max-width: calc(100vw - 24px)` under a `coarse-pointer` query in `app.scss`, marked as a workaround. The real fix belongs in `style/components/_extended-select.scss`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2   | **The focus ring on `tc-page-tabs`, `tc-tab-dock` and `tc-app-bar`'s back button is `--tc-app-accent`**, which sunshine maps to amber — 1.79:1 on cream.                                                                                                                                                                                                                                                                            | A keyboard user cannot see where focus is on the app's three most-used chrome elements.                                                                                                                                                     | `_a11y.scss` re-points the ring for those three selectors.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 3   | **`Button.ts` never forwards `aria-label`/`title` to its inner `<button>`.** It observes only `variant/outline/size/disabled/loading/href/type/skin`, so an icon-only `tc-button` reports as unnamed.                                                                                                                                                                                                                               | Every icon-only `tc-button` is an unlabelled control.                                                                                                                                                                                       | A `.visually-hidden` span as the element's **single** child (two children hit gap 8 below).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 4   | **`tc-taxonomy-card` renders its heading as an unconditional `h3`.**                                                                                                                                                                                                                                                                                                                                                                | An `h1 → h3` outline skip on seven list routes; the card cannot be placed under an `h2`.                                                                                                                                                    | None — recorded as a known outline defect. Needs a `heading-level` attribute, which `tc-app-bar` already has.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 5   | **`tc-day-strip` announces the today marker twice** (visible text plus a redundant accessible name).                                                                                                                                                                                                                                                                                                                                | A screen reader reads the current day's label two times.                                                                                                                                                                                    | None.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 6   | **`tc-alert` hardcodes `role="alert"` in its own `render()`** and has no politeness attribute.                                                                                                                                                                                                                                                                                                                                      | Every alert is assertive, so a _success_ interrupts a screen reader — usually while the user is typing. React writes props before insertion, so a consumer's `role` prop is clobbered by the element's first render.                        | The consumer re-writes `role`/`aria-live` in an effect **after** mount. Needs a `politeness` (or `live`) attribute.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 7   | **`tc-alert` has no swipe-to-dismiss.**                                                                                                                                                                                                                                                                                                                                                                                             | A toast layer built on it can only be dismissed by the close button or its timer.                                                                                                                                                           | Accepted: a pointer-move handler in the app would compete with the shell's scroll pane.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 8   | **An element that re-parents its slotted children into a rendered wrapper breaks react-dom.** `tc-button` moves them into `.tc-button-content` while the React fiber still records the host as their parent, so the first time React removes ONE element child individually, `removeChild` throws `NotFoundError` and the whole route renders blank. Same shape in `tc-toast` (`.toast-body`) and `tc-alert` (`.tc-alert-content`). | Took `/shopping/:id` down completely. It only bites on an _individual_ child removal — React deletes a subtree by its topmost host node, so a static single child is safe.                                                                  | Five `tc-button` sites that passed element children were replaced by `tc-icon-button` (icon/label as attributes, no children). **Task `41` found two more shapes of the same gap and they are worth spelling out, because „a static single child is safe" reads narrower than the trap actually is:** (a) `{label}{n > 0 ? ` (${n})` : ''}` is TWO text children, and React treats `''` as _no child_ — so the count falling to zero is an individual removal and took `/moderation` down to a blank screen the moment the last report was resolved; (b) `{cond && <p/>}` as one of several children of `tc-alert` does the same when `cond` flips (`CapacityBanner`'s waiting-queue pitch). Both were fixed app-side by interpolating into one string / wrapping every child in one stable element. The library-side fix is unchanged: stop re-parenting and order the regions with CSS, as `tc-mobile-shell` and `tc-bottom-sheet` already do. |
| 9   | **The library is one entry point and one stylesheet.** `register()` constructs all 362 elements; `style.css` is all 349 component partials plus all seven themes — 517 KB gzip of JS and 351 KB of CSS, against the app's own 151 KB and 28 KB.                                                                                                                                                                                     | JADI.mk's „total first-load JS ≤ 400 KB gzip" budget fails at 668 KB and **no app-side splitting can reach it.** It is also the residual 50 ms frame on the first sheet of a session (first-time style/layout against a 2.8 MB stylesheet). | None available. Needs per-element registration and a per-theme CSS entry (`@toolcase/web-components/themes/sunshine.css`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 10  | **`tc-extended-select`'s picker sheet is titled `this.label                                                                                                                                                                                                                                                                                                                                                                         |                                                                                                                                                                                                                                             | this.placeholder`.** In sheet mode (coarse pointer) the option list moves into a `tc-bottom-sheet` whose heading comes from those two, in that order.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | A consumer that labels the field with a sibling `tc-label` — which is the documented way to label a field that sits in a grid with its own `<tc-label>` — gets a sheet headed „Изберете…" instead of „Пол". JADI.mk has ~20 of these, i.e. every select on a phone. | None. Setting `label` on the element would fix the title and render a SECOND visible label under the existing `tc-label`, so the app-side fix is a 20-call-site change; recorded instead of churned. Needs either a `sheet-title` attribute or `aria-label` participating in the fallback. Found by task `41`. |

Gaps 1–3, 6, 7 and 10 are cosmetic or additive and fit a patch. 4 and 5 change rendered
markup, so they are minor-bump candidates. 8 and 9 are structural.

> **Gap 8 update.** Closed for `tc-badge`, `tc-empty-state`, `tc-alert`, `tc-text`
> and `tc-label`, and now measured rather than remembered: run
> `npm -w @toolcase/web-components run check:react-safety` for the current list
> (49 of 388 conform), and see the _Changed — React compatibility_ entry at the
> top of this file. Gap 9 is unchanged.

## 5.0.19

Mobile-first pass: a phone application shell and the interaction primitives a
touch UI needs, plus a touch-target and viewport foundation the existing
components read from. Driven by the JADI.mk mobile rebuild, but nothing in it is
app-specific — no domain vocabulary entered the library.

### New elements (20)

**Application frame**

| Tag               | What it is                                                                                                                                                                                                                      | Not to be confused with                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `tc-mobile-shell` | The phone frame: `header` / one scrolling pane / `action` / `dock` / `overlay` slots, `100dvh`, safe-area aware, per-key scroll restoration, rAF-throttled `tc-shell-scroll` event, `--tc-keyboard-inset` from `visualViewport` | `tc-dashboard-layout` (desktop sidebar + topbar)        |
| `tc-app-bar`      | Top bar, variants `brand` / `title` / `back`                                                                                                                                                                                    | `tc-navbar` (desktop horizontal nav with a links model) |
| `tc-page-tabs`    | Horizontally **scrolling** underline tab rail; never wraps                                                                                                                                                                      | `tc-tab-bar` (desktop switcher, wraps)                  |
| `tc-tab-dock`     | 5-up bottom navigation dock, icon over label, count badges, `tc-tab-dock-reselect`                                                                                                                                              | `tc-page-tabs`, `tc-tab-bar`                            |
| `tc-action-bar`   | Sticky bottom action surface: safe-area padding, keyboard inset, dock-aware shadow. Imposes no button styling                                                                                                                   | —                                                       |
| `tc-fab`          | 56px squircle floating action button (`border-radius: 16px`, not a circle), optional `auto-hide` off the shell scroll event                                                                                                     | —                                                       |

**Overlay**

| Tag               | What it is                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tc-bottom-sheet` | Bottom sheet: grab handle, snap points, pointer-driven drag-to-dismiss (35% or a >0.5px/ms flick), nested-scroll arbitration, focus trap with return-to-trigger, scroll lock that targets the shell pane when inside one and falls back to the body technique otherwise (reported by a readonly `lockTarget`), 2-level stack cap. Ships `.tc-sheet-section` as a class, not an element |

**Paging**

| Tag              | What it is                                                                                                                                                                              |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tc-swipe-pager` | Discrete page container built on CSS scroll-snap, so the browser owns the animation. `scrollend` with a debounced fallback; `touch-action: pan-y` so vertical scroll wins               |
| `tc-step-pager`  | Guided full-screen step surface: segmented progress, `keep-awake` via `navigator.wakeLock` (reflects the **real** lock state, re-requests on `visibilitychange`), viewport-clamped type |

**List / content**

| Tag                | What it is                                                                                                                                                           |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tc-check-row`     | Tick-off row wrapping a real visually-hidden `<input type="checkbox">`; whole row is the hit target; `shape` square/circle, `tone` accent/success                    |
| `tc-list-section`  | Titled, bordered list group with a banded header                                                                                                                     |
| `tc-notice`        | Inline aside with a left accent bar, six tones, plus a full-width `banner` variant. **Distinct from `tc-alert`**, which is a dismissible announcement with a heading |
| `tc-taxonomy-card` | Content card whose identity comes from one accent hue: accent top border, tinted surface, floated metric box, chip and social slots                                  |
| `tc-add-slot`      | Dashed-border "add" affordance; a real `<button>`                                                                                                                    |
| `tc-load-more`     | Idle / loading / exhausted pagination control for touch lists. `tc-pagination` is now documented desktop-only                                                        |

**Numeric display**

| Tag              | What it is                                                                                                                    |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `tc-stat-tile`   | Number + label + optional hint, tonal number colour                                                                           |
| `tc-macro-grid`  | 3/4-up grid of stat tiles, `bare` and `tiled` variants                                                                        |
| `tc-quota-meter` | Track + fill + fraction label; owns the colour-on-approach rule (≥90% warning, 100% danger). Also a full-width `bar` variant  |
| `tc-trend-spark` | Sparkline: line, optional area fill and end dot. Deliberately not a chart — no axes, tooltips or legend                       |
| `tc-day-strip`   | 7-up day selector where **state and selection are orthogonal**; status is exposed in the accessible name, not by colour alone |

### Foundation

- `--tc-safe-top/-right/-bottom/-left` indirections over `env(safe-area-inset-*)`, so a consumer can override an inset (a design canvas or desktop shell can force 0). Components must read the token, never `env()` directly.
- `--tc-vh` (`100dvh`) and `--tc-vh-min` (`100svh`), with an `@supports not (height: 100dvh)` fallback to `100vh`.
- `--tc-min-touch-target` (44px) and `--tc-touch-target-dense` (40px), now read by the controls below rather than hardcoded per partial.
- Mobile spacing / radii / control-height / elevation / motion tokens, and a `sunshine` mobile layer (type scale, scrim, dock states) with per-component partials under `style/themes/sunshine/components/`.
- 16 `tc-`-prefixed utilities, including `.tc-scroll-y` (carries the load-bearing `min-height: 0`), `.tc-scroll-x`, `.tc-snap-x`, `.tc-touch-target`, `.tc-truncate-1/-2`.
- Mobile-first Sass mixins: `up()`, `coarse-pointer()`, `fine-pointer()`, `motion-ok()`, `reduced-motion()`. **No `down()` mixin** — deliberately, so components are authored at phone width and widened.
- `style/foundation/README.md` documents the above.

### Changed defaults a consumer can see

Unconditional:

| Change                                               | Old                                            | New                                                                          |
| ---------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------- |
| `:where(button, [role="button"], a, label, summary)` | —                                              | `touch-action: manipulation` (removes the 300ms tap delay; zero specificity) |
| `tc-nav-button` `aria-label` fallback                | hardcoded `'Back'` / `'Close'`                 | reads the message registry, so `configureMessages` is finally honoured       |
| `ToolcaseMessages`                                   | —                                              | gained a required `back` field                                               |
| `lib/react.d.ts`                                     | 4 components shipped without their event types | `tc-generate` (×2), `tc-continue`, `tc-step-click` now typed                 |

Only under `@media (pointer: coarse)`:

- `input` / `select` / `textarea`: `font-size: max(16px, 1em)` — below 16px iOS Safari zooms the viewport on focus and never zooms back.
- `.btn` gains a `min-width` floor; `.form-select` gains min-height and font-size floors.
- `html, body { overscroll-behavior-y: none }`, with a documented opt-out.

> **Versioning note.** This shipped as a patch. The `ToolcaseMessages` `back`
> field is the one line that can break a build: a consumer declaring a _complete_
> catalog object stops compiling until they add it. `configureMessages` takes a
> `Partial<>`, so runtime is unaffected, and no other change alters an existing
> element's behaviour outside a `pointer: coarse` query. Consumers pinning `~5.0`
> and rendering on touch will see the touch floors above.

### `tc-step-pager` — two additive features (JADI.mk task 21)

Added while building the app screen this element was written for, so they land in the same unreleased entry rather than a follow-up. Both are opt-in and neither changes an existing default.

| Addition                                      | API                                                                                                                                                                    | Why                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Progress degrades past a step-count threshold | `max-segments` attribute / `maxSegments` property, default **10**; host reflects `[data-progress-bar]`; new `--bs-step-pager-count-*` knobs                            | At 390px 15 segments are 20px each with 4px gaps — a dotted line whose fill boundary is unreadable, which defeats the rule. Past the threshold the region becomes one bar filled to `(index+1)/count` with a „3/15" counter beside it                                                                                                                       |
| The context title can be an action            | `heading-action` attribute / `headingAction` property, `tc-step-pager-heading` event, `onHeadingAction` callback, `--bs-step-pager-heading-icon-size` / `-heading-gap` | A guided sequence whose steps reference context the reader needs mid-way has nowhere to put it (cooking mode and the ingredient amounts). The title row is where a thumb looks. With the attribute the heading is a real `<button>` + `chevron-down` + `aria-haspopup="dialog"`; without it, still a `<div>` — a plain title must not announce as pressable |

**Internal DOM changed.** The element owns its whole subtree, so this is not a slot contract, but a consumer styling internals should know: `.tc-step-pager-progress` now wraps `.tc-step-pager-track` (the segments, or one `.tc-step-pager-bar`) plus `.tc-step-pager-count`, and `.tc-step-pager-heading` wraps its text in `.tc-step-pager-heading-text`. `.tc-step-pager-seg` and its `[data-filled]` are unchanged. No new `ToolcaseMessages` key — „3/15" is figures and a solidus, so there is no sentence to translate.

### Fixes

- **`.form-select` had no touch floor at all.** `_input.scss` declared one, but `_select.scss` is forwarded later and re-declared `min-height` at equal specificity — media queries add no specificity, so the rule lost on source order. Same cause found and fixed for `.pagination-sm .page-link`.
- **`.tc-touch-target` used `display: grid`**, stretching non-button elements to full width; now `inline-grid`.
- **`gen-react-types.mjs` never matched `new CustomEvent<Detail>(…)`**, which is why the four components above had no event types.
- **`tc-app-bar` doubled to 68px at 320px**: flex line-breaking uses an item's _hypothetical_ main size, so `flex-basis: auto` on the title block pushed the actions to a second line. Fixed with `flex: 1 1 0`.
- Theme-scoped elevation: `rgba(var(--tint), α)` composed at `:root` cannot be re-pointed by a theme, because a custom property's `var()` is substituted where it is declared. The elevation block is now emitted again at theme scope, so warm-tinted shadows stay warm.
