import React from 'react'
import { EcosystemMap, RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const EcosystemMapDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
					chips={<RichPageHeaderChip>Ecosystem & Community</RichPageHeaderChip>}
					title="EcosystemMap"
					description="Concentric ring layout showing core + plugin packages."
				/>
				<div className="d-flex flex-column gap-3 mt-4">
					<SectionCard title="Radial layout">
						<EcosystemMap
							core={{ name: '@your/core', label: 'core' }}
							rings={[
								{ label: 'Official', items: [{ name: '@your/auth' }, { name: '@your/cache' }, { name: '@your/queue' }, { name: '@your/router' }] },
								{ label: 'Community', items: [{ name: 'lib-x' }, { name: 'lib-y' }, { name: 'lib-z' }, { name: 'lib-foo' }, { name: 'lib-bar' }, { name: 'lib-baz' }] },
							]}
						/>
					</SectionCard>
				</div>
			</div>
		</div>
	</div>
)

export default EcosystemMapDemo
