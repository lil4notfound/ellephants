import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import DirectoryContents from './components/DirectoryContents.vue'
import HomeTopics from './components/HomeTopics.vue'
import VisualThemeSwitch from './components/VisualThemeSwitch.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      'nav-bar-content-after': () => h(VisualThemeSwitch)
    }),
  enhanceApp({ app }) {
    app.component('DirectoryContents', DirectoryContents)
    app.component('HomeTopics', HomeTopics)
  }
} satisfies Theme
