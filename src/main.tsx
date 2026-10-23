import { render } from 'preact'
import '@fontsource-variable/inter'
import '@fontsource/oswald/500.css'
import '@fontsource/oswald/600.css'
import './styles.css'
import { App } from './app'
import { initCloud } from './cloud'

render(<App />, document.getElementById('app')!)
initCloud()
