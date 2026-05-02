import { JSX } from 'react'

export type GameComponentCategory =
    | 'Layout'
    | 'Inputs'
    | 'HUD — Resource Bars'
    | 'HUD — Combat'
    | 'HUD — Navigation'
    | 'HUD — Skills'
    | 'HUD — Display'
    | 'HUD — Communications'

export type GameComponentExample = {
    key: string
    category: GameComponentCategory
    element: JSX.Element
}

export const gameComponentCategories: GameComponentCategory[] = [
    'Layout',
    'Inputs',
    'HUD — Resource Bars',
    'HUD — Combat',
    'HUD — Navigation',
    'HUD — Skills',
    'HUD — Display',
    'HUD — Communications',
]

type DemoModule = { default: () => JSX.Element }

const demoModules = import.meta.glob<DemoModule>('./*Demo.tsx', { eager: true })

const keyAlias: Record<string, string> = {
    GcList: 'list',
    VSyncToggle: 'vsync-toggle',
    FPSCapSelect: 'fps-cap-select',
    FOVSlider: 'fov-slider'
}

const toKebabCase = (name: string): string =>
    name
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .toLowerCase()

const resolveKey = (componentName: string): string => keyAlias[componentName] ?? toKebabCase(componentName)

const categoryMap: Record<string, GameComponentCategory> = {
    // Layout
    'panel': 'Layout',
    'stack': 'Layout',
    'grid': 'Layout',
    'anchor': 'Layout',
    'safe-area': 'Layout',
    'aspect-ratio-box': 'Layout',
    'list': 'Layout',
    'artboard-backdrop': 'Layout',
    'panel-header': 'Layout',

    // Inputs
    'combo-box': 'Inputs',
    'nav-button': 'Inputs',
    'page-indicator': 'Inputs',
    'key-binder': 'Inputs',
    'gamepad-button-prompt': 'Inputs',
    'check': 'Inputs',
    'key': 'Inputs',
    'toggle': 'Inputs',
    'toggle-row': 'Inputs',
    'select-row': 'Inputs',
    'volume-slider': 'Inputs',
    'deadzone-slider': 'Inputs',
    'mouse-sensitivity': 'Inputs',
    'fov-slider': 'Inputs',
    'fps-cap-select': 'Inputs',
    'vsync-toggle': 'Inputs',
    'fullscreen-toggle': 'Inputs',
    'invert-axis-toggle': 'Inputs',
    'controls-rebind-list': 'Inputs',
    'controller-layout-preview': 'Inputs',
    'reset-to-defaults': 'Inputs',

    // Resource Bars
    'health-bar': 'HUD — Resource Bars',
    'mana-bar': 'HUD — Resource Bars',
    'stamina-bar': 'HUD — Resource Bars',
    'circular-progress': 'HUD — Resource Bars',
    'boss-bar': 'HUD — Resource Bars',

    // Combat
    'crosshair': 'HUD — Combat',
    'ammo-counter': 'HUD — Combat',
    'hit-marker': 'HUD — Combat',
    'damage-number': 'HUD — Combat',

    // Navigation
    'compass-bar': 'HUD — Navigation',
    'compass-rose': 'HUD — Navigation',
    'minimap': 'HUD — Navigation',
    'waypoint-marker': 'HUD — Navigation',
    'objective-marker': 'HUD — Navigation',

    // Skills
    'skill-bar': 'HUD — Skills',
    'radial-wheel': 'HUD — Skills',
    'buff-bar': 'HUD — Skills',
    'quest-tracker': 'HUD — Skills',
    'interact-prompt': 'HUD — Skills',
    'ability-card': 'HUD — Skills',
    'perk-picker': 'HUD — Skills',
    'skill-tree': 'HUD — Skills',
    'hotbar': 'HUD — Skills',

    // Communications
    'kill-feed': 'HUD — Communications',
    'chat-window': 'HUD — Communications',
    'friends-list': 'HUD — Communications',
    'party-panel': 'HUD — Communications',
    'guild-panel': 'HUD — Communications',
    'report-player-dialog': 'HUD — Communications',
    'mute-list': 'HUD — Communications',
    'invite-toast': 'HUD — Communications'
}

const resolveCategory = (key: string): GameComponentCategory => categoryMap[key] ?? 'HUD — Display'

export const gameComponentExamples: GameComponentExample[] = Object.entries(demoModules)
    .map(([path, mod]) => {
        const componentName = path.replace('./', '').replace('Demo.tsx', '')
        const key = resolveKey(componentName)
        const Demo = mod.default
        return {
            key,
            category: resolveCategory(key),
            element: <Demo />,
        }
    })
    .sort((a, b) => {
        const categoryDelta = gameComponentCategories.indexOf(a.category) - gameComponentCategories.indexOf(b.category)
        if (categoryDelta !== 0) return categoryDelta
        return a.key.localeCompare(b.key)
    })
