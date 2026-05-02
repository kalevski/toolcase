# Game UI Components

Reference list of UI components commonly used in game interfaces (menus, HUD, settings, credits, dialogs).

> Items already covered by `@toolcase/react-components` have been removed.

## Core / Primitives

- **Panel / Frame** — bordered container, nine-slice background

## Input Controls

- **ComboBox** — searchable dropdown
- **KeyBinder / HotkeyCapture** — capture key combo for rebinding
- **GamepadButtonPrompt** — show input glyph (A/B/X/Y, ◯△□✕)

## Navigation

- **MainMenu** — title screen root menu
- **PauseMenu** — in-game overlay menu
- **NavigationStack** — push/pop screens with back button
- **PageIndicator / Dots** — carousel position
- **BackButton / CloseButton** — standard nav controls

## Containers / Layout

- **Grid** — inventory grid, level select grid
- **List** — quest list, settings list
- **Stack (V/H)** — flex-style layout
- **Anchor / Aligned** — pin to edge/corner
- **SafeArea** — respect notch/edges (mobile/console)
- **AspectRatioBox** — fixed ratio container

## Dialogs / Overlays

- **ConfirmDialog** — yes/no/cancel
- **LoadingOverlay** — full-screen loader with tip text

## HUD / In-Game

- **HealthBar / ManaBar / StaminaBar** — resource bars (segmented, smooth, ghost-damage)
- **CircularProgress / RadialBar** — cooldown, charge
- **Minimap** — world overview, fog of war
- **CompassBar** — directional indicator (top-of-screen)
- **WaypointMarker** — world-space marker on HUD
- **DamageNumber / FloatingText** — combat numbers, crit popups
- **Crosshair / Reticle** — aiming
- **HitMarker** — confirm hit feedback
- **AmmoCounter** — bullets, mag/reserve
- **SkillBar / Hotbar / ActionBar** — abilities with cooldown overlays
- **BuffBar / DebuffBar** — status icons with timers
- **QuestTracker** — objectives list
- **ObjectiveMarker** — pinned waypoint
- **KillFeed** — recent kills/events log
- **ChatWindow** — text chat with channels
- **EmoteWheel** — radial emote picker
- **PingWheel / CommandWheel** — radial comms
- **Subtitle / CaptionBox** — dialogue/voice text
- **DialogueBox** — NPC speech with portrait, choices
- **Speedometer / Tachometer** — racing
- **CompassRose** — orientation
- **InteractPrompt** — "Press E to ..." contextual hint
- **ScoreDisplay** — points, multiplier
- **ComboCounter** — hit combo

## Menus / Screens

- **TitleScreen** — logo, press start
- **PressAnyKey** — entry prompt
- **CharacterSelect** — portrait grid + stats
- **CharacterCreate** — appearance/class customization
- **LevelSelect / WorldMap** — node-based progression
- **Lobby** — pre-game player list, ready state
- **MatchmakingScreen** — searching/found state
- **LoadingScreen** — progress, art, tip rotator
- **GameOverScreen** — results, retry/quit
- **VictoryScreen / WinScreen** — celebration, rewards
- **PauseScreen** — resume/restart/quit
- **SaveSlotList** — save/load slots with thumbnails
- **CreditsScroll** — auto-scrolling credits
- **CreditsList** — paginated credits
- **LegalScreen** — EULA, privacy, third-party licenses

## Settings

- **SettingsCategoryList** — Video / Audio / Controls / Gameplay / Accessibility
- **VolumeSlider** — master, music, SFX, voice
- **ResolutionSelect** — dropdown
- **GraphicsPresetPicker** — low/medium/high/ultra
- **QualitySetting** — per-feature dropdown
- **FullscreenToggle**
- **VSyncToggle**
- **FPSCapSelect**
- **BrightnessCalibration** — gamma/HDR test image
- **FOVSlider**
- **MouseSensitivity** — separate ADS/scope sliders
- **InvertAxisToggle**
- **ControlsRebindList** — action → key/button
- **ControllerLayoutPreview**
- **DeadzoneSlider**
- **AccessibilityPanel** — colorblind mode, subtitles size, screen shake toggle, hold-vs-toggle, aim assist
- **LanguageSelect**
- **ResetToDefaults** — confirm-required button

## Inventory / Items

- **InventoryGrid** — slot grid with drag/drop
- **ItemSlot** — icon, qty, rarity border
- **ItemTooltip** — name, rarity, stats, lore
- **ItemCompare** — side-by-side stats diff
- **EquipmentDoll / Paperdoll** — character silhouette w/ slots
- **CraftingPanel** — recipe inputs/output
- **LootList** — drops summary
- **ShopPanel / Store** — buy/sell tabs, currency
- **Currency Display** — coins/gems/premium with icon

## Progression / Meta

- **SkillTree / TalentTree** — node graph with branches
- **AbilityCard** — large ability detail card
- **PerkPicker**
- **AchievementList** — locked/unlocked, progress
- **StatsScreen** — career stats, charts
- **Codex / Bestiary** — entries grid + detail page
- **Journal / QuestLog** — quest list w/ description
- **Map / WorldMap** — pannable, zoomable, fast-travel pins
- **BattlePass / SeasonProgress** — tier track with rewards

## Social / Online

- **FriendsList** — online/offline, invite
- **PartyPanel** — party members, ready state
- **GuildPanel / ClanRoster**
- **PlayerCard** — profile popover
- **ReportPlayerDialog**
- **MuteList**
- **InviteToast**

## Feedback / Effects

- **ScreenFlash** — damage/heal pulse
- **VignetteOverlay** — low-health red edges
- **BlurOverlay** — pause blur
- **LetterboxBars** — cutscene framing
- **ShakeContainer** — UI element shake
- **ParticleEmitter (UI)** — sparkles on rewards
- **TransitionWipe / Fade** — scene transition

## Utility

- **NetworkStatusIcon** — ping/connection
- **PingDisplay** — ms readout
- **PlatformIcon** — PC/PS/Xbox/mobile glyph
- **VersionLabel** — build/version corner text
- **DebugOverlay** — FPS, draw calls, dev info
