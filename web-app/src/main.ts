import { mount } from 'svelte'
import 'shared-ui/style.css'
import './themes/variables.css'
import 'shared-ui/src/styles/components.css'
import App from './App.svelte'

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app
