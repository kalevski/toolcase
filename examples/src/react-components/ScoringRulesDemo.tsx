import React from 'react'
import {
	RichPageHeader,
	RichPageHeaderChip,
	ScoringRules,
	SectionCard,
} from '@toolcase/react-components'

const rules = [
	{ icon: '¶', title: 'General msg · ≥40 chars', description: 'Substantive participation. Bonus +1 if the message picks up two or more replies.', points: '+1', suffix: 'pt' },
	{ icon: '⌘', title: 'Dev-talk', description: 'Code blocks or technical terms in dev-channels. Capped at 8 pts per message.', points: '≤8', suffix: 'pts', accent: 'cyan' as const },
	{ icon: '★', title: 'Showcase reactions', description: 'Logarithmic scaling on unique reactors in forum threads. Capped at 30.', points: '≤30', suffix: 'pts', accent: 'yellow' as const },
	{ icon: '✦', title: 'Auto-feature · 25+', description: 'Triggers feature post and a flat bonus that bypasses the daily cap.', points: '+50', suffix: 'pts', accent: 'green' as const },
	{ icon: '✓', title: 'Helpful answer', description: 'When the original asker reacts with the helpful emoji on your reply.', points: '+5', suffix: 'pts' },
	{ icon: '⊘', title: 'Daily caps', description: '50 pts/day total · sub-cap of 15 from general. Auto-feature bypasses both.', points: '50', suffix: '/day', accent: 'red' as const },
]

const ScoringRulesDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
					chips={<RichPageHeaderChip>Game Jam / Arcade</RichPageHeaderChip>}
					title="ScoringRules"
					description="Vertical stack of rule rows: icon | title + description | points. Optional accent recolors the icon."
				/>
				<div className="d-flex flex-column gap-4 mt-4">
					<SectionCard title="Sprint scoring rules">
						<ScoringRules rules={rules} />
					</SectionCard>

					<SectionCard title="Neon theme">
						<div className="theme theme--neon" style={{ padding: 24 }}>
							<ScoringRules rules={rules} />
						</div>
					</SectionCard>
				</div>
			</div>
		</div>
	</div>
)

export default ScoringRulesDemo
