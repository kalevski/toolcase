import { AbilityCard } from './AbilityCard'
import { AchievementList } from './AchievementList'
import { AmmoCounter } from './AmmoCounter'
import { Anchor } from './Anchor'
import { ArtboardBackdrop } from './ArtboardBackdrop'
import { AspectRatioBox } from './AspectRatioBox'
import { BattlePass } from './BattlePass'
import { BlurOverlay } from './BlurOverlay'
import { BossBar } from './BossBar'
import { BrightnessCalibration } from './BrightnessCalibration'
import { BuffBar } from './BuffBar'
import { BuffIcon } from './BuffIcon'
import { CharacterCreate } from './CharacterCreate'
import { CharacterSelect } from './CharacterSelect'
import { ChatWindow } from './ChatWindow'
import { Check } from './Check'
import { CircularProgress } from './CircularProgress'
import { Codex } from './Codex'
import { ComboBox } from './ComboBox'
import { ComboCounter } from './ComboCounter'
import { CompassBar } from './CompassBar'
import { CompassRose } from './CompassRose'
import { ConfirmDialog } from './ConfirmDialog'
import { ControllerLayoutPreview } from './ControllerLayoutPreview'
import { ControlsRebindList } from './ControlsRebindList'
import { CraftingPanel } from './CraftingPanel'
import { CreditsList } from './CreditsList'
import { CreditsScroll } from './CreditsScroll'
import { Crosshair } from './Crosshair'
import { CurrencyChip } from './CurrencyChip'
import { CurrencyDisplay } from './CurrencyDisplay'
import { DamageNumber } from './DamageNumber'
import { DeadzoneSlider } from './DeadzoneSlider'
import { DebugOverlay } from './DebugOverlay'
import { DialogueBox } from './DialogueBox'
import { Divider } from './Divider'
import { EquipmentDoll } from './EquipmentDoll'
import { Eyebrow } from './Eyebrow'
import { FOVSlider } from './FOVSlider'
import { FPSCapSelect } from './FPSCapSelect'
import { FriendsList } from './FriendsList'
import { FullscreenToggle } from './FullscreenToggle'
import { GameOverScreen } from './GameOverScreen'
import { GamepadButtonPrompt } from './GamepadButtonPrompt'
import { GcList } from './GcList'
import { GildedFrame } from './GildedFrame'
import { GraphicsPresetPicker } from './GraphicsPresetPicker'
import { Grid } from './Grid'
import { GuildPanel } from './GuildPanel'
import { HealthBar } from './HealthBar'
import { HitMarker } from './HitMarker'
import { Hotbar } from './Hotbar'
import { IconBadge } from './IconBadge'
import { InteractPrompt } from './InteractPrompt'
import { InventoryGrid } from './InventoryGrid'
import { InvertAxisToggle } from './InvertAxisToggle'
import { InviteToast } from './InviteToast'
import { ItemCompare } from './ItemCompare'
import { ItemSlot } from './ItemSlot'
import { ItemTooltip } from './ItemTooltip'
import { Journal } from './Journal'
import { KeyBinder } from './KeyBinder'
import { Key } from './Key'
import { KillFeed } from './KillFeed'
import { LegalScreen } from './LegalScreen'
import { LetterboxBars } from './LetterboxBars'
import { LevelHeader } from './LevelHeader'
import { LevelSelect } from './LevelSelect'
import { ListRow } from './ListRow'
import { LoadingOverlay } from './LoadingOverlay'
import { LoadingScreen } from './LoadingScreen'
import { Lobby } from './Lobby'
import { LootList } from './LootList'
import { LoreText } from './LoreText'
import { MainMenu } from './MainMenu'
import { ManaBar } from './ManaBar'
import { MatchmakingScreen } from './MatchmakingScreen'
import { MenuItem } from './MenuItem'
import { MetalButton } from './MetalButton'
import { Minimap } from './Minimap'
import { MouseSensitivity } from './MouseSensitivity'
import { MuteList } from './MuteList'
import { NavButton } from './NavButton'
import { NetworkStatusIcon } from './NetworkStatusIcon'
import { ObjectiveMarker } from './ObjectiveMarker'
import { PageIndicator } from './PageIndicator'
import { PanelHeader } from './PanelHeader'
import { Panel } from './Panel'
import { ParticleEmitter } from './ParticleEmitter'
import { PartyPanel } from './PartyPanel'
import { PauseMenu } from './PauseMenu'
import { PauseScreen } from './PauseScreen'
import { PerkPicker } from './PerkPicker'
import { PingDisplay } from './PingDisplay'
import { PlatformIcon } from './PlatformIcon'
import { PlayerCard } from './PlayerCard'
import { PlayerFrame } from './PlayerFrame'
import { Portrait } from './Portrait'
import { PressAnyKey } from './PressAnyKey'
import { QuestTracker } from './QuestTracker'
import { RadialWheel } from './RadialWheel'
import { RarityChip } from './RarityChip'
import { ReportPlayerDialog } from './ReportPlayerDialog'
import { ResetToDefaults } from './ResetToDefaults'
import { ResultScreen } from './ResultScreen'
import { RuneCorner } from './RuneCorner'
import { SafeArea } from './SafeArea'
import { SaveSlotList } from './SaveSlotList'
import { ScoreDisplay } from './ScoreDisplay'
import { ScreenFlash } from './ScreenFlash'
import { ScrollText } from './ScrollText'
import { SelectRow } from './SelectRow'
import { SettingsCategoryList } from './SettingsCategoryList'
import { ShakeContainer } from './ShakeContainer'
import { ShopPanel } from './ShopPanel'
import { SkillBar } from './SkillBar'
import { SkillTree } from './SkillTree'
import { Speedometer } from './Speedometer'
import { Stack } from './Stack'
import { StaminaBar } from './StaminaBar'
import { StatRow } from './StatRow'
import { StatsScreen } from './StatsScreen'
import { Subtitle } from './Subtitle'
import { TabBar } from './TabBar'
import { TitleScreen } from './TitleScreen'
import { Title } from './Title'
import { ToggleRow } from './ToggleRow'
import { Toggle } from './Toggle'
import { TransitionWipe } from './TransitionWipe'
import { VSyncToggle } from './VSyncToggle'
import { VersionLabel } from './VersionLabel'
import { VictoryScreen } from './VictoryScreen'
import { VignetteOverlay } from './VignetteOverlay'
import { VolumeSlider } from './VolumeSlider'
import { WaypointMarker } from './WaypointMarker'

export function register(): void {
    customElements.define('gc-ability-card', AbilityCard)
    customElements.define('gc-achievement-list', AchievementList)
    customElements.define('gc-ammo-counter', AmmoCounter)
    customElements.define('gc-anchor', Anchor)
    customElements.define('gc-artboard-backdrop', ArtboardBackdrop)
    customElements.define('gc-aspect-ratio-box', AspectRatioBox)
    customElements.define('gc-battle-pass', BattlePass)
    customElements.define('gc-blur-overlay', BlurOverlay)
    customElements.define('gc-boss-bar', BossBar)
    customElements.define('gc-brightness-calibration', BrightnessCalibration)
    customElements.define('gc-buff-bar', BuffBar)
    customElements.define('gc-buff-icon', BuffIcon)
    customElements.define('gc-character-create', CharacterCreate)
    customElements.define('gc-character-select', CharacterSelect)
    customElements.define('gc-chat-window', ChatWindow)
    customElements.define('gc-check', Check)
    customElements.define('gc-circular-progress', CircularProgress)
    customElements.define('gc-codex', Codex)
    customElements.define('gc-combo-box', ComboBox)
    customElements.define('gc-combo-counter', ComboCounter)
    customElements.define('gc-compass-bar', CompassBar)
    customElements.define('gc-compass-rose', CompassRose)
    customElements.define('gc-confirm-dialog', ConfirmDialog)
    customElements.define('gc-controller-layout-preview', ControllerLayoutPreview)
    customElements.define('gc-controls-rebind-list', ControlsRebindList)
    customElements.define('gc-crafting-panel', CraftingPanel)
    customElements.define('gc-credits-list', CreditsList)
    customElements.define('gc-credits-scroll', CreditsScroll)
    customElements.define('gc-crosshair', Crosshair)
    customElements.define('gc-currency-chip', CurrencyChip)
    customElements.define('gc-currency-display', CurrencyDisplay)
    customElements.define('gc-damage-number', DamageNumber)
    customElements.define('gc-deadzone-slider', DeadzoneSlider)
    customElements.define('gc-debug-overlay', DebugOverlay)
    customElements.define('gc-dialogue-box', DialogueBox)
    customElements.define('gc-divider', Divider)
    customElements.define('gc-equipment-doll', EquipmentDoll)
    customElements.define('gc-eyebrow', Eyebrow)
    customElements.define('gc-fov-slider', FOVSlider)
    customElements.define('gc-fps-cap-select', FPSCapSelect)
    customElements.define('gc-friends-list', FriendsList)
    customElements.define('gc-fullscreen-toggle', FullscreenToggle)
    customElements.define('gc-game-over-screen', GameOverScreen)
    customElements.define('gc-gamepad-button-prompt', GamepadButtonPrompt)
    customElements.define('gc-list', GcList)
    customElements.define('gc-gilded-frame', GildedFrame)
    customElements.define('gc-graphics-preset-picker', GraphicsPresetPicker)
    customElements.define('gc-grid', Grid)
    customElements.define('gc-guild-panel', GuildPanel)
    customElements.define('gc-health-bar', HealthBar)
    customElements.define('gc-hit-marker', HitMarker)
    customElements.define('gc-hotbar', Hotbar)
    customElements.define('gc-icon-badge', IconBadge)
    customElements.define('gc-interact-prompt', InteractPrompt)
    customElements.define('gc-inventory-grid', InventoryGrid)
    customElements.define('gc-invert-axis-toggle', InvertAxisToggle)
    customElements.define('gc-invite-toast', InviteToast)
    customElements.define('gc-item-compare', ItemCompare)
    customElements.define('gc-item-slot', ItemSlot)
    customElements.define('gc-item-tooltip', ItemTooltip)
    customElements.define('gc-journal', Journal)
    customElements.define('gc-key-binder', KeyBinder)
    customElements.define('gc-key', Key)
    customElements.define('gc-kill-feed', KillFeed)
    customElements.define('gc-legal-screen', LegalScreen)
    customElements.define('gc-letterbox-bars', LetterboxBars)
    customElements.define('gc-level-header', LevelHeader)
    customElements.define('gc-level-select', LevelSelect)
    customElements.define('gc-list-row', ListRow)
    customElements.define('gc-loading-overlay', LoadingOverlay)
    customElements.define('gc-loading-screen', LoadingScreen)
    customElements.define('gc-lobby', Lobby)
    customElements.define('gc-loot-list', LootList)
    customElements.define('gc-lore-text', LoreText)
    customElements.define('gc-main-menu', MainMenu)
    customElements.define('gc-mana-bar', ManaBar)
    customElements.define('gc-matchmaking-screen', MatchmakingScreen)
    customElements.define('gc-menu-item', MenuItem)
    customElements.define('gc-metal-button', MetalButton)
    customElements.define('gc-minimap', Minimap)
    customElements.define('gc-mouse-sensitivity', MouseSensitivity)
    customElements.define('gc-mute-list', MuteList)
    customElements.define('gc-nav-button', NavButton)
    customElements.define('gc-network-status-icon', NetworkStatusIcon)
    customElements.define('gc-objective-marker', ObjectiveMarker)
    customElements.define('gc-page-indicator', PageIndicator)
    customElements.define('gc-panel-header', PanelHeader)
    customElements.define('gc-panel', Panel)
    customElements.define('gc-particle-emitter', ParticleEmitter)
    customElements.define('gc-party-panel', PartyPanel)
    customElements.define('gc-pause-menu', PauseMenu)
    customElements.define('gc-pause-screen', PauseScreen)
    customElements.define('gc-perk-picker', PerkPicker)
    customElements.define('gc-ping-display', PingDisplay)
    customElements.define('gc-platform-icon', PlatformIcon)
    customElements.define('gc-player-card', PlayerCard)
    customElements.define('gc-player-frame', PlayerFrame)
    customElements.define('gc-portrait', Portrait)
    customElements.define('gc-press-any-key', PressAnyKey)
    customElements.define('gc-quest-tracker', QuestTracker)
    customElements.define('gc-radial-wheel', RadialWheel)
    customElements.define('gc-rarity-chip', RarityChip)
    customElements.define('gc-report-player-dialog', ReportPlayerDialog)
    customElements.define('gc-reset-to-defaults', ResetToDefaults)
    customElements.define('gc-result-screen', ResultScreen)
    customElements.define('gc-rune-corner', RuneCorner)
    customElements.define('gc-safe-area', SafeArea)
    customElements.define('gc-save-slot-list', SaveSlotList)
    customElements.define('gc-score-display', ScoreDisplay)
    customElements.define('gc-screen-flash', ScreenFlash)
    customElements.define('gc-scroll-text', ScrollText)
    customElements.define('gc-select-row', SelectRow)
    customElements.define('gc-settings-category-list', SettingsCategoryList)
    customElements.define('gc-shake-container', ShakeContainer)
    customElements.define('gc-shop-panel', ShopPanel)
    customElements.define('gc-skill-bar', SkillBar)
    customElements.define('gc-skill-tree', SkillTree)
    customElements.define('gc-speedometer', Speedometer)
    customElements.define('gc-stack', Stack)
    customElements.define('gc-stamina-bar', StaminaBar)
    customElements.define('gc-stat-row', StatRow)
    customElements.define('gc-stats-screen', StatsScreen)
    customElements.define('gc-subtitle', Subtitle)
    customElements.define('gc-tab-bar', TabBar)
    customElements.define('gc-title-screen', TitleScreen)
    customElements.define('gc-title', Title)
    customElements.define('gc-toggle-row', ToggleRow)
    customElements.define('gc-toggle', Toggle)
    customElements.define('gc-transition-wipe', TransitionWipe)
    customElements.define('gc-vsync-toggle', VSyncToggle)
    customElements.define('gc-version-label', VersionLabel)
    customElements.define('gc-victory-screen', VictoryScreen)
    customElements.define('gc-vignette-overlay', VignetteOverlay)
    customElements.define('gc-volume-slider', VolumeSlider)
    customElements.define('gc-waypoint-marker', WaypointMarker)
}
