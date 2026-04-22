import { Link } from 'react-router'
import { examples, categories, ExampleCategory } from '../react-components/index'

const categoryIcons: Record<ExampleCategory, string> = {
    'Inputs': 'bi-input-cursor-text',
    'Buttons & Actions': 'bi-hand-index',
    'Feedback': 'bi-bell',
    'Overlays': 'bi-layers',
    'Navigation': 'bi-compass',
    'Data Display': 'bi-table',
    'Layout & Surfaces': 'bi-layout-wtf',
    'Typography': 'bi-type',
    'Media & Files': 'bi-images',
    'Editors': 'bi-code-square',
    'Dashboard & Admin': 'bi-shield-lock',
    'Marketing': 'bi-megaphone',
    'Full Page Demos': 'bi-window-fullscreen',
}

const formatLabel = (key: string) => {
    return key.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export const ReactComponentsPage = () => {
    return (
        <div className="example-menu">
            <div className="example-menu__header">
                <h1>React Components</h1>
                <p>{examples.length} components</p>
            </div>
            {categories.map((category) => {
                const items = examples.filter((e) => e.category === category)
                if (items.length === 0) return null
                return (
                    <div key={category} className="example-menu__category">
                        <div className="example-menu__category-header">
                            <i className={`bi ${categoryIcons[category]}`}></i>
                            <h2>{category}</h2>
                            <span className="example-menu__category-count">{items.length}</span>
                        </div>
                        <div className="example-menu__grid">
                            {items.map((example) => (
                                <Link key={example.key} className="example-menu__card" to={`/react-components/${example.key}`}>
                                    <span className="example-menu__card-label">{formatLabel(example.key)}</span>
                                    <i className="bi bi-arrow-right example-menu__card-arrow"></i>
                                </Link>
                            ))}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
