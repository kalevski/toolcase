import React from 'react'
import {
	Changelog,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
	type ChangelogEntry
} from '@toolcase/react-components'

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
		<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Data Display</RichPageHeaderChip>}
				title="Changelog"
				description="A horizontal scrolling changelog section showcasing recent product updates with date, tag, title, and description."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
			<SectionCard title={'With "Read More" Link'}>
				<Changelog entries={entries} readMoreHref="#" />
			</SectionCard>

			<SectionCard title={'Without "Read More" Link'}>
				<Changelog entries={entries.slice(0, 3)} readMoreHref="#" />
			</SectionCard>
		</div>
		
			</div>
		</div>
	</div>
	)
}

export default ChangelogDemo
