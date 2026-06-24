import { useEffect, useRef, useState, ReactNode } from 'react'
import { Routes, Route, useNavigate, useLocation, Link as RouterLink } from 'react-router'
import { packageRoutes, topPages, type DemoEntry, type PackageRoute } from './routes'
import { NginxPilotPage } from './pages/NginxPilotPage'
import { TaskForgePage } from './pages/TaskForgePage'

// Header dogfoods <tc-navbar>: the glass app-chrome bar. Nav links are
// React-controlled (RouterLink) so SPA navigation + active state keep working;
// the link set is static, so the navbar moving them into its collapse region
// never fights React's reconciliation.
const Header = () => {
    const location = useLocation()
    const path = location.pathname

    const isApps = path.startsWith('/apps')
    const isSkills = path.startsWith('/skills')
    const isPackages = !isApps && !isSkills

    return (
        // @ts-ignore custom element registered by @toolcase/web-components
        <tc-navbar brand="@toolcase" expand="md" sticky="top">
            <ul className="navbar-nav me-auto mb-2 mb-md-0">
                <li className="nav-item">
                    <RouterLink to="/" className={`nav-link ${isPackages ? 'active' : ''}`}>
                        Packages
                    </RouterLink>
                </li>
                <li className="nav-item">
                    <RouterLink to="/apps" className={`nav-link ${isApps ? 'active' : ''}`}>
                        Apps
                    </RouterLink>
                </li>
                <li className="nav-item">
                    <RouterLink to="/skills" className={`nav-link ${isSkills ? 'active' : ''}`}>
                        Skills
                    </RouterLink>
                </li>
            </ul>
            <a
                className="nav-link"
                href="https://github.com/kalevski/toolcase"
                target="_blank"
                rel="noopener"
            >
                github ↗
            </a>
            {/* @ts-ignore */}
        </tc-navbar>
    )
}

// Footer dogfoods <tc-page-footer>. Its rows are JS properties (socialLinks),
// assigned through a ref after mount; the rest is attribute-driven.
const Footer = () => {
    const ref = useRef<any>(null)
    useEffect(() => {
        if (!ref.current) return
        ref.current.socialLinks = [
            { icon: 'github', href: 'https://github.com/kalevski/toolcase', label: 'GitHub' },
            { icon: 'package', href: 'https://www.npmjs.com/~kalevski', label: 'npm' },
            { icon: 'mail', href: 'mailto:dakalevski@gmail.com', label: 'Contact' },
        ]
    }, [])
    return (
        // @ts-ignore custom element registered by @toolcase/web-components
        <tc-page-footer
            ref={ref}
            brand="@toolcase"
            tagline="Reusable code shaped over a decade of web apps and games."
            legal-text="© Daniel Kalevski · MIT"
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

const routeThemes: Record<string, { value: string; label: string }[]> = {
    'web-components': [
        { value: 'default', label: 'Default' },
        { value: 'dungeon', label: 'Dungeon' },
        { value: 'aurora', label: 'Aurora' },
    ],
}

const ExampleWrapper = ({ children, route, example }: ExampleWrapperProps) => {
    const navigate = useNavigate()
    const themes = routeThemes[route.key]
    // Persist the chosen theme per package so it sticks while browsing the section.
    const themeStorageKey = `tc-examples-theme:${route.key}`
    const [theme, setTheme] = useState(() => {
        if (!themes) return 'default'
        try {
            return localStorage.getItem(themeStorageKey) ?? 'default'
        } catch {
            return 'default'
        }
    })

    useEffect(() => {
        if (!themes) return
        try {
            localStorage.setItem(themeStorageKey, theme)
        } catch {
            /* ignore unavailable storage */
        }
    }, [theme, themes, themeStorageKey])
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
            <div className="example__bar">
                <div className="example__bar-inner">
                    <RouterLink to={route.basePath} className="example__back-link">
                        ← {route.indexLabel}
                    </RouterLink>
                    <span className="example__title">
                        {example.title}
                        {example.extraHeader ? <> — {example.extraHeader}</> : null}
                    </span>
                    {themes ? (
                        <label className="example__theme">
                            theme
                            <select value={theme} onChange={(e) => setTheme(e.target.value)}>
                                {themes.map((t) => (
                                    <option key={t.value} value={t.value}>
                                        {t.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                    ) : null}
                    <span className="example__hint">
                        <kbd>←</kbd> <kbd>→</kbd> navigate
                    </span>
                </div>
            </div>
            <div className={canvasClass}>
                {route.key === 'web-components' ? (
                    <div className="wc-theme-scope" data-tc-theme={theme}>{children}</div>
                ) : (
                    children
                )}
            </div>
        </div>
    )
}

export const App = () => {
    return (
        <div className="app">
            <Header />
            <Routes>
                <Route path="/" element={topPages.home} />
                <Route path="/apps" element={topPages.apps} />
                <Route path="/apps/nginxpilot" element={<NginxPilotPage />} />
                <Route path="/apps/taskforge" element={<TaskForgePage />} />
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
                    )),
                )}
            </Routes>
            <Footer />
        </div>
    )
}
