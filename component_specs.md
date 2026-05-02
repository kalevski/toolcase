# Game Components Specs

Generated from `game-components/src/components/`. All components are Lit web components extending `GameElement` (custom event helper via `emit()`). Tags use `gc-*` prefix.

---

## ATOMIC COMPONENTS (Reusable Foundation)

### Layout Primitives

Component: Stack
Tag: gc-stack
Props: direction (vertical|horizontal), gap, align, justify, wrap (bool), inline (bool)
States: none explicit
Behaviors: none explicit
Accessibility: none explicit

Component: Grid
Tag: gc-grid
Props: columns, rows, gap, cellSize
States: none explicit
Behaviors: none explicit
Accessibility: none explicit

Component: Anchor
Tag: gc-anchor
Props: position (top-left|top|top-right|left|center|right|bottom-left|bottom|bottom-right), inset
States: none explicit
Behaviors: none explicit
Accessibility: none explicit

Component: SafeArea
Tag: gc-safe-area
Props: extra
States: none explicit
Behaviors: none explicit
Accessibility: none explicit

Component: AspectRatioBox
Tag: gc-aspect-ratio-box
Props: ratio
States: none explicit
Behaviors: none explicit
Accessibility: none explicit

### Containers

Component: Panel
Tag: gc-panel
Props: bordered (bool), corners (bool), parchment (bool), nineSlice, nineSliceFill, padding
States: parchment, bordered, nine-slice variants
Behaviors: none explicit
Accessibility: none explicit

Component: GildedFrame
Tag: gc-gilded-frame
Props: tone (dark|leather|transparent), padding
States: tone variants
Behaviors: none explicit
Accessibility: none explicit

Component: ArtboardBackdrop
Tag: gc-artboard-backdrop
Props: kind (dark|scene|parch), padding
States: none explicit
Behaviors: none explicit
Accessibility: none explicit

### Typography

Component: Title
Tag: gc-title
Props: size
States: none explicit
Behaviors: none explicit
Accessibility: none explicit

Component: Subtitle
Tag: gc-subtitle
Props: text, speaker, boxed (bool, reflect), align (left|right|center), fontSize, maxWidth
States: hidden when !text, optional speaker, boxed variant
Behaviors: none explicit
Accessibility: none explicit

Component: Eyebrow
Tag: gc-eyebrow
Props: none explicit (slot-based)
States: none explicit
Behaviors: none explicit
Accessibility: none explicit

Component: Key
Tag: gc-key
Props: none explicit (slot-based)
States: none explicit
Behaviors: none explicit
Accessibility: none explicit

Component: LoreText
Tag: gc-lore-text
Props: none explicit (slot-based)
States: none explicit
Behaviors: none explicit
Accessibility: none explicit

Component: ScrollText
Tag: gc-scroll-text
Props: scrollTitle
States: none explicit
Behaviors: none explicit
Accessibility: none explicit

Component: VersionLabel
Tag: gc-version-label
Props: version, build, branch
States: none explicit
Behaviors: none explicit
Accessibility: none explicit

### Visual Indicators & Badges

Component: IconBadge
Tag: gc-icon-badge
Props: glyph, size, color, bg
States: none explicit
Behaviors: none explicit
Accessibility: none explicit

Component: RarityChip
Tag: gc-rarity-chip
Props: rarity (ItemRarity)
States: rarity styling via r-{rarity} class
Behaviors: none explicit
Accessibility: none explicit

Component: CurrencyChip
Tag: gc-currency-chip
Props: glyph, amount, color
States: none explicit
Behaviors: none explicit
Accessibility: none explicit

Component: CurrencyDisplay
Tag: gc-currency-display
Props: amount, currencyIcon, label, color, fontSize
States: none explicit
Behaviors: none explicit
Accessibility: none explicit

Component: Portrait
Tag: gc-portrait
Props: glyph, size, ring, level (number|null), circle (bool)
States: circle vs square, level badge optional
Behaviors: none explicit
Accessibility: none explicit

Component: PlatformIcon
Tag: gc-platform-icon
Props: platform, size, label (bool)
States: platform-specific icon
Behaviors: none explicit
Accessibility: none explicit

Component: GamepadButtonPrompt
Tag: gc-gamepad-button-prompt
Props: glyph, label, size
States: button-type color coding
Behaviors: none explicit
Accessibility: none explicit

Component: CompassRose
Tag: gc-compass-rose
Props: heading, size
States: none explicit
Behaviors: none explicit
Accessibility: none explicit

Component: RuneCorner
Tag: gc-rune-corner
Props: at (tl|tr|bl|br), size
States: corner position variants
Behaviors: none explicit
Accessibility: none explicit

Component: PingDisplay
Tag: gc-ping-display
Props: ping (number|null)
States: color-coded (success <60, warning <200, danger otherwise)
Behaviors: none explicit
Accessibility: none explicit

Component: PageIndicator
Tag: gc-page-indicator
Props: count, index, size, gap, color, activeColor
States: active page highlighted
Behaviors: emit('select', {index})
Accessibility: aria-label per page button

### Simple Controls

Component: Toggle
Tag: gc-toggle
Props: on (bool, reflect), disabled (bool)
States: on, off, disabled
Behaviors: emit('change', {on}) on click or Space/Enter
Accessibility: role=switch, aria-checked, tabindex=0, keyboard Space/Enter

Component: Check
Tag: gc-check
Props: on (bool), disabled (bool)
States: on, off, disabled
Behaviors: emit('change', {on}) on click or Space/Enter
Accessibility: role=checkbox, aria-checked, tabindex=0, keyboard Space/Enter

Component: KeyBinder
Tag: gc-key-binder
Props: value, placeholder, disabled (bool)
States: capturing ("Press any key…") vs idle
Behaviors: emit('change', {value, code, key}) on capture; emit('cancel') on Escape; window keydown listener while capturing
Accessibility: none explicit

### Visual Effects

Component: VignetteOverlay
Tag: gc-vignette-overlay
Props: intensity (0-1), vignetteColor
States: none explicit
Behaviors: none explicit
Accessibility: none explicit

Component: BlurOverlay
Tag: gc-blur-overlay
Props: blurAmount, background
States: none explicit
Behaviors: none explicit
Accessibility: none explicit

Component: LetterboxBars
Tag: gc-letterbox-bars
Props: show (bool, reflect), barHeight, barColor, duration
States: shown/hidden with transition
Behaviors: none explicit
Accessibility: none explicit

Component: Divider
Tag: gc-divider
Props: noDiamond (bool)
States: none explicit
Behaviors: none explicit
Accessibility: none explicit

---

## SIMPLE COMPONENTS (Few properties, minimal state)

### Buttons & Navigation

Component: MetalButton
Tag: gc-metal-button
Props: variant (default|primary|danger|ghost), size (sm|md|lg), disabled (bool)
States: variant + size + disabled
Behaviors: emit('click') on click
Accessibility: none explicit

Component: NavButton
Tag: gc-nav-button
Props: kind (back|close), label, size
States: back vs close icon
Behaviors: emit('click')
Accessibility: aria-label

Component: MenuItem
Tag: gc-menu-item
Props: label, hotkey, icon, selected (bool, reflect), disabled (bool)
States: selected, disabled, caret indicator
Behaviors: emit('select', {label}) on click
Accessibility: none explicit

Component: ListRow
Tag: gc-list-row
Props: selected (bool, reflect), accent
States: selected/normal
Behaviors: emit('select') on click
Accessibility: none explicit

### Progress & Status

Component: CircularProgress
Tag: gc-circular-progress
Props: value, max, size, thickness, color, background, showText (bool), reverse (bool)
States: none explicit
Behaviors: none explicit
Accessibility: none explicit

Component: HitMarker
Tag: gc-hit-marker
Props: show (bool, reflect), crit (bool), kill (bool), size, duration
States: crit, kill, normal variants; auto-hide
Behaviors: emit('done') after duration via timer in updated()
Accessibility: none explicit

Component: DamageNumber
Tag: gc-damage-number
Props: value, crit (bool), heal (bool), miss (bool), duration
States: crit, heal, miss variants
Behaviors: emit('done') after duration timeout
Accessibility: none explicit

Component: NetworkStatusIcon
Tag: gc-network-status-icon
Props: ping (number|null), loss, connected (bool), size, showLabel (bool)
States: 4-bar indicator color-coded by quality, label optional
Behaviors: none explicit
Accessibility: none explicit

Component: ComboCounter
Tag: gc-combo-counter
Props: combo, label, timer, fontSize
States: hidden when combo<=1, timer bar visible when timer!==null
Behaviors: none explicit
Accessibility: none explicit

Component: ScoreDisplay
Tag: gc-score-display
Props: score, multiplier (number|null), label, align (left|right|center), fontSize
States: multiplier visible when !==1
Behaviors: none explicit
Accessibility: none explicit

### Simple Overlays & Effects

Component: ScreenFlash
Tag: gc-screen-flash
Props: flashColor, flashOpacity, duration, trigger
States: active/inactive
Behaviors: flash on `trigger` property change; emit('done') after duration via setTimeout
Accessibility: none explicit

Component: ShakeContainer
Tag: gc-shake-container
Props: trigger, intensity, duration
States: shaking/idle
Behaviors: rAF-driven randomized offset on `trigger` change
Accessibility: none explicit

Component: TransitionWipe
Tag: gc-transition-wipe
Props: show (bool, reflect), direction (fade|left|right|up|down|iris), duration, wipeColor
States: shown/hidden, direction variants
Behaviors: emit('complete') after duration
Accessibility: none explicit

Component: InteractPrompt
Tag: gc-interact-prompt
Props: show (bool), keyLabel, text, holdProgress (null|0-1)
States: hidden when !show, hold-fill bar when holdProgress!==null
Behaviors: none explicit
Accessibility: none explicit

---

## MODERATE COMPONENTS (Multiple features, state management)

### Resource Bars

Component: ResourceBarBase
Tag: (abstract — extended by gc-health-bar, gc-mana-bar, gc-stamina-bar)
Props: value (default 0), max (default 100), ghost (number|null), segments (default 1), showText (bool), label
States: ghost overlay rendered when ghost!==null && ghostPct>pct; segmented bar when segments>1
Behaviors: none explicit
Accessibility: none explicit

Component: HealthBar
Tag: gc-health-bar
Props: extends ResourceBarBase
States: extends ResourceBarBase
Behaviors: extends ResourceBarBase
Accessibility: none explicit

Component: ManaBar
Tag: gc-mana-bar
Props: extends ResourceBarBase
States: extends ResourceBarBase
Behaviors: extends ResourceBarBase
Accessibility: none explicit

Component: StaminaBar
Tag: gc-stamina-bar
Props: extends ResourceBarBase
States: extends ResourceBarBase
Behaviors: extends ResourceBarBase
Accessibility: none explicit

Component: AmmoCounter
Tag: gc-ammo-counter
Props: mag, magMax, reserve, weaponName, reloading (bool)
States: low ammo (<20% magMax), reloading
Behaviors: none explicit
Accessibility: none explicit

Component: BossBar
Tag: gc-boss-bar
Props: name, epithet, phase, hp, hpMax, phaseTicks[]
States: phase ticks rendered along bar
Behaviors: none explicit
Accessibility: none explicit

### Settings Controls

Component: SettingRowBase
Tag: (abstract — extended by FOVSlider, FPSCapSelect, DeadzoneSlider, ToggleRow, SelectRow, ResetToDefaults, GraphicsPresetPicker, VolumeSlider, MouseSensitivity, FullscreenToggle, InvertAxisToggle, VSyncToggle)
Props: rowLabel, description
States: depends on subclass
Behaviors: abstract `renderControl()` provided by subclasses
Accessibility: none explicit

Component: FOVSlider
Tag: gc-fov-slider
Props: value, min, max (extends SettingRowBase, rowLabel='Field of View')
States: none explicit
Behaviors: emit('change', {value})
Accessibility: none explicit

Component: DeadzoneSlider
Tag: gc-deadzone-slider
Props: value (extends SettingRowBase)
States: none explicit
Behaviors: emit('change', {value})
Accessibility: none explicit

Component: VolumeSlider
Tag: gc-volume-slider
Props: value, muted (bool) (extends SettingRowBase, rowLabel='Volume')
States: muted variant
Behaviors: emit('toggle-mute'); emit('change', {value})
Accessibility: none explicit

Component: MouseSensitivity
Tag: gc-mouse-sensitivity
Props: value, ads (number|null)
States: dual sliders when ads!==null
Behaviors: emit('change', {key, value}) — separate keys for main/ads
Accessibility: none explicit

Component: ToggleRow
Tag: gc-toggle-row
Props: checked (bool) (extends SettingRowBase)
States: none explicit
Behaviors: emit('change', {value}) on checkbox change
Accessibility: none explicit

Component: FullscreenToggle
Tag: gc-fullscreen-toggle
Props: extends ToggleRow (rowLabel='Fullscreen')
States: extends ToggleRow
Behaviors: extends ToggleRow
Accessibility: none explicit

Component: InvertAxisToggle
Tag: gc-invert-axis-toggle
Props: extends ToggleRow (rowLabel='Invert Y axis')
States: extends ToggleRow
Behaviors: extends ToggleRow
Accessibility: none explicit

Component: VSyncToggle
Tag: gc-vsync-toggle
Props: extends ToggleRow (rowLabel='V-Sync')
States: extends ToggleRow
Behaviors: extends ToggleRow
Accessibility: none explicit

Component: FPSCapSelect
Tag: gc-fps-cap-select
Props: value, options[] (extends SettingRowBase, rowLabel='FPS Cap')
States: none explicit
Behaviors: emit('change', {value})
Accessibility: none explicit

Component: SelectRow
Tag: gc-select-row
Props: value, options[] (SelectOption: {value, label}) (extends SettingRowBase)
States: none explicit
Behaviors: emit('change', {value})
Accessibility: none explicit

Component: GraphicsPresetPicker
Tag: gc-graphics-preset-picker
Props: value (extends SettingRowBase, rowLabel='Quality preset', default 'medium')
States: button toggle group
Behaviors: emit('change', {value})
Accessibility: none explicit

Component: ResetToDefaults
Tag: gc-reset-to-defaults
Props: extends SettingRowBase (rowLabel='Reset to defaults')
States: idle vs confirming
Behaviors: emit('reset') on confirm
Accessibility: none explicit

### Buff & Status Effects

Component: BuffIcon
Tag: gc-buff-icon
Props: glyph, time, kind (buff|debuff), color, size
States: buff/debuff variant
Behaviors: none explicit
Accessibility: none explicit

Component: BuffBar
Tag: gc-buff-bar
Props: buffs[] (BuffEntry: {id, icon?, name?, remaining?, duration?, stacks?, debuff?}), iconSize, gap
States: buff vs debuff variants, cooldown overlay, stack count
Behaviors: none explicit
Accessibility: none explicit

### Visualization

Component: Crosshair
Tag: gc-crosshair
Props: variant (cross|dot|circle|tShape|classic|rune), size, thickness, gap, color, spread
States: variant visuals, spread expansion
Behaviors: none explicit
Accessibility: none explicit

Component: Speedometer
Tag: gc-speedometer
Props: value, max, rpm (number|null), unit, gear, size
States: danger color when pct>=0.85
Behaviors: none explicit
Accessibility: none explicit

Component: BrightnessCalibration
Tag: gc-brightness-calibration
Props: value (number)
States: none explicit
Behaviors: emit('change', {value}) on input range
Accessibility: none explicit

Component: ParticleEmitter
Tag: gc-particle-emitter
Props: burst, count, colors[], particleSize, speed, lifetime, gravity, width, height
States: animating
Behaviors: trigger burst on `burst` property change; canvas rAF animation loop
Accessibility: none explicit

### Simple Dialog

Component: ConfirmDialog
Tag: gc-confirm-dialog
Props: open (bool, reflect), dialogTitle, eyebrow, message, confirmLabel, cancelLabel, danger (bool)
States: open/closed, danger variant on confirm button
Behaviors: emit('cancel') on Escape or cancel button; emit('confirm') on Enter or confirm button; window keydown listener on connected
Accessibility: role=dialog, aria-modal=true

Component: LoadingOverlay
Tag: gc-loading-overlay
Props: open (bool, reflect), progress (0-1|null), label, tip
States: open/closed, indeterminate vs determinate progress
Behaviors: none explicit
Accessibility: none explicit

### Debug Tools

Component: DebugOverlay
Tag: gc-debug-overlay
Props: fps, drawCalls, triangles, memMb, rows[]
States: FPS color-coded (good/warning/danger)
Behaviors: none explicit
Accessibility: none explicit

---

## COMPLEX COMPONENTS (Multiple features, complex state & interactions)

### Buttons & Navigation (Compound)

Component: PauseMenu
Tag: gc-pause-menu
Props: open (bool, reflect), items[] (MainMenuItem), menuTitle
States: open/closed
Behaviors: emit('resume'); emit('close'); emit('select', {id}); Escape key listener
Accessibility: none explicit

Component: TabBar
Tag: gc-tab-bar
Props: tabs[] (TabItem: {id, label, icon?}), activeId, size (sm|md)
States: active/inactive, size variants
Behaviors: emit('change', {id})
Accessibility: none explicit

### Lists & Selection

Component: MainMenu
Tag: gc-main-menu
Props: items[] (MainMenuItem: {id, label, disabled?, badge?}), selectedId, menuTitle, subtitle
States: selected, disabled, badge
Behaviors: emit('select', {id}); ArrowUp/ArrowDown/Enter keyboard nav; mouseenter highlights
Accessibility: keyboard navigation (no explicit role/aria)

Component: GcList
Tag: gc-list
Props: items[] (GcListItem: {id, label?, icon?, meta?, disabled?}), selectedId
States: selected, disabled
Behaviors: emit('select', {id})
Accessibility: none explicit

Component: SettingsCategoryList
Tag: gc-settings-category-list
Props: categories[] (SettingsCategory: {id, label, icon?}), selectedId
States: active category
Behaviors: emit('select', {id}); slotted content area
Accessibility: none explicit

Component: ComboBox
Tag: gc-combo-box
Props: options[] (ComboOption: {value, label, keywords?}), value, placeholder, disabled (bool)
States: open/closed dropdown, filtered by query
Behaviors: emit('change', {value}); Escape closes; outside mousedown closes
Accessibility: none explicit

### Input & Binding

Component: ControlsRebindList
Tag: gc-controls-rebind-list
Props: bindings[] (ControlBinding: {id, action, key?})
States: none explicit
Behaviors: emit('rebind', {id})
Accessibility: none explicit

### Inventory & Items

Component: ItemSlot
Tag: gc-item-slot
Props: item (InventoryItem|null), selected (bool), size, hotkey
States: selected, empty, rarity border, cooldown overlay, equipped/qty badges, locked
Behaviors: emit('click', {item}); cooldown via conic-gradient
Accessibility: none explicit

Component: ItemTooltip
Tag: gc-item-tooltip
Props: item (InventoryItem|null)
States: hidden when !item, rarity color/glow
Behaviors: none explicit
Accessibility: none explicit

Component: ItemCompare
Tag: gc-item-compare
Props: current (InventoryItem|null), candidate (InventoryItem|null)
States: none explicit
Behaviors: none explicit
Accessibility: none explicit

Component: Hotbar
Tag: gc-hotbar
Props: slots[] (HotbarSlot: {item?, hotkey?}), slotSize, selectedId
States: selected slot highlighted
Behaviors: emit('select', {item, index}); composes gc-item-slot
Accessibility: none explicit

Component: InventoryGrid
Tag: gc-inventory-grid
Props: items[] (InventoryItem|null), columns, slotSize, selectedId
States: selected slot highlighted, empty slots
Behaviors: emit('select', {item, index})
Accessibility: none explicit

Component: EquipmentDoll
Tag: gc-equipment-doll
Props: slots[] (EquipmentSlotConfig: {id, label?, item?, x, y}), silhouette, width, height, slotSize, selectedId
States: selected slot highlighted
Behaviors: emit('select', {id})
Accessibility: none explicit

### Ability & Skills

Component: AbilityCard
Tag: gc-ability-card
Props: abilityName, icon, description, cooldown, cost, range, keybind, rarity (common|uncommon|rare|epic|legendary)
States: rarity color variants
Behaviors: none explicit
Accessibility: none explicit

Component: SkillBar
Tag: gc-skill-bar
Props: slots[] (SkillSlot: {id, icon?, hotkey?, cooldown?, remaining?, charges?, disabled?, selected?}), slotSize, gap
States: cooldown overlay, selected, disabled, hotkey/charge badges
Behaviors: emit('activate', {id}); cooldown conic-gradient
Accessibility: none explicit

### Map & Navigation

Component: CompassBar
Tag: gc-compass-bar
Props: heading, fov, markers[] (CompassMarker: {id, heading, color?, label?, icon?}), width, height, showCardinals (bool)
States: cardinals optional, markers culled by FOV
Behaviors: none explicit
Accessibility: none explicit

Component: Minimap
Tag: gc-minimap
Props: worldX, worldY, worldWidth, worldHeight, markers[] (MinimapMarker: {id, x, y, color?, size?}), backgroundImage, size, rotation
States: none explicit
Behaviors: none explicit
Accessibility: none explicit

Component: ObjectiveMarker
Tag: gc-objective-marker
Props: x, y, label, distance, color, size, pulse (bool, reflect)
States: pulse animation when pulse=true
Behaviors: none explicit
Accessibility: none explicit

Component: WaypointMarker
Tag: gc-waypoint-marker
Props: x, y, label, distance, color, icon, size
States: none explicit
Behaviors: none explicit
Accessibility: none explicit

### Dialogs & Modals

Component: DialogueBox
Tag: gc-dialogue-box
Props: speaker, text, choices[] (DialogueChoice: {id, label, disabled?}), typingSpeed
States: typing animation, choices visible/hidden
Behaviors: emit('choice', {id}); emit('advance'); typing animation on text change; click skips/advances
Accessibility: none explicit

Component: ReportPlayerDialog
Tag: gc-report-player-dialog
Props: open (bool, reflect), playerName, reasons[] (default 5)
States: open/closed, radio-selected reason
Behaviors: emit('cancel'); emit('submit', {reason, comment})
Accessibility: none explicit

Component: InviteToast
Tag: gc-invite-toast
Props: open (bool, reflect), inviter, body, timeoutSeconds
States: open/closed, countdown
Behaviors: emit('accept'); emit('decline'); auto emit('decline') on timer expiry
Accessibility: none explicit

Component: LegalScreen
Tag: gc-legal-screen
Props: sections[] (LegalSection: {id, title, body}), initialSection, screenTitle, showAccept (bool)
States: active section selection
Behaviors: emit('close'); emit('accept')
Accessibility: none explicit

### Character Management

Component: CharacterCreate
Tag: gc-character-create
Props: fields[] (CharacterCreateField: {id, label, type?, options?, min?, max?}), values (Record<string, string|number>), name
States: none explicit
Behaviors: emit('name', {value}); emit('change', {id, value}); emit('confirm', {name, values})
Accessibility: none explicit

Component: CharacterSelect
Tag: gc-character-select
Props: characters[] (CharacterEntry: {id, name, role?, locked?, portrait?, description?, stats?}), selectedId
States: locked (disabled), selected (highlighted)
Behaviors: emit('select', {id}) on click; emit('confirm', {id}) on dblclick
Accessibility: none explicit

Component: PlayerCard
Tag: gc-player-card
Props: playerName, cardTitle, rank, level, stats[], actions[] ({id, label, danger?}), onlineStatus (PresenceStatus)
States: online status indicator, action danger variant
Behaviors: emit('action', {id})
Accessibility: none explicit

Component: PlayerFrame
Tag: gc-player-frame
Props: name, className, glyph, level, hp, hpMax, mp, mpMax, stamina, staminaMax, showMp (bool), showStamina (bool)
States: optional mana/stamina bars
Behaviors: none explicit
Accessibility: none explicit

### Game Screens

Component: TitleScreen
Tag: gc-title-screen
Props: titleText, subtitle
States: none explicit
Behaviors: none explicit
Accessibility: none explicit

Component: LoadingScreen
Tag: gc-loading-screen
Props: progress (0-1|null), label, eyebrow, titleText, tipTitle, tips[], tipInterval
States: tip carousel, indeterminate progress
Behaviors: setInterval cycles tips
Accessibility: none explicit

Component: PauseScreen
Tag: gc-pause-screen
Props: open (bool, reflect), screenTitle, items[] (default resume/restart/quit)
States: open/closed
Behaviors: emit('resume'); emit('restart'); emit('quit'); Escape key listener
Accessibility: none explicit

Component: ResultScreen
Tag: gc-result-screen
Props: titleText, subtitle, stats[] (ResultStat), rewards[] (ResultReward), actions[] (ResultAction), titleColor
States: none explicit
Behaviors: emit('action', {id})
Accessibility: none explicit

Component: GameOverScreen
Tag: gc-game-over-screen
Props: extends ResultScreen (titleColor=danger, titleText='Game Over')
States: extends ResultScreen
Behaviors: extends ResultScreen
Accessibility: none explicit

Component: VictoryScreen
Tag: gc-victory-screen
Props: extends ResultScreen (titleColor=gold, titleText='Victory!')
States: extends ResultScreen
Behaviors: extends ResultScreen
Accessibility: none explicit

Component: StatsScreen
Tag: gc-stats-screen
Props: sections[] (StatsSection: {title, stats[]}), screenTitle, summary
States: none explicit
Behaviors: none explicit
Accessibility: none explicit

Component: MatchmakingScreen
Tag: gc-matchmaking-screen
Props: state (searching|connecting|found|failed|idle), elapsed, estimated, region, mode, foundLabel
States: searching, connecting, found, failed, idle; spin animation
Behaviors: emit('accept'); emit('cancel')
Accessibility: none explicit

### Social & Communication

Component: ChatWindow
Tag: gc-chat-window
Props: messages[] (ChatMessage: {id, channel?, sender, body, color?, system?}), channels[] (ChatChannel: {id, label, color?}), activeChannel, placeholder, width, height
States: channel tabs, system messages styled distinct
Behaviors: emit('send', {channel, text}); emit('channel-change', {id}); auto-scroll to bottom in updated()
Accessibility: none explicit

Component: FriendsList
Tag: gc-friends-list
Props: friends[] (Friend: {id, name, status?, activity?, rank?}), listTitle
States: status colors (online/away/busy/offline/in-game), offline italicized
Behaviors: emit('invite', {id}); emit('message', {id}); auto-sort by status
Accessibility: none explicit

Component: MuteList
Tag: gc-mute-list
Props: players[] (MutedPlayer: {id, name, mutedAt?, reason?})
States: empty state, populated
Behaviors: emit('unmute', {id})
Accessibility: none explicit

Component: KillFeed
Tag: gc-kill-feed
Props: entries[] (KillFeedEntry: {id, killerName, victimName, killerColor?, victimColor?, weapon?, headshot?}), maxVisible
States: shows last N entries, headshot indicator
Behaviors: none explicit
Accessibility: none explicit

### Progression & Content

Component: LevelHeader
Tag: gc-level-header
Props: level, title, xp, xpMax, nextLabel
States: none explicit
Behaviors: none explicit
Accessibility: none explicit

Component: LevelSelect
Tag: gc-level-select
Props: nodes[] (LevelNode: {id, x, y, label?, icon?, locked?, completed?, stars?, bestStars?}), edges[] (LevelEdge: {from, to}), selectedId, width, height
States: locked, completed, normal; star ratings
Behaviors: emit('select', {id}) on click; emit('confirm', {id}) on dblclick; SVG-rendered map
Accessibility: none explicit

Component: SkillTree
Tag: gc-skill-tree
Props: nodes[] (SkillNode: {id, x, y, label?, icon?, locked?, unlocked?, rank?, maxRank?, description?}), edges[], selectedId, points (number|null), width, height
States: locked, unlocked, selected; SVG edges colored by unlock
Behaviors: emit('select', {id}); emit('unlock', {id}); click + dblclick handlers
Accessibility: none explicit

Component: Codex
Tag: gc-codex
Props: entries[] (CodexEntry: {id, name, icon?, discovered?, description?, stats?}), selectedId
States: undiscovered hidden/obscured, active selection
Behaviors: internal selection state, controllable via selectedId
Accessibility: none explicit

Component: Journal
Tag: gc-journal
Props: entries[] (JournalEntry: {id, title, description?, body?, objectives?, state?, rewards?}), selectedId
States: active/inactive entry, completed objective checkmarks
Behaviors: internal selection state
Accessibility: none explicit

Component: QuestTracker
Tag: gc-quest-tracker
Props: quests[] (QuestEntry: {id, name, objectives[]}), trackerTitle
States: completed/optional objectives, progress bars
Behaviors: none explicit
Accessibility: none explicit

Component: AchievementList
Tag: gc-achievement-list
Props: achievements[] (Achievement: {id, name, description?, icon?, unlocked?, progress?, target?, points?, secret?})
States: locked, unlocked, in-progress (with progress bar)
Behaviors: none explicit
Accessibility: none explicit

Component: BattlePass
Tag: gc-battle-pass
Props: tiers[] (BattlePassTier: {level, xpRequired, free?, premium?}), currentLevel, currentXp, seasonName, seasonEnd, hasPremium (bool)
States: tier locked/unlocked, reward claimed/unclaimed, premium track gated
Behaviors: emit('claim', {level, track})
Accessibility: none explicit

### Gameplay Panels

Component: CraftingPanel
Tag: gc-crafting-panel
Props: recipes[] (CraftingRecipe: {id, name, icon?, inputs, output}), selectedId, crafting (bool)
States: selected highlighted, crafting disables actions, input availability shown
Behaviors: emit('select', {id}); emit('craft', {id})
Accessibility: none explicit

Component: ShopPanel
Tag: gc-shop-panel
Props: items[] (ShopItem: {item, price, discount?, soldOut?}), sellMode (bool), currency (number|null), currencyIcon
States: buy vs sell mode, discount indicator, sold-out disabled
Behaviors: emit('buy', {id}) | emit('sell', {id})
Accessibility: none explicit

Component: LootList
Tag: gc-loot-list
Props: items[] ({item, qty?}), listTitle
States: none explicit
Behaviors: emit('take', {id}); emit('take-all')
Accessibility: none explicit

### Social Panels

Component: GuildPanel
Tag: gc-guild-panel
Props: guildName, tag, motto, members[] (GuildMember: {id, name, rank?, online?, contribution?}), level, memberCap
States: online/offline indicators
Behaviors: none explicit
Accessibility: none explicit

Component: PartyPanel
Tag: gc-party-panel
Props: members[] (PartyMember: {id, name, ready?, host?, role?}), capacity
States: ready/not-ready, empty slots with invite buttons
Behaviors: emit('leave'); emit('invite')
Accessibility: none explicit

Component: Lobby
Tag: gc-lobby
Props: players[] (LobbyPlayer: {id, name, ready?, host?, rank?}), capacity, lobbyMode, mapName, isReady (bool), canStart (bool)
States: ready/not-ready indicators, empty slots, host badge
Behaviors: emit('leave'); emit('ready'); emit('start')
Accessibility: none explicit

### UI Utilities & Specialized

Component: PerkPicker
Tag: gc-perk-picker
Props: perks[] (Perk: {id, name, description?, icon?, selected?, locked?}), columns
States: selected, locked, normal
Behaviors: emit('select', {id})
Accessibility: none explicit

Component: RadialWheel
Tag: gc-radial-wheel
Props: options[] (RadialOption: {id, icon?, label?, color?, disabled?}), open (bool, reflect), radius, optionSize, centerLabel
States: open/closed, hover with label, disabled options
Behaviors: emit('select', {id}); emit('close'); mouseenter/leave hover; Escape closes; backdrop click closes
Accessibility: none explicit

Component: SaveSlotList
Tag: gc-save-slot-list
Props: slots[] (SaveSlot: {id, name?, timestamp?, location?, level?, playtime?, empty?, autosave?}), selectedId, mode (load|save)
States: selected, empty, autosave; mode-dependent actions
Behaviors: emit('select', {id}); emit('save', {id}); emit('load', {id}); emit('delete', {id})
Accessibility: none explicit

Component: ControllerLayoutPreview
Tag: gc-controller-layout-preview
Props: layout (xbox|playstation|nintendo|generic)
States: layout variants
Behaviors: none explicit
Accessibility: none explicit

Component: CreditsList
Tag: gc-credits-list
Props: sections[] (CreditsSection: {role, names[]})
States: none explicit
Behaviors: none explicit
Accessibility: none explicit

Component: CreditsScroll
Tag: gc-credits-scroll
Props: sections[], speed, scrollTitle
States: playing/paused
Behaviors: requestAnimationFrame auto-scroll; emit('complete') at end; click toggles pause
Accessibility: none explicit

Component: PressAnyKey
Tag: gc-press-any-key
Props: text
States: none explicit
Behaviors: emit('continue') on keydown or mousedown
Accessibility: none explicit

Component: StatRow
Tag: gc-stat-row
Props: label, value (string|number), accent, trend (number|null)
States: trend up/down with color + glyph
Behaviors: none explicit
Accessibility: none explicit

Component: PanelHeader
Tag: gc-panel-header
Props: eyebrow, headerTitle, titleSize
States: none explicit
Behaviors: none explicit
Accessibility: none explicit
