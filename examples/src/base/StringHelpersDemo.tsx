import { useState } from 'react'
import { slugify, truncate, escapeHtml } from '@toolcase/base'
import { captureConsole, DemoSection, type LogEntry } from './_demo/ConsoleDemo'

const code = `// slugify — URL-safe slug from any string
slugify('Hello, World!')        // 'hello-world'
slugify('  héllo wörld  ')      // 'hello-world'
slugify('café')                 // 'cafe'
slugify('My Post Title 2024')   // 'my-post-title-2024'
slugify('!!!---')               // ''

// truncate — shorten with a suffix
truncate('hello world', 8)          // 'hello w…'
truncate('hello world', 8, '...')   // 'hello...'
truncate('short', 10)               // 'short'

// escapeHtml — make user input safe for innerHTML
escapeHtml('& < > " \'')
// '&amp; &lt; &gt; &quot; &#39;'
escapeHtml('<script>alert("XSS")</script>')
// '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'`

export const StringHelpersDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])

    const run = () => setLogs(captureConsole(() => {
        console.log('── slugify ──')
        console.log(slugify('Hello, World!'))
        console.log(slugify('  héllo wörld  '))
        console.log(slugify('café'))
        console.log(slugify('My Post Title 2024'))
        console.log(slugify('hello--world'))
        console.log(slugify('!!!---'))

        console.log('')
        console.log('── truncate ──')
        console.log(truncate('hello world', 8))
        console.log(truncate('hello world', 8, '...'))
        console.log(truncate('short', 10))
        console.log(truncate('hi', 1, '…'))

        console.log('')
        console.log('── escapeHtml ──')
        console.log(escapeHtml('& < > " \''))
        console.log(escapeHtml('<script>alert("XSS")</script>'))
        console.log(escapeHtml('hello world'))
    }))

    return (
        <DemoSection
            title="String Helpers"
            description="slugify converts any string to a URL-safe slug; truncate shortens text with a configurable suffix; escapeHtml replaces HTML special characters to prevent XSS."
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default StringHelpersDemo
