import React from 'react'
import { Card, Button, Badge, CodeSnippet } from '@toolcase/react-components'
import { DemoPage, DemoSection, DemoGrid } from './_demo'

const CardDemo: React.FC = () => (
	<DemoPage
		eyebrow="Layout & Surfaces"
		title="Card"
		lede={
			<>
				A neutral surface container with an optional <code>header</code> and a semantic{' '}
				<code>variant</code>. Cards hold a single concern — settings group, a metric, a form
				section — and compose naturally in grids and dashboards.
			</>
		}
	>
		<DemoSection
			eyebrow="Default"
			title="Plain content"
			caption="The bread-and-butter use: a neutral 1px-bordered surface to group related content."
		>
			<DemoGrid columns={2} minItemWidth={280}>
				<Card>
					<p style={{ margin: 0 }}>
						A plain card without a header. Use this when the heading is already established by
						the surrounding page.
					</p>
				</Card>
				<Card header="Project settings">
					<p style={{ margin: 0 }}>
						Headered cards are the workhorse — they call out the concern the card handles.
					</p>
				</Card>
			</DemoGrid>
		</DemoSection>

		<DemoSection
			eyebrow="Composition"
			title="With controls"
			caption="Cards compose with any other component. Here a header names the section, the body holds the detail, and a footer-shaped row closes with actions."
		>
			<Card header="API key · rotation">
				<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
					<p style={{ margin: 0, color: '#475569', fontSize: '0.9rem' }}>
						Rotate your production API key. The old key stays valid for 24h to give clients time
						to pick up the new one.
					</p>
					<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
						<code
							style={{
								flex: 1,
								padding: '8px 10px',
								background: '#f8fafc',
								border: '1px solid #e2e8f0',
								fontFamily: 'monospace',
								fontSize: '0.82rem',
								color: '#475569',
							}}
						>
							wg_live_•••••••••••••••••••••a3f9
						</code>
						<Badge variant="warning">Last rotated 48d ago</Badge>
					</div>
					<div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
						<Button variant="secondary" outline size="small">Reveal</Button>
						<Button variant="primary" size="small">Rotate key</Button>
					</div>
				</div>
			</Card>
		</DemoSection>

		<DemoSection
			eyebrow="Semantics"
			title="Colored variants"
			caption="Colored variants emphasize a card's severity. Reserve for at-a-glance dashboards — most cards should stay neutral."
		>
			<DemoGrid minItemWidth={180}>
				<Card variant="primary" header="Primary">
					<span style={{ color: 'inherit', opacity: 0.92 }}>Headline metric or CTA.</span>
				</Card>
				<Card variant="info" header="Info">
					<span style={{ color: 'inherit', opacity: 0.92 }}>Neutral announcement.</span>
				</Card>
				<Card variant="success" header="Success">
					<span style={{ color: 'inherit', opacity: 0.92 }}>Positive status.</span>
				</Card>
				<Card variant="warning" header="Warning">
					<span style={{ color: 'inherit', opacity: 0.92 }}>Attention needed.</span>
				</Card>
				<Card variant="danger" header="Danger">
					<span style={{ color: 'inherit', opacity: 0.92 }}>Blocking problem.</span>
				</Card>
				<Card variant="secondary" header="Secondary">
					<span style={{ color: 'inherit', opacity: 0.92 }}>Muted emphasis.</span>
				</Card>
			</DemoGrid>
		</DemoSection>

		<DemoSection eyebrow="API" title="Usage">
			<CodeSnippet
				language="typescript"
				code={`import { Card } from '@toolcase/react-components'

<Card header="Project settings">
  Card content goes here.
</Card>

<Card variant="warning" header="Storage">
  82% of 10 GB used.
</Card>`}
			/>
		</DemoSection>
	</DemoPage>
)

export default CardDemo
