import { useEffect, useState, ReactNode } from 'react'
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
import { packageRoutes, topPages, type DemoEntry, type PackageRoute } from './routes'

const THEME_STORAGE_KEY = 'toolcase.examples.theme'

const themeOptions: ExtendedSelectItem[] = [
    { key: 'default', name: 'Default', description: 'Light toolcase baseline', icon: 'sun' },
    { key: 'dark', name: 'Dark', description: 'Dark toolcase baseline', icon: 'moon' },
    { key: 'neon', name: 'Neon Drift', description: 'Dark synthwave override', icon: 'lightning-charge' },
    { key: 'purple-night', name: 'Purple Night', description: 'Moody dark with purple accent', icon: 'stars' },
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

    const isApps = location.pathname.startsWith('/apps')
    const isSkills = location.pathname.startsWith('/skills')
    const items: CoolNavItem[] = [
        { key: 'packages', label: 'Packages', href: '/', active: !isApps && !isSkills, onClick: go('/') },
        { key: 'apps', label: 'Apps', href: '/apps', active: isApps, onClick: go('/apps') },
        { key: 'skills', label: 'Skills', href: '/skills', active: isSkills, onClick: go('/skills') },
    ]

    const brand = (
        <a href="/" onClick={go('/')} className="app-brand-link">
            <Brand primaryText="@toolcase" label="library" />
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

const isEditableTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false
    const tag = target.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
    if (target.isContentEditable) return true
    return false
}

interface ExampleWrapperProps {
    children: ReactNode
    route: PackageRoute
    example: DemoEntry
}

const ExampleWrapper = ({ children, route, example }: ExampleWrapperProps) => {
    const navigate = useNavigate()
    const index = route.examples.findIndex((e) => e.key === example.key)
    const prev = index > 0 ? route.examples[index - 1] : null
    const next = index < route.examples.length - 1 ? route.examples[index + 1] : null

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
            if (isEditableTarget(event.target)) return
            if (event.key === 'ArrowLeft' && prev) {
                event.preventDefault()
                navigate(`${route.basePath}/${prev.key}`)
            } else if (event.key === 'ArrowRight' && next) {
                event.preventDefault()
                navigate(`${route.basePath}/${next.key}`)
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [navigate, prev, next, route.basePath])

    const canvasClass = ['example__canvas', route.canvasClassName].filter(Boolean).join(' ')

    return (
        <div className="example">
            <div className="example__back">
                <RouterLink to={route.basePath} className="example__back-link">
                    <Icon name="arrow-left" /> {route.indexLabel}
                </RouterLink>
                {example.extraHeader && (
                    <Text as="span" variant="muted" size="small">
                        {example.title} — {example.extraHeader}
                    </Text>
                )}
                <Text as="span" variant="muted" size="small" className="example__hint">
                    <Kbd>←</Kbd> <Kbd>→</Kbd> to navigate
                </Text>
            </div>
            <div className={canvasClass}>{children}</div>
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
                <Route path="/" element={topPages.home} />
                <Route path="/apps" element={topPages.apps} />
                <Route path="/skills" element={topPages.skills} />
                {packageRoutes.map((route) => (
                    <Route key={route.key} path={route.basePath} element={route.page} />
                ))}
                {packageRoutes.flatMap((route) =>
                    route.examples.map((example) => (
                        <Route
                            key={`${route.key}-${example.key}`}
                            path={`${route.basePath}/${example.key}`}
                            element={
                                <ExampleWrapper route={route} example={example}>
                                    {example.element}
                                </ExampleWrapper>
                            }
                        />
                    ))
                )}
            </Routes>
        </div>
    )
}
