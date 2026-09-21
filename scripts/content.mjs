import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { basename, join, relative, sep } from 'node:path'
import { parse } from 'yaml'
import { branchesForDomain, domains } from './taxonomy.mjs'

const ignoredDirectories = new Set(['assets', 'public', '.vitepress'])

export function parseFrontmatter(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return {}
  const data = parse(match[1])
  return data && typeof data === 'object' ? data : {}
}

export function markdownBody(source) {
  return source.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n)*/, '')
}

function titleFromSource(source, fallback) {
  const frontmatter = parseFrontmatter(source)
  if (frontmatter.title) return String(frontmatter.title)

  const heading = source.replace(/^---\r?\n[\s\S]*?\r?\n---/, '').match(/^#\s+(.+)$/m)
  return heading?.[1]?.trim() || fallback
}

function pageInfo(filePath, docsRoot) {
  const source = readFileSync(filePath, 'utf8')
  const frontmatter = parseFrontmatter(source)
  const relativePath = relative(docsRoot, filePath).split(sep).join('/')
  const withoutExtension = relativePath.replace(/\.md$/, '')
  const route = withoutExtension === 'index'
    ? '/'
    : withoutExtension.endsWith('/index')
      ? `/${withoutExtension.slice(0, -6)}`
      : `/${withoutExtension}`

  return {
    text: titleFromSource(source, basename(filePath, '.md')),
    link: route,
    order: Number.isFinite(frontmatter.order) ? frontmatter.order : 9999,
    draft: frontmatter.draft === true
  }
}

function compareItems(left, right) {
  if (left.order !== right.order) return left.order - right.order
  return left.text.localeCompare(right.text, 'zh-CN', { numeric: true })
}

function walkDirectory(directory, docsRoot) {
  const entries = readdirSync(directory, { withFileTypes: true })
  const pages = []
  const sections = []

  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name.startsWith('_')) continue

    const entryPath = join(directory, entry.name)

    if (entry.isDirectory()) {
      if (ignoredDirectories.has(entry.name)) continue

      const sectionIndex = join(entryPath, 'index.md')
      const indexInfo = existsSync(sectionIndex)
        ? pageInfo(sectionIndex, docsRoot)
        : { text: entry.name, link: undefined, order: 9999, draft: false }
      const items = walkDirectory(entryPath, docsRoot)

      if (!indexInfo.draft && items.length > 0) {
        sections.push({
          text: indexInfo.text,
          link: indexInfo.link,
          order: indexInfo.order,
          collapsed: false,
          items
        })
      } else if (!indexInfo.draft && indexInfo.link) {
        pages.push(indexInfo)
      }
      continue
    }

    if (!entry.isFile() || !entry.name.endsWith('.md') || entry.name === 'index.md') continue

    const info = pageInfo(entryPath, docsRoot)
    if (!info.draft) pages.push(info)
  }

  const items = [...pages, ...sections].sort(compareItems)
  return items.map(({ order: _order, draft: _draft, ...item }) => item)
}

export function createSidebar(docsRoot) {
  if (!existsSync(docsRoot)) return []

  const collectContentPages = (directories) => directories.flatMap((directory) => {
    const absoluteDirectory = join(docsRoot, directory.replace(/^docs[\\/]/, ''))
    if (!existsSync(absoluteDirectory)) return []
    return walkDirectory(absoluteDirectory, docsRoot).filter((item) => item.link)
  })

  const sidebar = [
    { text: '知识地图', link: '/knowledge-map/' }
  ]

  for (const domain of domains) {
    const domainBranches = branchesForDomain(domain.id)
    const items = domainBranches.length > 0
      ? domainBranches.map((branch) => ({
          text: branch.label,
          link: branch.route,
          collapsed: true,
          items: collectContentPages(branch.contentDirectories || [branch.directory])
            .map(({ order: _order, draft: _draft, ...item }) => item)
        }))
      : collectContentPages([domain.directory])

    sidebar.push({
      text: domain.label,
      link: domain.route,
      collapsed: domain.id === 'situation' || domain.id === 'furry',
      items
    })
  }

  const guideDirectory = join(docsRoot, 'guide')
  if (existsSync(guideDirectory)) {
    sidebar.push({
      text: '参与共建',
      link: '/guide/',
      collapsed: true,
      items: walkDirectory(guideDirectory, docsRoot)
    })
  }

  return sidebar
}
