import React from 'react'
import { CommandReference, RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const CommandReferenceDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
					chips={<RichPageHeaderChip>Features & API</RichPageHeaderChip>}
					title="CommandReference"
					description="Searchable CLI command list with usage, flags, and descriptions."
				/>
				<div className="d-flex flex-column gap-3 mt-4">
					<SectionCard title="CLI commands">
						<CommandReference
							commands={[
								{ name: 'init', usage: 'mycli init [name]', description: 'Scaffold a new project.', flags: [{ name: '--template', description: 'Template to use', default: 'basic' }, { name: '--ts', description: 'Use TypeScript' }] },
								{ name: 'build', usage: 'mycli build [target]', description: 'Build the project for production.', flags: [{ name: '--minify', description: 'Minify output', default: 'true' }] },
								{ name: 'dev', aliases: ['serve'], usage: 'mycli dev', description: 'Start the dev server with HMR.' },
								{ name: 'test', usage: 'mycli test [pattern]', description: 'Run the test suite.' },
							]}
						/>
					</SectionCard>
				</div>
			</div>
		</div>
	</div>
)

export default CommandReferenceDemo
