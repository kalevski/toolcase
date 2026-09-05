import React, { useEffect, useRef, useState } from 'react'

const note: React.CSSProperties = {
    fontSize: '0.8125rem',
    color: 'var(--tc-text-muted)',
    lineHeight: 1.5,
}
const code: React.CSSProperties = {
    fontFamily: 'var(--tc-font-mono)',
    fontSize: '0.75rem',
    whiteSpace: 'pre-wrap',
    background: 'var(--tc-surface-muted)',
    padding: '0.75rem',
    color: 'var(--tc-text-muted)',
}

const FIELDS = [
    {
        key: 'price',
        label: 'Price',
        type: 'number' as const,
        operators: ['lt', 'lte', 'gt', 'gte', 'eq'],
    },
    { key: 'year', label: 'Year', type: 'number' as const, operators: ['gte', 'lte', 'eq'] },
    {
        key: 'fuel',
        label: 'Fuel',
        type: 'select' as const,
        operators: ['eq', 'ne', 'in'],
        options: [
            { value: 'diesel', label: 'Diesel' },
            { value: 'petrol', label: 'Petrol' },
            { value: 'hybrid', label: 'Hybrid' },
        ],
    },
    { key: 'notes', label: 'Notes', type: 'text' as const, operators: ['eq', 'isNull'] },
]

const LABELS = {
    eq: 'is',
    ne: 'is not',
    lt: 'under',
    lte: 'at most',
    gt: 'over',
    gte: 'at least',
    in: 'one of',
    isNull: 'is empty',
}

const SEED = {
    combinator: 'all' as const,
    children: [
        { field: 'price', operator: 'lte', value: '9000' },
        {
            combinator: 'any' as const,
            children: [
                { field: 'fuel', operator: 'eq', value: 'diesel' },
                { field: 'fuel', operator: 'eq', value: 'hybrid' },
            ],
        },
    ],
}

const ConditionBuilderDemo: React.FC = () => {
    const [tree, setTree] = useState<unknown>(SEED)
    const ref = useRef<HTMLElement>(null)

    useEffect(() => {
        const node = ref.current as never as {
            fields: unknown
            operatorLabels: unknown
            value: unknown
        } | null
        if (!node) return
        node.fields = FIELDS
        node.operatorLabels = LABELS
        node.value = SEED
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="ConditionBuilder"
                            description="A nested and/or tree of field · operator · value leaves. polovni.mk's RuleEditor and webgame.cloud's SchemaEditor are the same shape; nothing in the library covered it."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Advanced
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-3 mt-4">
                            <tc-section-card title="Build a rule">
                                <tc-condition-builder
                                    ref={ref}
                                    ontc-change={(e) => setTree(e.detail.value)}
                                />
                                <p style={note} className="mt-3">
                                    <strong>The vocabulary is closed.</strong> Fields come from{' '}
                                    <code>fields</code>, operators from each field's own list, so
                                    every control is a choice over something the evaluating side
                                    already accepts — the editor cannot express a rule the
                                    interpreter would choke on.
                                </p>
                                <p style={note}>
                                    Changing a field drops an operator the new field does not
                                    accept: silently keeping it is how a tree ends up holding a
                                    condition the evaluator rejects. A nullary operator („is empty")
                                    has no value cell at all, rather than a disabled input beside
                                    it.
                                </p>
                            </tc-section-card>

                            <tc-section-card title="What comes out">
                                <pre style={code}>{JSON.stringify(tree, null, 2)}</pre>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ConditionBuilderDemo
