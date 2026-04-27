import React from 'react'
import { CookbookGrid, RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const CookbookGridDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
					chips={<RichPageHeaderChip>Features & API</RichPageHeaderChip>}
					title="CookbookGrid"
					description="Recipe cards with title, short description, and an embedded code snippet."
				/>
				<div className="d-flex flex-column gap-3 mt-4">
					<SectionCard title="Recipes">
						<CookbookGrid
							recipes={[
								{ title: 'Basic server', description: 'Spin up a server in three lines.', tags: ['server', 'http'], language: 'javascript', code: "import { serve } from 'lib'\nserve({ port: 3000 })" },
								{ title: 'Auth middleware', description: 'Validate JWT tokens on incoming requests.', tags: ['auth', 'middleware'], language: 'typescript', code: "app.use(authMiddleware({ secret: 'shh' }))" },
								{ title: 'WebSocket', description: 'Bidirectional realtime channel.', tags: ['websocket', 'realtime'], language: 'typescript', code: "ws.on('message', (msg) => ws.send('echo: ' + msg))" },
							]}
						/>
					</SectionCard>
				</div>
			</div>
		</div>
	</div>
)

export default CookbookGridDemo
