import { createRoot } from 'react-dom/client'
import { register as registerWebComponents, configureMessages } from '@toolcase/web-components'
import '@toolcase/web-components/style.css'
import '@fontsource/space-grotesk/400.css'
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/600.css'
import '@fontsource/space-grotesk/700.css'
import '@fontsource/chakra-petch/500.css'
import '@fontsource/chakra-petch/600.css'
import '@fontsource/chakra-petch/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
// Side-effect import: React JSX typings for every tc-* tag.
import '@toolcase/web-components/react'
import './styles/blueprint.css'
import './styles/app.css'
import './styles/skin.css'
import { App } from './App'
import { pickLocale, setLocale, t } from './i18n'

setLocale(pickLocale())
configureMessages({
    close: t('common.close'),
    loading: t('common.loading'),
    back: t('common.back'),
})
registerWebComponents()

const root = document.getElementById('app')
if (root) createRoot(root).render(<App />)
