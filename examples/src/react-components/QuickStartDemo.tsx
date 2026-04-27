import React from 'react'
import { QuickStart, RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const QuickStartDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
					chips={<RichPageHeaderChip>Installation</RichPageHeaderChip>}
					title="QuickStart"
					description="Numbered vertical steps with embedded code blocks."
				/>
				<div className="d-flex flex-column gap-3 mt-4">
					<SectionCard title="3-step start">
						<QuickStart
							steps={[
								{ title: 'Install', description: 'Add the package to your project.', code: 'npm install @your/package', language: 'bash' },
								{ title: 'Import', description: 'Pull in what you need.', code: "import { Server } from '@your/package'", language: 'typescript' },
								{ title: 'Run', description: 'Start your server.', code: 'new Server().listen(3000)', language: 'typescript' },
							]}
						/>
					</SectionCard>
				</div>
			</div>
		</div>
	</div>
)

export default QuickStartDemo
