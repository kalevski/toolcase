import React from 'react'
import {
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
	StateMachine,
} from '@toolcase/react-components'

const states = [
	{ id: 'announce', label: 'announce', note: 'briefs rolled', status: 'done' as const },
	{ id: 'open', label: 'open', note: 'accepting builds', status: 'active' as const },
	{ id: 'voting', label: 'voting', note: 'reserved', status: 'reserved' as const },
	{ id: 'reveal', label: 'reveal', note: 'reserved', status: 'reserved' as const },
	{ id: 'finals_voting', label: 'finals_voting', note: 'reserved', status: 'reserved' as const },
	{ id: 'finals_reveal', label: 'finals_reveal', note: 'reserved', status: 'reserved' as const },
	{ id: 'closed', label: 'closed', note: 'miss tracking', status: 'future' as const },
]

const StateMachineDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
					chips={<RichPageHeaderChip>Game Jam / Arcade</RichPageHeaderChip>}
					title="StateMachine"
					description="Horizontal flat row of state cells with done / active / reserved / future variants. Active gets a top-edge accent bar."
				/>
				<div className="d-flex flex-column gap-4 mt-4">
					<SectionCard title="Sprint state machine">
						<StateMachine states={states} />
					</SectionCard>

					<SectionCard title="Compact variant">
						<StateMachine
							compact
							states={[
								{ id: 'todo', label: 'Todo', status: 'done' },
								{ id: 'doing', label: 'Doing', note: 'in progress', status: 'active' },
								{ id: 'review', label: 'Review', status: 'future' },
								{ id: 'done', label: 'Done', status: 'future' },
							]}
						/>
					</SectionCard>

					<SectionCard title="Neon theme">
						<div className="theme theme--neon" style={{ padding: 24 }}>
							<StateMachine states={states} />
						</div>
					</SectionCard>
				</div>
			</div>
		</div>
	</div>
)

export default StateMachineDemo
