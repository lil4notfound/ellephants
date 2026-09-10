import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import contentAreas from '../config/content-areas.json' with { type: 'json' }

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const fieldLabels = [
  '目标领域',
  '页面类型',
  '页面标题',
  '页面简介',
  '内容属性',
  '署名',
  '先修知识',
  '页面定位',
  '学习目标',
  '主要内容',
  '资料链接',
  '补充说明',
  '授权确认'
]

const targetAreas = new Map(
  contentAreas.map(({ label, directory, tags }) => [label, { directory, tags }])
)

const pageTypes = new Map([
  ['课程页', 'course'],
  ['专题文章', 'article']
])

const contentKinds = new Map([
  ['理论', 'theory'],
  ['实验', 'experiment'],
  ['方法', 'methods'],
  ['综合', 'overview']
])

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeResponse(value) {
  const cleaned = value
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim()

  return /^_?(?:no response|无回应)_?$/i.test(cleaned) ? '' : cleaned
}

export function parseIssueForm(body) {
  const markers = []

  for (const label of fieldLabels) {
    const pattern = new RegExp(`^###\\s+${escapeRegExp(label)}\\s*$`, 'm')
    const match = pattern.exec(body)
    if (match) markers.push({ label, index: match.index, end: match.index + match[0].length })
  }

  markers.sort((left, right) => left.index - right.index)
  const fields = new Map()

  for (let index = 0; index < markers.length; index += 1) {
    const marker = markers[index]
    const next = markers[index + 1]
    fields.set(marker.label, normalizeResponse(body.slice(marker.end, next?.index)))
  }

  return fields
}

function requireField(fields, label) {
  const value = fields.get(label)?.trim()
  if (!value) throw new Error(`缺少必填字段：${label}`)
  return value
}

function linesFrom(value) {
  if (!value || /^(?:无|暂无|none)$/i.test(value.trim())) return []

  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*+]\s+|\d+[.)、]\s*)/, '').trim())
    .filter(Boolean)
}

function bulletList(value) {
  return linesFrom(value).map((line) => `- ${line}`).join('\n')
}

function assertSafeMarkdown(value, label) {
  if (/<\/?[a-z][^>]*>/i.test(value) || /(?:javascript:|data:text\/html|\{\{)/i.test(value)) {
    throw new Error(`${label} 包含不支持的 HTML 或可执行内容`)
  }
}

function escapeTableCell(value) {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim()
}

function resourceTable(value) {
  const lines = linesFrom(value)
  if (lines.length === 0) return ''

  const rows = lines.map((line, index) => {
    const parts = line.split(/\s*[|｜]\s*/)
    if (parts.length !== 5 || parts.some((part) => !part.trim()) || !/^https?:\/\/[^\s<>]+$/i.test(parts[1])) {
      throw new Error(`资料链接第 ${index + 1} 行格式不正确`)
    }
    const [name, url, typeAndSize, rights, usage] = parts.map(escapeTableCell)
    return `| [${name}](${url}) | ${typeAndSize} | ${rights} | ${usage} |`
  })

  return [
    '## 资料与使用建议',
    '',
    '| 资料 | 类型和大小 | 来源与授权 | 使用说明 |',
    '| --- | --- | --- | --- |',
    ...rows
  ].join('\n')
}

function optionalSection(title, value, transform = (text) => text.trim()) {
  const content = transform(value)
  return content ? `## ${title}\n\n${content}` : ''
}

export function prepareSubmission({ body, issueNumber, issueAuthor }) {
  const fields = parseIssueForm(body)
  const targetLabel = requireField(fields, '目标领域')
  const typeLabel = requireField(fields, '页面类型')
  const title = requireField(fields, '页面标题').replace(/^#+\s*/, '').trim()
  const description = requireField(fields, '页面简介')
  const kindLabel = requireField(fields, '内容属性')
  const positioning = requireField(fields, '页面定位')
  const goals = requireField(fields, '学习目标')
  const mainContent = requireField(fields, '主要内容')
  const rights = requireField(fields, '授权确认')
  const target = targetAreas.get(targetLabel)
  const type = pageTypes.get(typeLabel)
  const kind = contentKinds.get(kindLabel)

  if (!target) throw new Error(`未知目标领域：${targetLabel}`)
  if (!type) throw new Error(`未知页面类型：${typeLabel}`)
  if (!kind) throw new Error(`未知内容属性：${kindLabel}`)
  if (!title) throw new Error('页面标题无效')
  if (!/-\s*\[[xX]\]/.test(rights)) throw new Error('授权确认尚未勾选')

  for (const [label, value] of fields) {
    if (label !== '授权确认') assertSafeMarkdown(value, label)
  }

  const numericIssueNumber = Number(issueNumber)
  if (!Number.isSafeInteger(numericIssueNumber) || numericIssueNumber <= 0) {
    throw new Error('Issue 编号无效')
  }

  const prerequisites = linesFrom(fields.get('先修知识'))
  const author = fields.get('署名')?.trim() || `@${issueAuthor}`
  const tags = [...target.tags, kind]
  const resourcesSection = resourceTable(fields.get('资料链接'))
  const notesSection = optionalSection('补充说明', fields.get('补充说明') || '')
  const prerequisitesSection = optionalSection('先修知识', fields.get('先修知识') || '', bulletList)
  const positionHeading = type === 'course' ? '课程定位' : '内容概述'
  const contentHeading = type === 'course' ? '内容地图' : '正文'

  return {
    directory: target.directory,
    filename: `contribution-${numericIssueNumber}.md`,
    replacements: {
      '{{TITLE_YAML}}': JSON.stringify(title),
      '{{DESCRIPTION_YAML}}': JSON.stringify(description),
      '{{ORDER}}': String(1000 + numericIssueNumber),
      '{{TYPE}}': type,
      '{{AUTHOR_YAML}}': JSON.stringify([author]),
      '{{TAGS_YAML}}': JSON.stringify(tags),
      '{{PREREQUISITES_YAML}}': JSON.stringify(prerequisites),
      '{{TITLE}}': title,
      '{{POSITION_HEADING}}': positionHeading,
      '{{POSITIONING}}': positioning,
      '{{PREREQUISITES_SECTION}}': prerequisitesSection,
      '{{GOALS}}': bulletList(goals),
      '{{CONTENT_HEADING}}': contentHeading,
      '{{MAIN_CONTENT}}': mainContent,
      '{{RESOURCES_SECTION}}': resourcesSection,
      '{{NOTES_SECTION}}': notesSection
    }
  }
}

export function renderSubmission(template, replacements) {
  let output = template
  for (const [token, value] of Object.entries(replacements)) output = output.replaceAll(token, value)

  const unresolved = output.match(/\{\{[A-Z_]+\}\}/g)
  if (unresolved) throw new Error(`模板存在未替换字段：${unresolved.join('、')}`)

  return `${output.replace(/\n{3,}/g, '\n\n').trim()}\n`
}

function main() {
  const issueBody = process.env.ISSUE_BODY || ''
  const issueNumber = process.env.ISSUE_NUMBER || ''
  const issueAuthor = process.env.ISSUE_AUTHOR || ''
  const submission = prepareSubmission({ body: issueBody, issueNumber, issueAuthor })

  if (process.argv.includes('--validate-only')) {
    console.log('内容投稿表单检查通过。')
    return
  }

  const outputRoot = resolve(process.env.CONTENT_OUTPUT_ROOT || projectRoot)
  const templatePath = resolve(projectRoot, 'docs/_template.md')
  const outputPath = resolve(outputRoot, submission.directory, submission.filename)

  if (existsSync(outputPath)) throw new Error(`目标页面已存在：${relative(outputRoot, outputPath)}`)

  const content = renderSubmission(readFileSync(templatePath, 'utf8'), submission.replacements)
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, content, 'utf8')

  const displayPath = relative(outputRoot, outputPath).split(sep).join('/')
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `content_path=${displayPath}\n`)
  console.log(`已生成 ${displayPath}`)
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
