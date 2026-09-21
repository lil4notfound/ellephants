import { createContentLoader } from 'vitepress'
import taxonomyNodes from '../config/taxonomy/nodes.json'

export type ContentOrigin = 'original' | 'resource'

export interface PublishedPage {
  contentId: string
  title: string
  description: string
  url: string
  directory: string
  order: number
  origin: ContentOrigin
  domainId: string
  branchId: string
  topicIds: string[]
  secondaryDomainIds: string[]
  keywords: string[]
  contentType: string
}

declare const data: PublishedPage[]
export { data }

interface TaxonomyNode {
  id: string
  kind: string
  label: string
  aliases?: string[]
  primaryParentId?: string
  directory?: string
  contentDirectories?: string[]
  route?: string
}

const branches = (taxonomyNodes as TaxonomyNode[]).filter((node) => node.kind === 'branch')
const domains = (taxonomyNodes as TaxonomyNode[]).filter((node) => node.kind === 'domain')

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string')
  if (typeof value !== 'string' || !value.trim()) return []

  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === 'string')
  } catch {
    // Legacy scalar values are handled below.
  }

  return value.split(/[,，、]/).map((item) => item.trim()).filter(Boolean)
}

function inferClassification(url: string, tags: string[]) {
  const matchingBranch = branches.find((branch) => {
    const directories = branch.contentDirectories || (branch.directory ? [branch.directory] : [])
    return directories.some((directory) => url.startsWith(`/${directory.replace(/^docs\//, '')}/`)) ||
      tags.some((tag) => tag === branch.label || branch.aliases?.includes(tag))
  })

  if (matchingBranch) {
    return { domainId: matchingBranch.primaryParentId || '', branchId: matchingBranch.id }
  }

  const matchingDomain = domains.find((domain) => (
    Boolean(domain.route && url.startsWith(domain.route)) || tags.includes(domain.label)
  ))
  return { domainId: matchingDomain?.id || '', branchId: '' }
}

export default createContentLoader<PublishedPage[]>('**/*.md', {
  transform(pages) {
    return pages
      .filter(({ frontmatter }) => !['home', 'index', 'guide'].includes(String(frontmatter.type)) && frontmatter.draft !== true)
      .map(({ url, frontmatter }) => {
        const tags = stringArray(frontmatter.tags)
        const inferred = inferClassification(url, tags)
        return {
          contentId: String(frontmatter.content_id || url),
          title: String(frontmatter.title || '未命名页面'),
          description: String(frontmatter.description || ''),
          url,
          directory: url.slice(0, url.lastIndexOf('/') + 1),
          order: Number.isFinite(frontmatter.order) ? frontmatter.order : 9999,
          origin: frontmatter.origin === 'resource' ? 'resource' : 'original',
          domainId: String(frontmatter.domain_id || inferred.domainId),
          branchId: String(frontmatter.branch_id || inferred.branchId),
          topicIds: stringArray(frontmatter.topic_ids),
          secondaryDomainIds: stringArray(frontmatter.secondary_domain_ids),
          keywords: stringArray(frontmatter.keywords),
          contentType: String(frontmatter.content_type || frontmatter.type || 'article')
        }
      })
      .sort((left, right) => {
        if (left.domainId !== right.domainId) return left.domainId.localeCompare(right.domainId)
        if (left.branchId !== right.branchId) return left.branchId.localeCompare(right.branchId)
        if (left.order !== right.order) return left.order - right.order
        return left.title.localeCompare(right.title, 'zh-CN', { numeric: true })
      })
  }
})
