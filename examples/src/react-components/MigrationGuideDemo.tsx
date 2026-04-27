import React from 'react'
import { MigrationGuide, RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const MigrationGuideDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
					chips={<RichPageHeaderChip>Roadmap & Releases</RichPageHeaderChip>}
					title="MigrationGuide"
					description="Step-by-step old → new code transformations using DiffViewer."
				/>
				<div className="d-flex flex-column gap-3 mt-4">
					<SectionCard title="v1 → v2">
						<MigrationGuide
							from="v1.x"
							to="v2.x"
							steps={[
								{
									title: 'Replace createServer with serve',
									description: 'The factory function was renamed.',
									before: "const app = createServer()\napp.listen(3000)",
									after: "const app = serve()\nawait app.listen(3000)",
									language: 'typescript',
								},
								{
									title: 'Update middleware signature',
									description: 'Middleware now uses async ctx-based handlers.',
									before: "app.use((req, res, next) => {\n    res.send('hi')\n})",
									after: "app.use(async (ctx) => {\n    ctx.body = 'hi'\n})",
									language: 'typescript',
								},
							]}
						/>
					</SectionCard>
				</div>
			</div>
		</div>
	</div>
)

export default MigrationGuideDemo
