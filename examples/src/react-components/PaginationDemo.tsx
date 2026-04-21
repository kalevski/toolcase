import React, { useState } from 'react'
import { Pagination, Card, CodeSnippet } from '@toolcase/react-components'

const PaginationDemo: React.FC = () => {
	const [offset1, setOffset1] = useState(0)
	const [offset2, setOffset2] = useState(30)
	const [offset3, setOffset3] = useState(0)
	const [offset4, setOffset4] = useState(200)

	return (
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">Pagination</h1>
					<p className="text-muted mb-0">Navigate between pages with numbered buttons, prev/next arrows, and result summary.</p>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Basic</h2>
						<Pagination limit={10} offset={offset1} total={50} onChange={setOffset1} />
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">With Result Summary</h2>
						<Pagination
							limit={10}
							offset={offset2}
							total={97}
							onChange={setOffset2}
						/>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Many Pages (Dots Truncation)</h2>
						<Pagination
							limit={10}
							offset={offset3}
							total={500}
							onChange={setOffset3}
						/>
						<div className="mt-2">
							<div className="d-flex flex-wrap gap-2">
								<button className="btn btn-sm btn-outline-secondary" onClick={() => setOffset3(0)}>Go to 1</button>
								<button className="btn btn-sm btn-outline-secondary" onClick={() => setOffset3(240)}>Go to 25</button>
								<button className="btn btn-sm btn-outline-secondary" onClick={() => setOffset3(490)}>Go to 50</button>
							</div>
						</div>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Single Page</h2>
						<Pagination limit={10} offset={0} total={3} />
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">siblingCount Variants</h2>
						<p className="text-muted small mb-3">Controls how many page numbers appear around the active page.</p>
						<div className="d-flex flex-column gap-3">
							<div>
								<p className="text-muted small mb-1">siblingCount=0 (minimal)</p>
								<Pagination limit={10} offset={offset4} total={500} onChange={setOffset4} siblingCount={0} />
							</div>
							<div>
								<p className="text-muted small mb-1">siblingCount=1 (default)</p>
								<Pagination limit={10} offset={offset4} total={500} onChange={setOffset4} siblingCount={1} />
							</div>
							<div>
								<p className="text-muted small mb-1">siblingCount=2 (wider)</p>
								<Pagination limit={10} offset={offset4} total={500} onChange={setOffset4} siblingCount={2} />
							</div>
						</div>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Usage</h2>
						<CodeSnippet
							language="typescript"
							code={`import { Pagination } from '@toolcase/react-components'

<Pagination
  limit={10}
  offset={offset}
  total={97}
  onChange={(newOffset) => setOffset(newOffset)}
/>`}
						/>
					</Card>
				</div>
			</div>
		</div>
	)
}

export default PaginationDemo
