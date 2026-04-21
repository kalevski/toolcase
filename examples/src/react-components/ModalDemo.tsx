import React, { useState } from 'react'
import { Modal, Button, IconButton, Input, Card, Alert, CodeSnippet } from '@toolcase/react-components'

export function ModalDemo() {
	return (
		<div className="container my-5">
			<div className="row">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">Modal System</h1>
					<p className="text-muted mb-4">A context-based modal system supporting stacking, input payloads, and result callbacks.</p>
				</div>
			</div>
			<Modal.ModalContext>
				<div className="row">
					<div className="col-lg-8">
						<ModalExamples />
					</div>
				</div>
				<ModalDefinitions />
			</Modal.ModalContext>

			{/* Usage */}
			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Usage</h2>
						<CodeSnippet
							language="typescript"
							code={`import { Modal, Button } from '@toolcase/react-components'

<Modal.ModalContext>
  <OpenButton />
  <Modal.ModalRender>
    <Modal.Window key="my-modal">
      <MyModalContent />
    </Modal.Window>
  </Modal.ModalRender>
</Modal.ModalContext>

// Inside OpenButton:
const open = Modal.useModalOpen('my-modal')
<Button onClick={() => open()}>Open</Button>

// Inside MyModalContent:
const close = Modal.useModalClose()
<Button onClick={() => close()}>Close</Button>`}
						/>
					</Card>
				</div>
			</div>
		</div>
	)
}

function ModalExamples() {
	const [result, setResult] = useState<string>('')

	const openSimpleModal = Modal.useModalOpen('simple-modal')

	const openUserModal = Modal.useModalOpen('user-modal', (payload) => {
		if (payload) {
			setResult(`User modal result: ${JSON.stringify(payload)}`)
		} else {
			setResult('User modal was cancelled')
		}
	})

	const openConfirmModal = Modal.useModalOpen('confirm-modal', (payload) => {
		setResult(`Confirmation result: ${payload ? 'Confirmed' : 'Cancelled'}`)
	})

	const openFirstModal = Modal.useModalOpen('first-modal')

	const closeAllModals = Modal.useModalCloseAll()

	return (
		<Card>
			<h2 className="h5 mb-3">Interactive Examples</h2>

			<div className="d-flex flex-wrap gap-2 mb-3">
				<Button variant="primary" onClick={() => openSimpleModal()}>
					Simple Modal
				</Button>
				<Button variant="secondary" onClick={() => openUserModal({ userId: 123, name: 'John Doe' })}>
					Modal with Data
				</Button>
				<Button variant="warning" onClick={() => openConfirmModal()}>
					Confirmation Modal
				</Button>
				<Button variant="info" onClick={() => openFirstModal()}>
					Nested Modals
				</Button>
				<Button variant="danger" onClick={() => closeAllModals()}>
					Close All
				</Button>
			</div>

			{result && (
				<Alert variant="info">
					<strong>Result:</strong> {result}
				</Alert>
			)}
		</Card>
	)
}

function ModalDefinitions() {
	return (
		<Modal.ModalRender>
			<Modal.Window key="simple-modal" size="medium">
				<SimpleModalContent />
			</Modal.Window>

			<Modal.Window key="user-modal" size="medium">
				<UserModalContent />
			</Modal.Window>

			<Modal.Window key="confirm-modal" size="small">
				<ConfirmModalContent />
			</Modal.Window>

			<Modal.Window key="first-modal" size="medium">
				<FirstModalContent />
			</Modal.Window>

			<Modal.Window key="second-modal" size="large">
				<SecondModalContent />
			</Modal.Window>
		</Modal.ModalRender>
	)
}

function SimpleModalContent() {
	const closeModal = Modal.useModalClose()

	return (
		<div>
			<div className="modal-header">
				<h5 className="modal-title">Simple Modal</h5>
				<IconButton icon="x-lg" size="small" onClick={() => closeModal()} aria-label="Close" />
			</div>
			<div className="modal-body">
				<p>This is a simple modal without any input data.</p>
				<p>It demonstrates the basic modal functionality.</p>
			</div>
			<div className="modal-footer">
				<Button variant="secondary" onClick={() => closeModal()}>
					Close
				</Button>
			</div>
		</div>
	)
}

function UserModalContent() {
	const input = Modal.useModalInput<{ userId: number; name: string }>()
	const closeModal = Modal.useModalClose()
	const [name, setName] = useState(input?.name || '')

	const handleSave = () => {
		closeModal({
			success: true,
			data: { userId: input?.userId, name },
		})
	}

	return (
		<div>
			<div className="modal-header">
				<h5 className="modal-title">Edit User</h5>
				<IconButton icon="x-lg" size="small" onClick={() => closeModal({ success: false })} aria-label="Close" />
			</div>
			<div className="modal-body">
				<p>
					<strong>User ID:</strong> {input?.userId}
				</p>
				<Input
					label="Name"
					id="userName"
					value={name}
					onChange={(e) => setName(e.target.value)}
				/>
			</div>
			<div className="modal-footer">
				<Button variant="secondary" onClick={() => closeModal({ success: false })}>
					Cancel
				</Button>
				<Button variant="primary" onClick={handleSave}>
					Save
				</Button>
			</div>
		</div>
	)
}

function ConfirmModalContent() {
	const closeModal = Modal.useModalClose()

	return (
		<div>
			<div className="modal-header">
				<h5 className="modal-title">Confirm Action</h5>
				<IconButton icon="x-lg" size="small" onClick={() => closeModal(false)} aria-label="Close" />
			</div>
			<div className="modal-body">
				<p>Are you sure you want to proceed with this action?</p>
				<p className="text-muted">This action cannot be undone.</p>
			</div>
			<div className="modal-footer">
				<Button variant="secondary" onClick={() => closeModal(false)}>
					Cancel
				</Button>
				<Button variant="danger" onClick={() => closeModal(true)}>
					Confirm
				</Button>
			</div>
		</div>
	)
}

function FirstModalContent() {
	const closeModal = Modal.useModalClose()
	const openSecondModal = Modal.useModalOpen('second-modal')

	return (
		<div>
			<div className="modal-header">
				<h5 className="modal-title">First Modal</h5>
				<IconButton icon="x-lg" size="small" onClick={() => closeModal()} aria-label="Close" />
			</div>
			<div className="modal-body">
				<p>This is the first modal in a nested modal example.</p>
				<p>You can open another modal on top of this one.</p>
			</div>
			<div className="modal-footer">
				<Button variant="secondary" onClick={() => closeModal()}>
					Close
				</Button>
				<Button variant="primary" onClick={() => openSecondModal()}>
					Open Second Modal
				</Button>
			</div>
		</div>
	)
}

function SecondModalContent() {
	const closeModal = Modal.useModalClose()

	return (
		<div>
			<div className="modal-header">
				<h5 className="modal-title">Second Modal</h5>
				<IconButton icon="x-lg" size="small" onClick={() => closeModal()} aria-label="Close" />
			</div>
			<div className="modal-body">
				<p>This is the second modal, stacked on top of the first one.</p>
				<p>Notice how the modal stack manages the display correctly.</p>
			</div>
			<div className="modal-footer">
				<Button variant="primary" onClick={() => closeModal()}>
					Close
				</Button>
			</div>
		</div>
	)
}
