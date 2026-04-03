import React from 'react'
import { Timeline, Card, CodeSnippet, type TimelineItem } from '@toolcase/react-components'

const timelineItems: TimelineItem[] = [
	{
		title: 'Project Kickoff',
		date: 'Jan 10, 2024',
		description: 'Initial alignment with stakeholders and core team formation with clear milestones.',
	},
	{
		title: 'Architecture Sign-off',
		date: 'Feb 04, 2024',
		description: 'Chose scalable micro-frontend approach with shared design system and CI/CD.',
	},
	{
		title: 'Beta Launch',
		date: 'Mar 18, 2024',
		description: 'Released first playable demo to a closed group; collected telemetry for tuning.',
	},
	{
		title: 'Global Release',
		date: 'May 02, 2024',
		description: 'Rolled out to all regions with localized assets, live events, and marketing push.',
	},
]

const shortTimeline: TimelineItem[] = [
	{
		title: 'Feature Request',
		date: 'Jun 01, 2024',
		description: 'Community requested real-time multiplayer support.',
	},
	{
		title: 'Implementation',
		date: 'Jul 15, 2024',
		description: 'WebSocket-based sync engine built and tested.',
	},
]

const TimelineDemo: React.FC = () => {
	return (
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-lg-8">
					<h1 className="display-4 text-gradient-primary mb-2">Timeline</h1>
					<p className="text-muted mb-4">
						A vertical timeline with alternating cards for major milestones, showing the date, title, and a
						short description for each event.
					</p>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Default (4 items, overlap 50)</h2>
						<Timeline items={timelineItems} overlap={50} />
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Compact (no overlap)</h2>
						<Timeline items={shortTimeline} overlap={0} />
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
							code={`import { Timeline, type TimelineItem } from '@webgame-cloud/react-components'

const items: TimelineItem[] = [
  { title: 'Created', date: 'Jan 01, 2024', description: 'Project created' },
  { title: 'Updated', date: 'Feb 15, 2024', description: 'Added new feature' },
]

<Timeline items={items} overlap={50} />`}
						/>
					</Card>
				</div>
			</div>
		</div>
	)
}

export default TimelineDemo
