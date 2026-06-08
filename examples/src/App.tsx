import { useEffect, useState, ReactNode } from 'react'
import { Routes, Route, useNavigate, useLocation, Link as RouterLink } from 'react-router'
import { packageRoutes, topPages, type DemoEntry, type PackageRoute } from './routes'
import { NginxStaticServerPage } from './pages/NginxStaticServerPage'
import { TaskForgePage } from './pages/TaskForgePage'

const Header = () => {
    const location = useLocation()
    const path = location.pathname

    const isPackages = path === '/' || packageRoutes.some((r) => path === r.basePath || path.startsWith(`${r.basePath}/`))
    const isApps = path.startsWith('/apps')
    const isSkills = path.startsWith('/skills')

    return (
        <header className="site-header">
            <div className="site-header-inner">
                <RouterLink to="/" className="brand">
                    <span className="dot" />
                    <span>@toolcase</span>
                </RouterLink>
                <nav className="nav">
                    <RouterLink to="/" className={isPackages && !isApps && !isSkills ? 'active' : ''}>
                        Packages
                    </RouterLink>
                    <RouterLink to="/apps" className={isApps ? 'active' : ''}>
                        Apps
                    </RouterLink>
                    <RouterLink to="/skills" className={isSkills ? 'active' : ''}>
                        Skills
                    </RouterLink>
                </nav>
                <div className="header-spacer" />
                <div className="header-meta">
                    <a href="https://github.com/kalevski/toolcase" target="_blank" rel="noopener">
                        github ↗
                    </a>
                </div>
            </div>
        </header>
    )
}

const Footer = () => (
    <footer className="site-footer">
        <div className="site-footer-inner">
            <div>
                <span style={{ color: 'var(--fg-2)', fontWeight: 500 }}>@toolcase</span>
                &nbsp;·&nbsp; reusable code shaped over 10 years
            </div>
            <div style={{ display: 'flex', gap: 20 }}>
                <a href="https://github.com/kalevski/toolcase" target="_blank" rel="noopener">github</a>
                <a href="https://www.npmjs.com/~kalevski" target="_blank" rel="noopener">npm</a>
                <a href="mailto:dakalevski@gmail.com">contact</a>
            </div>
        </div>
    </footer>
)

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
    const supportsTheme = route.key === 'react-components'
    const [theme, setTheme] = useState<'default' | 'dark'>('default')
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
                    {supportsTheme ? (
                        <label className="example__theme">
                            theme
                            <select value={theme} onChange={(e) => setTheme(e.target.value as 'default' | 'dark')}>
                                <option value="default">Default</option>
                                <option value="dark">Dark</option>
                            </select>
                        </label>
                    ) : null}
                    <span className="example__hint">
                        <kbd>←</kbd> <kbd>→</kbd> navigate
                    </span>
                </div>
            </div>
            <div className={canvasClass}>
                {supportsTheme && theme === 'dark' ? (
                    <div className="theme theme--dark">{children}</div>
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
                <Route path="/apps/nginx-static-server" element={<NginxStaticServerPage />} />
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
                    ))
                )}
            </Routes>
            <Footer />
        </div>
    )
}
