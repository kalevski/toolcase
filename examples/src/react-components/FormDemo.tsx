import React from 'react'
import {
	Button,
	Checkbox,
	Form,
	Input,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
	Select
} from '@toolcase/react-components'

const FormDemo: React.FC = () => {
	const handleSubmit = (data: Record<string, any>) => {
		alert('Submitted: ' + JSON.stringify(data, null, 2))
	}

	return (
		<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Inputs</RichPageHeaderChip>}
				title="Form"
				description="A form wrapper that auto-collects FormData on submit with optional Card wrapper and header."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
			<SectionCard title="With Card Wrapper (default)">
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
			</SectionCard>

			<SectionCard title="Without Card Wrapper">
				<Form wrapper={false} onSubmit={handleSubmit}>
					<div className="d-flex flex-column gap-3">
						<Input label="Email" name="email" type="email" placeholder="you@example.com" />
						<Input label="Password" name="password" type="password" placeholder="••••••••" />
						<Button type="submit" variant="primary">Sign In</Button>
					</div>
				</Form>
			</SectionCard>

			<SectionCard title="Variant Colors">
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
			</SectionCard>
		</div>
		
			</div>
		</div>
	</div>
	)
}

export default FormDemo
