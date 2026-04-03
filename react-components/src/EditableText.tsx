import React, { forwardRef, FocusEvent, KeyboardEvent } from 'react'

export type EditableTextChangeEvent = (e: FocusEvent<HTMLInputElement>) => void

export interface EditableTextProps {
	defaultValue?: string
	disabled?: boolean
	placeholder?: string
	onChange?: EditableTextChangeEvent
}

const EditableText = forwardRef<HTMLInputElement, EditableTextProps>(
	({ defaultValue = '', disabled = false, placeholder = '', onChange = () => {} }, ref) => {
		const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
			if (typeof onChange !== 'function') {
				return
			}
			if (defaultValue === e.target.value) {
				return
			}
			onChange(e)
		}

		const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
			if (e.key === 'Enter') {
				e.currentTarget.blur()
			} else if (e.key === 'Escape') {
				e.currentTarget.value = defaultValue
				e.currentTarget.blur()
			}
		}

		return (
			<div className="component component-editable-text">
				<input
					disabled={disabled}
					ref={ref}
					placeholder={placeholder}
					onBlur={handleBlur}
					onKeyDown={handleKeyDown}
					defaultValue={defaultValue}
				/>
			</div>
		)
	},
)

export default EditableText
