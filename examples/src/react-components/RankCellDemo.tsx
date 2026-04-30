import React from 'react'
import {
	RankCell,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
} from '@toolcase/react-components'

const ranks = (
	<div style={{ display: 'flex', gap: 32, alignItems: 'center', justifyContent: 'center' }}>
		<RankCell rank={1} />
		<RankCell rank={2} />
		<RankCell rank={3} />
		<RankCell rank={4} />
		<RankCell rank={42} />
	</div>
)

const RankCellDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
					chips={<RichPageHeaderChip>Game Jam / Arcade</RichPageHeaderChip>}
					title="RankCell"
					description="Rank numeral with top-3 color tint (1 → warning, 2 → info, 3 → accent)."
				/>
				<div className="d-flex flex-column gap-4 mt-4">
					<SectionCard title="Top of the board">{ranks}</SectionCard>

					<SectionCard title="Custom padding">
						<div style={{ display: 'flex', gap: 32, alignItems: 'center', justifyContent: 'center' }}>
							<RankCell rank={1} pad={3} />
							<RankCell rank={42} pad={4} />
							<RankCell rank={1099} pad={4} />
						</div>
					</SectionCard>

					<SectionCard title="Neon theme">
						<div className="theme theme--neon" style={{ padding: 32 }}>{ranks}</div>
					</SectionCard>
					<SectionCard title="Dark theme">
						<div className="theme theme--dark" style={{ padding: 32 }}>{ranks}</div>
					</SectionCard>
				</div>
			</div>
		</div>
	</div>
)

export default RankCellDemo
