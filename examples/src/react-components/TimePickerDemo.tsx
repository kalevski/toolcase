import React, { useState } from 'react'
import { TimePicker } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

export const TimePickerDemo: React.FC = () => {
	const [time24, setTime24] = useState('')
	const [time12, setTime12] = useState('')
	const [timeSec, setTimeSec] = useState('')

	return (
		<DemoPage
			eyebrow="Inputs"
			title="TimePicker"
			lede="Dropdown-based time picker with 12h/24h format and optional seconds."
		>
			<DemoSection title="24-hour format">
				<TimePicker
					label="Start time"
					value={time24}
					onChange={setTime24}
					format="24h"
					clearable
				/>
				<p style={{ color: '#64748b', marginTop: 8, marginBottom: 0, fontSize: '0.85rem' }}>Value: {time24 || '—'}</p>
			</DemoSection>

			<DemoSection title="12-hour format (AM/PM)">
				<TimePicker
					label="Meeting time"
					value={time12}
					onChange={setTime12}
					format="12h"
					minuteStep={15}
					clearable
				/>
			</DemoSection>

			<DemoSection title="With seconds">
				<TimePicker
					label="Precise time"
					value={timeSec}
					onChange={setTimeSec}
					format="24h"
					showSeconds
					minuteStep={1}
				/>
			</DemoSection>

			<DemoSection title="Error state">
				<TimePicker
					label="End time"
					value="09:00"
					onChange={() => {}}
					error="End time must be after start time."
				/>
			</DemoSection>
		</DemoPage>
	)
}
