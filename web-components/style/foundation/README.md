# Foundation layer

Loads before every component partial, so components sit later in the cascade.

| Partial               | Holds                                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `_tokens.scss`        | Compile-time Sass: breakpoint/spacer maps, the palette, the theme-colour maps, and the **media mixins**. Emits no CSS.                |
| `_reset.scss`         | Element defaults wired to the runtime tokens, the `display` registry every `tc-*` tag needs, touch defaults.                          |
| `_grid.scss`          | The Bootstrap-compatible 12-column grid.                                                                                              |
| `_utilities.scss`     | The utility slice the components emit, plus the opt-in mobile utilities below.                                                        |
| `_mobile-tokens.scss` | The `--m-*` mobile scale (space, radii, control sizes, elevation geometry, motion) and the `--tc-safe-*` / `--tc-vh` hardware tokens. |

The runtime `--tc-*` token layer itself lives in `../themes/default/_foundation.scss`,
applied at `:root` so it is present with or without a `tc-theme` wrapper.

---

## Mobile foundation

### Safe areas

```css
--tc-safe-top    /* env(safe-area-inset-top, 0px) */
--tc-safe-right
--tc-safe-bottom
--tc-safe-left
```

**Components read these tokens, never `env()` directly.** That indirection is the
whole point: a host can lie about the insets. A design canvas that draws its own
status-bar mock, or a desktop frame previewing a phone, sets them to `0` and every
component inside complies. Reading `env()` inside a component takes that away.

Two things that bite:

1. **The insets stay `0` until the document opts in** with
   `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`.
   Without it the UA insets the viewport itself and `env()` has nothing left to
   report — so a bottom dock that looks correct in every desktop browser still puts
   its bottom 34px under the iOS home indicator, untappable, on a real phone. The
   meta tag is the app's job; the library cannot add it.
2. **`env()` is invalid inside a media query.** `@media (padding: env(…))` does not
   parse. "Is there a home indicator?" is not a question CSS can ask. Express it as
   arithmetic instead, never as a query.

Chrome that already has padding of its own should fold the inset into that value
rather than reaching for `.tc-safe-bottom`; a second `padding-bottom` declaration
wins over the first and drops it.

```scss
padding-bottom: calc(var(--m-pad-page) + var(--tc-safe-bottom, 0px));
```

**Do not put `--m-h-dock` on the left of that sum.** Its 78px is the space a design
screen _reserves_ for the dock, and the 73px the dock actually draws includes a 17px
row that mocks the home indicator — so
`calc(var(--m-h-dock) + var(--tc-safe-bottom))` stacks the mock on top of the real
inset and lands at 112px. A free-standing device dock is
`calc(56px + max(7px, var(--tc-safe-bottom)))` → 63px flat, 90px notched — but
_inside a `tc-mobile-shell` drop the inset from that sum_, because the shell already
pays `--tc-safe-bottom` on the host: the dock is a flat `63px` (56 + 7) there, and
keeping the `max()` lands at 124px of bottom chrome against the design's 78px.
`tc-tab-dock` already does all of this — it is only worth deriving by hand for
some other bottom-most chrome. The decomposition is spelled out beside the token in
`_mobile-tokens.scss`; measure it with the webfont **loaded**, or the label's line
box is 2px short and every figure above drops with it.

Three forms of the same four tokens, so pick one rather than adding a fourth:
`<tc-safe-area>` (element, all four sides, `extra` attribute for uniform extra
padding), `.tc-safe-top` / `.tc-safe-bottom` / `.tc-safe-x` (utilities, per side),
or the `calc()` above (fold the inset into padding you already own).

**Inside a `tc-mobile-shell` you need none of them.** The shell pays both insets
out of its own padding box, so slotted chrome keeps every `padding` declaration it
wrote and the dock's box genuinely _ends_ above the home indicator instead of
drawing 34px of space it still owns. A shell region that adds its own
`.tc-safe-bottom` double-counts. `--bs-mobile-shell-inset-top` /
`--bs-mobile-shell-inset-bottom` (and the `edge` attribute) are the override points.

### Viewport height — `dvh` vs `svh`

```css
--tc-vh: 100dvh; /* → 100vh under @supports not (height: 100dvh) */
--tc-vh-min: 100svh;
```

- **`--tc-vh` (dvh)** — the _currently_ visible height. Use it for the app shell.
  Sized this way, the shell follows the mobile-Safari toolbar in and out instead of
  jumping by the toolbar's height every time the scroll direction changes.
- **`--tc-vh-min` (svh)** — the _small_ extreme, toolbar showing. Use it for
  anything that must never be clipped: a sheet's `max-height`, a fullscreen
  overlay's content box. `dvh` can shrink below it mid-gesture.

`dvh` reflows during scroll as the toolbar collapses. That is the intended
behaviour for a shell, but anything animating at the same time will jitter —
animate `transform`, never `height`.

The `@supports` fallback cannot be replaced by a `var(--tc-vh, 100vh)` default.
Custom-property values are not validated at parse time, so `--tc-vh: 100dvh` is
stored verbatim even where `dvh` means nothing and the `var()` fallback never
fires; the failure surfaces at substitution instead, where `height: var(--tc-vh)`
becomes invalid-at-computed-value-time and resolves to `height: auto` — a shell
that silently collapses to its content instead of filling the screen.

That is also why **no component may hardcode `100dvh`**: it would opt out of the
fallback above. The twelve that predated these tokens were migrated
(`_login`, `_offcanvas`, `_modal`, `_drawer` ×2, `_dashboard-layout` ×3,
`_confirm-dialog`, `_report-dialog`, `_loot-popup`, `_pause-menu`) — `grep -rn
100dvh style/components/` should stay empty. The `max-height` sites among them are
arguably `--tc-vh-min` cases (a dialog must never be clipped mid-gesture); they
were migrated 1:1 to `--tc-vh` to keep behaviour identical, and switching them is a
deliberate follow-up, not a cleanup.

### Touch floors

```css
--tc-min-touch-target: 44px; /* iOS HIG; Android wants 48dp */
--tc-touch-target-dense: 40px;
```

Both live in `../themes/default/_foundation.scss` with the other ergonomics floors.

There is **no blanket `button { min-width: 44px }`** in the reset, and adding one
would be a mistake: the library renders plenty of micro-controls as buttons — chart
segments, hotbar slots, rating stars, colour swatches, calendar day cells — that a
global floor would visibly break on touch. The floor is opted into per control
(`.btn`, `.tc-icon-button`, `.page-link`, `.form-control`, `.form-select`) or via
`.tc-touch-target`.

The dense 40px tier is only defensible where the **row** is the primary target and
the control is one of several inside it. Never for a standalone action.

**When the floor and the design disagree, the floor is a token, not a constant.**
Every floor reads `var(--tc-min-touch-target, 44px)`, so a surface whose design
specifies a shorter box sets the token on its own subtree and makes the 44px hit
area up with padding on the wrapper instead of the control:

```scss
.m-search-band {
    --tc-min-touch-target: 40px; // design's 40px field (screens 1c, 1f)
    padding-block: 2px; // …with the missing 4px of hit area here
}
```

JADI.mk needs exactly this twice: the 40px search field (`1c`, `1f` —
`--m-h-control`) and the 42px sheet select (`1g`). Without the override those render
at 44px, which is a visible 2–4px deviation from the canvas. Do not reach for
`!important` or a taller-specificity copy of the floor.

### Text inputs must render at ≥ 16px

Below 16px, iOS Safari zooms the whole viewport when a text field takes focus and
does not zoom back out. A 13px _label_ is fine — it is the field's own text that
matters.

The reset's `input, select, textarea { font-size: max(16px, 1em) }` is 0-0-1, so it
reaches only controls that declare no font-size of their own. **Any control with a
class-level font-size needs the floor repeated in its own partial**, in a
coarse-pointer block placed after the base declaration so it wins on source order
too. Raising the reset's specificity does not work: the reset loads before every
component partial, so an equal-specificity copy still loses.

28 selectors in this library carry their own floor today; `_reset.scss` lists them by
name next to the element rule, and `grep -rn 'max(16px' style/components/` is the
live inventory. A new text control with a class-level size below 16px joins that
list — and **measure it on a live element**, because media queries add no
specificity, so "the rule exists" is not evidence "the rule wins".

**The same obligation lands on a theme.** A theme partial that re-declares a field's
`font-size` is scoped under `tc-theme[name='…']`, so it out-specifies the component's
own floor and has to restate it. `blueprint` was the only theme doing so
(`.tc-color-picker-hex`, `.tc-extended-select__search-input`,
`.tc-icon-picker-search`) and now does.

Write the floor as `max(16px, <the base size>)`, not a flat `16px`, so it can only
ever raise a size — a consumer scaling the root font-size keeps the larger field it
asked for, and a `-lg` tier already above 16px is not pulled down. Where the base
size is a `--bs-*` knob, read the knob rather than repeating its literal.

### Media mixins

From `_tokens.scss`, in scope in every partial that already does
`@use '../foundation/tokens' as *`.

```scss
@include up(md) { … }        // named breakpoint
@include up(430px) { … }     // or a raw length
@include coarse-pointer { … }
@include fine-pointer { … }  // (pointer: fine) and (hover: hover)
@include motion-ok { … }
@include reduced-motion { … }
```

`media-up($key)` is kept as the named-key alias the grid and the utility ladder
were written against; it forwards to `up()` so there is one implementation.

**There is deliberately no `down()` mixin.** Components here are authored at phone
width and widened with `up()`. A `down()` mixin is an invitation to write the
desktop layout first and shrink it, which is how a component ends up with its
mobile case as an afterthought. Apps retrofitting legacy desktop-first SCSS keep
their own.

`_reset.scss` already flattens every transition and animation under
`prefers-reduced-motion: reduce`, so `motion-ok` is not needed to protect those.
It is for the motion the reset cannot reach: `scroll-behavior`, a transform that
should be replaced by an instant state change rather than sped up, or a duration
token read by JS.

### Utilities

All opt-in, all `tc-`-prefixed, none `!important`.

| Class                                             | Effect                                                                                                                       |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `.tc-safe-top` · `.tc-safe-bottom` · `.tc-safe-x` | Padding of the matching hardware inset.                                                                                      |
| `.tc-safe-top-m` · `.tc-safe-bottom-m`            | The same as margin, for positioned chrome whose padding is spoken for.                                                       |
| `.tc-scroll-y`                                    | The one scrolling pane of a shell: `flex: 1; min-height: 0; overflow-y: auto` + momentum + `overscroll-behavior-y: contain`. |
| `.tc-scroll-x`                                    | Horizontal rail with the scrollbar hidden. Sets no `display` — the owner lays the rail out.                                  |
| `.tc-snap-x`                                      | `scroll-snap-type: x mandatory` with `scroll-snap-align: start` on children.                                                 |
| `.tc-no-tap-highlight`                            | Suppresses the iOS tap flash and long-press callout.                                                                         |
| `.tc-touch-target` / `--dense`                    | Grows the box to the 44px / 40px floor, content stays centred and its own size.                                              |
| `.tc-truncate-1` / `.tc-truncate-2`               | Single-line ellipsis / two-line clamp.                                                                                       |

`.tc-touch-target` computes `display: inline-grid`, not `grid`. `min-width` is a
floor and never a ceiling, so a block-level grid box still fills its container: on a
`<span>`/`<a>`/`<div>` the "44px" target measured the full 390px of the phone, and an
invisible full-width tap area beside another tab swallows its taps. `<button>` hid
that, because a form control's width is fit-content whatever `display` says. A caller
that genuinely wants a block-level target declares `display: grid` itself.

`.tc-truncate-1` and `.tc-text-truncate` (`style/components/_text.scss`, what
`tc-text variant="truncate"` renders) are the same rule; the tc-text one adds the
`display: block` it needs in order to work on an inline tag. Use the component class
inside a tc-text and the utility anywhere else — do not add a third.

`min-height: 0` in `.tc-scroll-y` is the load-bearing line. A flex child's
automatic minimum size is its content, so without it the pane refuses to shrink
below its list and pushes the dock off the bottom of the screen instead of
scrolling — the most common reason a `100dvh` shell still scrolls the document.

`tc-mobile-shell` restates those five declarations rather than applying this class,
in a `tc-mobile-shell > :not([slot])` rule. Not an oversight: the shell's pane is the
_consumer's_ element, and a class written onto it from JS is clobbered the next time
the framework re-renders that element's `className`. **The two must stay in step** —
`style/components/_mobile-shell.scss` says so at the rule.

`tc-page-tabs` does the same with `.tc-scroll-x`'s five declarations, for the same
reason plus one more: the rail's host is also its own tablist, so the tabs have to be
its direct children for the `tablist`→`tab` ARIA ownership and there is no inner
scroller to put the class on.

`tc-swipe-pager` is the third, and for now the last: its pages are the consumer's
direct children, so there is no inner track to carry the class and the host's own
`class` attribute belongs to whoever rendered it. It restates `.tc-scroll-x`'s five
declarations **and** `.tc-snap-x`'s pair. Those three are the **only** sanctioned
copies of either utility; a fourth means the utility is the wrong shape and should
change instead. All three say so at the rule — keep them in step with the utility,
which is the definition.

`.tc-snap-x`'s `mandatory` is right for a full-width pager (every rest position is
a page) and wrong for a chip rail, where it fights the user for a resting place
between two chips. Leave a chip rail free-scrolling. What the utility deliberately
does **not** carry is `scroll-snap-stop: always`, which `tc-swipe-pager` adds on its
own children: without it a fast flick carries through two or three snap points, which
is right for a rail and wrong for a pager whose caption says „swipe for the next
step". A rail must never stop at every chip.

A scroll container clips both axes (`overflow-x: auto` forces the used value of
`overflow-y` to `auto` too), so give a horizontal rail vertical padding — a child's
focus ring is otherwise cut off at the rail's edge. Where the design leaves no room
for that padding, the other way out is an **inset** ring on the rail's children
(`outline-offset: -2px`), which is what `tc-page-tabs` does: its 9px of bottom padding
is the distance from the label to the active underline, and the underline _is_ the
bar's bottom edge, so there is nowhere for an outset ring to be drawn.

`.tc-truncate-2` computes `display: flow-root`, not `-webkit-box`, wherever the
unprefixed `line-clamp` is supported — the engine un-blockifies the legacy display.
Do not assert on the computed `display` to check the clamp is active; measure
`scrollHeight` against `clientHeight`.

### Document-level touch defaults

Under `@media (pointer: coarse)` the reset sets `overscroll-behavior-y: none` on
`html, body`, killing document rubber-band: it peels fixed chrome away from the
hardware edge and, on Android, arms pull-to-refresh from inside a scrolling pane.
The shell's own pane opts back in with `contain` via `.tc-scroll-y`.

Scoped to coarse pointers because the same declaration on a desktop would also
kill macOS trackpad elastic scroll — right in an app shell, wrong in a content
site. **A consumer that wants pull-to-refresh back sets
`html, body { overscroll-behavior-y: auto }`.**

`touch-action: manipulation` is set on `:where(button, [role="button"], a, label,
summary)`, dropping the ~300ms "was that the first of a double-tap-to-zoom?" delay
before a tap dispatches. Listed selectors rather than `*`, because applied globally
it would also disable pinch-zoom inside scrollers, maps and image viewers.
