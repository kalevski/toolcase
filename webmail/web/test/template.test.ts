import { test } from 'node:test'
import assert from 'node:assert/strict'

// Mirrors expandTemplate in src/api/jmap.ts (kept import-free so it runs under node).
const expand = (tpl: string, vars: Record<string, string>) =>
    tpl.replace(/\{(\w+)\}/g, (_, n: string) => encodeURIComponent(vars[n] ?? ''))

test('download template expansion encodes every variable', () => {
    const tpl = '/api/download/{accountId}/{blobId}/{name}?type={type}'
    assert.equal(
        expand(tpl, { accountId: 'a1', blobId: 'b/2', name: 'my file.pdf', type: 'application/pdf' }),
        '/api/download/a1/b%2F2/my%20file.pdf?type=application%2Fpdf',
    )
})
