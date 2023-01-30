import StateExample from './StateExample'

const examples = new Map()
const DEFAULT_EXAMPLE = 'StateExample'


examples.set('StateExample', StateExample)

let url = new window.URL(window.location.href)
let key = url.searchParams.get('scene') || DEFAULT_EXAMPLE
if (!examples.has(key)) {
    key = DEFAULT_EXAMPLE
}
let Class = examples.get(key)
let example = new Class()
example.run()
