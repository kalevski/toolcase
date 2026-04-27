import React from 'react'
import { CodeWithOutput, RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const CodeWithOutputDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
					chips={<RichPageHeaderChip>Installation</RichPageHeaderChip>}
					title="CodeWithOutput"
					description="Side-by-side code and console output."
				/>
				<div className="d-flex flex-column gap-3 mt-4">
					<SectionCard title="Split">
						<CodeWithOutput
							code={`console.log('Hello, world')\nconsole.log(42 + 8)`}
							output={`Hello, world\n50`}
						/>
					</SectionCard>
					<SectionCard title="Stacked">
						<CodeWithOutput
							layout="stacked"
							language="bash"
							code="npm test"
							output={`✓ src/parse.test.ts (4 tests)\n✓ src/format.test.ts (3 tests)\nTest Files  2 passed`}
						/>
					</SectionCard>
				</div>
			</div>
		</div>
	</div>
)

export default CodeWithOutputDemo
