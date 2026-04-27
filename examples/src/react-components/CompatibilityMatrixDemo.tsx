import React from 'react'
import { CompatibilityMatrix, RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const CompatibilityMatrixDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
					chips={<RichPageHeaderChip>Features & API</RichPageHeaderChip>}
					title="CompatibilityMatrix"
					description="Versions × platforms support grid with legend."
				/>
				<div className="d-flex flex-column gap-3 mt-4">
					<SectionCard title="Node.js support">
						<CompatibilityMatrix
							versions={['18.x', '20.x', '22.x', '24.x']}
							platforms={['Linux', 'macOS', 'Windows']}
							support={{
								'18.x': { Linux: 'deprecated', macOS: 'deprecated', Windows: 'deprecated' },
								'20.x': { Linux: 'supported', macOS: 'supported', Windows: 'supported' },
								'22.x': { Linux: 'supported', macOS: 'supported', Windows: 'supported' },
								'24.x': { Linux: 'planned', macOS: 'planned', Windows: 'unsupported' },
							}}
						/>
					</SectionCard>
				</div>
			</div>
		</div>
	</div>
)

export default CompatibilityMatrixDemo
