import React from 'react'
import {
	Leaderboard,
	LeaderboardEntry,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
} from '@toolcase/react-components'

const entries: LeaderboardEntry[] = [
	{ id: '1', rank: 1, displayName: 'vex.kbd', handle: '@vex_kbd · ’23', avatar: 'VK', tierLabel: 'Architect', tierColor: 'red', sprints: 22, trendValue: 84, trendDirection: 'up', points: '2,148' },
	{ id: '2', rank: 2, displayName: 'nullmoss', handle: '@nullmoss', avatar: 'NM', tierLabel: 'Architect', tierColor: 'red', sprints: 19, trendValue: 51, trendDirection: 'up', points: '1,894' },
	{ id: '3', rank: 3, displayName: 'orbit-rat', handle: 'finals ✓', avatar: 'OR', tierLabel: 'Mason', tierColor: 'pink', sprints: 15, trendValue: 12, trendDirection: 'down', points: '1,402' },
	{ id: '4', rank: 4, displayName: 'aft.fern', handle: '@aftfern', avatar: 'AF', tierLabel: 'Mason', tierColor: 'pink', sprints: 12, trendValue: 29, trendDirection: 'up', points: '1,118' },
	{ id: '5', rank: 5, displayName: 'peat.tape', handle: '@peattape', avatar: 'PT', tierLabel: 'Mason', tierColor: 'pink', sprints: 11, trendValue: 44, trendDirection: 'up', points: 964 },
	{ id: '6', rank: 6, displayName: 'shrike.hour', handle: 'paused', avatar: 'SH', tierLabel: 'Mason', tierColor: 'pink', sprints: 9, trendValue: 7, trendDirection: 'down', points: 812 },
	{ id: 'me', rank: 7, displayName: 'You', handle: 'joined sprint 042', avatar: 'YO', tierLabel: 'Journey', tierColor: 'yellow', sprints: 5, trendValue: 63, trendDirection: 'up', points: 412, highlight: true },
	{ id: '8', rank: 8, displayName: 'cold.lichen', handle: '@coldlichen', avatar: 'CL', tierLabel: 'Journey', tierColor: 'yellow', sprints: 6, trendValue: 18, trendDirection: 'up', points: 388 },
	{ id: '9', rank: 9, displayName: 'halfbit.honey', handle: '@halfbit', avatar: 'HB', tierLabel: 'Journey', tierColor: 'yellow', sprints: 4, trendValue: 5, trendDirection: 'down', points: 341 },
	{ id: '10', rank: 10, displayName: 'vault.row', handle: 'withdrawn', avatar: 'VR', tierLabel: 'Apprentice', tierColor: 'cyan', sprints: 2, trendValue: 0, trendDirection: 'flat', points: 298 },
]

const LeaderboardDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
					chips={<RichPageHeaderChip>Game Jam / Arcade</RichPageHeaderChip>}
					title="Leaderboard"
					description="Ranked dev table with rank cell, avatar+handle, tier badge, sprint count, 7-day trend, points. Top-3 ranks color-tinted."
				/>
				<div className="d-flex flex-column gap-4 mt-4">
					<SectionCard title="Top of the hall (90d rolling)">
						<Leaderboard entries={entries} />
					</SectionCard>

					<SectionCard title="Neon theme">
						<div className="theme theme--neon" style={{ padding: 24 }}>
							<Leaderboard entries={entries} />
						</div>
					</SectionCard>
				</div>
			</div>
		</div>
	</div>
)

export default LeaderboardDemo
