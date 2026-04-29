import React from 'react'
import {
	LeaderboardTrend,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
} from '@toolcase/react-components'

const trio = (
	<div style={{ display: 'flex', gap: 24, alignItems: 'center', justifyContent: 'center' }}>
		<LeaderboardTrend value="84" direction="up" />
		<LeaderboardTrend value="12" direction="down" />
		<LeaderboardTrend value="0" direction="flat" />
	</div>
)

const LeaderboardTrendDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
					chips={<RichPageHeaderChip>Game Jam / Arcade</RichPageHeaderChip>}
					title="LeaderboardTrend"
					description="Inline trend pill — green ▲ up / red ▼ down / dim — flat. Used inside Leaderboard rows; usable standalone for any delta indicator."
				/>
				<div className="d-flex flex-column gap-4 mt-4">
					<SectionCard title="All three directions">{trio}</SectionCard>

					<SectionCard title="Inline with sample row">
						<div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 80px', gap: 14, fontFamily: 'var(--tc-font-family-mono)', fontSize: 13 }}>
							<span>Rank 7</span>
							<span>vex.kbd</span>
							<LeaderboardTrend value="44" direction="up" />
						</div>
					</SectionCard>

					<SectionCard title="Neon theme">
						<div className="theme theme--neon" style={{ padding: 32 }}>{trio}</div>
					</SectionCard>
				</div>
			</div>
		</div>
	</div>
)

export default LeaderboardTrendDemo
