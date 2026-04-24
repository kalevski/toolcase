import { useEffect, useState } from 'react'
import { Routes, Route, Link } from 'react-router'
import { ExtendedSelect, type ExtendedSelectItem } from '@toolcase/react-components'
import { Home } from './pages/Home'
import { ReactComponentsPage } from './pages/ReactComponentsPage'
import { BaseExamplesPage } from './pages/BaseExamplesPage'
import { LoggingExamplesPage } from './pages/LoggingExamplesPage'
import { SerializerExamplesPage } from './pages/SerializerExamplesPage'
import { examples } from './react-components/index'

const THEME_STORAGE_KEY = 'toolcase.examples.theme'

const themeOptions: ExtendedSelectItem[] = [
    {
        key: 'default',
        name: 'Default',
        description: 'Light toolcase baseline',
        icon: 'sun',
    },
    {
        key: 'neon',
        name: 'Neon Drift',
        description: 'Dark synthwave override',
        icon: 'lightning-charge',
    },
]

const Nav = () => (
    <nav className="app-nav">
        <div className="app-nav__inner">
            <Link to="/" className="app-nav__brand">@toolcase</Link>
            <div className="app-nav__links">
                <Link to="/base">Base</Link>
                <Link to="/logging">Logging</Link>
                <Link to="/serializer">Serializer</Link>
                <Link to="/react-components">React Components</Link>
            </div>
        </div>
    </nav>
)

const ExampleWrapper = ({ children }: { children: React.ReactNode }) => {
    const [theme, setTheme] = useState<string>(() => {
        const stored = localStorage.getItem(THEME_STORAGE_KEY)
        return themeOptions.some((o) => o.key === stored) ? (stored as string) : 'default'
    })
    useEffect(() => {
        localStorage.setItem(THEME_STORAGE_KEY, theme)
    }, [theme])
    const isNeon = theme === 'neon'
    const canvasClass = [
        'example__canvas',
        `example__canvas--${isNeon ? 'dark' : 'light'}`,
        isNeon ? `theme theme--${theme}` : '',
    ]
        .filter(Boolean)
        .join(' ')
    return (
        <div className="example">
            <div className="example__back">
                <Link to="/react-components">
                    <i className="bi bi-arrow-left"></i> All Components
                </Link>
                <div className="example__theme">
                    <span className="example__theme-label">Theme</span>
                    <ExtendedSelect
                        items={themeOptions}
                        value={theme}
                        onChange={setTheme}
                        placeholder="Select theme"
                    />
                </div>
            </div>
            <div className={canvasClass}>
                {children}
            </div>
        </div>
    )
}

export const App = () => {
    return (
        <>
            <Nav />
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/base" element={<BaseExamplesPage />} />
                <Route path="/logging" element={<LoggingExamplesPage />} />
                <Route path="/serializer" element={<SerializerExamplesPage />} />
                <Route path="/react-components" element={<ReactComponentsPage />} />
                {examples.map((example) => (
                    <Route
                        key={example.key}
                        path={`/react-components/${example.key}`}
                        element={<ExampleWrapper>{example.element}</ExampleWrapper>}
                    />
                ))}
            </Routes>
        </>
    )
}
