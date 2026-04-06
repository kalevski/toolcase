import React, { useState } from 'react'
import { Pagination, Card, CodeSnippet } from '@toolcase/react-components'

const PaginationDemo: React.FC = () => {
	const [page1, setPage1] = useState(1)
	const [page2, setPage2] = useState(4)
	const [page3, setPage3] = useState(1)

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
						<Pagination page={page1} totalPages={5} onChange={setPage1} />
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">With Result Summary</h2>
						<Pagination
							page={page2}
							totalPages={10}
							totalResults={97}
							pageSize={10}
							onChange={setPage2}
						/>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Many Pages (Dots Truncation)</h2>
						<Pagination
							page={page3}
							totalPages={50}
							totalResults={500}
							pageSize={10}
							onChange={setPage3}
						/>
						<div className="mt-2">
							<div className="d-flex flex-wrap gap-2">
								<button className="btn btn-sm btn-outline-secondary" onClick={() => setPage3(1)}>Go to 1</button>
								<button className="btn btn-sm btn-outline-secondary" onClick={() => setPage3(25)}>Go to 25</button>
								<button className="btn btn-sm btn-outline-secondary" onClick={() => setPage3(50)}>Go to 50</button>
							</div>
						</div>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Single Page</h2>
						<Pagination page={1} totalPages={1} totalResults={3} pageSize={10} />
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
  page={page}
  totalPages={10}
  totalResults={97}
  pageSize={10}
  onChange={(p) => setPage(p)}
/>`}
						/>
					</Card>
				</div>
			</div>
		</div>
	)
}

export default PaginationDemo
