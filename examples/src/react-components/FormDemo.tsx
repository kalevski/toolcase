import React from 'react'
import { Form, Input, Select, Checkbox, Card, Button, CodeSnippet } from '@toolcase/react-components'

const FormDemo: React.FC = () => {
	const handleSubmit = (data: Record<string, any>) => {
		alert('Submitted: ' + JSON.stringify(data, null, 2))
	}

	return (
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">Form</h1>
					<p className="text-muted mb-0">A form wrapper that auto-collects FormData on submit with optional Card wrapper and header.</p>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">With Card Wrapper (default)</h2>
						<Form header="Create Project" onSubmit={handleSubmit}>
							<div className="d-flex flex-column gap-3">
								<Input label="Project Name" name="name" placeholder="My Game" />
								<Select
									label="Engine"
									name="engine"
									options={[
										{ value: 'unity', label: 'Unity' },
										{ value: 'godot', label: 'Godot' },
										{ value: 'unreal', label: 'Unreal' },
									]}
								/>
								<Checkbox label="Make public" name="public" />
								<Button type="submit" variant="primary">Create</Button>
							</div>
						</Form>
					</Card>
				</div>
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">Without Card Wrapper</h2>
						<Form wrapper={false} onSubmit={handleSubmit}>
							<div className="d-flex flex-column gap-3">
								<Input label="Email" name="email" type="email" placeholder="you@example.com" />
								<Input label="Password" name="password" type="password" placeholder="••••••••" />
								<Button type="submit" variant="primary">Sign In</Button>
							</div>
						</Form>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">Variant Colors</h2>
						<div className="d-flex flex-column gap-3">
							<Form header="Default" variant="default" wrapper>
								<p className="mb-0 text-muted" style={{ fontSize: '0.85rem' }}>Default variant card</p>
							</Form>
							<Form header="Primary" variant="primary" wrapper>
								<p className="mb-0">Primary variant card</p>
							</Form>
							<Form header="Danger" variant="danger" wrapper>
								<p className="mb-0">Danger variant card</p>
							</Form>
						</div>
					</Card>
				</div>
			</div>

			{/* Usage */}
			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Usage</h2>
						<CodeSnippet
							language="typescript"
							code={`import { Form, Input, Select, Textarea } from '@toolcase/react-components'

<Form onSubmit={handleSubmit}>
  <Input label="Name" name="name" required />
  <Select label="Role" options={roles} />
  <Textarea label="Bio" name="bio" />
</Form>`}
						/>
					</Card>
				</div>
			</div>
		</div>
	)
}

export default FormDemo
