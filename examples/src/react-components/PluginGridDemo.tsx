import React from 'react'
import { PluginGrid, RichPageHeader, RichPageHeaderChip, SectionCard, Icon } from '@toolcase/react-components'

const PluginGridDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
					chips={<RichPageHeaderChip>Ecosystem & Community</RichPageHeaderChip>}
					title="PluginGrid"
					description="Third-party plugins/integrations as clickable cards."
				/>
				<div className="d-flex flex-column gap-3 mt-4">
					<SectionCard title="Plugins">
						<PluginGrid
							items={[
								{ name: '@your/auth', logo: <Icon name="shield-lock-fill" />, description: 'JWT, OAuth2, sessions out of the box.', installCommand: 'npm i @your/auth', href: '#', official: true, downloads: 124000 },
								{ name: '@your/cache', logo: <Icon name="lightning-fill" />, description: 'In-memory and Redis-backed caching.', installCommand: 'npm i @your/cache', href: '#', downloads: 56000 },
								{ name: '@your/queue', logo: <Icon name="list-task" />, description: 'Background jobs with retry and rate-limiting.', installCommand: 'npm i @your/queue', href: '#', downloads: 32000 },
							]}
						/>
					</SectionCard>
				</div>
			</div>
		</div>
	</div>
)

export default PluginGridDemo
