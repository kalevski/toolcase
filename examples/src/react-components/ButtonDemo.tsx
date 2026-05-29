import React, { useState } from 'react'
import {
	Button,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

const ButtonDemo: React.FC = () => {
	const [saving, setSaving] = useState(false)
	const [confirmed, setConfirmed] = useState<boolean | null>(null)

	const simulateSave = () => {
		setSaving(true)
		setTimeout(() => setSaving(false), 1200)
	}

	return (
		<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Buttons & Actions</RichPageHeaderChip>}
				title="Button"
				description={
				<>
					The workhorse action element. Six semantic <code>variant</code>s, three{' '}
					<code>size</code>s, optional <code>outline</code> modifier, plus <code>disabled</code> and
					<code> loading</code> states. Wraps a real <code>&lt;button&gt;</code> so every native event
					(and <code>aria-*</code>) works.
				</>
			}
			/>
				<div className="d-flex flex-column gap-4 mt-4">
			<SectionCard title="Variants">
				<div>
					<Button variant="primary">Save changes</Button>
					<Button variant="secondary">Cancel</Button>
					<Button variant="success">Publish</Button>
					<Button variant="info">View details</Button>
					<Button variant="warning">Unsaved</Button>
					<Button variant="danger">Delete project</Button>
				</div>
				<div>
					<Button variant="primary" outline>Save changes</Button>
					<Button variant="secondary" outline>Cancel</Button>
					<Button variant="success" outline>Publish</Button>
					<Button variant="info" outline>View details</Button>
					<Button variant="warning" outline>Unsaved</Button>
					<Button variant="danger" outline>Delete project</Button>
				</div>
			</SectionCard>

			<SectionCard title="Sizes">
				<div>
					<Button variant="primary" size="small">Save</Button>
					<Button variant="secondary" size="small" outline>Cancel</Button>
				</div>
				<div>
					<Button variant="primary">Save</Button>
					<Button variant="secondary" outline>Cancel</Button>
				</div>
				<div>
					<Button variant="primary" size="large">Save</Button>
					<Button variant="secondary" size="large" outline>Cancel</Button>
				</div>
			</SectionCard>

			<SectionCard title="Disabled">
				<div>
					<Button variant="primary" disabled>Save changes</Button>
					<Button variant="danger" disabled>Delete</Button>
				</div>
				<div>
					<Button variant="primary" outline disabled>Save changes</Button>
					<Button variant="danger" outline disabled>Delete</Button>
				</div>
			</SectionCard>

			<SectionCard title="Loading">
				<div className="d-flex gap-2 flex-wrap">
					<Button variant="primary" loading>Saving…</Button>
					<Button variant="success" loading>Publishing</Button>
					<Button variant="danger" outline loading>Deleting</Button>
				</div>
			</SectionCard>

			<SectionCard title="With icons">
				<div className="d-flex gap-2 flex-wrap">
					<Button variant="primary" startIcon={<span aria-hidden>＋</span>}>New item</Button>
					<Button variant="secondary" outline endIcon={<span aria-hidden>→</span>}>Next</Button>
					<Button variant="danger" outline startIcon={<span aria-hidden>🗑</span>}>Delete</Button>
				</div>
			</SectionCard>

			<SectionCard title="Full width">
				<Button variant="primary" fullWidth>Continue</Button>
			</SectionCard>

			<SectionCard title="Save flow">
				<div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
					<Button variant="secondary" outline onClick={() => setConfirmed(false)}>Cancel</Button>
					<Button variant="primary" onClick={simulateSave} loading={saving}>
						{saving ? 'Saving…' : 'Save changes'}
					</Button>
				</div>
				{confirmed === false && (
					<p style={{ marginTop: 12, color: '#64748b', fontSize: '0.85rem' }}>
						Cancel was clicked — in a real dialog this would call <code>onClose()</code>.
					</p>
				)}
			</SectionCard>
		</div>
		
			</div>
		</div>
	</div>
	)
}

export default ButtonDemo
