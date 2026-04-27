import React from 'react'
import { MaintainerCard, RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const MaintainerCardDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
					chips={<RichPageHeaderChip>Ecosystem & Community</RichPageHeaderChip>}
					title="MaintainerCard"
					description="Profile card for project maintainers with social links and sponsor CTA."
				/>
				<div className="d-flex flex-column gap-3 mt-4">
					<SectionCard title="Profile">
						<MaintainerCard
							name="Daniel Kalevski"
							avatarUrl="https://i.pravatar.cc/200?img=12"
							role="Lead Maintainer"
							location="Skopje, MK"
							bio="Building tools for Node.js since 2015. Open source enthusiast."
							links={[
								{ kind: 'github', href: '#' },
								{ kind: 'x', href: '#' },
								{ kind: 'website', href: '#' },
							]}
							sponsorHref="#"
						/>
					</SectionCard>
				</div>
			</div>
		</div>
	</div>
)

export default MaintainerCardDemo
