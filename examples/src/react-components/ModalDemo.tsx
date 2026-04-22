import { useState } from 'react'
import { Modal, Button, IconButton, Input, Alert, CodeSnippet } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

export function ModalDemo() {
	return (
		<DemoPage
			eyebrow="Overlays"
			title="Modal"
			lede={
				<>
					A context-based modal system. Modals are declared once via <code>Modal.Window</code>,
					opened imperatively with <code>useModalOpen(key)</code>, and can receive payloads on
					open and return results on close. Supports nesting, focus trap, and <code>Escape</code>{' '}
					to close.
				</>
			}
		>
			<Modal.ModalContext>
				<ModalExamples />
				<ModalDefinitions />
			</Modal.ModalContext>

			<DemoSection eyebrow="API" title="Usage">
				<CodeSnippet
					language="typescript"
					code={`import { Modal, Button } from '@toolcase/react-components'

// 1. Wrap your app (or section) in ModalContext
<Modal.ModalContext>
  <OpenButton />
  <Modal.ModalRender>
    <Modal.Window key="edit-user" size="medium">
      <EditUserModal />
    </Modal.Window>
  </Modal.ModalRender>
</Modal.ModalContext>

// 2. Open imperatively with a payload; receive a result on close
const openEditUser = Modal.useModalOpen('edit-user', (result) => {
  if (result?.saved) refresh()
})
openEditUser({ userId: 123 })

// 3. Inside the modal, read the payload and close with a result
const input = Modal.useModalInput<{ userId: number }>()
const close = Modal.useModalClose()
close({ saved: true })`}
				/>
			</DemoSection>
		</DemoPage>
	)
}

function ModalExamples() {
	const [result, setResult] = useState<string>('')

	const openSimple = Modal.useModalOpen('demo-simple')
	const openWithData = Modal.useModalOpen<{ saved: boolean; name?: string }>('demo-user', (payload) => {
		setResult(
			payload?.saved
				? `Saved user: ${payload.name}`
				: 'User modal was cancelled',
		)
	})
	const openConfirm = Modal.useModalOpen<boolean>('demo-confirm', (confirmed) => {
		setResult(confirmed ? 'Confirmed delete' : 'Delete cancelled')
	})
	const openNested = Modal.useModalOpen('demo-nested-a')
	const closeAll = Modal.useModalCloseAll()

	return (
		<>
			<DemoSection
				eyebrow="Triggers"
				title="Open modals imperatively"
				caption="Each button calls a hook returned from useModalOpen(key). The hook takes an optional payload and an optional callback invoked when the modal closes."
			>
				<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
					<Button variant="primary" onClick={() => openSimple()}>
						Simple modal
					</Button>
					<Button variant="secondary" onClick={() => openWithData({ userId: 123, name: 'Rei Kuroda' })}>
						Modal with payload
					</Button>
					<Button variant="danger" outline onClick={() => openConfirm()}>
						Confirm delete
					</Button>
					<Button variant="info" outline onClick={() => openNested()}>
						Nested modals
					</Button>
					<Button variant="secondary" outline onClick={() => closeAll()}>
						Close all
					</Button>
				</div>
				{result && (
					<div style={{ marginTop: 12 }}>
						<Alert variant="info">
							<strong>Result:</strong> {result}
						</Alert>
					</div>
				)}
			</DemoSection>
		</>
	)
}

function ModalDefinitions() {
	return (
		<Modal.ModalRender>
			<Modal.Window key="demo-simple" size="medium">
				<SimpleModal />
			</Modal.Window>
			<Modal.Window key="demo-user" size="medium">
				<EditUserModal />
			</Modal.Window>
			<Modal.Window key="demo-confirm" size="small">
				<ConfirmDeleteModal />
			</Modal.Window>
			<Modal.Window key="demo-nested-a" size="medium">
				<NestedA />
			</Modal.Window>
			<Modal.Window key="demo-nested-b" size="large">
				<NestedB />
			</Modal.Window>
		</Modal.ModalRender>
	)
}

function SimpleModal() {
	const close = Modal.useModalClose()
	return (
		<div>
			<div className="modal-header">
				<h5 className="modal-title">Release notes</h5>
				<IconButton icon="x-lg" size="small" onClick={() => close()} aria-label="Close" />
			</div>
			<div className="modal-body">
				<p style={{ marginTop: 0 }}>Version <code>2.3.0</code> is live.</p>
				<ul style={{ paddingLeft: '1.25rem', marginBottom: 0, color: '#475569' }}>
					<li>Asset bundles can now target multiple platforms in one build.</li>
					<li>Schema editor gained an undo/redo stack.</li>
					<li>Team roles can be scoped per project.</li>
				</ul>
			</div>
			<div className="modal-footer">
				<Button variant="primary" onClick={() => close()}>Got it</Button>
			</div>
		</div>
	)
}

function EditUserModal() {
	const input = Modal.useModalInput<{ userId: number; name: string }>()
	const close = Modal.useModalClose()
	const [name, setName] = useState(input?.name || '')

	return (
		<div>
			<div className="modal-header">
				<h5 className="modal-title">Edit team member</h5>
				<IconButton icon="x-lg" size="small" onClick={() => close({ saved: false })} aria-label="Close" />
			</div>
			<div className="modal-body">
				<p style={{ marginTop: 0, color: '#64748b', fontSize: '0.85rem' }}>
					User ID: <code>{input?.userId}</code>
				</p>
				<Input
					label="Display name"
					id="demo-modal-name"
					value={name}
					onChange={(e) => setName(e.target.value)}
				/>
			</div>
			<div className="modal-footer">
				<Button variant="secondary" outline onClick={() => close({ saved: false })}>Cancel</Button>
				<Button variant="primary" onClick={() => close({ saved: true, name })}>Save</Button>
			</div>
		</div>
	)
}

function ConfirmDeleteModal() {
	const close = Modal.useModalClose()
	return (
		<div>
			<div className="modal-header">
				<h5 className="modal-title">Delete project?</h5>
				<IconButton icon="x-lg" size="small" onClick={() => close(false)} aria-label="Close" />
			</div>
			<div className="modal-body">
				<p style={{ marginTop: 0 }}>
					This permanently deletes <strong>indie-raid-game</strong> and all of its bundles and
					configs.
				</p>
				<p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: 0 }}>
					This action cannot be undone.
				</p>
			</div>
			<div className="modal-footer">
				<Button variant="secondary" outline onClick={() => close(false)}>Cancel</Button>
				<Button variant="danger" onClick={() => close(true)}>Delete project</Button>
			</div>
		</div>
	)
}

function NestedA() {
	const close = Modal.useModalClose()
	const openB = Modal.useModalOpen('demo-nested-b')
	return (
		<div>
			<div className="modal-header">
				<h5 className="modal-title">Settings</h5>
				<IconButton icon="x-lg" size="small" onClick={() => close()} aria-label="Close" />
			</div>
			<div className="modal-body">
				<p style={{ marginTop: 0 }}>
					Opening a second modal on top works out-of-the-box — the stack manager keeps focus
					pinned to the topmost one.
				</p>
			</div>
			<div className="modal-footer">
				<Button variant="secondary" outline onClick={() => close()}>Close</Button>
				<Button variant="primary" onClick={() => openB()}>Open detail modal</Button>
			</div>
		</div>
	)
}

function NestedB() {
	const close = Modal.useModalClose()
	return (
		<div>
			<div className="modal-header">
				<h5 className="modal-title">Advanced settings</h5>
				<IconButton icon="x-lg" size="small" onClick={() => close()} aria-label="Close" />
			</div>
			<div className="modal-body">
				<p style={{ marginTop: 0 }}>
					This modal is stacked on top of the first. Closing it returns focus to the original
					modal; closing both returns focus to the trigger button.
				</p>
			</div>
			<div className="modal-footer">
				<Button variant="primary" onClick={() => close()}>Close</Button>
			</div>
		</div>
	)
}

export default ModalDemo
