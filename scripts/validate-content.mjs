import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseFrontmatter } from './content.mjs'
import { getNode } from './taxonomy.mjs'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const docsRoot = join(projectRoot, 'docs')
const errors = []
const allowedTypes = new Set(['home', 'index', 'guide', 'course', 'article'])
const allowedStatuses = new Set(['stub', 'draft', 'review', 'published'])
const allowedMediaRepostPreferences = new Set(['declined', 'attributed', 'anonymous'])
const administrativeFields = new Set([
  'course-number',
  'course_number',
  'credits',
  'credit',
  'semester',
  'class-hours',
  'class_hours'
])

function collectMarkdown(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') return []

    const entryPath = join(directory, entry.name)
    if (entry.isDirectory()) return collectMarkdown(entryPath)
    if (entry.isFile() && extname(entry.name) === '.md') return [entryPath]
    return []
  })
}

function displayPath(filePath) {
  return relative(projectRoot, filePath).split(sep).join('/')
}

function validateName(filePath) {
  const path = displayPath(filePath)
  const segments = path.split('/').slice(1)

  for (const segment of segments) {
    if (segment === '_template.md') continue
    if (!/^[a-z0-9-]+(?:\.md)?$/.test(segment)) {
      errors.push(`${path}: 文件和目录名只能使用小写英文、数字和连字符`)
      return
    }
  }
}

function resolveLocalTarget(filePath, rawTarget) {
  const cleanTarget = decodeURIComponent(rawTarget.split('#')[0].split('?')[0])
  if (!cleanTarget) return true

  const absolute = cleanTarget.startsWith('/')
    ? join(docsRoot, cleanTarget.slice(1))
    : resolve(dirname(filePath), cleanTarget)

  const candidates = extname(absolute)
    ? [absolute]
    : [absolute, `${absolute}.md`, join(absolute, 'index.md')]

  return candidates.some((candidate) => existsSync(candidate))
}

function validateLinks(filePath, source) {
  const linkPattern = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g

  for (const match of source.matchAll(linkPattern)) {
    const target = match[1].replace(/^<|>$/g, '')
    if (/^(?:https?:|mailto:|tel:|data:|#)/.test(target)) continue

    if (!resolveLocalTarget(filePath, target)) {
      errors.push(`${displayPath(filePath)}: 找不到链接目标 ${target}`)
    }
  }
}

function validateAttachments(filePath, rawValue) {
  if (!rawValue) return

  let attachments
  if (Array.isArray(rawValue)) {
    attachments = rawValue
  } else {
    try {
      attachments = JSON.parse(String(rawValue))
    } catch {
      errors.push(`${displayPath(filePath)}: attachments 必须是有效的数组`)
      return
    }
  }

  if (!Array.isArray(attachments)) {
    errors.push(`${displayPath(filePath)}: attachments 必须是数组`)
    return
  }

  for (const [index, attachment] of attachments.entries()) {
    const label = `attachments[${index}]`
    if (
      typeof attachment !== 'object' ||
      attachment === null ||
      typeof attachment.name !== 'string' ||
      !attachment.name.trim() ||
      typeof attachment.url !== 'string' ||
      !/^\/attachments\/contribution-\d+\/attachment-\d+\.(?:pdf|docx|xlsx|pptx|zip|gz|tar\.gz|txt|csv)$/.test(attachment.url)
    ) {
      errors.push(`${displayPath(filePath)}: ${label} 的名称或路径无效`)
      continue
    }

    const assetPath = join(docsRoot, 'public', attachment.url.slice(1))
    if (!existsSync(assetPath)) {
      errors.push(`${displayPath(filePath)}: 找不到附件 ${attachment.url}`)
      continue
    }

    if (Number.isFinite(attachment.size) && statSync(assetPath).size !== attachment.size) {
      errors.push(`${displayPath(filePath)}: 附件 ${attachment.url} 的文件大小与元信息不一致`)
    }
  }
}

function validateClassification(filePath, frontmatter) {
  const hasNewClassification = Boolean(
    frontmatter.content_id || frontmatter.domain_id || frontmatter.branch_id || frontmatter.topic_ids
  )
  if (!hasNewClassification) return

  const path = displayPath(filePath)
  const domain = getNode(frontmatter.domain_id)
  const branch = frontmatter.branch_id ? getNode(frontmatter.branch_id) : undefined
  if (!frontmatter.content_id) errors.push(`${path}: 缺少 content_id`)
  if (!['original', 'resource'].includes(frontmatter.origin)) errors.push(`${path}: origin 必须是 original 或 resource`)
  if (!domain || domain.kind !== 'domain') errors.push(`${path}: domain_id 无效`)
  if (domain && ['mathematics', 'physics'].includes(domain.id) && (!branch || branch.kind !== 'branch')) {
    errors.push(`${path}: 数学和物理内容必须填写有效的 branch_id`)
  }
  if (branch && branch.primaryParentId !== domain?.id) errors.push(`${path}: branch_id 不属于 domain_id`)
  if (!Array.isArray(frontmatter.topic_ids)) errors.push(`${path}: topic_ids 必须是数组`)
  for (const topicId of frontmatter.topic_ids || []) {
    const topic = getNode(topicId)
    if (!topic || topic.kind !== 'concept') errors.push(`${path}: topic_ids 包含未知主题 ${topicId}`)
  }
  if (frontmatter.secondary_domain_ids && !Array.isArray(frontmatter.secondary_domain_ids)) {
    errors.push(`${path}: secondary_domain_ids 必须是数组`)
  }
  for (const domainId of frontmatter.secondary_domain_ids || []) {
    const secondaryDomain = getNode(domainId)
    if (!secondaryDomain || secondaryDomain.kind !== 'domain') errors.push(`${path}: 次要领域无效 ${domainId}`)
    if (domainId === frontmatter.domain_id) errors.push(`${path}: 次要领域不能与主领域重复`)
  }
  if (frontmatter.keywords && !Array.isArray(frontmatter.keywords)) errors.push(`${path}: keywords 必须是数组`)
}

for (const filePath of collectMarkdown(docsRoot)) {
  const source = readFileSync(filePath, 'utf8')
  validateName(filePath)

  if (filePath.endsWith('_template.md')) continue

  const frontmatter = parseFrontmatter(source)

  if (!frontmatter.title) {
    errors.push(`${displayPath(filePath)}: 缺少 front matter 字段 title`)
  }

  if (!frontmatter.description) {
    errors.push(`${displayPath(filePath)}: 缺少 front matter 字段 description`)
  }

  if (!Number.isFinite(frontmatter.order)) {
    errors.push(`${displayPath(filePath)}: 缺少数字类型的 front matter 字段 order`)
  }

  if (!allowedTypes.has(frontmatter.type)) {
    errors.push(`${displayPath(filePath)}: type 必须是 ${[...allowedTypes].join('、')} 之一`)
  }

  if (!allowedStatuses.has(frontmatter.status)) {
    errors.push(`${displayPath(filePath)}: status 必须是 ${[...allowedStatuses].join('、')} 之一`)
  }

  if (frontmatter.type === 'course' || frontmatter.type === 'article') {
    if (!frontmatter.authors) {
      errors.push(`${displayPath(filePath)}: course 和 article 页面必须填写 authors`)
    }

    if (!frontmatter.tags) {
      errors.push(`${displayPath(filePath)}: course 和 article 页面必须填写 tags`)
    }

    if (frontmatter.license !== 'CC-BY-SA-4.0') {
      errors.push(`${displayPath(filePath)}: course 和 article 页面必须使用 CC-BY-SA-4.0`)
    }

    if (
      frontmatter.media_repost_preference &&
      !allowedMediaRepostPreferences.has(frontmatter.media_repost_preference)
    ) {
      errors.push(`${displayPath(filePath)}: media_repost_preference 取值无效`)
    }

    validateAttachments(filePath, frontmatter.attachments)
    validateClassification(filePath, frontmatter)
  }

  for (const field of administrativeFields) {
    if (Object.hasOwn(frontmatter, field)) {
      errors.push(`${displayPath(filePath)}: 不应在 front matter 中记录行政字段 ${field}`)
    }
  }

  if (frontmatter.status === 'published' && /此处用于|\bTODO\b|\bTBD\b/i.test(source)) {
    errors.push(`${displayPath(filePath)}: published 页面不能保留占位语或 TODO`)
  }

  validateLinks(filePath, source)
}

if (errors.length > 0) {
  console.error(`内容检查失败，共 ${errors.length} 项：`)
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('内容检查通过。')
