import React from 'react'
import { Changelog, Card, CodeSnippet, type ChangelogEntry } from '@toolcase/react-components'

const entries: ChangelogEntry[] = [
	{
		date: 'Mar 20, 2026',
		title: 'Real-time multiplayer sync',
		description: 'Added WebSocket-based state synchronization for up to 16 concurrent players per session.',
		tag: 'Feature',
	},
	{
		date: 'Mar 14, 2026',
		title: 'Asset pipeline overhaul',
		description: 'Switched to streaming asset loading, reducing initial load times by 40% on average.',
		tag: 'Improvement',
	},
	{
		date: 'Mar 08, 2026',
		title: 'Bug fix: tilemap rendering',
		description: 'Fixed an edge case where large tilemaps would flicker on Safari and older WebKit browsers.',
		tag: 'Fix',
	},
	{
		date: 'Feb 28, 2026',
		title: 'New analytics dashboard',
		description: 'Track player retention, session length, and custom events from a unified dashboard.',
		tag: 'Feature',
	},
	{
		date: 'Feb 20, 2026',
		title: 'Improved deploy previews',
		description: 'Deploy previews now spin up in under 10 seconds with shareable short links.',
		tag: 'Improvement',
	},
]

const ChangelogDemo: React.FC = () => {
	return (
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-lg-8">
					<h1 className="display-4 text-gradient-primary mb-2">Changelog</h1>
					<p className="text-muted mb-4">
						A horizontal scrolling changelog section showcasing recent product updates with date, tag, title, and description.
					</p>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">With "Read More" Link</h2>
						<Changelog entries={entries} readMoreHref="#" />
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Without "Read More" Link</h2>
						<Changelog entries={entries.slice(0, 3)} readMoreHref="#" />
					</Card>
				</div>
			</div>

			{/* Usage */}
			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Usage</h2>
						<CodeSnippet
							language="typescript"
							code={`import { Changelog, type ChangelogEntry } from '@webgame-cloud/react-components'

const entries: ChangelogEntry[] = [
  { date: 'Mar 01, 2024', title: 'New feature', description: 'Added dark mode', tag: 'Feature' },
  { date: 'Feb 15, 2024', title: 'Bug fix', description: 'Fixed login issue', tag: 'Fix' },
]

<Changelog entries={entries} readMoreHref="/changelog" />`}
						/>
					</Card>
				</div>
			</div>
		</div>
	)
}

export default ChangelogDemo
