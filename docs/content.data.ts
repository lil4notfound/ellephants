import { createContentLoader } from 'vitepress'

export interface PublishedPage {
  title: string
  description: string
  url: string
  directory: string
  order: number
}

declare const data: PublishedPage[]
export { data }

export default createContentLoader<PublishedPage[]>('**/*.md', {
  transform(pages) {
    return pages
      .filter(({ frontmatter }) => frontmatter.type !== 'index' && frontmatter.draft !== true)
      .map(({ url, frontmatter }) => ({
        title: String(frontmatter.title || '未命名页面'),
        description: String(frontmatter.description || ''),
        url,
        directory: url.slice(0, url.lastIndexOf('/') + 1),
        order: Number.isFinite(frontmatter.order) ? frontmatter.order : 9999
      }))
      .sort((left, right) => {
        if (left.directory !== right.directory) {
          return left.directory.localeCompare(right.directory, 'zh-CN')
        }

        if (left.order !== right.order) return left.order - right.order
        return left.title.localeCompare(right.title, 'zh-CN', { numeric: true })
      })
  }
})
