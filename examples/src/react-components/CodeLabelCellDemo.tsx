import React from 'react'
import { CodeLabelCell, Table, TableColumn } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

interface Country {
	code: string
	name: string
	region: string
}

const countries: Country[] = [
	{ code: 'US', name: 'United States', region: 'North America' },
	{ code: 'GB', name: 'United Kingdom', region: 'Europe' },
	{ code: 'DE', name: 'Germany', region: 'Europe' },
	{ code: 'JP', name: 'Japan', region: 'Asia' },
	{ code: 'BR', name: 'Brazil', region: 'South America' },
]

const CodeLabelCellDemo: React.FC = () => (
	<DemoPage
		eyebrow="Data Display"
		title="CodeLabelCell"
		lede={
			<>
				A micro-cell for tables: a short monospace <strong>code</strong> alongside a longer
				human-readable <strong>name</strong>. Use for country codes, currency codes, IATA
				codes, plan keys — anywhere a record has both a compact identifier and a display name.
			</>
		}
	>
		<DemoSection
			eyebrow="In a table"
			title="Countries"
			caption="Pure display — no interactive behavior. Names truncate with ellipsis when the column is narrow."
		>
			<Table
				columns={[
					{
						key: 'country',
						header: 'Country',
						render: (row: Country) => <CodeLabelCell code={row.code} name={row.name} />,
					},
					{
						key: 'region',
						header: 'Region',
						render: (row: Country) => row.region,
					},
				] as TableColumn<Country>[]}
				data={countries}
				rowKey={(r) => r.code}
			/>
		</DemoSection>

		<DemoSection
			eyebrow="Variety"
			title="Other codes"
			caption="Plan keys, currency codes, IATA codes — the same micro-cell fits them all."
		>
			<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
				<CodeLabelCell code="USD" name="United States Dollar" />
				<CodeLabelCell code="EUR" name="Euro" />
				<CodeLabelCell code="JPY" name="Japanese Yen" />
				<CodeLabelCell code="JFK" name="New York · John F. Kennedy International" />
				<CodeLabelCell code="PRO" name="Pro · annual · seat-based" />
			</div>
		</DemoSection>
	</DemoPage>
)

export default CodeLabelCellDemo
