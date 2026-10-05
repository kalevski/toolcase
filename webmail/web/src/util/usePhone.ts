import { useEffect, useState } from 'react'

const QUERY = '(max-width: 767.98px)'

function matches(): boolean {
    try {
        return window.matchMedia(QUERY).matches
    } catch {
        return false
    }
}

export function usePhone(): boolean {
    const [phone, setPhone] = useState(matches)
    useEffect(() => {
        const mq = window.matchMedia(QUERY)
        const onChange = () => setPhone(mq.matches)
        onChange()
        mq.addEventListener('change', onChange)
        return () => mq.removeEventListener('change', onChange)
    }, [])
    return phone
}
