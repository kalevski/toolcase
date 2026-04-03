import React, { useState } from 'react'
import { FormInput, FormInputValidator, Card, CodeSnippet, ColorPickerProps, ColorOption, IconOption } from '@toolcase/react-components'

const sampleColors: ColorOption[] = [
	{ hex: '#ef4444', label: 'Red' },
	{ hex: '#f59e0b', label: 'Amber' },
	{ hex: '#22c55e', label: 'Green' },
	{ hex: '#3b82f6', label: 'Blue' },
	{ hex: '#8b5cf6', label: 'Violet' },
	{ hex: '#ec4899', label: 'Pink' },
]

const sampleIcons: IconOption[] = [
	{ icon: 'house', value: 'house', label: 'House' },
	{ icon: 'gear', value: 'gear', label: 'Gear' },
	{ icon: 'person', value: 'person', label: 'Person' },
	{ icon: 'star', value: 'star', label: 'Star' },
	{ icon: 'heart', value: 'heart', label: 'Heart' },
	{ icon: 'bell', value: 'bell', label: 'Bell' },
	{ icon: 'envelope', value: 'envelope', label: 'Envelope' },
	{ icon: 'trash', value: 'trash', label: 'Trash' },
]

const checkboxOptions = [
	{ key: 'html', value: 'html', label: 'HTML' },
	{ key: 'css', value: 'css', label: 'CSS' },
	{ key: 'js', value: 'js', label: 'JavaScript' },
	{ key: 'ts', value: 'ts', label: 'TypeScript' },
]

const radioOptions = [
	{ key: 'sm', value: 'sm', label: 'Small' },
	{ key: 'md', value: 'md', label: 'Medium' },
	{ key: 'lg', value: 'lg', label: 'Large' },
]

const FormInputDemo: React.FC = () => {
	const [textVal, setTextVal] = useState('')
	const [emailVal, setEmailVal] = useState('')
	const [urlVal, setUrlVal] = useState('')
	const [numberVal, setNumberVal] = useState<number | string>(50)
	const [rangeVal, setRangeVal] = useState<number | string>(50)
	const [textareaVal, setTextareaVal] = useState('')
	const [dateVal, setDateVal] = useState('')
	const [colorVal, setColorVal] = useState('#3b82f6')
	const [iconVal, setIconVal] = useState('star')
	const [tags, setTags] = useState<string[]>(['react', 'typescript'])
	const [checkVal, setCheckVal] = useState(false)
	const [checkGroupVal, setCheckGroupVal] = useState<string[]>(['html', 'css'])
	const [radioGroupVal, setRadioGroupVal] = useState('md')
	const [boolVal, setBoolVal] = useState(true)
	const [validatedName, setValidatedName] = useState('')
	const [validatedAge, setValidatedAge] = useState<number | string>('')

	return (
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">FormInput</h1>
					<p className="text-muted mb-0">
						A unified form input component that renders the correct input type based on a single <code>type</code> prop.
						Supports 15 input types with consistent label, help tooltip, helper text, and error handling.
					</p>
				</div>
			</div>

			{/* Text Inputs */}
			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Text Inputs</h2>
						<div className="d-flex flex-column gap-4">
							<FormInput
								type="text"
								label="Full Name"
								placeholder="Enter your name"
								help="Your display name visible to other users."
								value={textVal}
								onChange={(v) => setTextVal(v as string)}
							/>
							<FormInput
								type="email"
								label="Email Address"
								placeholder="you@example.com"
								required
								value={emailVal}
								onChange={(v) => setEmailVal(v as string)}
								helper="We'll never share your email with anyone else."
							/>
							<FormInput
								type="url"
								label="Website"
								placeholder="https://example.com"
								value={urlVal}
								onChange={(v) => setUrlVal(v as string)}
							/>
							<FormInput
								type="number"
								label="Quantity"
								placeholder="0"
								min={0}
								max={100}
								step={1}
								value={numberVal}
								onChange={(v) => setNumberVal(v as number)}
								help="Enter a value between 0 and 100."
							/>
						</div>
					</Card>
				</div>
			</div>

			{/* Range */}
			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Range</h2>
						<FormInput
							type="range"
							label={`Volume: ${rangeVal}`}
							min={0}
							max={100}
							step={1}
							value={rangeVal}
							onChange={(v) => setRangeVal(v as number)}
						/>
					</Card>
				</div>
			</div>

			{/* Textarea */}
			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Textarea</h2>
						<FormInput
							type="textarea"
							label="Description"
							placeholder="Write a brief description..."
							rows={4}
							value={textareaVal}
							onChange={(v) => setTextareaVal(v as string)}
							helper="Markdown is supported."
						/>
					</Card>
				</div>
			</div>

			{/* Date */}
			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Date</h2>
						<FormInput
							type="date"
							label="Start Date"
							value={dateVal}
							onChange={(v) => setDateVal(v as string)}
							help="When should the project begin?"
						/>
					</Card>
				</div>
			</div>

			{/* Color Picker */}
			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Color</h2>
						<FormInput
							type="color"
							label="Theme Color"
							colors={sampleColors}
							columns={6}
							value={colorVal}
							onChange={(v) => setColorVal(v as string)}
						/>
					</Card>
				</div>
			</div>

			{/* Icon Picker */}
			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Icon</h2>
						<FormInput
							type="icon"
							label="Project Icon"
							icons={sampleIcons}
							columns={4}
							value={iconVal}
							onChange={(v) => setIconVal(v as string)}
							help="Choose an icon to represent this project."
						/>
					</Card>
				</div>
			</div>

			{/* Tag Input */}
			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Tags</h2>
						<FormInput
							type="tag"
							label="Technologies"
							placeholder="Add a tag..."
							value={tags}
							onChange={(v) => setTags(v as string[])}
							recommendations={['react', 'vue', 'angular', 'svelte', 'typescript', 'javascript']}
							allowCreate
							maxTags={8}
							helper="Press Enter to add a tag."
						/>
					</Card>
				</div>
			</div>

			{/* Checkbox & Boolean */}
			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Checkbox &amp; Boolean</h2>
						<div className="d-flex flex-column gap-4">
							<FormInput
								type="checkbox"
								label="I agree to the terms and conditions"
								value={checkVal}
								onChange={(v) => setBoolVal(v as boolean)}
								required
							/>
							<FormInput
								type="boolean"
								label="Enable notifications"
								value={boolVal}
								onChange={(v) => setBoolVal(v as boolean)}
								help="Toggle push notifications."
							/>
						</div>
					</Card>
				</div>
			</div>

			{/* Checkbox Group */}
			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Checkbox Group</h2>
						<FormInput
							type="checkbox-group"
							label="Skills"
							options={checkboxOptions}
							value={checkGroupVal}
							onChange={(v) => setCheckGroupVal(v as string[])}
							inline
							helper="Select all that apply."
						/>
					</Card>
				</div>
			</div>

			{/* Radio Group */}
			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Radio Group</h2>
						<FormInput
							type="radio-group"
							label="Size"
							options={radioOptions}
							value={radioGroupVal}
							onChange={(v) => setRadioGroupVal(v as string)}
							inline
						/>
					</Card>
				</div>
			</div>

			{/* Validation */}
			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Validation</h2>
						<p className="text-muted mb-4">
							When a validator returns a non-null value, an error message is shown.
							The second argument of <code>onChange</code> indicates whether the value has an error.
							Use <code>onErrorMessage</code> to convert the validator result into a display string.
						</p>
						<div className="d-flex flex-column gap-4">
							<FormInput
								type="text"
								label="Name (min 3 chars)"
								placeholder="Enter your name"
								value={validatedName}
								onChange={(v) => setValidatedName(v as string)}
								validate={(val) => {
									const s = val as string
									if (s.length > 0 && s.length < 3) return { min: 3, actual: s.length }
									return null
								}}
								onErrorMessage={(result) => {
									const r = result as { min: number; actual: number }
									return `Name must be at least ${r.min} characters (currently ${r.actual}).`
								}}
								helper={`Current value: "${validatedName}"`}
							/>
							<FormInput
								type="number"
								label="Age (18–120)"
								placeholder="Enter your age"
								value={validatedAge}
								onChange={(v) => setValidatedAge(v as number)}
								validate={[
									(val) => {
										const n = Number(val)
										if (val !== '' && n < 18) return 'too-young'
										return null
									},
									(val) => {
										const n = Number(val)
										if (val !== '' && n > 120) return 'too-old'
										return null
									},
								]}
								onErrorMessage={(result) => {
									if (result === 'too-young') return 'You must be at least 18 years old.'
									if (result === 'too-old') return 'Age cannot exceed 120.'
									return String(result)
								}}
								helper={`Current value: "${validatedAge}"`}
							/>
						</div>
					</Card>
				</div>
			</div>

			{/* Error State */}
			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Error State</h2>
						<div className="d-flex flex-column gap-4">
							<FormInput
								type="email"
								label="Email"
								placeholder="you@example.com"
								value="not-an-email"
								error="Please enter a valid email address."
								required
							/>
							<FormInput
								type="text"
								label="Username"
								placeholder="Choose a username"
								value="ab"
								error="Username must be at least 3 characters."
							/>
						</div>
					</Card>
				</div>
			</div>

			{/* Disabled State */}
			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Disabled State</h2>
						<div className="d-flex flex-column gap-4">
							<FormInput
								type="text"
								label="Read-only Field"
								value="Cannot edit this"
								disabled
							/>
							<FormInput
								type="boolean"
								label="Locked toggle"
								value={false}
								disabled
							/>
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
							code={`import { FormInput } from '@webgame-cloud/react-components'

// Text input — onChange receives (value, hasError)
<FormInput
  type="text"
  label="Full Name"
  placeholder="Enter your name"
  value={name}
  onChange={(v, hasError) => {
    setName(v as string)
    if (!hasError) { /* value is valid */ }
  }}
  required
/>

// Validation — onChange always fires, hasError tells you validity
<FormInput
  type="text"
  label="Username"
  value={username}
  onChange={(v, hasError) => setUsername(v as string)}
  validate={(val) => {
    const s = val as string
    if (s.length > 0 && s.length < 3) return { min: 3 }
    return null
  }}
  onErrorMessage={(r) => \`Min \${(r as any).min} characters.\`}
/>

// Multiple validators (array)
<FormInput
  type="number"
  label="Age"
  value={age}
  onChange={(v, hasError) => setAge(v as number)}
  validate={[
    (val) => Number(val) < 18 ? 'too-young' : null,
    (val) => Number(val) > 120 ? 'too-old' : null,
  ]}
  onErrorMessage={(r) =>
    r === 'too-young' ? 'Must be 18+.' : 'Max 120.'
  }
/>

// error prop has priority over validators
<FormInput
  type="email"
  label="Email"
  value={email}
  onChange={(v) => setEmail(v as string)}
  error="Please enter a valid email address."
/>`}
						/>
					</Card>
				</div>
			</div>
		</div>
	)
}

export default FormInputDemo
