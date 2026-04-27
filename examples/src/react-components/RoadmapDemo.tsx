import React from 'react'
import { Roadmap, RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const RoadmapDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
					chips={<RichPageHeaderChip>Roadmap & Releases</RichPageHeaderChip>}
					title="Roadmap"
					description="Public roadmap split into status columns."
				/>
				<div className="d-flex flex-column gap-3 mt-4">
					<SectionCard title="Kanban">
						<Roadmap
							columns={[
								{ status: 'shipped', items: [
									{ title: 'TypeScript rewrite', description: 'Full TS port with strict mode.', href: '#' },
									{ title: 'New plugin API', href: '#' },
								]},
								{ status: 'in-progress', items: [
									{ title: 'WebSocket support', eta: 'Q2', href: '#' },
									{ title: 'Streaming responses', eta: 'Q2' },
								]},
								{ status: 'planned', items: [
									{ title: 'Edge runtime', eta: 'Q3' },
									{ title: 'Built-in auth', eta: 'Q3' },
								]},
								{ status: 'considering', items: [
									{ title: 'GraphQL adapter' },
									{ title: 'Native SSE' },
								]},
							]}
						/>
					</SectionCard>
				</div>
			</div>
		</div>
	</div>
)

export default RoadmapDemo
