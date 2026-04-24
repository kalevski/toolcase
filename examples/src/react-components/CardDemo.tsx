import React from 'react'
import {
	Badge,
	Button,
	Card,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

const CardDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Layout & Surfaces</RichPageHeaderChip>}
				title="Card"
				description={
			<>
				A neutral surface container with an optional <code>header</code> and a semantic{' '}
				<code>variant</code>. Cards hold a single concern — settings group, a metric, a form
				section — and compose naturally in grids and dashboards.
			</>
		}
			/>
				<div className="d-flex flex-column gap-4 mt-4">
		<SectionCard title="Plain content">
			<div style={{display: 'grid', gap: 16, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'}}>
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
			</div>
		</SectionCard>

		<SectionCard title="With controls">
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
		</SectionCard>

		<SectionCard title="Colored variants">
			<div style={{display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))'}}>
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
			</div>
		</SectionCard>
	</div>
		
			</div>
		</div>
	</div>
)

export default CardDemo
