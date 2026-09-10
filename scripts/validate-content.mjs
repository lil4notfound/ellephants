import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseFrontmatter } from './content.mjs'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const docsRoot = join(projectRoot, 'docs')
const errors = []
const allowedTypes = new Set(['home', 'index', 'guide', 'course', 'article'])
const allowedStatuses = new Set(['stub', 'draft', 'review', 'published'])
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

for (const filePath of collectMarkdown(docsRoot)) {
  const source = readFileSync(filePath, 'utf8')
  const frontmatter = parseFrontmatter(source)

  validateName(filePath)

  if (filePath.endsWith('_template.md')) continue

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
