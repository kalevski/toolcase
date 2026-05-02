import { useEffect, useState } from 'react'
import { Routes, Route, useNavigate, useLocation, Link as RouterLink } from 'react-router'
import {
    Brand,
    CoolNav,
    type CoolNavItem,
    ExtendedSelect,
    type ExtendedSelectItem,
    Icon,
    Kbd,
    Text,
} from '@toolcase/react-components'
import { Home } from './pages/Home'
import { ReactComponentsPage } from './pages/ReactComponentsPage'
import { BaseExamplesPage } from './pages/BaseExamplesPage'
import { LoggingExamplesPage } from './pages/LoggingExamplesPage'
import { SerializerExamplesPage } from './pages/SerializerExamplesPage'
import { PhaserPlusPage } from './pages/PhaserPlusPage'
import { GameComponentsPage } from './pages/GameComponentsPage'
import { examples } from './react-components/index'
import { phaserExamples } from './phaser-plus/index'
import { gameComponentExamples } from './game-components/index'

const THEME_STORAGE_KEY = 'toolcase.examples.theme'

const themeOptions: ExtendedSelectItem[] = [
    {
        key: 'default',
        name: 'Default',
        description: 'Light toolcase baseline',
        icon: 'sun',
    },
    {
        key: 'dark',
        name: 'Dark',
        description: 'Dark toolcase baseline',
        icon: 'moon',
    },
    {
        key: 'neon',
        name: 'Neon Drift',
        description: 'Dark synthwave override',
        icon: 'lightning-charge',
    },
    {
        key: 'purple-night',
        name: 'Purple Night',
        description: 'Moody dark with purple accent',
        icon: 'stars',
    },
]

interface NavProps {
    theme: string
    onThemeChange: (key: string) => void
}

const Nav = ({ theme, onThemeChange }: NavProps) => {
    const navigate = useNavigate()
    const location = useLocation()

    const go = (path: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
        event.preventDefault()
        navigate(path)
    }

    const items: CoolNavItem[] = [
        { key: 'base', label: 'Base', href: '/base', active: location.pathname.startsWith('/base'), onClick: go('/base') },
        { key: 'logging', label: 'Logging', href: '/logging', active: location.pathname.startsWith('/logging'), onClick: go('/logging') },
        { key: 'serializer', label: 'Serializer', href: '/serializer', active: location.pathname.startsWith('/serializer'), onClick: go('/serializer') },
        { key: 'rc', label: 'React Components', href: '/react-components', active: location.pathname.startsWith('/react-components'), onClick: go('/react-components') },
        { key: 'gc', label: 'Game Components', href: '/game-components', active: location.pathname.startsWith('/game-components'), onClick: go('/game-components') },
        { key: 'phaser', label: 'Phaser+', href: '/phaser-plus', active: location.pathname.startsWith('/phaser-plus'), onClick: go('/phaser-plus') },
    ]

    const brand = (
        <a
            href="/"
            onClick={go('/')}
            className="app-brand-link"
        >
            <Brand primaryText="@toolcase" label="v2" />
        </a>
    )

    const themeSelect = (
        <div className="app-theme">
            <ExtendedSelect
                items={themeOptions}
                value={theme}
                onChange={onThemeChange}
                placeholder="Theme"
            />
        </div>
    )

    return (
        <CoolNav
            brand={brand}
            items={items}
            rightEl={themeSelect}
            theme="light"
        />
    )
}

interface ExampleWrapperProps {
    children: React.ReactNode
    exampleKey: string
}

const isEditableTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false
    const tag = target.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
    if (target.isContentEditable) return true
    return false
}

const ExampleWrapper = ({ children, exampleKey }: ExampleWrapperProps) => {
    const navigate = useNavigate()
    const index = examples.findIndex(e => e.key === exampleKey)
    const prev = index > 0 ? examples[index - 1] : null
    const next = index < examples.length - 1 ? examples[index + 1] : null

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
            if (isEditableTarget(event.target)) return
            if (event.key === 'ArrowLeft' && prev) {
                event.preventDefault()
                navigate(`/react-components/${prev.key}`)
            } else if (event.key === 'ArrowRight' && next) {
                event.preventDefault()
                navigate(`/react-components/${next.key}`)
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [navigate, prev, next])

    return (
        <div className="example">
            <div className="example__back">
                <RouterLink to="/react-components" className="example__back-link">
                    <Icon name="arrow-left" /> All Components
                </RouterLink>
                <Text as="span" variant="muted" size="small" className="example__hint">
                    <Kbd>←</Kbd> <Kbd>→</Kbd> to navigate
                </Text>
            </div>
            <div className="example__canvas">
                {children}
            </div>
        </div>
    )
}

interface PhaserExampleWrapperProps {
    children: React.ReactNode
    exampleKey: string
}

interface GameComponentExampleWrapperProps {
    children: React.ReactNode
    exampleKey: string
}

const GameComponentExampleWrapper = ({ children, exampleKey }: GameComponentExampleWrapperProps) => {
    const navigate = useNavigate()
    const index = gameComponentExamples.findIndex(e => e.key === exampleKey)
    const prev = index > 0 ? gameComponentExamples[index - 1] : null
    const next = index < gameComponentExamples.length - 1 ? gameComponentExamples[index + 1] : null

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
            if (isEditableTarget(event.target)) return
            if (event.key === 'ArrowLeft' && prev) {
                event.preventDefault()
                navigate(`/game-components/${prev.key}`)
            } else if (event.key === 'ArrowRight' && next) {
                event.preventDefault()
                navigate(`/game-components/${next.key}`)
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [navigate, prev, next])

    return (
        <div className="example">
            <div className="example__back">
                <RouterLink to="/game-components" className="example__back-link">
                    <Icon name="arrow-left" /> All Game Components
                </RouterLink>
                <Text as="span" variant="muted" size="small" className="example__hint">
                    <Kbd>←</Kbd> <Kbd>→</Kbd> to navigate
                </Text>
            </div>
            <div className="example__canvas">
                {children}
            </div>
        </div>
    )
}

const PhaserExampleWrapper = ({ children, exampleKey }: PhaserExampleWrapperProps) => {
    const navigate = useNavigate()
    const index = phaserExamples.findIndex(e => e.key === exampleKey)
    const prev = index > 0 ? phaserExamples[index - 1] : null
    const next = index < phaserExamples.length - 1 ? phaserExamples[index + 1] : null
    const current = phaserExamples[index]

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
            if (isEditableTarget(event.target)) return
            if (event.key === 'ArrowLeft' && prev) {
                event.preventDefault()
                navigate(`/phaser-plus/${prev.key}`)
            } else if (event.key === 'ArrowRight' && next) {
                event.preventDefault()
                navigate(`/phaser-plus/${next.key}`)
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [navigate, prev, next])

    return (
        <div className="example">
            <div className="example__back">
                <RouterLink to="/phaser-plus" className="example__back-link">
                    <Icon name="arrow-left" /> All Phaser+ Demos
                </RouterLink>
                {current && (
                    <Text as="span" variant="muted" size="small">
                        {current.title} — <code>{current.sceneFile}</code>
                    </Text>
                )}
                <Text as="span" variant="muted" size="small" className="example__hint">
                    <Kbd>←</Kbd> <Kbd>→</Kbd> to navigate
                </Text>
            </div>
            <div className="example__canvas phaser-canvas-wrapper">
                {children}
            </div>
        </div>
    )
}

export const App = () => {
    const [theme, setTheme] = useState<string>(() => {
        const stored = localStorage.getItem(THEME_STORAGE_KEY)
        return themeOptions.some((o) => o.key === stored) ? (stored as string) : 'default'
    })
    useEffect(() => {
        localStorage.setItem(THEME_STORAGE_KEY, theme)
    }, [theme])

    const isDarkScope = theme === 'neon' || theme === 'dark' || theme === 'purple-night'
    const appClass = [
        'app',
        `app--${isDarkScope ? 'dark' : 'light'}`,
        isDarkScope ? `theme theme--${theme}` : '',
    ]
        .filter(Boolean)
        .join(' ')

    return (
        <div className={appClass}>
            <Nav theme={theme} onThemeChange={setTheme} />
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/base" element={<BaseExamplesPage />} />
                <Route path="/logging" element={<LoggingExamplesPage />} />
                <Route path="/serializer" element={<SerializerExamplesPage />} />
                <Route path="/react-components" element={<ReactComponentsPage />} />
                <Route path="/game-components" element={<GameComponentsPage />} />
                <Route path="/phaser-plus" element={<PhaserPlusPage />} />
                {examples.map((example) => (
                    <Route
                        key={example.key}
                        path={`/react-components/${example.key}`}
                        element={
                            <ExampleWrapper exampleKey={example.key}>
                                {example.element}
                            </ExampleWrapper>
                        }
                    />
                ))}
                {gameComponentExamples.map((example) => (
                    <Route
                        key={example.key}
                        path={`/game-components/${example.key}`}
                        element={
                            <GameComponentExampleWrapper exampleKey={example.key}>
                                {example.element}
                            </GameComponentExampleWrapper>
                        }
                    />
                ))}
                {phaserExamples.map((example) => (
                    <Route
                        key={example.key}
                        path={`/phaser-plus/${example.key}`}
                        element={
                            <PhaserExampleWrapper exampleKey={example.key}>
                                {example.element}
                            </PhaserExampleWrapper>
                        }
                    />
                ))}
            </Routes>
        </div>
    )
}
