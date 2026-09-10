import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import HomeTopics from './components/HomeTopics.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('HomeTopics', HomeTopics)
  }
} satisfies Theme
