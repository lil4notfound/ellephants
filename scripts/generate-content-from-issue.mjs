import { Buffer } from 'node:buffer'
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  branchesForDomain,
  domains,
  getNode,
  resolveSubmissionArea,
  resolveTopics,
  splitTerms
} from './taxonomy.mjs'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const fieldLabels = [
  '领域',
  '主分支',
  '主题词',
  '次要领域',
  '内容形式',
  '资源类型',
  '目标领域',
  '页面类型',
  '页面标题',
  '页面简介',
  '内容属性',
  '署名',
  '导览署名',
  '先修知识',
  '内容范围',
  '页面定位',
  '阅读收获',
  '学习目标',
  '主要内容',
  '资源作者或机构',
  '来源地址',
  '访问方式',
  '版权或使用依据',
  '推荐说明',
  '资料链接',
  '附件',
  '补充说明',
  '媒体平台转发偏好',
  '授权确认'
]

const pageTypes = new Map([
  ['课程页', 'course'],
  ['专题文章', 'article']
])

const originalContentTypes = new Map([
  ['文章', { pageType: 'article', contentType: 'article' }],
  ['教程或课程', { pageType: 'course', contentType: 'tutorial' }],
  ['笔记', { pageType: 'article', contentType: 'notes' }],
  ['经验与方法', { pageType: 'article', contentType: 'experience' }],
  ['创作', { pageType: 'article', contentType: 'creation' }]
])

const resourceTypes = new Map([
  ['书籍', 'book'],
  ['论文', 'paper'],
  ['网站', 'website'],
  ['软件或工具', 'software'],
  ['视频或音频', 'media'],
  ['数据集', 'dataset'],
  ['其他资源', 'other']
])

const contentKinds = new Map([
  ['理论', 'theory'],
  ['实验', 'experiment'],
  ['方法', 'methods'],
  ['综合', 'overview']
])

const mediaRepostPreferences = new Map([
  ['不允许原野象群媒体账号转发', 'declined'],
  ['允许转发并保留署名', 'attributed'],
  ['允许转发且无需署名', 'anonymous']
])

const allowedAttachmentExtensions = new Set([
  '.pdf',
  '.docx',
  '.xlsx',
  '.pptx',
  '.zip',
  '.gz',
  '.tar.gz',
  '.txt',
  '.csv'
])
const maxAttachmentCount = 5
const maxAttachmentBytes = 25 * 1024 * 1024

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

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
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
    '## 资料链接',
    '',
    '| 资料 | 类型和大小 | 来源与授权 | 使用说明 |',
    '| --- | --- | --- | --- |',
    ...rows
  ].join('\n')
}

function attachmentExtension(name) {
  const normalized = name.toLowerCase()
  if (normalized.endsWith('.tar.gz')) return '.tar.gz'
  const match = normalized.match(/\.[a-z0-9]+$/)
  return match?.[0] || ''
}

function validateAttachmentUrl(rawUrl) {
  let url
  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error(`附件链接无效：${rawUrl}`)
  }

  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'github.com' ||
    !/^\/user-attachments\/(?:files|assets)\//.test(url.pathname)
  ) {
    throw new Error('附件必须通过表单的上传控件提交')
  }

  return url.toString()
}

function normalizeAttachmentName(value) {
  const name = value
    .replace(/\\([\\`*{}\[\]()#+.!_>-])/g, '$1')
    .split(/[\\/]/)
    .pop()
    ?.trim()

  if (!name || name.length > 180 || /[\u0000-\u001f<>]/.test(name)) {
    throw new Error('附件文件名无效或过长')
  }

  return name
}

export function parseAttachments(value, issueNumber) {
  if (!value || /^(?:无|暂无|none)$/i.test(value.trim())) return []

  const entries = []
  const seenUrls = new Set()
  const markdownLinkPattern = /!?\[((?:\\.|[^\]\r\n])+)\]\((https:\/\/github\.com\/user-attachments\/(?:files|assets)\/[^)\s]+)\)/gi

  for (const match of value.matchAll(markdownLinkPattern)) {
    const sourceUrl = validateAttachmentUrl(match[2])
    if (seenUrls.has(sourceUrl)) continue
    seenUrls.add(sourceUrl)
    entries.push({ name: normalizeAttachmentName(match[1]), sourceUrl })
  }

  const plainUrlPattern = /https:\/\/github\.com\/user-attachments\/(?:files|assets)\/[^\s)]+/gi
  for (const match of value.matchAll(plainUrlPattern)) {
    const sourceUrl = validateAttachmentUrl(match[0])
    if (seenUrls.has(sourceUrl)) continue
    seenUrls.add(sourceUrl)

    const pathname = new URL(sourceUrl).pathname
    const fallbackName = decodeURIComponent(pathname.slice(pathname.lastIndexOf('/') + 1))
    entries.push({ name: normalizeAttachmentName(fallbackName), sourceUrl })
  }

  if (entries.length === 0) throw new Error('附件字段中没有可识别的上传文件')
  if (entries.length > maxAttachmentCount) throw new Error(`每次投稿最多上传 ${maxAttachmentCount} 个附件`)

  return entries.map((entry, index) => {
    const extension = attachmentExtension(entry.name)
    if (!allowedAttachmentExtensions.has(extension)) {
      throw new Error(`附件 ${entry.name} 的文件类型不受支持`)
    }

    const storageFilename = `attachment-${index + 1}${extension}`
    return {
      ...entry,
      storageFilename,
      url: `/attachments/contribution-${issueNumber}/${storageFilename}`
    }
  })
}

function publishedAttachments(attachments) {
  return attachments.map(({ name, url, size }) => ({
    name,
    url,
    ...(Number.isFinite(size) ? { size } : {})
  }))
}

function attachmentReplacements(attachments) {
  return {
    '{{ATTACHMENTS_YAML}}': JSON.stringify(publishedAttachments(attachments)),
    '{{ATTACHMENTS_SECTION}}': attachments.length > 0 ? '## 附件\n\n<AttachmentDownloads />' : ''
  }
}

function optionalSection(title, value, transform = (text) => text.trim()) {
  const content = transform(value)
  return content ? `## ${title}\n\n${content}` : ''
}

function requireHttpUrl(value, label) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${label} 必须是有效的网址`)
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`${label} 只支持 HTTP 或 HTTPS`)
  return url.toString()
}

function resourceDetailsSection({ creators, sourceUrl, accessMethod, rightsBasis }) {
  return [
    '## 资源信息',
    '',
    '| 项目 | 说明 |',
    '| --- | --- |',
    `| 作者或机构 | ${escapeTableCell(creators)} |`,
    `| 来源 | [访问原始页面](${sourceUrl}) |`,
    `| 访问方式 | ${escapeTableCell(accessMethod)} |`,
    `| 权利说明 | ${escapeTableCell(rightsBasis)} |`
  ].join('\n')
}

function yamlValue(value) {
  return JSON.stringify(value)
}

function domainIdsFrom(value, primaryDomainId) {
  const ids = []
  for (const label of splitTerms(value)) {
    const domain = domains.find((candidate) => candidate.label === label || candidate.aliases?.includes(label))
    if (!domain) throw new Error(`未知次要领域：${label}`)
    if (domain.id !== primaryDomainId && !ids.includes(domain.id)) ids.push(domain.id)
  }
  return ids
}

export function prepareSubmission({ body, issueNumber, issueAuthor }) {
  const fields = parseIssueForm(body)
  const legacySubmission = Boolean(fields.get('目标领域')?.trim())
  const resourceSubmission = Boolean(fields.get('资源类型')?.trim())
  const domainLabel = legacySubmission ? '' : requireField(fields, '领域')
  const selectedDomain = legacySubmission
    ? undefined
    : domains.find((domain) => domain.label === domainLabel || domain.aliases?.includes(domainLabel))
  if (!legacySubmission && !selectedDomain) throw new Error(`未知领域：${domainLabel}`)

  const branchLabel = fields.get('主分支')?.trim() || ''
  let targetLabel
  if (legacySubmission) {
    targetLabel = requireField(fields, '目标领域')
  } else if (branchesForDomain(selectedDomain.id).length > 0) {
    if (!branchLabel) throw new Error(`领域“${domainLabel}”需要选择主分支`)
    targetLabel = branchLabel
  } else {
    targetLabel = branchLabel || domainLabel
  }
  const title = requireField(fields, '页面标题').replace(/^#+\s*/, '').trim()
  const description = requireField(fields, '页面简介')
  const mediaRepostLabel = requireField(fields, '媒体平台转发偏好')
  const rights = requireField(fields, '授权确认')
  const target = resolveSubmissionArea(targetLabel)
  const mediaRepostPreference = mediaRepostPreferences.get(mediaRepostLabel)

  if (!target) throw new Error(`未知目标领域：${targetLabel}`)
  if (!mediaRepostPreference) throw new Error(`未知媒体平台转发偏好：${mediaRepostLabel}`)
  if (!title) throw new Error('页面标题无效')
  if (!/-\s*\[[xX]\]/.test(rights)) throw new Error('授权确认尚未勾选')

  if (!legacySubmission) {
    if (selectedDomain.id !== target.domainId) {
      throw new Error(`领域“${domainLabel}”与主分支“${targetLabel}”不一致`)
    }
  }

  for (const [label, value] of fields) {
    if (label !== '授权确认') assertSafeMarkdown(value, label)
  }

  const numericIssueNumber = Number(issueNumber)
  if (!Number.isSafeInteger(numericIssueNumber) || numericIssueNumber <= 0) {
    throw new Error('Issue 编号无效')
  }

  let type
  let contentType
  let legacyKind

  if (legacySubmission) {
    const typeLabel = requireField(fields, '页面类型')
    const kindLabel = requireField(fields, '内容属性')
    type = pageTypes.get(typeLabel)
    legacyKind = contentKinds.get(kindLabel)
    if (!type) throw new Error(`未知页面类型：${typeLabel}`)
    if (!legacyKind) throw new Error(`未知内容属性：${kindLabel}`)
    contentType = type === 'course' ? 'tutorial' : 'article'
  } else if (resourceSubmission) {
    const resourceTypeLabel = requireField(fields, '资源类型')
    contentType = resourceTypes.get(resourceTypeLabel)
    if (!contentType) throw new Error(`未知资源类型：${resourceTypeLabel}`)
    type = 'article'
  } else {
    const contentTypeLabel = requireField(fields, '内容形式')
    const resolvedType = originalContentTypes.get(contentTypeLabel)
    if (!resolvedType) throw new Error(`未知内容形式：${contentTypeLabel}`)
    type = resolvedType.pageType
    contentType = resolvedType.contentType
  }

  const origin = resourceSubmission ? 'resource' : 'original'
  const prerequisites = linesFrom(fields.get('先修知识'))
  const author = (fields.get('署名') || fields.get('导览署名'))?.trim() || `@${issueAuthor}`
  const topicResolution = legacySubmission ? { topicIds: [], keywords: [] } : resolveTopics(requireField(fields, '主题词'))
  const secondaryDomainIds = legacySubmission
    ? []
    : domainIdsFrom(fields.get('次要领域') || '', target.domainId)
  const topicLabels = topicResolution.topicIds.map((topicId) => getNode(topicId)?.label).filter(Boolean)
  const tags = [...new Set([...target.tags, ...topicLabels, ...topicResolution.keywords, ...(legacyKind ? [legacyKind] : [])])]
  const resourcesSection = resourceTable(fields.get('资料链接'))
  const attachments = parseAttachments(fields.get('附件') || '', numericIssueNumber)
  const notesSection = optionalSection('补充说明', fields.get('补充说明') || '')
  const prerequisitesSection = optionalSection('先修知识', fields.get('先修知识') || '', bulletList)
  const positioningValue = fields.get('内容范围') || fields.get('页面定位') || ''
  const goalsValue = fields.get('阅读收获') || fields.get('学习目标') || ''
  const positioningSection = optionalSection(legacySubmission ? '页面定位' : '内容范围', positioningValue)
  const goalsSection = optionalSection(legacySubmission ? '学习目标' : '阅读收获', goalsValue, bulletList)

  let mainContent
  let mainContentSection
  let resourceFrontmatter = ''
  let detailsSection = ''

  if (resourceSubmission) {
    const creators = requireField(fields, '资源作者或机构')
    const sourceUrl = requireHttpUrl(requireField(fields, '来源地址'), '来源地址')
    const accessMethod = requireField(fields, '访问方式')
    const rightsBasis = requireField(fields, '版权或使用依据')
    mainContent = requireField(fields, '推荐说明')
    resourceFrontmatter = [
      `resource_type: ${contentType}`,
      `resource_creators: ${yamlValue(creators)}`,
      `source_url: ${yamlValue(sourceUrl)}`,
      `access_method: ${yamlValue(accessMethod)}`,
      `rights_basis: ${yamlValue(rightsBasis)}`
    ].join('\n')
    detailsSection = resourceDetailsSection({ creators, sourceUrl, accessMethod, rightsBasis })
    mainContentSection = `## 推荐说明\n\n${mainContent}`
  } else {
    mainContent = requireField(fields, '主要内容')
    mainContentSection = `## 主要内容\n\n${mainContent}`
  }

  return {
    directory: target.directory,
    filename: `contribution-${numericIssueNumber}.md`,
    attachments,
    candidateTopics: topicResolution.keywords,
    origin,
    domainId: target.domainId,
    branchId: target.branchId,
    replacements: {
      '{{TITLE_YAML}}': JSON.stringify(title),
      '{{DESCRIPTION_YAML}}': JSON.stringify(description),
      '{{ORDER}}': String(1000 + numericIssueNumber),
      '{{TYPE}}': type,
      '{{CONTENT_ID_YAML}}': yamlValue(`contribution-${numericIssueNumber}`),
      '{{ORIGIN}}': origin,
      '{{DOMAIN_ID}}': target.domainId,
      '{{BRANCH_ID_YAML}}': yamlValue(target.branchId),
      '{{TOPIC_IDS_YAML}}': yamlValue(topicResolution.topicIds),
      '{{SECONDARY_DOMAIN_IDS_YAML}}': yamlValue(secondaryDomainIds),
      '{{KEYWORDS_YAML}}': yamlValue(topicResolution.keywords),
      '{{CONTENT_TYPE}}': contentType,
      '# {{RESOURCE_FRONTMATTER}}': resourceFrontmatter,
      '{{AUTHOR_YAML}}': JSON.stringify([author]),
      '{{TAGS_YAML}}': JSON.stringify(tags),
      '{{PREREQUISITES_YAML}}': JSON.stringify(prerequisites),
      '{{MEDIA_REPOST_PREFERENCE}}': mediaRepostPreference,
      '{{TITLE}}': title,
      '{{AUTHOR_HTML}}': escapeHtml(author),
      '{{POSITIONING_SECTION}}': positioningSection,
      '{{PREREQUISITES_SECTION}}': prerequisitesSection,
      '{{GOALS_SECTION}}': goalsSection,
      '{{RESOURCE_DETAILS_SECTION}}': detailsSection,
      '{{MAIN_CONTENT_SECTION}}': mainContentSection,
      '{{RESOURCES_SECTION}}': resourcesSection,
      '{{NOTES_SECTION}}': notesSection,
      ...attachmentReplacements(attachments)
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

function validateDownloadedAttachment(attachment, buffer) {
  if (buffer.length === 0) throw new Error(`附件 ${attachment.name} 是空文件`)

  const extension = attachmentExtension(attachment.name)
  const firstBytes = buffer.subarray(0, 8)
  if (extension === '.pdf' && !firstBytes.toString('ascii').startsWith('%PDF-')) {
    throw new Error(`附件 ${attachment.name} 不是有效的 PDF 文件`)
  }

  if (['.docx', '.xlsx', '.pptx', '.zip'].includes(extension) && firstBytes.subarray(0, 2).toString('ascii') !== 'PK') {
    throw new Error(`附件 ${attachment.name} 不是有效的 ZIP 或 Office 文件`)
  }

  if (['.gz', '.tar.gz'].includes(extension) && (firstBytes[0] !== 0x1f || firstBytes[1] !== 0x8b)) {
    throw new Error(`附件 ${attachment.name} 不是有效的 GZIP 文件`)
  }

  if (['.txt', '.csv'].includes(extension) && buffer.includes(0)) {
    throw new Error(`附件 ${attachment.name} 不是有效的文本文件`)
  }
}

async function readAttachmentResponse(response, attachment) {
  const declaredSize = Number(response.headers.get('content-length'))
  if (Number.isFinite(declaredSize) && declaredSize > maxAttachmentBytes) {
    throw new Error(`附件 ${attachment.name} 超过 25 MB`)
  }

  if (!response.body) {
    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length > maxAttachmentBytes) throw new Error(`附件 ${attachment.name} 超过 25 MB`)
    return buffer
  }

  const reader = response.body.getReader()
  const chunks = []
  let size = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > maxAttachmentBytes) {
      await reader.cancel()
      throw new Error(`附件 ${attachment.name} 超过 25 MB`)
    }
    chunks.push(Buffer.from(value))
  }

  return Buffer.concat(chunks, size)
}

export async function downloadAttachments(attachments, { outputRoot, fetchImpl = fetch }) {
  if (attachments.length === 0) return []

  const directoryMatch = attachments[0].url.match(/^\/attachments\/(contribution-\d+)\//)
  if (!directoryMatch) throw new Error('附件发布路径无效')
  const attachmentDirectory = resolve(outputRoot, 'docs/public/attachments', directoryMatch[1])
  if (existsSync(attachmentDirectory)) {
    throw new Error(`目标附件目录已存在：${relative(outputRoot, attachmentDirectory)}`)
  }

  const downloaded = []

  for (const attachment of attachments) {
    const headers = {
      Accept: 'application/octet-stream',
      'User-Agent': 'ellephants-content-publisher'
    }

    const response = await fetchImpl(attachment.sourceUrl, {
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(30_000)
    })

    if (!response.ok) throw new Error(`无法下载附件 ${attachment.name}：HTTP ${response.status}`)

    if (response.url) {
      const finalUrl = new URL(response.url)
      const trustedHost = finalUrl.hostname === 'github.com' || finalUrl.hostname.endsWith('.githubusercontent.com')
      if (finalUrl.protocol !== 'https:' || !trustedHost) {
        throw new Error(`附件 ${attachment.name} 被重定向到了不受信任的地址`)
      }
    }

    const buffer = await readAttachmentResponse(response, attachment)
    validateDownloadedAttachment(attachment, buffer)
    downloaded.push({ ...attachment, size: buffer.length, buffer })
  }

  mkdirSync(attachmentDirectory, { recursive: true })
  for (const attachment of downloaded) {
    writeFileSync(resolve(attachmentDirectory, attachment.storageFilename), attachment.buffer)
  }

  return downloaded.map(({ buffer: _buffer, ...attachment }) => attachment)
}

async function main() {
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

  const downloadedAttachments = await downloadAttachments(submission.attachments, { outputRoot })
  Object.assign(submission.replacements, attachmentReplacements(downloadedAttachments))
  const content = renderSubmission(readFileSync(templatePath, 'utf8'), submission.replacements)
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, content, 'utf8')

  const displayPath = relative(outputRoot, outputPath).split(sep).join('/')
  const attachmentDirectory = downloadedAttachments.length > 0
    ? `docs/public/attachments/contribution-${issueNumber}`
    : ''
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `content_path=${displayPath}\n`)
    appendFileSync(process.env.GITHUB_OUTPUT, `attachment_directory=${attachmentDirectory}\n`)
    appendFileSync(process.env.GITHUB_OUTPUT, `taxonomy_candidates=${submission.candidateTopics.join('、')}\n`)
  }
  console.log(`已生成 ${displayPath}`)
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  try {
    await main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
