# Reusability Guide — `@toolcase/web-components`

How complex `tc-*` components should reuse simpler ones, where they currently
don't, and the concrete refactors that pay off most. Audit covers all **347**
source files in `src/`.

---

## 0. The headline

The library is broad (≈340 components) but **flat**: components almost never
build on each other. Two numbers say it all:

| Signal | Count | Meaning |
|---|---|---|
| Files that nest another `tc-*` element | **14 / 347** | Composition is the exception, not the rule. |
| Files importing from `src/internal/` | 27 / 347 | The shared layer exists but is barely used. |
| Files with their own private `esc()` HTML-escape fn | **227 / 347** | Same 5-line function copy-pasted 227 times. |
| Files with their own `lucideByName()`/`resolveIcon()` | **84** | Same kebab→PascalCase lucide lookup, 84 times. |
| Files emitting raw `class="btn …"` | 33 | Re-implementing `tc-button`. |
| Files emitting progress-fill markup (`aria-valuenow`) | 21 | Re-implementing `tc-progress-bar`/`tc-resource-bar`. |
| Files redeclaring `VARIANTS = ['primary', …]` | 30 | Same variant table + getter/setter boilerplate. |

`esc()` is even duplicated **4 times inside `internal/` itself**
(`bs-overlay.ts`, `resourceBar.ts`, `text-field-base.ts`, `dialog-base.ts`)
before any component copies it. That is the canonical "extract once" target.

The good news: the codebase already proves shared helpers work here — `icon()`
in `icons.ts` is reused by **129** files, and `internal/` already holds real
base classes (`SlotWrapBase`, `LinkItemBase`, `DialogBase`, `text-field-base`,
`renderResourceBarTrack`). The pattern is established; it's just under-applied.

---

## Status (implementation log)

**Tier 0 — DONE and build-verified.** Six shared helpers created and adopted:

| Helper | Adopted by | Replaced |
|---|---|---|
| `internal/esc.ts` | ~236 files + the 4 internal copies now delegate | 224 `function esc`, 1 `escapeAttr`, 6 `_escape*` methods |
| `internal/lucide.ts` | 64 files | every standalone `lucideByName` |
| `internal/image.ts` | 6 files | every `isImageSrc` copy |
| `internal/initials.ts` | Avatar, ContributorWall | 2 of the 4 `deriveInitials` copies (UserPanel/Leaderboard diverge — left) |
| `internal/variants.ts` | 14 files | `VARIANTS_FULL`/`VARIANTS_CORE` (10 + 4 identical arrays) |
| `internal/format.ts` | DownloadStats, DebugOverlay | `formatCompact`, `formatNumber` |

Also removed 62 orphaned `import * as LucideIcons` and 12 orphaned `icon`
imports left behind by the lucide migration. `tsup` build green; no orphaned
imports remain. Number-format `formatTime` was intentionally **not** merged —
the two copies use different units (ms vs seconds); merging would be a bug.

**Tier 1 — re-scoped after inspection (see §3).** The original Tier 1 premise
(swap inline markup → nested `tc-*` elements) does **not** hold up against the
code. Spot-checks of the `btn`/`badge`/`progress` re-implementations show the
library *already shares the visual layer through the Bootstrap-class API*
(`.btn`, `.badge`, `.progress`, `text-bg-*`). Components that "re-implement" a
primitive almost always fall into one of two buckets, neither of which benefits
from element-nesting:

1. **Already reuse the classes** (e.g. ConfirmDialog/FormWizard/Dropdown emit
   `class="btn btn-primary tc-x__confirm"`). The `.btn` styling is shared; the
   extra hook class exists for `querySelector` event-wiring. Wrapping in
   `<tc-button>` yields **identical pixels** but breaks the event wiring and
   adds a host + `.tc-button-content` wrapper — pure churn, real risk.
2. **Intentionally bespoke** (e.g. PlayerCard's lighter card-context action
   buttons; its presence pip supports an `in-game` state `tc-status-dot` lacks;
   the `__track`/`__fill` bars in BattlePass/AudioMixer/sliders are
   contextually different from a `.progress` bar). Nesting the primitive here
   **regresses** the design.

The genuine remaining reuse is **behavioral, not markup** — see Tier 2.

**Tier 2 — DONE for the clean fits.** `DialogBase` grew three default-preserving
hooks (`shouldLockScroll`, `onOpened`, `onClosing`); **Drawer, LootPopup,
PauseMenu** now `extends DialogBase` instead of re-implementing `getFocusable` +
focus-trap + scroll-lock + transition-timing + open-state (~476 lines deleted,
render markup byte-identical, `tsup` + examples build green). Slot-capture
stays in Drawer (a thin `connectedCallback` override); PauseMenu pins
`classPrefix` to `tc-pause-menu` for its `tc-pause-screen` alias.
**Lightbox** and **CommandPalette** were deferred on purpose: Lightbox uses a
`--open`-class visibility model (no `hidden` attr) plus carousel index state,
and CommandPalette uses a non-BEM structure (`-backdrop`, no `__panel`) with a
search/arrow-nav model — both are poor DialogBase fits and forcing them would
re-introduce the exact churn-vs-fit problem flagged in Tier 1.

---

## 1. How reuse works in this codebase

Components render **raw HTML strings via `innerHTML`** into the light DOM with
Bootstrap-compatible classnames. That shapes the two reuse strategies:

### Strategy A — nest a `tc-*` element

Emit the child custom element inside the parent's markup:

```ts
// instead of hand-writing the badge span:
this.innerHTML = `<tc-badge variant="${variant}" text="${esc(label)}"></tc-badge>`
```

- **Use for** self-contained, stateful, or interactive sub-widgets that own
  behavior and accessibility: `tc-button`, `tc-avatar` (image-error fallback),
  `tc-status-dot`, `tc-switch`, `tc-progress-bar`, `tc-tooltip`, `tc-item-slot`.
- **Win**: zero markup drift, automatic theming (incl. the dungeon theme),
  bugfixes propagate.
- **Cost**: custom-element upgrade timing; the host must be registered; passing
  rich/array data needs a property set after insertion, not an attribute. Each
  new tag needs a `display` entry in `foundation/_reset.scss` (already true for
  the primitives).

### Strategy B — shared render helper / base class (`src/internal/`)

Extract the markup fragment or utility into `internal/` and call it from the
string template:

```ts
import { esc } from './internal/esc'
import { badgeHtml } from './internal/badge'      // returns a `<span class="badge …">` string
this.innerHTML = `<div class="…">${badgeHtml(variant, label)}</div>`
```

- **Use for** pure-markup fragments and utility functions: `esc()`,
  `lucideByName()`, `isImageSrc()`, `deriveInitials()`, number formatting,
  `VARIANTS` tables + variant getter/setter, and static badge/chip/trend spans.
- **Win**: no runtime element overhead, composes inside any string, matches the
  existing `internal/` precedent. **This is the primary strategy for this
  library.**
- **Cost**: helper and element markup can still drift unless the element itself
  also routes through the helper (make the primitive consume its own helper).

> **Rule of thumb:** behavior & a11y → nest the element (A). Pure markup &
> string utilities → shared helper (B). When a primitive is *both* (e.g.
> `tc-badge`), extract a `badgeHtml()` helper that **both** the `tc-badge`
> element and its callers use — single source of truth, caller's choice of A or B.

---

## 2. Tier 0 — cross-cutting utility duplication (do these first)

Highest ROI: small, mechanical, touches the most files, zero visual risk.

| # | Helper to create | Replaces | Files affected | Effort |
|---|---|---|---|---|
| 0.1 | `internal/esc.ts` — one `esc(s)` | 227 local copies + 4 in `internal/` | ~231 | Low (mechanical) |
| 0.2 | `internal/lucide.ts` — `lucideByName(name)` / `resolveIcon()` (kebab→Pascal lookup + `icon()` wrap) | `lucideByName`/`resolveIcon`/`firstLucide` | **84** | Low–Med |
| 0.3 | `internal/format.ts` — `formatCompact(n)`, `formatNumber(n)`, `formatTime(s)` | inline `toLocaleString`, `formatCompact`, `formatTime` (DownloadStats, CooldownBadge, charts, CurrencyChip…) | ~20 | Low |
| 0.4 | `internal/image.ts` — `isImageSrc(s)` | identical copies in Hotbar, InventoryGrid, EquipmentDoll, CraftingPanel, ItemSlot, CharacterSelect | 6 | Low |
| 0.5 | `internal/initials.ts` — `deriveInitials(name)` | Avatar's copy + ContributorWall + ~9 others | 11 | Low |
| 0.6 | `internal/variants.ts` — shared `VARIANTS` const + a `variantAttr()` accessor mixin | 30 redeclared arrays + duplicated getter/setter | 30 | Med |

**Notes**
- 0.1: there are **5 different escape behaviors** in the wild — most do 4
  replaces (`& < > "`), some add `'→&#039;`. Standardize on the 5-replace version
  (it's a superset and safe). Have `text-field-base`/`dialog-base`/`bs-overlay`/
  `resourceBar` re-export from `internal/esc.ts` rather than keep their own.
- 0.2: the icon-resolver is the second-biggest duplication after `esc`. Many
  variants exist (`lucideByName`, `resolveIcon`, `_resolveIcon`, `firstLucide`,
  with ad-hoc `gear`/`cog` normalization). Consolidate the normalization too.

---

## 3. Tier 1 — primitives re-implemented as inline markup

Complex components hand-roll markup that a leaf primitive already owns. Fix by
extracting a `*Html()` helper that the primitive also consumes (B), or by
nesting the element where behavior matters (A).

### 3.1 Badge / Chip (`tc-badge`, `tc-chip`, `tc-rarity-chip`, `tc-currency-chip`)
Re-implemented `class="badge text-bg-*"` / chip spans, and per-variant color
logic, in: PlayerCard (rank/level), StatCard, MetricCard, StatusCard,
GithubStarsCard, PricingCard, Leaderboard, ShopPanel, BattlePass, FileTags,
BadgeRow, ChipGroup, CurrencyDisplay, RarityChip, and most game widgets.
→ Extract `internal/badge.ts#badgeHtml(variant, text, {pill})`; `tc-badge`
consumes it too. **Strategy B.**

### 3.2 Button / IconButton / CloseButton (`tc-button`, `tc-icon-button`, `tc-close-button`)
33 files emit raw `class="btn …"`. Hot spots:
- **PlayerCard** action buttons (`PlayerCard.ts:166-172`) → `tc-button`.
- **ConfirmDialog** (`:134`), **ReportDialog** (`:159` + close at `:151`),
  **Drawer** (`:272`), **Modal** (`:119`), **Offcanvas** (`:91`) all hand-write
  close/action buttons → `tc-button` / `tc-close-button`.
- DangerZoneActions, ResetToDefaults, ActionItems, Login, screens.
→ **Strategy A** (buttons carry loading/disabled/href behavior worth inheriting).

### 3.3 ProgressBar / ResourceBar (`tc-progress-bar`, `tc-resource-bar`)
21 files build progress fills. `internal/resourceBar.ts` already exports
`renderResourceBarTrack()` — but BuffBar, SkillBar, BossBar, QuestTracker,
HeroStatsBar, BattlePass, SkillTree compute their own `remaining/duration`
percentage and emit their own track div.
→ Route all bars through `renderResourceBarTrack()` (already the canonical
track) + a shared `pctOf(current, max)` helper. **Strategy B**, or nest
`tc-resource-bar` where it's a standalone bar.

### 3.4 Avatar / StatusDot / Portrait (`tc-avatar`, `tc-status-dot`, `tc-portrait`)
- Status pips re-implemented in PlayerCard (`tc-player-card-pip`, `:182-184`),
  and Avatar carries its **own** status dot (`tc-avatar-status`) that duplicates
  `tc-status-dot`'s logic. 5 components hand-roll presence pips.
  → `tc-avatar` should nest/share `tc-status-dot`; PlayerCard should nest
  `tc-avatar` + `tc-status-dot`. **Strategy A.**
- `deriveInitials` (Avatar) duplicated in ContributorWall, PartyPanel,
  EntityProfileCard, UserPanel → Tier 0.5.

### 3.5 TrendIndicator / Sparkline / charts (`tc-trend-indicator`, `tc-chart-container`)
- Trend arrows (up/down + color) re-derived in DifferenceCard, MetricCard,
  StatCard, Leaderboard, ItemCompare → nest `tc-trend-indicator` (A) or
  `trendHtml()` (B).
- BarChart, LineChart, AreaChart, PieChart, FunnelChart, BenchmarkChart each
  repeat axis/legend/container chrome and their own y-formatter →
  `tc-chart-container` + `internal/format.ts`. **Strategy B.**

### 3.6 Form controls (`tc-input`, `tc-label`, `tc-helper-text`, `tc-input-group`, `tc-check`, `tc-radio`)
`internal/text-field-base.ts` exists and already exports `esc`, but:
- NumberInput, PhoneInput, DatePicker, TimePicker hand-build
  `input-group`/`form-control`/label/`invalid-feedback` markup →
  `tc-input-group` + `tc-helper-text` (A), or shared label/help helpers (B).
- CheckboxGroup (`:159`), RadioGroup (`:233`), FormInput (`:534`,`:557`)
  re-implement `form-check` wrappers → `tc-check` / `tc-radio`. **Strategy A.**
- FormInput keeps a **local `esc()`** (`:579`) despite importing
  `text-field-base` — straight Tier 0.1 cleanup.

### 3.7 List rows / cells (`tc-list-group-item`, `tc-list-row`, `tc-entity-cell`, `tc-rank-cell`, `tc-stat-row`)
Leaderboard, DataList, AssetRowList, SettingsCategoryList, ContributorWall,
AdvancedTable hand-build rows/cells that `tc-list-row` / `tc-entity-cell` /
`tc-rank-cell` / `tc-stat-row` already render. → mix of A (cells) and B.

---

## 4. Tier 2 — behavioral base classes are bypassed

These are the highest-value *behavioral* (not just markup) duplications.

### 4.1 `DialogBase` (`internal/dialog-base.ts`) — focus-trap, scroll-lock, transition, ESC/backdrop
Already an abstract class with `getFocusable`, `_trapFocus`, `_lockScroll`,
`_restoreScroll`, `_applyOpenState`. **Drawer, Lightbox, LootPopup, PauseMenu,
CommandPalette each re-implement all of it** (Drawer `:121-227`, Lightbox
`:114-161`, LootPopup `:139-161`, PauseMenu `:168-256`).
→ Make them `extends DialogBase`. Removes ~80 lines each + 5 copies of a
fiddly focus-trap. **Highest behavioral ROI.**

### 4.2 `SlotWrapBase` (`internal/slot-wrap.ts`) — capture→render→re-append
The slot-capture `connectedCallback`/`attributeChangedCallback` dance is
copy-pasted verbatim in nearly every component (Badge, Button, AssetRowList,
AdvancedTable, …) even though `SlotWrapBase` abstracts it exactly. Adopt it for
any "styled shell around slotted children" element.

### 4.3 `LinkItemBase` (`internal/link-item.ts`)
Already shared by breadcrumb/dropdown items; extend to NavItem, MenuItem,
ListGroupItem, SideNav rows (same `href`/`active` + shell pattern).

---

## 5. Decision rule (use this for every new component)

```
Need a sub-element that has behavior / state / its own a11y?
  → YES: nest the tc-* element            (Strategy A)
  → NO, it's just markup or a utility fn?
        → extract/import an internal/ helper (Strategy B)
Is the primitive BOTH markup and an element (badge, chip, progress)?
  → extract *Html() helper; the element consumes it too; callers pick A or B
Re-implementing focus-trap / scroll-lock / slot-capture / open-close?
  → extend the existing base class (DialogBase / SlotWrapBase / LinkItemBase)
Copy-pasting esc / icon-resolve / format / initials / VARIANTS?
  → STOP. import from internal/ (Tier 0)
```

---

## 6. Prioritized roadmap

| Phase | Work | Files | Risk | Payoff |
|---|---|---|---|---|
| **P1** | `internal/esc.ts` + collapse the 4 internal copies; codemod 227 imports | ~231 | Very low | Huge LOC + one escape policy |
| **P1** | `internal/lucide.ts` icon-resolver | 84 | Low | Kills 2nd-biggest dup |
| **P2** | `internal/format.ts`, `image.ts`, `initials.ts`, `variants.ts` | ~60 | Low | Removes the remaining util sprawl |
| **P2** | Drawer/Lightbox/LootPopup/PauseMenu/CommandPalette → `extends DialogBase` | 5 | Medium (test focus/scroll) | ~400 lines, fewer a11y bugs |
| **P3** | `badgeHtml`/`chipHtml`/`trendHtml`/`pctOf` + route primitives through them | ~50 | Low–Med | Markup can't drift |
| **P3** | Charts → `tc-chart-container` + shared formatter | ~8 | Medium | Consistent chart chrome |
| **P4** | Buttons/avatars/status-dots → nest elements (A) in cards, dialogs, panels | ~40 | Med (visual QA) | Theming + behavior inheritance |

Codemod hint for P1: each local copy is a near-identical `function esc(` /
`const esc =` / `escapeAttr` / `escapeHtml` / `_escape` / `_escapeHtml`. Replace
body with `import { esc } from './internal/esc'` and delete the local def.

---

## 7. Guardrail (prevent regression)

Add to the new-component checklist in `styleguide.md` §7:

- [ ] No private `esc`/`escape*` — import `internal/esc`.
- [ ] No private lucide-name resolver — import `internal/lucide`.
- [ ] Badges, buttons, progress bars, avatars, status dots, chips: reuse the
      primitive (nest `tc-*`) or its `*Html()` helper — don't hand-roll the markup.
- [ ] Overlay behavior (focus-trap/scroll-lock/ESC/backdrop) → `extends DialogBase`.
- [ ] Slot-wrapping shell → `extends SlotWrapBase`; link rows → `LinkItemBase`.
- [ ] No redeclared `VARIANTS` — import the shared table.

---

## Appendix — per-family opportunity tables

Concrete component → primitive mappings with line numbers, grouped by family.
Strategy: **A** = nest `tc-*` element, **B** = shared `internal/` helper/base class.

### A. Card-like

| Component | line | Duplicated | Reuse | Strat |
|---|---|---|---|---|
| PlayerCard | 21, 166-172, 182-184 | esc; action btns; status pip | esc; tc-button; tc-status-dot/tc-avatar | B/A/A |
| EntityProfileCard | 3 | esc; initials | internal/esc; internal/initials | B |
| StatCard / MetricCard / MetricTile | 22-46 / 6-18 / 6-17 | esc + resolveIcon; trend; value badge | esc; lucide; tc-trend-indicator; tc-badge | B |
| FeatureCard / BasicCard / ListCard / AbilityCard / BriefCard | 9-24 | esc + resolveIcon | esc; lucide | B |
| PricingCard / GameShowcaseCard / GithubStarsCard / MaintainerCard / UserPanel | 13-35 | esc + lucideByName; badges | esc; lucide; tc-badge | B |
| StatusCard / ActivityCard | 31-80 | esc + status-icon resolve | esc; lucide; tc-status-dot | B/A |
| DifferenceCard | 12-33 | esc + direction-icon | esc; lucide; tc-trend-indicator | B/A |
| LinkedProvidersCard / DownloadStats / SlicesCard / SectionCard | 3-113 | esc; formatCompact | esc; internal/format | B |

### B. Game HUD / RPG

| Component | line | Duplicated | Reuse | Strat |
|---|---|---|---|---|
| BuffBar / SkillBar / BossBar / QuestTracker / HeroStatsBar / BattlePass / SkillTree | bars + 66-124 | esc; pct calc; track div | esc; pctOf; renderResourceBarTrack | B |
| Hotbar / InventoryGrid / EquipmentDoll / CraftingPanel / ItemSlot / CharacterSelect | 18-46 | esc; isImageSrc | esc; internal/image | B |
| TierLadder / PerkPicker / BattlePass / SkillTree / ItemCompare | 16-46 | lucideByName; trend icons | internal/lucide; tc-trend-indicator | B/A |
| LootList / LootPopup / ShopPanel / GuildPanel / PartyPanel / Leaderboard / ItemCompare / ItemTooltip | esc | esc | internal/esc | B |
| CooldownBadge | 13-21 | formatTime | internal/format | B |
| LootPopup | 16-161 | focus-trap/scroll-lock | extends DialogBase | B |

### C. Forms & inputs

| Component | line | Duplicated | Reuse | Strat |
|---|---|---|---|---|
| NumberInput | 8-14, 337-358 | esc; input-group markup | text-field-base/esc; tc-input-group | B/A |
| PhoneInput / DatePicker / TimePicker | 7-22, 401-500 | esc; label+invalid-feedback | esc; tc-helper-text/tc-label | B/A |
| OTPInput / TagInput / ColorPicker / IconPicker / EditableText / Slider | 5-19 | esc; label markup | esc; tc-label | B/A |
| Select / ExtendedSelect / Range | 8-200 | esc; label | esc; tc-label | B/A |
| CheckboxGroup / RadioGroup / FormInput | 159 / 233 / 534-581 | form-check wrappers; local esc | tc-check/tc-radio; internal/esc | A/B |

### D. Lists / tables / data

| Component | line | Duplicated | Reuse | Strat |
|---|---|---|---|---|
| DataList / Table / AdvancedTable / VerticalItemList / AssetRow | 6-51 | esc; slot-capture | esc; SlotWrapBase | B |
| StatRow / ListCard / Timeline / CommandReference / Roadmap / TreeView / FeatureMatrix / CompatibilityMatrix / SettingsCategoryList | 13-64 | esc + lucide resolve | esc; lucide | B |
| EntityCell / RankCell / CodeLabelCell / Changelog / FAQList / BadgeRow / Pipeline / SponsorWall | 3-22 | esc | internal/esc | B |
| ContributorWall | 3-16 | esc; deriveInitials | esc; tc-avatar/internal/initials | B/A |
| ControlsRebindList / SettingRowBase | 13-55 | esc (apostrophe variant) | internal/esc | B |

### E. Screens / overlays / menus

| Component | line | Duplicated | Reuse | Strat |
|---|---|---|---|---|
| Drawer | 13-272 | esc; getFocusable; open-state; scroll-lock; close btn | esc; extends DialogBase; tc-close-button | B/A |
| Lightbox / LootPopup / PauseMenu / CommandPalette | various | esc; focus-trap; scroll-lock; lucide | esc; extends DialogBase; internal/lucide | B |
| ConfirmDialog / ReportDialog | 19-160 | esc; btns; close btn | esc; tc-button; tc-close-button | B/A |
| Modal / Offcanvas | 91-119 | hardcoded close icon; escapeHtml | tc-close-button; internal/esc | A/B |
| Login / MainMenu / TitleScreen / LoadingScreen / CharacterSelect / Lobby / WelcomeGuide / Panel / UsageSummaryPanel | esc (+ lucide) | esc; lucide | internal/esc; internal/lucide | B |
| ContextMenu | 6-83 | esc; resolveIcon | esc; lucide | B |

### F. Badges / chips / status / charts

| Component | line | Duplicated | Reuse | Strat |
|---|---|---|---|---|
| Chip / Rating | 10-26 / 9-17 | esc; lucideByName | internal/esc; internal/lucide | B |
| BarChart / LineChart / AreaChart / PieChart / Sparkline / ChartContainer | 3-51 | esc; y-formatter; container chrome | esc; internal/format; tc-chart-container | B |
| StatusDot / PulseIndicator / TrendIndicator / Icon / Kbd | 3-141 | esc / `_escape` / `_escapeHtml` | internal/esc | B |
| CurrencyChip / RarityChip / CooldownBadge / Stamp / VersionLabel / PlatformIcon / CurrencyDisplay / PingDisplay / FileTags / BadgeRow / ChipGroup / Stepper | 3-23 | esc; format | internal/esc; internal/format | B |
| Spinner / Key / Stepper | 6-8 | VARIANTS/SIZES arrays | internal/variants | B |
