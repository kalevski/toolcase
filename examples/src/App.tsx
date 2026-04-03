import { Routes, Route, Link } from 'react-router'
import { Home } from './pages/Home'
import { ReactComponentsPage } from './pages/ReactComponentsPage'
import { BaseExamplesPage } from './pages/BaseExamplesPage'
import { examples } from './react-components/index'

const formatLabel = (key: string) => {
    return key.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

const Nav = () => (
    <nav className="app-nav">
        <div className="app-nav__inner">
            <Link to="/" className="app-nav__brand">@toolcase</Link>
            <div className="app-nav__links">
                <Link to="/base">Base</Link>
                <Link to="/react-components">React Components</Link>
            </div>
        </div>
    </nav>
)

const ExampleWrapper = ({ children }: { children: React.ReactNode }) => (
    <div className="example">
        <div className="example__back">
            <Link to="/react-components">
                <i className="bi bi-arrow-left"></i> All Components
            </Link>
        </div>
        {children}
    </div>
)

export const App = () => {
    return (
        <>
            <Nav />
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/base" element={<BaseExamplesPage />} />
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
