import React from 'react'
import { DiffViewer, RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const before = `function greet(name) {
    return 'Hello, ' + name
}`
const after = `function greet(name: string): string {
    return \`Hello, \${name}\`
}`

const DiffViewerDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
					chips={<RichPageHeaderChip>Installation</RichPageHeaderChip>}
					title="DiffViewer"
					description="Before/after code diff with red/green line highlighting."
				/>
				<div className="d-flex flex-column gap-3 mt-4">
					<SectionCard title="Split mode">
						<DiffViewer before={before} after={after} language="typescript" filename="greet.ts" />
					</SectionCard>
					<SectionCard title="Unified mode">
						<DiffViewer before={before} after={after} mode="unified" language="typescript" />
					</SectionCard>
				</div>
			</div>
		</div>
	</div>
)

export default DiffViewerDemo
