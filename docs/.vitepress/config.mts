import { resolve } from 'node:path'
import { defineConfig } from 'vitepress'
import { createSidebar } from '../../scripts/content.mjs'

const projectRoot = process.cwd()
const docsRoot = resolve(projectRoot, 'docs')

export default defineConfig({
  lang: 'zh-CN',
  title: 'ellephants',
  description: '由社群共同维护的知识、经验与创作地图。',
  base: process.env.DOCS_BASE || '/',
  cleanUrls: true,
  lastUpdated: true,
  srcExclude: ['_template.md'],
  outDir: resolve(projectRoot, 'dist'),
  cacheDir: resolve(projectRoot, '.cache/vitepress'),
  head: [
    ['meta', { name: 'theme-color', content: '#7a4a21' }],
    ['meta', { name: 'color-scheme', content: 'light dark' }],
    [
      'script',
      {},
      "try{document.documentElement.dataset.visualTheme=localStorage.getItem('ellephants-visual-theme')==='field'?'field':'classic'}catch(e){document.documentElement.dataset.visualTheme='classic'}"
    ]
  ],
  vite: {
    server: {
      host: '127.0.0.1',
      strictPort: true
    },
    preview: {
      host: '127.0.0.1',
      strictPort: true
    }
  },
  themeConfig: {
    logo: '/elephant-logo.jpg',
    siteTitle: 'ellephants',
    nav: [
      { text: '首页', link: '/' },
      { text: '知识地图', link: '/knowledge-map/' },
      { text: '参与共建', link: '/guide/contributing' },
      {
        text: '反馈问题',
        link: 'https://github.com/lil4notfound/ellephants/issues/new?template=feedback.yml'
      },
      {
        text: '提交内容',
        items: [
          { text: '提交原创内容', link: 'https://github.com/lil4notfound/ellephants/issues/new?template=content-submission.yml' },
          { text: '提交资源导览', link: 'https://github.com/lil4notfound/ellephants/issues/new?template=resource-submission.yml' }
        ]
      }
    ],
    sidebar: createSidebar(docsRoot),
    outline: {
      level: [2, 3],
      label: '本页目录'
    },
    search: {
      provider: 'local',
      options: {
        translations: {
          button: {
            buttonText: '搜索',
            buttonAriaLabel: '搜索知识库'
          },
          modal: {
            noResultsText: '没有找到相关内容',
            resetButtonTitle: '清除搜索',
            footer: {
              selectText: '选择',
              navigateText: '切换',
              closeText: '关闭'
            }
          }
        }
      }
    },
    docFooter: {
      prev: '上一篇',
      next: '下一篇'
    },
    lastUpdated: {
      text: '最后更新于',
      formatOptions: {
        dateStyle: 'medium',
        timeStyle: 'short'
      }
    },
    returnToTopLabel: '返回顶部',
    skipToContentLabel: '跳至正文',
    sidebarMenuLabel: '目录',
    darkModeSwitchLabel: '外观',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式',
    footer: {
      message: '原创内容采用 CC BY-SA 4.0；第三方内容除外',
      copyright: '© 2026 ellephants contributors'
    }
  }
})
