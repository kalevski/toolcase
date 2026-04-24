import React, { useState } from 'react'
import { FormInput, ColorOption, IconOption, DropdownItem, ExtendedSelectItem } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

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

const dropdownItems: DropdownItem[] = [
	{ key: 'proj-1', name: 'Space Invaders', description: 'Arcade shooter', icon: 'rocket-takeoff' },
	{ key: 'proj-2', name: 'Puzzle Quest', description: 'Match-3 RPG', icon: 'puzzle' },
	{ key: 'proj-3', name: 'Pixel Runner', description: 'Platformer', icon: 'controller' },
	{ key: 'proj-4', name: 'Strategy Master', description: 'Real-time strategy', icon: 'chess' },
	{ key: 'proj-5', name: 'Adventure Land', description: 'Open-world adventure', icon: 'map' },
]

const extSelectItems: ExtendedSelectItem[] = [
	{ key: 'unity', name: 'Unity', description: 'Cross-platform game engine', icon: 'box' },
	{ key: 'godot', name: 'Godot', description: 'Open source game engine', icon: 'gem' },
	{ key: 'unreal', name: 'Unreal Engine', description: 'High-end 3D engine', icon: 'gpu-card' },
	{ key: 'phaser', name: 'Phaser', description: 'HTML5 game framework', icon: 'browser-safari' },
	{ key: 'pixi', name: 'PixiJS', description: '2D WebGL renderer', icon: 'grid' },
	{ key: 'babylon', name: 'Babylon.js', description: '3D WebGL engine', icon: 'globe' },
	{ key: 'cocos', name: 'Cocos2d', description: 'Mobile-first 2D engine', icon: 'phone' },
	{ key: 'love2d', name: 'LÖVE', description: '2D Lua game framework', icon: 'heart' },
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
	const [dropdownVal, setDropdownVal] = useState<string | undefined>('proj-1')
	const [extSelectVal, setExtSelectVal] = useState<string | undefined>('unity')

	return (
		<DemoPage
			eyebrow="Inputs"
			title="FormInput"
			lede={
				<>
					A unified form input component that renders the correct input type based on a single <code>type</code> prop.
					Supports 15 input types with consistent label, help tooltip, helper text, and error handling.
				</>
			}
		>
			<DemoSection title="Text Inputs">
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
			</DemoSection>

			<DemoSection title="Range">
				<FormInput
					type="range"
					label={`Volume: ${rangeVal}`}
					min={0}
					max={100}
					step={1}
					value={rangeVal}
					onChange={(v) => setRangeVal(v as number)}
				/>
			</DemoSection>

			<DemoSection title="Textarea">
				<FormInput
					type="textarea"
					label="Description"
					placeholder="Write a brief description..."
					rows={4}
					value={textareaVal}
					onChange={(v) => setTextareaVal(v as string)}
					helper="Markdown is supported."
				/>
			</DemoSection>

			<DemoSection title="Date">
				<FormInput
					type="date"
					label="Start Date"
					value={dateVal}
					onChange={(v) => setDateVal(v as string)}
					help="When should the project begin?"
				/>
			</DemoSection>

			<DemoSection title="Color">
				<FormInput
					type="color"
					label="Theme Color"
					colors={sampleColors}
					columns={6}
					value={colorVal}
					onChange={(v) => setColorVal(v as string)}
				/>
			</DemoSection>

			<DemoSection title="Icon">
				<FormInput
					type="icon"
					label="Project Icon"
					icons={sampleIcons}
					columns={4}
					value={iconVal}
					onChange={(v) => setIconVal(v as string)}
					help="Choose an icon to represent this project."
				/>
			</DemoSection>

			<DemoSection title="Tags">
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
			</DemoSection>

			<DemoSection title="Checkbox & Boolean">
				<div className="d-flex flex-column gap-4">
					<FormInput
						type="checkbox"
						label="I agree to the terms and conditions"
						value={checkVal}
						onChange={(v) => setCheckVal(v as boolean)}
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
			</DemoSection>

			<DemoSection title="Checkbox Group">
				<FormInput
					type="checkbox-group"
					label="Skills"
					options={checkboxOptions}
					value={checkGroupVal}
					onChange={(v) => setCheckGroupVal(v as string[])}
					inline
					helper="Select all that apply."
				/>
			</DemoSection>

			<DemoSection title="Radio Group">
				<FormInput
					type="radio-group"
					label="Size"
					options={radioOptions}
					value={radioGroupVal}
					onChange={(v) => setRadioGroupVal(v as string)}
					inline
				/>
			</DemoSection>

			<DemoSection title="Dropdown">
				<div className="d-flex flex-column gap-4">
					<FormInput
						type="dropdown"
						label="Project"
						items={dropdownItems}
						value={dropdownVal}
						onChange={(v) => setDropdownVal(v as string)}
						help="Select the project to work on."
					/>
				</div>
			</DemoSection>

			<DemoSection title="Extended Select">
				<div className="d-flex flex-column gap-4">
					<FormInput
						type="extended-select"
						label="Game Engine"
						items={extSelectItems}
						value={extSelectVal}
						onChange={(v) => setExtSelectVal(v as string)}
						placeholder="Choose an engine..."
						searchPlaceholder="Search engines..."
						noResultsText="No engines matched your search."
						help="Pick the primary game engine for your project."
					/>
				</div>
			</DemoSection>

			<DemoSection
				title="Validation"
				caption={
					<>
						When a validator returns a non-null value, an error message is shown.
						The second argument of <code>onChange</code> indicates whether the value has an error.
						Use <code>onErrorMessage</code> to convert the validator result into a display string.
					</>
				}
			>
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
			</DemoSection>

			<DemoSection title="Error State">
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
			</DemoSection>

			<DemoSection title="Disabled State">
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
			</DemoSection>
		</DemoPage>
	)
}

export default FormInputDemo
