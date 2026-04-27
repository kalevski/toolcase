import React from 'react'
import {
	Card,
	CodeSnippet,
	Comparator,
	type ComparatorFeature,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
} from '@toolcase/react-components'

const reactVsVue: ComparatorFeature[] = [
	{
		name: 'Rendering Model',
		description: 'How the framework reconciles UI updates.',
		left: 'Virtual DOM diffing',
		right: 'Reactive proxies + VDOM',
		winner: 'right',
	},
	{
		name: 'Bundle Size (gzipped)',
		description: 'Approximate runtime cost shipped to clients.',
		left: 44,
		right: 34,
		leftLabel: '44 KB',
		rightLabel: '34 KB',
		lowerIsBetter: true,
	},
	{
		name: 'Built-in State Management',
		description: 'Provided out of the box without extra libraries.',
		left: false,
		right: true,
	},
	{
		name: 'TypeScript-first DX',
		description: 'Type inference quality and ergonomic APIs.',
		left: true,
		right: true,
	},
	{
		name: 'Ecosystem Size',
		description: 'Number of mature third-party packages and tooling.',
		left: 100,
		right: 65,
		leftLabel: 'Massive',
		rightLabel: 'Large',
	},
	{
		name: 'Learning Curve',
		description: 'Time to productive contribution.',
		left: 'Steeper',
		right: 'Gentler',
		winner: 'right',
	},
]

const dbBenchmark: ComparatorFeature[] = [
	{
		name: 'Read Throughput (ops/sec)',
		left: 18000,
		right: 24500,
		leftLabel: '18K ops/s',
		rightLabel: '24.5K ops/s',
	},
	{
		name: 'P99 Latency',
		left: 12,
		right: 9,
		leftLabel: '12 ms',
		rightLabel: '9 ms',
		lowerIsBetter: true,
	},
	{
		name: 'Horizontal Scaling',
		left: true,
		right: true,
	},
	{
		name: 'Native JSON Indexing',
		left: false,
		right: true,
	},
	{
		name: 'Cost / Million Reads',
		left: 0.42,
		right: 0.31,
		leftLabel: '$0.42',
		rightLabel: '$0.31',
		lowerIsBetter: true,
		highlight: true,
	},
]

const ComparatorDemo: React.FC = () => {
	return (
		<div className="container py-4">
			<div className="row">
				<div className="col-12">
					<RichPageHeader
						chips={<RichPageHeaderChip>Composite Components</RichPageHeaderChip>}
						title="Comparator"
						description="Side-by-side comparison of two technologies across multiple features. Auto-detects winners from booleans and numbers, supports per-row overrides, and shows an aggregate summary."
					/>
					<div className="d-flex flex-column gap-4 mt-4">
						<SectionCard title="Default — React vs Vue">
							<Comparator
								title="React vs Vue"
								description="A high-level comparison across rendering, bundle size, ecosystem, and DX."
								left={{
									name: 'React',
									tagline: 'A UI library for component-driven apps',
									iconName: 'lightning-charge-fill',
									accentColor: '#61dafb',
								}}
								right={{
									name: 'Vue',
									tagline: 'The progressive JavaScript framework',
									iconName: 'gem',
									accentColor: '#42b883',
								}}
								features={reactVsVue}
								showSummary
							/>
						</SectionCard>

						<SectionCard title="Numeric benchmark with explicit summary">
							<Comparator
								title="Postgres vs CockroachDB"
								description="Benchmark snapshot for read-heavy workloads at production scale."
								left={{
									name: 'Postgres',
									tagline: 'Battle-tested relational database',
									iconName: 'database-fill',
									accentColor: '#336791',
								}}
								right={{
									name: 'CockroachDB',
									tagline: 'Distributed SQL with native sharding',
									iconName: 'diagram-3-fill',
									accentColor: '#6933ff',
								}}
								features={dbBenchmark}
								showSummary
							/>
						</SectionCard>

						<SectionCard title="Without summary (compact)">
							<Comparator
								left={{ name: 'Option A' }}
								right={{ name: 'Option B' }}
								features={[
									{ name: 'Free Tier', left: true, right: false },
									{ name: 'Open Source', left: true, right: true },
									{ name: 'Self-host Friendly', left: true, right: false },
								]}
							/>
						</SectionCard>

						<SectionCard title="Loading state">
							<Comparator
								left={{ name: '' }}
								right={{ name: '' }}
								features={[]}
								loading
								loadingCount={4}
							/>
						</SectionCard>

						<Card>
							<h2 className="h5 mb-3">Minimal usage</h2>
							<CodeSnippet
								language="typescript"
								code={`import { Comparator, type ComparatorFeature } from '@toolcase/react-components'

const features: ComparatorFeature[] = [
    { name: 'Bundle size', left: 44, right: 34, lowerIsBetter: true },
    { name: 'Built-in store', left: false, right: true },
    { name: 'TypeScript DX', left: true, right: true },
]

<Comparator
    title="React vs Vue"
    left={{ name: 'React', iconName: 'lightning-charge-fill' }}
    right={{ name: 'Vue', iconName: 'gem' }}
    features={features}
    showSummary
/>`}
							/>
						</Card>
					</div>
				</div>
			</div>
		</div>
	)
}

export default ComparatorDemo
