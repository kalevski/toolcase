import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ExtendedSelect } from '../src/ExtendedSelect'
import { OTPInput } from '../src/OTPInput'
import { PhoneInput } from '../src/PhoneInput'
import { MultiCardSelect } from '../src/MultiCardSelect'
import { SingleCardSelect } from '../src/SingleCardSelect'
import { ToggleCard } from '../src/ToggleCard'
import { VersionPicker } from '../src/VersionPicker'
import { Form } from '../src/Form'

// improvements/03 — every value-holding control must be able to participate in
// native <form> submission via `name` (hidden input or native element).

const hidden = (name: string, value: string) =>
    new RegExp(`<input[^>]*type="hidden"[^>]*name="${name}"[^>]*value="${value}"`)

describe('native form integration', () => {
    it('ExtendedSelect renders a hidden input for the selected key', () => {
        const html = renderToStaticMarkup(
            <ExtendedSelect name="plan" value="pro" items={[{ key: 'pro', name: 'Pro' }]} />,
        )
        expect(html).toMatch(hidden('plan', 'pro'))
    })

    it('OTPInput renders a hidden input with the joined code', () => {
        const html = renderToStaticMarkup(<OTPInput name="otp" value="123456" />)
        expect(html).toMatch(hidden('otp', '123456'))
    })

    it('PhoneInput renders a hidden input with the full value', () => {
        const html = renderToStaticMarkup(<PhoneInput name="phone" value="+15551234" />)
        expect(html).toMatch(hidden('phone', '\\+15551234'))
    })

    it('MultiCardSelect renders one hidden input per selected key', () => {
        const html = renderToStaticMarkup(
            <MultiCardSelect
                name="features"
                value={['a', 'c']}
                options={[
                    { key: 'a', title: 'A' },
                    { key: 'b', title: 'B' },
                    { key: 'c', title: 'C' },
                ]}
            />,
        )
        expect(html).toMatch(hidden('features', 'a'))
        expect(html).toMatch(hidden('features', 'c'))
        expect(html).not.toMatch(hidden('features', 'b'))
    })

    it('SingleCardSelect renders a hidden input for the selection', () => {
        const html = renderToStaticMarkup(
            <SingleCardSelect name="tier" value="x" options={[{ key: 'x', title: 'X' }]} />,
        )
        expect(html).toMatch(hidden('tier', 'x'))
    })

    it('ToggleCard uses checkbox semantics (present only while checked)', () => {
        const on = renderToStaticMarkup(<ToggleCard name="beta" checked label="Beta" />)
        const off = renderToStaticMarkup(<ToggleCard name="beta" checked={false} label="Beta" />)
        expect(on).toMatch(hidden('beta', 'on'))
        expect(off).not.toMatch(/type="hidden"/)
    })

    it('VersionPicker submits via native select (dropdown) and hidden input (segmented)', () => {
        const versions = [{ value: '1', label: 'v1' }]
        const dropdown = renderToStaticMarkup(
            <VersionPicker name="v" variant="dropdown" versions={versions} value="1" onChange={() => {}} />,
        )
        const segmented = renderToStaticMarkup(
            <VersionPicker name="v" variant="segmented" versions={versions} value="1" onChange={() => {}} />,
        )
        expect(dropdown).toMatch(/<select[^>]*name="v"/)
        expect(segmented).toMatch(hidden('v', '1'))
    })

    it('Form passes method/action through for native submission', () => {
        const html = renderToStaticMarkup(
            <Form wrapper={false} action="/subscribe" method="post">
                <button type="submit">go</button>
            </Form>,
        )
        expect(html).toMatch(/<form[^>]*action="\/subscribe"/)
        expect(html).toMatch(/<form[^>]*method="post"/)
    })
})
