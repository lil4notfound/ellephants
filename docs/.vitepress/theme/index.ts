import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import DirectoryContents from './components/DirectoryContents.vue'
import HomeTopics from './components/HomeTopics.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('DirectoryContents', DirectoryContents)
    app.component('HomeTopics', HomeTopics)
  }
} satisfies Theme
