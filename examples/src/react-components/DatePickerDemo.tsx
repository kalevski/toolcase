import React, { useState } from 'react'
import { DatePicker } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const DatePickerDemo: React.FC = () => {
	const [date, setDate] = useState('2025-01-15')

	return (
		<DemoPage
			eyebrow="Inputs"
			title="DatePicker"
			lede="A labeled date input with min/max constraints and disabled state."
		>
			<DemoSection title="Basic">
				<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
					<DatePicker label="Release Date" value={date} onChange={setDate} />
					<p className="text-muted mb-0" style={{ fontSize: '0.8rem' }}>Selected: {date}</p>
				</div>
			</DemoSection>

			<DemoSection title="With Min/Max">
				<DatePicker
					label="Event Date"
					min="2025-01-01"
					max="2025-12-31"
					value="2025-06-15"
				/>
			</DemoSection>

			<DemoSection title="Disabled">
				<DatePicker label="Locked Date" value="2025-03-01" disabled />
			</DemoSection>

			<DemoSection title="Without Label">
				<DatePicker value="2025-07-04" />
			</DemoSection>
		</DemoPage>
	)
}

export default DatePickerDemo
