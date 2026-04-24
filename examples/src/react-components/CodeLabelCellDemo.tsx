import React from 'react'
import {
	CodeLabelCell,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
	Table,
	TableColumn
} from '@toolcase/react-components'

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
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Data Display</RichPageHeaderChip>}
				title="CodeLabelCell"
				description={
			<>
				A micro-cell for tables: a short monospace <strong>code</strong> alongside a longer
				human-readable <strong>name</strong>. Use for country codes, currency codes, IATA
				codes, plan keys — anywhere a record has both a compact identifier and a display name.
			</>
		}
			/>
				<div className="d-flex flex-column gap-4 mt-4">
		<SectionCard title="Countries">
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
		</SectionCard>

		<SectionCard title="Other codes">
			<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
				<CodeLabelCell code="USD" name="United States Dollar" />
				<CodeLabelCell code="EUR" name="Euro" />
				<CodeLabelCell code="JPY" name="Japanese Yen" />
				<CodeLabelCell code="JFK" name="New York · John F. Kennedy International" />
				<CodeLabelCell code="PRO" name="Pro · annual · seat-based" />
			</div>
		</SectionCard>
	</div>
		
			</div>
		</div>
	</div>
)

export default CodeLabelCellDemo
