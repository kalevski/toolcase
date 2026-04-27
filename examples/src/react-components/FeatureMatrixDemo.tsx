import React from 'react'
import { FeatureMatrix, RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const FeatureMatrixDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
					chips={<RichPageHeaderChip>Features & API</RichPageHeaderChip>}
					title="FeatureMatrix"
					description="Multi-column feature comparison with yes/no/partial values."
				/>
				<div className="d-flex flex-column gap-3 mt-4">
					<SectionCard title="Plans">
						<FeatureMatrix
							columns={[
								{ name: 'Free' },
								{ name: 'Pro', highlight: true, tagline: 'Most popular' },
								{ name: 'Team' },
							]}
							rows={[
								{ feature: 'Projects', values: [3, 'Unlimited', 'Unlimited'] },
								{ feature: 'Custom domains', values: [false, true, true] },
								{ feature: 'SSO / SAML', values: [false, 'partial', true] },
								{ feature: 'Priority support', values: [false, false, true] },
								{ feature: 'API access', values: [true, true, true] },
							]}
						/>
					</SectionCard>
				</div>
			</div>
		</div>
	</div>
)

export default FeatureMatrixDemo
