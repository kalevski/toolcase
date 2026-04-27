import React from 'react'
import { BenchmarkChart, RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const BenchmarkChartDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
					chips={<RichPageHeaderChip>Performance</RichPageHeaderChip>}
					title="BenchmarkChart"
					description="Horizontal bar chart for performance comparisons."
				/>
				<div className="d-flex flex-column gap-3 mt-4">
					<SectionCard title="Throughput (higher is better)">
						<BenchmarkChart
							bars={[
								{ label: '@your/server', value: 124000, unit: 'req/s' },
								{ label: 'fastify', value: 102000, unit: 'req/s' },
								{ label: 'koa', value: 78000, unit: 'req/s' },
								{ label: 'express', value: 41000, unit: 'req/s', baseline: true },
							]}
						/>
					</SectionCard>
					<SectionCard title="P99 latency (lower is better)">
						<BenchmarkChart
							lowerIsBetter
							bars={[
								{ label: '@your/server', value: 8 },
								{ label: 'fastify', value: 11 },
								{ label: 'express', value: 24 },
							]}
						/>
					</SectionCard>
				</div>
			</div>
		</div>
	</div>
)

export default BenchmarkChartDemo
