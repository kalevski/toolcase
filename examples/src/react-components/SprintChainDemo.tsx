import React from 'react'
import {
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
	SprintChain,
} from '@toolcase/react-components'

const items = [
	{ id: '042', label: '042', tag: 'Closed' },
	{ id: '043', label: '043', tag: 'Closed' },
	{ id: '044', label: '044', tag: 'Closed' },
	{ id: '045', label: '045', tag: 'Closed' },
	{ id: '046', label: '046', tag: 'Closed' },
	{ id: '047', label: '047', tag: 'Open' },
	{ id: '048', label: '048', tag: 'Queued' },
	{ id: '049', label: '049', tag: 'Queued' },
	{ id: '050', label: '050', tag: 'Queued' },
	{ id: '051', label: '051', tag: 'Queued' },
	{ id: '052', label: '052', tag: 'Queued' },
	{ id: 'inf', label: '···', tag: '∞' },
]

const SprintChainDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
					chips={<RichPageHeaderChip>Game Jam / Arcade</RichPageHeaderChip>}
					title="SprintChain"
					description="Horizontal sequence of equal-width cells. Each cell auto-derives past / now / future state from currentId."
				/>
				<div className="d-flex flex-column gap-4 mt-4">
					<SectionCard title="Default — twelve cycle cells">
						<SprintChain
							currentId="047"
							header="The chain — past · future"
							headerEnd="Every 14 days · ∞"
							items={items}
						/>
					</SectionCard>

					<SectionCard title="Four-step pipeline">
						<SprintChain
							currentId="ship"
							header="Release process"
							items={[
								{ id: 'plan', label: 'Plan', tag: 'Done' },
								{ id: 'build', label: 'Build', tag: 'Done' },
								{ id: 'ship', label: 'Ship', tag: 'Now' },
								{ id: 'review', label: 'Review', tag: 'Queued' },
							]}
						/>
					</SectionCard>

					<SectionCard title="Neon theme">
						<div className="theme theme--neon" style={{ padding: 24 }}>
							<SprintChain
								currentId="047"
								header="« THE CHAIN — past · future »"
								headerEnd="EVERY 14 DAYS · ∞"
								items={items}
							/>
						</div>
					</SectionCard>
					<SectionCard title="Dark theme">
						<div className="theme theme--dark" style={{ padding: 24 }}>
							<SprintChain
								currentId="047"
								header="« THE CHAIN — past · future »"
								headerEnd="EVERY 14 DAYS · ∞"
								items={items}
							/>
						</div>
					</SectionCard>
				</div>
			</div>
		</div>
	</div>
)

export default SprintChainDemo
