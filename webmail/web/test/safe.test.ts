import { test } from 'node:test'
import assert from 'node:assert/strict'
import { domainOf, failedAuthChecks, isEmail, isHexColor, isHttpUrl } from '../src/util/safe.ts'

test('isHttpUrl accepts only http(s)', () => {
    assert.equal(isHttpUrl('https://cdn.example.org/logo.png'), true)
    assert.equal(isHttpUrl('javascript:alert(1)'), false)
    assert.equal(isHttpUrl('data:image/png;base64,AAAA'), false)
    assert.equal(isHttpUrl(''), false)
    assert.equal(isHttpUrl(42), false)
})

test('isHexColor', () => {
    assert.equal(isHexColor('#1a2B3c'), true)
    assert.equal(isHexColor('#abc'), true)
    assert.equal(isHexColor('red'), false)
    assert.equal(isHexColor('#123456; background:url(x)'), false)
})

test('domainOf partial addresses', () => {
    assert.equal(domainOf('anna@acme.com'), 'acme.com')
    assert.equal(domainOf('anna@acme'), '')
    assert.equal(domainOf('anna'), '')
    assert.equal(domainOf('@acme.com'), '')
})

test('isEmail', () => {
    assert.equal(isEmail('a@b.co'), true)
    assert.equal(isEmail('a b@c.d'), false)
})

test('failedAuthChecks reports fail/softfail only', () => {
    const h = 'mx.example; spf=softfail smtp.mailfrom=x; dkim=pass header.d=x; dmarc=fail'
    assert.deepEqual(failedAuthChecks(h), ['SPF', 'DMARC'])
    assert.deepEqual(failedAuthChecks('mx; spf=pass; dkim=none'), [])
    assert.deepEqual(failedAuthChecks(null), [])
})
