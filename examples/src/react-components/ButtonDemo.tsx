import React, { useState } from 'react'
import { Button } from '@toolcase/react-components'
import { DemoPage, DemoSection, DemoRow } from './_demo'

const ButtonDemo: React.FC = () => {
	const [saving, setSaving] = useState(false)
	const [confirmed, setConfirmed] = useState<boolean | null>(null)

	const simulateSave = () => {
		setSaving(true)
		setTimeout(() => setSaving(false), 1200)
	}

	return (
		<DemoPage
			eyebrow="Buttons & Actions"
			title="Button"
			lede={
				<>
					The workhorse action element. Six semantic <code>variant</code>s, three{' '}
					<code>size</code>s, optional <code>outline</code> modifier, plus <code>disabled</code> and
					<code> loading</code> states. Wraps a real <code>&lt;button&gt;</code> so every native event
					(and <code>aria-*</code>) works.
				</>
			}
		>
			<DemoSection
				eyebrow="Semantic meaning"
				title="Variants"
				caption="Each variant carries a different semantic weight. Prefer primary for the single most important action on a surface, danger for destructive ones, and secondary for neutral actions."
			>
				<DemoRow label="Solid">
					<Button variant="primary">Save changes</Button>
					<Button variant="secondary">Cancel</Button>
					<Button variant="success">Publish</Button>
					<Button variant="info">View details</Button>
					<Button variant="warning">Unsaved</Button>
					<Button variant="danger">Delete project</Button>
				</DemoRow>
				<DemoRow label="Outline">
					<Button variant="primary" outline>Save changes</Button>
					<Button variant="secondary" outline>Cancel</Button>
					<Button variant="success" outline>Publish</Button>
					<Button variant="info" outline>View details</Button>
					<Button variant="warning" outline>Unsaved</Button>
					<Button variant="danger" outline>Delete project</Button>
				</DemoRow>
			</DemoSection>

			<DemoSection
				eyebrow="Form density"
				title="Sizes"
				caption="Match the input scale around the button. Small for dense tables, default for most forms, large for hero CTAs."
			>
				<DemoRow label="Small">
					<Button variant="primary" size="small">Save</Button>
					<Button variant="secondary" size="small" outline>Cancel</Button>
				</DemoRow>
				<DemoRow label="Default">
					<Button variant="primary">Save</Button>
					<Button variant="secondary" outline>Cancel</Button>
				</DemoRow>
				<DemoRow label="Large">
					<Button variant="primary" size="large">Save</Button>
					<Button variant="secondary" size="large" outline>Cancel</Button>
				</DemoRow>
			</DemoSection>

			<DemoSection
				eyebrow="State"
				title="Disabled"
				caption="Disabled buttons are non-interactive and non-focusable. Use when the action isn't available yet — not to hide it from the user."
			>
				<DemoRow label="Solid">
					<Button variant="primary" disabled>Save changes</Button>
					<Button variant="danger" disabled>Delete</Button>
				</DemoRow>
				<DemoRow label="Outline">
					<Button variant="primary" outline disabled>Save changes</Button>
					<Button variant="danger" outline disabled>Delete</Button>
				</DemoRow>
			</DemoSection>

			<DemoSection
				eyebrow="Realistic usage"
				title="Save flow"
				caption="A pair of buttons in a dialog footer. Click “Save” to simulate a 1.2s async request — the button disables while the save is in flight."
			>
				<div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
					<Button variant="secondary" outline onClick={() => setConfirmed(false)}>Cancel</Button>
					<Button variant="primary" onClick={simulateSave} disabled={saving}>
						{saving ? 'Saving…' : 'Save changes'}
					</Button>
				</div>
				{confirmed === false && (
					<p style={{ marginTop: 12, color: '#64748b', fontSize: '0.85rem' }}>
						Cancel was clicked — in a real dialog this would call <code>onClose()</code>.
					</p>
				)}
			</DemoSection>
		</DemoPage>
	)
}

export default ButtonDemo
