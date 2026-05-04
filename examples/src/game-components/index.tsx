import { JSX } from 'react'
import StackDemo from './StackDemo'
import GridDemo from './GridDemo'
import AnchorDemo from './AnchorDemo'
import PanelDemo from './PanelDemo'
import GildedFrameDemo from './GildedFrameDemo'
import ArtboardBackdropDemo from './ArtboardBackdropDemo'
import TitleDemo from './TitleDemo'
import SubtitleDemo from './SubtitleDemo'
import EyebrowDemo from './EyebrowDemo'
import KeyDemo from './KeyDemo'
import LoreTextDemo from './LoreTextDemo'
import ScrollTextDemo from './ScrollTextDemo'
import VersionLabelDemo from './VersionLabelDemo'
import IconBadgeDemo from './IconBadgeDemo'
import RarityChipDemo from './RarityChipDemo'
import CurrencyChipDemo from './CurrencyChipDemo'
import CurrencyDisplayDemo from './CurrencyDisplayDemo'
import PortraitDemo from './PortraitDemo'
import PlatformIconDemo from './PlatformIconDemo'
import GamepadButtonPromptDemo from './GamepadButtonPromptDemo'
import CompassRoseDemo from './CompassRoseDemo'
import RuneCornerDemo from './RuneCornerDemo'
import PingDisplayDemo from './PingDisplayDemo'
import PageIndicatorDemo from './PageIndicatorDemo'
import MetalButtonDemo from './MetalButtonDemo'
import NavButtonDemo from './NavButtonDemo'
import MenuItemDemo from './MenuItemDemo'
import ListRowDemo from './ListRowDemo'
import CircularProgressDemo from './CircularProgressDemo'
import CooldownBadgeDemo from './CooldownBadgeDemo'
import HitMarkerDemo from './HitMarkerDemo'
import DamageNumberDemo from './DamageNumberDemo'
import NetworkStatusIconDemo from './NetworkStatusIconDemo'
import ComboCounterDemo from './ComboCounterDemo'
import ScoreDisplayDemo from './ScoreDisplayDemo'
import ScreenFlashDemo from './ScreenFlashDemo'
import ShakeContainerDemo from './ShakeContainerDemo'
import TransitionWipeDemo from './TransitionWipeDemo'
import InteractPromptDemo from './InteractPromptDemo'
import ResourceBarsDemo from './ResourceBarsDemo'
import AmmoCounterDemo from './AmmoCounterDemo'
import BossBarDemo from './BossBarDemo'
import SettingRowsDemo from './SettingRowsDemo'
import BuffsDemo from './BuffsDemo'
import VisualizationDemo from './VisualizationDemo'
import SafeAreaDemo from './SafeAreaDemo'
import AspectRatioBoxDemo from './AspectRatioBoxDemo'
import TabBarDemo from './TabBarDemo'
import MainMenuDemo from './MainMenuDemo'
import GcListDemo from './GcListDemo'
import SettingsCategoryListDemo from './SettingsCategoryListDemo'
import PauseMenuDemo from './PauseMenuDemo'
import ComboBoxDemo from './ComboBoxDemo'
import DialogueBoxDemo from './DialogueBoxDemo'
import ReportPlayerDialogDemo from './ReportPlayerDialogDemo'
import InviteToastDemo from './InviteToastDemo'
import LegalScreenDemo from './LegalScreenDemo'
import CharacterCreateDemo from './CharacterCreateDemo'
import CharacterSelectDemo from './CharacterSelectDemo'
import PlayerCardDemo from './PlayerCardDemo'
import PlayerFrameDemo from './PlayerFrameDemo'
import TitleScreenDemo from './TitleScreenDemo'
import LoadingScreenDemo from './LoadingScreenDemo'
import PauseScreenDemo from './PauseScreenDemo'
import ResultScreenDemo from './ResultScreenDemo'
import StatsScreenDemo from './StatsScreenDemo'
import MatchmakingScreenDemo from './MatchmakingScreenDemo'
import ToggleDemo from './ToggleDemo'
import CheckDemo from './CheckDemo'
import KeyBinderDemo from './KeyBinderDemo'
import VignetteOverlayDemo from './VignetteOverlayDemo'
import BlurOverlayDemo from './BlurOverlayDemo'
import LetterboxBarsDemo from './LetterboxBarsDemo'
import DividerDemo from './DividerDemo'
import ConfirmDialogDemo from './ConfirmDialogDemo'
import LoadingOverlayDemo from './LoadingOverlayDemo'
import DebugOverlayDemo from './DebugOverlayDemo'
import ControlsRebindListDemo from './ControlsRebindListDemo'
import ItemSlotDemo from './ItemSlotDemo'
import ItemTooltipDemo from './ItemTooltipDemo'
import ItemCompareDemo from './ItemCompareDemo'
import HotbarDemo from './HotbarDemo'
import InventoryGridDemo from './InventoryGridDemo'
import EquipmentDollDemo from './EquipmentDollDemo'
import AbilityCardDemo from './AbilityCardDemo'
import SkillBarDemo from './SkillBarDemo'
import CompassBarDemo from './CompassBarDemo'
import MinimapDemo from './MinimapDemo'
import ObjectiveMarkerDemo from './ObjectiveMarkerDemo'
import WaypointMarkerDemo from './WaypointMarkerDemo'
import ChatWindowDemo from './ChatWindowDemo'
import FriendsListDemo from './FriendsListDemo'
import MuteListDemo from './MuteListDemo'
import KillFeedDemo from './KillFeedDemo'
import LevelHeaderDemo from './LevelHeaderDemo'
import LevelSelectDemo from './LevelSelectDemo'
import SkillTreeDemo from './SkillTreeDemo'
import CodexDemo from './CodexDemo'
import JournalDemo from './JournalDemo'
import QuestTrackerDemo from './QuestTrackerDemo'
import AchievementListDemo from './AchievementListDemo'
import BattlePassDemo from './BattlePassDemo'
import CraftingPanelDemo from './CraftingPanelDemo'
import ShopPanelDemo from './ShopPanelDemo'
import LootListDemo from './LootListDemo'
import LootPopupDemo from './LootPopupDemo'
import GuildPanelDemo from './GuildPanelDemo'
import PartyPanelDemo from './PartyPanelDemo'
import LobbyDemo from './LobbyDemo'
import PerkPickerDemo from './PerkPickerDemo'
import RadialWheelDemo from './RadialWheelDemo'
import SaveSlotListDemo from './SaveSlotListDemo'
import ControllerLayoutPreviewDemo from './ControllerLayoutPreviewDemo'
import CreditsListDemo from './CreditsListDemo'
import CreditsScrollDemo from './CreditsScrollDemo'
import PressAnyKeyDemo from './PressAnyKeyDemo'
import StatRowDemo from './StatRowDemo'
import PanelHeaderDemo from './PanelHeaderDemo'

export type GameComponentCategory = 'Basic Components' | 'Layout Primitives' | 'Surfaces' | 'Typography' | 'Visual Indicators & Badges' | 'Buttons & Navigation' | 'Lists & Selection' | 'Dialogs & Modals' | 'Progress & Status' | 'Overlays & Effects' | 'Resource Bars' | 'Settings' | 'Visualization' | 'Character Management' | 'Game Screens' | 'Inventory & Items' | 'Ability & Skills' | 'Input & Binding' | 'Map & Navigation' | 'Social & Communication' | 'Progression & Content' | 'Gameplay Panels' | 'Social Panels' | 'UI Utilities & Specialized'

export type GameComponentDef = {
	key: string
	category: GameComponentCategory
	element: JSX.Element
}

export const categories: GameComponentCategory[] = [
	'Basic Components',
	'Layout Primitives',
	'Surfaces',
	'Typography',
	'Visual Indicators & Badges',
	'Buttons & Navigation',
	'Lists & Selection',
	'Dialogs & Modals',
	'Progress & Status',
	'Overlays & Effects',
	'Resource Bars',
	'Settings',
	'Visualization',
	'Character Management',
	'Game Screens',
	'Input & Binding',
	'Inventory & Items',
	'Ability & Skills',
	'Map & Navigation',
	'Social & Communication',
	'Progression & Content',
	'Gameplay Panels',
	'Social Panels',
	'UI Utilities & Specialized',
]

export const gameComponentExamples: GameComponentDef[] = [
	{ key: 'stack', category: 'Layout Primitives', element: <StackDemo /> },
	{ key: 'grid', category: 'Layout Primitives', element: <GridDemo /> },
	{ key: 'anchor', category: 'Layout Primitives', element: <AnchorDemo /> },
	{ key: 'panel', category: 'Surfaces', element: <PanelDemo /> },
	{ key: 'gilded-frame', category: 'Surfaces', element: <GildedFrameDemo /> },
	{ key: 'artboard-backdrop', category: 'Surfaces', element: <ArtboardBackdropDemo /> },
	{ key: 'title', category: 'Typography', element: <TitleDemo /> },
	{ key: 'subtitle', category: 'Typography', element: <SubtitleDemo /> },
	{ key: 'eyebrow', category: 'Typography', element: <EyebrowDemo /> },
	{ key: 'key', category: 'Typography', element: <KeyDemo /> },
	{ key: 'lore-text', category: 'Typography', element: <LoreTextDemo /> },
	{ key: 'scroll-text', category: 'Typography', element: <ScrollTextDemo /> },
	{ key: 'version-label', category: 'Typography', element: <VersionLabelDemo /> },
	{ key: 'icon-badge', category: 'Visual Indicators & Badges', element: <IconBadgeDemo /> },
	{ key: 'rarity-chip', category: 'Visual Indicators & Badges', element: <RarityChipDemo /> },
	{ key: 'currency-chip', category: 'Visual Indicators & Badges', element: <CurrencyChipDemo /> },
	{ key: 'currency-display', category: 'Visual Indicators & Badges', element: <CurrencyDisplayDemo /> },
	{ key: 'portrait', category: 'Visual Indicators & Badges', element: <PortraitDemo /> },
	{ key: 'platform-icon', category: 'Visual Indicators & Badges', element: <PlatformIconDemo /> },
	{ key: 'gamepad-button-prompt', category: 'Visual Indicators & Badges', element: <GamepadButtonPromptDemo /> },
	{ key: 'compass-rose', category: 'Visual Indicators & Badges', element: <CompassRoseDemo /> },
	{ key: 'rune-corner', category: 'Visual Indicators & Badges', element: <RuneCornerDemo /> },
	{ key: 'ping-display', category: 'Visual Indicators & Badges', element: <PingDisplayDemo /> },
	{ key: 'page-indicator', category: 'Visual Indicators & Badges', element: <PageIndicatorDemo /> },
	{ key: 'metal-button', category: 'Buttons & Navigation', element: <MetalButtonDemo /> },
	{ key: 'nav-button', category: 'Buttons & Navigation', element: <NavButtonDemo /> },
	{ key: 'menu-item', category: 'Buttons & Navigation', element: <MenuItemDemo /> },
	{ key: 'list-row', category: 'Buttons & Navigation', element: <ListRowDemo /> },
	{ key: 'circular-progress', category: 'Progress & Status', element: <CircularProgressDemo /> },
	{ key: 'cooldown-badge', category: 'Progress & Status', element: <CooldownBadgeDemo /> },
	{ key: 'hit-marker', category: 'Progress & Status', element: <HitMarkerDemo /> },
	{ key: 'damage-number', category: 'Progress & Status', element: <DamageNumberDemo /> },
	{ key: 'network-status-icon', category: 'Progress & Status', element: <NetworkStatusIconDemo /> },
	{ key: 'combo-counter', category: 'Progress & Status', element: <ComboCounterDemo /> },
	{ key: 'score-display', category: 'Progress & Status', element: <ScoreDisplayDemo /> },
	{ key: 'screen-flash', category: 'Overlays & Effects', element: <ScreenFlashDemo /> },
	{ key: 'shake-container', category: 'Overlays & Effects', element: <ShakeContainerDemo /> },
	{ key: 'transition-wipe', category: 'Overlays & Effects', element: <TransitionWipeDemo /> },
	{ key: 'interact-prompt', category: 'Overlays & Effects', element: <InteractPromptDemo /> },
	{ key: 'resource-bars', category: 'Resource Bars', element: <ResourceBarsDemo /> },
	{ key: 'ammo-counter', category: 'Resource Bars', element: <AmmoCounterDemo /> },
	{ key: 'boss-bar', category: 'Resource Bars', element: <BossBarDemo /> },
	{ key: 'setting-rows', category: 'Settings', element: <SettingRowsDemo /> },
	{ key: 'buffs', category: 'Visual Indicators & Badges', element: <BuffsDemo /> },
	{ key: 'visualization', category: 'Visualization', element: <VisualizationDemo /> },
	{ key: 'safe-area', category: 'Layout Primitives', element: <SafeAreaDemo /> },
	{ key: 'aspect-ratio-box', category: 'Layout Primitives', element: <AspectRatioBoxDemo /> },
	{ key: 'tab-bar', category: 'Buttons & Navigation', element: <TabBarDemo /> },
	{ key: 'pause-menu', category: 'Buttons & Navigation', element: <PauseMenuDemo /> },
	{ key: 'main-menu', category: 'Lists & Selection', element: <MainMenuDemo /> },
	{ key: 'list', category: 'Lists & Selection', element: <GcListDemo /> },
	{ key: 'settings-category-list', category: 'Lists & Selection', element: <SettingsCategoryListDemo /> },
	{ key: 'combo-box', category: 'Lists & Selection', element: <ComboBoxDemo /> },
	{ key: 'dialogue-box', category: 'Dialogs & Modals', element: <DialogueBoxDemo /> },
	{ key: 'report-player-dialog', category: 'Dialogs & Modals', element: <ReportPlayerDialogDemo /> },
	{ key: 'invite-toast', category: 'Dialogs & Modals', element: <InviteToastDemo /> },
	{ key: 'legal-screen', category: 'Dialogs & Modals', element: <LegalScreenDemo /> },
	{ key: 'character-create', category: 'Character Management', element: <CharacterCreateDemo /> },
	{ key: 'character-select', category: 'Character Management', element: <CharacterSelectDemo /> },
	{ key: 'player-card', category: 'Character Management', element: <PlayerCardDemo /> },
	{ key: 'player-frame', category: 'Character Management', element: <PlayerFrameDemo /> },
	{ key: 'title-screen', category: 'Game Screens', element: <TitleScreenDemo /> },
	{ key: 'loading-screen', category: 'Game Screens', element: <LoadingScreenDemo /> },
	{ key: 'pause-screen', category: 'Game Screens', element: <PauseScreenDemo /> },
	{ key: 'result-screen', category: 'Game Screens', element: <ResultScreenDemo /> },
	{ key: 'stats-screen', category: 'Game Screens', element: <StatsScreenDemo /> },
	{ key: 'matchmaking-screen', category: 'Game Screens', element: <MatchmakingScreenDemo /> },
	{ key: 'toggle', category: 'Settings', element: <ToggleDemo /> },
	{ key: 'check', category: 'Settings', element: <CheckDemo /> },
	{ key: 'key-binder', category: 'Settings', element: <KeyBinderDemo /> },
	{ key: 'vignette-overlay', category: 'Overlays & Effects', element: <VignetteOverlayDemo /> },
	{ key: 'blur-overlay', category: 'Overlays & Effects', element: <BlurOverlayDemo /> },
	{ key: 'letterbox-bars', category: 'Overlays & Effects', element: <LetterboxBarsDemo /> },
	{ key: 'divider', category: 'Visual Indicators & Badges', element: <DividerDemo /> },
	{ key: 'confirm-dialog', category: 'Dialogs & Modals', element: <ConfirmDialogDemo /> },
	{ key: 'loading-overlay', category: 'Dialogs & Modals', element: <LoadingOverlayDemo /> },
	{ key: 'debug-overlay', category: 'Progress & Status', element: <DebugOverlayDemo /> },
	{ key: 'controls-rebind-list', category: 'Input & Binding', element: <ControlsRebindListDemo /> },
	{ key: 'item-slot', category: 'Inventory & Items', element: <ItemSlotDemo /> },
	{ key: 'item-tooltip', category: 'Inventory & Items', element: <ItemTooltipDemo /> },
	{ key: 'item-compare', category: 'Inventory & Items', element: <ItemCompareDemo /> },
	{ key: 'hotbar', category: 'Inventory & Items', element: <HotbarDemo /> },
	{ key: 'inventory-grid', category: 'Inventory & Items', element: <InventoryGridDemo /> },
	{ key: 'equipment-doll', category: 'Inventory & Items', element: <EquipmentDollDemo /> },
	{ key: 'ability-card', category: 'Ability & Skills', element: <AbilityCardDemo /> },
	{ key: 'skill-bar', category: 'Ability & Skills', element: <SkillBarDemo /> },
	{ key: 'compass-bar', category: 'Map & Navigation', element: <CompassBarDemo /> },
	{ key: 'minimap', category: 'Map & Navigation', element: <MinimapDemo /> },
	{ key: 'objective-marker', category: 'Map & Navigation', element: <ObjectiveMarkerDemo /> },
	{ key: 'waypoint-marker', category: 'Map & Navigation', element: <WaypointMarkerDemo /> },
	{ key: 'chat-window', category: 'Social & Communication', element: <ChatWindowDemo /> },
	{ key: 'friends-list', category: 'Social & Communication', element: <FriendsListDemo /> },
	{ key: 'mute-list', category: 'Social & Communication', element: <MuteListDemo /> },
	{ key: 'kill-feed', category: 'Social & Communication', element: <KillFeedDemo /> },
	{ key: 'level-header', category: 'Progression & Content', element: <LevelHeaderDemo /> },
	{ key: 'level-select', category: 'Progression & Content', element: <LevelSelectDemo /> },
	{ key: 'skill-tree', category: 'Progression & Content', element: <SkillTreeDemo /> },
	{ key: 'codex', category: 'Progression & Content', element: <CodexDemo /> },
	{ key: 'journal', category: 'Progression & Content', element: <JournalDemo /> },
	{ key: 'quest-tracker', category: 'Progression & Content', element: <QuestTrackerDemo /> },
	{ key: 'achievement-list', category: 'Progression & Content', element: <AchievementListDemo /> },
	{ key: 'battle-pass', category: 'Progression & Content', element: <BattlePassDemo /> },
	{ key: 'crafting-panel', category: 'Gameplay Panels', element: <CraftingPanelDemo /> },
	{ key: 'shop-panel', category: 'Gameplay Panels', element: <ShopPanelDemo /> },
	{ key: 'loot-list', category: 'Gameplay Panels', element: <LootListDemo /> },
	{ key: 'loot-popup', category: 'Gameplay Panels', element: <LootPopupDemo /> },
	{ key: 'guild-panel', category: 'Social Panels', element: <GuildPanelDemo /> },
	{ key: 'party-panel', category: 'Social Panels', element: <PartyPanelDemo /> },
	{ key: 'lobby', category: 'Social Panels', element: <LobbyDemo /> },
	{ key: 'perk-picker', category: 'UI Utilities & Specialized', element: <PerkPickerDemo /> },
	{ key: 'radial-wheel', category: 'UI Utilities & Specialized', element: <RadialWheelDemo /> },
	{ key: 'save-slot-list', category: 'UI Utilities & Specialized', element: <SaveSlotListDemo /> },
	{ key: 'controller-layout-preview', category: 'UI Utilities & Specialized', element: <ControllerLayoutPreviewDemo /> },
	{ key: 'credits-list', category: 'UI Utilities & Specialized', element: <CreditsListDemo /> },
	{ key: 'credits-scroll', category: 'UI Utilities & Specialized', element: <CreditsScrollDemo /> },
	{ key: 'press-any-key', category: 'UI Utilities & Specialized', element: <PressAnyKeyDemo /> },
	{ key: 'stat-row', category: 'UI Utilities & Specialized', element: <StatRowDemo /> },
	{ key: 'panel-header', category: 'UI Utilities & Specialized', element: <PanelHeaderDemo /> },
]
