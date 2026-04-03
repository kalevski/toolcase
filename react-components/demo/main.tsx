import { createRoot } from 'react-dom/client'
import { Routes, Route, BrowserRouter, Link } from 'react-router'
import { examples, categories, ExampleCategory } from './examples'
import { JSX } from 'react'
import 'bootstrap/dist/js/bootstrap.js'
import 'bootstrap-icons/font/bootstrap-icons.css'

const formatLabel = (key: string) => {
	return key.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

const categoryIcons: Record<ExampleCategory, string> = {
	'Simple': 'bi-puzzle',
	'Form': 'bi-input-cursor-text',
	'Layout / Container': 'bi-layout-wtf',
	'Complex': 'bi-diagram-3',
	'Specialized': 'bi-star',
	'Advanced': 'bi-rocket-takeoff',
	'Full Page Demos': 'bi-window-fullscreen',
}

const wrap = (element: JSX.Element) => {
	return (
		<div className="example">
			<div className="example__back">
				<Link to="/">
					<i className="bi bi-arrow-left"></i> All Components
				</Link>
			</div>
			{element}
		</div>
	)
}

const DemoLinks = () => {
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
								<Link key={example.key} className="example-menu__card" to={`/examples/${example.key}`}>
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

const Playground = () => {
	return (
		<BrowserRouter>
			<Routes>
				<Route path="/" element={<DemoLinks />} />
				{examples.map((example) => (
					<Route key={example.key} path={`/examples/${example.key}`} element={wrap(example.element)} />
				))}
			</Routes>
		</BrowserRouter>
	)
}

window.addEventListener('DOMContentLoaded', () => {
	const rootElement = document.getElementById('app')
	if (rootElement === null) {
		return
	}
	try {
		const root = createRoot(rootElement)
		root.render(<Playground />)
	} catch (error) {
		console.error('tuka e makata', error)
	}
})
