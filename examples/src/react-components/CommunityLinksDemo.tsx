import React from 'react'
import { CommunityLinks, RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const CommunityLinksDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
					chips={<RichPageHeaderChip>Ecosystem & Community</RichPageHeaderChip>}
					title="CommunityLinks"
					description="Cards linking to community channels with optional member counts."
				/>
				<div className="d-flex flex-column gap-3 mt-4">
					<SectionCard title="Channels">
						<CommunityLinks
							links={[
								{ kind: 'github', label: 'GitHub Discussions', href: '#', description: 'Q&A and proposals', count: 1240 },
								{ kind: 'discord', label: 'Discord', href: '#', description: 'Real-time chat', count: 8500 },
								{ kind: 'x', label: 'Twitter/X', href: '#', description: 'Updates' },
								{ kind: 'rss', label: 'Blog RSS', href: '#', description: 'New posts' },
							]}
						/>
					</SectionCard>
				</div>
			</div>
		</div>
	</div>
)

export default CommunityLinksDemo
