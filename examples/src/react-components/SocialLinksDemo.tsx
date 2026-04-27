import React from 'react'
import { SocialLinks, RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const links = [
	{ kind: 'github' as const, href: '#' },
	{ kind: 'x' as const, href: '#' },
	{ kind: 'linkedin' as const, href: '#' },
	{ kind: 'youtube' as const, href: '#' },
	{ kind: 'rss' as const, href: '#' },
]

const SocialLinksDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
					chips={<RichPageHeaderChip>Footer & Misc</RichPageHeaderChip>}
					title="SocialLinks"
					description="Icon-only row of social links (ghost/filled, sm/md/lg)."
				/>
				<div className="d-flex flex-column gap-3 mt-4">
					<SectionCard title="Ghost"><SocialLinks links={links} /></SectionCard>
					<SectionCard title="Filled"><SocialLinks links={links} variant="filled" /></SectionCard>
					<SectionCard title="Large"><SocialLinks links={links} size="lg" variant="filled" /></SectionCard>
				</div>
			</div>
		</div>
	</div>
)

export default SocialLinksDemo
