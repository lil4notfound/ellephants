import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import AttachmentDownloads from './components/AttachmentDownloads.vue'
import BranchDirectory from './components/BranchDirectory.vue'
import DirectoryContents from './components/DirectoryContents.vue'
import DomainDirectory from './components/DomainDirectory.vue'
import HomeTopics from './components/HomeTopics.vue'
import KnowledgeAtlas from './components/KnowledgeAtlas.vue'
import VisualThemeSwitch from './components/VisualThemeSwitch.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      'nav-bar-content-after': () => h(VisualThemeSwitch)
    }),
  enhanceApp({ app }) {
    app.component('AttachmentDownloads', AttachmentDownloads)
    app.component('BranchDirectory', BranchDirectory)
    app.component('DirectoryContents', DirectoryContents)
    app.component('DomainDirectory', DomainDirectory)
    app.component('HomeTopics', HomeTopics)
    app.component('KnowledgeAtlas', KnowledgeAtlas)
  }
} satisfies Theme
