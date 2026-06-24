let _count = 0
let _savedOverflow: string | null = null

export function lockBody(): void {
    if (_count === 0) {
        _savedOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        document.body.classList.add('modal-open')
    }
    _count++
}

export function unlockBody(): void {
    if (_count === 0) return
    _count--
    if (_count === 0) {
        document.body.classList.remove('modal-open')
        document.body.style.overflow = _savedOverflow ?? ''
        _savedOverflow = null
    }
}
