import React from 'react'
import {
	PhaseGrid,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
} from '@toolcase/react-components'

const phases = [
	{ num: '01', title: 'Sprint open', body: 'Fresh Sprint row in state announce; dropDeadline +14 days.', tag: 'Done', command: '/sprint open', status: 'done' as const },
	{ num: '02', title: 'Pool setup', body: 'Genre + theme pools scoped from the master taxonomy.', tag: 'Done', command: '/sprint set-pool', status: 'done' as const },
	{ num: '03', title: 'Roll briefs', body: 'RNG seeded, easy + medium + optional hard drawn.', tag: 'Done', command: '/sprint roll-briefs', status: 'done' as const },
	{ num: '04', title: 'Register · Submit', body: 'Devs register games, submit/replace builds.', tag: 'Now', command: '/register-game · /submit-build', status: 'lit' as const },
	{ num: '05', title: 'Attest · Flag', body: 'Devs attest each brief; community can flag non-compliance.', tag: 'Now', command: '/attest-brief', status: 'lit' as const },
	{ num: '06', title: 'Sprint close', body: 'Miss tracking walks every game. Two strikes → abandoned.', tag: 'Upcoming', command: '/sprint close' },
	{ num: '07', title: 'Finals', body: 'After ≥4 personal sprints, lock the game into finals.', tag: 'Upcoming', command: '/declare-final' },
	{ num: '08', title: 'Withdraw · Pause', body: 'Permanent exit with cooldown, or one-quarter pause.', tag: 'Any-time', command: '/withdraw · /pause-sprint' },
	{ num: '09', title: 'Community score', body: 'Continuous. Messages, reactions, threads — caps applied.', tag: 'Continuous', command: '// ScoringService', status: 'continuous' as const },
	{ num: '10', title: 'Tier promotion', body: '90-day rolling points vs thresholds.', tag: 'Continuous', command: '// PromotionService', status: 'continuous' as const },
	{ num: '11', title: 'Nightly maint', body: '03:00 UTC. Decay recompute + role drift reconcile.', tag: 'Nightly', command: '// MaintenanceService', status: 'continuous' as const },
	{ num: '12', title: 'Onboarding', body: 'New member joins → User row inserted, default tier.', tag: 'On-join', command: '// NewMemberAction', status: 'continuous' as const },
]

const PhaseGridDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
					chips={<RichPageHeaderChip>Game Jam / Arcade</RichPageHeaderChip>}
					title="PhaseGrid"
					description="Grid of phase cells with prominent ordinal number, title, body, side tag, and inline command. Status drives the cell variant."
				/>
				<div className="d-flex flex-column gap-4 mt-4">
					<SectionCard title="12-phase pipeline (4 columns)">
						<PhaseGrid phases={phases} />
					</SectionCard>

					<SectionCard title="3-column compact pipeline">
						<PhaseGrid
							columns={3}
							phases={[
								{ num: '01', title: 'Plan', body: 'Define brief and objectives.', tag: 'Done', status: 'done' },
								{ num: '02', title: 'Execute', body: 'Implementation loop with daily check-ins.', tag: 'Now', status: 'lit' },
								{ num: '03', title: 'Ship', body: 'Rollout with monitored deploy.', tag: 'Upcoming' },
							]}
						/>
					</SectionCard>

					<SectionCard title="Neon theme">
						<div className="theme theme--neon" style={{ padding: 24 }}>
							<PhaseGrid phases={phases} />
						</div>
					</SectionCard>
				</div>
			</div>
		</div>
	</div>
)

export default PhaseGridDemo
