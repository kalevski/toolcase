import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { App } from './App'
import 'bootstrap-icons/font/bootstrap-icons.css'
import '@toolcase/react-components/style.css'
import { register } from '@toolcase/game-components'
import '@toolcase/game-components/style.css'
import { register as registerWebComponents } from '@toolcase/web-components'
import '@toolcase/web-components/style.css'
import './style.css'

window.addEventListener('DOMContentLoaded', () => {
    register()
    registerWebComponents()
    const root = document.getElementById('app')
    if (root) {
        createRoot(root).render(
            <BrowserRouter basename="/">
                <App />
            </BrowserRouter>
        )
    }
})
