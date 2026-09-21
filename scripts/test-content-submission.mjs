import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  downloadAttachments,
  prepareSubmission,
  renderSubmission
} from './generate-content-from-issue.mjs'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const template = readFileSync(resolve(projectRoot, 'docs/_template.md'), 'utf8')

const issueBody = `
### 目标领域

物理 / 电磁学与电动力学

### 页面类型

课程页

### 页面标题

电磁学

### 页面简介

介绍电磁场的基本概念、方程与典型问题。

### 内容属性

理论

### 署名

测试贡献者

### 先修知识

- 数学分析
- 矢量分析

### 页面定位

面向已掌握微积分基础的学习者。

### 学习目标

1. 理解静电场的基本方程
2. 能分析简单边值问题

### 主要内容

### 静电场

从库仑定律进入高斯定律与电势。

### 资料链接

示例讲义 | https://example.com/notes.pdf | PDF / 2 MB | 作者公开 | 用于复习

### 附件

[量子力学讲义 2026.pdf](https://github.com/user-attachments/files/12345678/quantum-notes.pdf)

### 补充说明

符号约定以后续版本为准。

### 媒体平台转发偏好

允许转发并保留署名

### 授权确认

- [x] 我确认对原创投稿内容及上传附件拥有相应权利并同意以 CC BY-SA 4.0 发布；第三方内容已标明作者、来源和许可或使用依据。
`

const submission = prepareSubmission({ body: issueBody, issueNumber: '42', issueAuthor: 'tester' })
assert.equal(submission.directory, 'docs/physics/electromagnetism')
assert.equal(submission.filename, 'contribution-42.md')
assert.deepEqual(submission.attachments, [
  {
    name: '量子力学讲义 2026.pdf',
    sourceUrl: 'https://github.com/user-attachments/files/12345678/quantum-notes.pdf',
    storageFilename: 'attachment-1.pdf',
    url: '/attachments/contribution-42/attachment-1.pdf'
  }
])

const output = renderSubmission(template, submission.replacements)
assert.match(output, /title: "电磁学"/)
assert.match(output, /license: CC-BY-SA-4\.0/)
assert.match(output, /tags: \["物理","电磁学与电动力学","theory"\]/)
assert.match(output, /content_id: "contribution-42"/)
assert.match(output, /domain_id: physics/)
assert.match(output, /branch_id: "physics\.electromagnetism-electrodynamics"/)
assert.match(output, /media_repost_preference: attributed/)
assert.match(output, /<p class="article-byline"><span>作者：<\/span>测试贡献者<\/p>/)
assert.match(output, /## 页面定位/)
assert.match(output, /## 主要内容/)
assert.match(output, /## 资料链接/)
assert.match(output, /attachments: \[{"name":"量子力学讲义 2026\.pdf","url":"\/attachments\/contribution-42\/attachment-1\.pdf"}\]/)
assert.match(output, /## 附件\n\n<AttachmentDownloads \/>/)
assert.match(output, /### 静电场/)
assert.match(output, /\[示例讲义\]\(https:\/\/example\.com\/notes\.pdf\)/)
assert.doesNotMatch(output, /\{\{[A-Z_]+\}\}/)

const noAttachmentBody = issueBody.replace(
  '[量子力学讲义 2026.pdf](https://github.com/user-attachments/files/12345678/quantum-notes.pdf)',
  ''
)
const noAttachmentSubmission = prepareSubmission({
  body: noAttachmentBody,
  issueNumber: '49',
  issueAuthor: 'tester'
})
const noAttachmentOutput = renderSubmission(template, noAttachmentSubmission.replacements)
assert.deepEqual(noAttachmentSubmission.attachments, [])
assert.match(noAttachmentOutput, /attachments: \[\]/)
assert.doesNotMatch(noAttachmentOutput, /## 附件/)
assert.doesNotMatch(noAttachmentOutput, /<AttachmentDownloads \/>/)

const outputRoot = mkdtempSync(join(tmpdir(), 'ellephants-attachments-'))
try {
  const downloaded = await downloadAttachments(submission.attachments, {
    outputRoot,
    fetchImpl: async () => new Response('%PDF-1.7\n%%EOF', {
      status: 200,
      headers: { 'content-length': '14' }
    })
  })
  assert.equal(downloaded[0].size, 14)
  assert.equal(
    readFileSync(join(outputRoot, 'docs/public/attachments/contribution-42/attachment-1.pdf'), 'utf8'),
    '%PDF-1.7\n%%EOF'
  )
} finally {
  rmSync(outputRoot, { recursive: true, force: true })
}

const anonymousBody = issueBody.replace('\n测试贡献者\n\n### 先修知识', '\n\n### 先修知识')
const anonymousSubmission = prepareSubmission({ body: anonymousBody, issueNumber: '44', issueAuthor: 'tester' })
const anonymousOutput = renderSubmission(template, anonymousSubmission.replacements)
assert.match(anonymousOutput, /authors: \["@tester"\]/)
assert.match(anonymousOutput, /<p class="article-byline"><span>作者：<\/span>@tester<\/p>/)

for (const [label, value] of [
  ['不允许原野象群媒体账号转发', 'declined'],
  ['允许转发且无需署名', 'anonymous']
]) {
  const variantBody = issueBody.replace('允许转发并保留署名', label)
  const variant = prepareSubmission({ body: variantBody, issueNumber: '46', issueAuthor: 'tester' })
  const variantOutput = renderSubmission(template, variant.replacements)
  assert.match(variantOutput, new RegExp(`media_repost_preference: ${value}`))
}

assert.throws(
  () => prepareSubmission({ body: issueBody.replace('允许转发并保留署名', '未知选项'), issueNumber: '45', issueAuthor: 'tester' }),
  /未知媒体平台转发偏好/
)

assert.throws(
  () => prepareSubmission({
    body: issueBody.replace(
      'https://github.com/user-attachments/files/12345678/quantum-notes.pdf',
      'https://example.com/quantum-notes.pdf'
    ),
    issueNumber: '47',
    issueAuthor: 'tester'
  }),
  /没有可识别的上传文件/
)

assert.throws(
  () => prepareSubmission({
    body: issueBody
      .replace('量子力学讲义 2026.pdf', '量子力学讲义 2026.epub')
      .replace('quantum-notes.pdf', 'quantum-notes.epub'),
    issueNumber: '48',
    issueAuthor: 'tester'
  }),
  /文件类型不受支持/
)

assert.throws(
  () => prepareSubmission({ body: issueBody.replace('从库仑定律', '<script>bad()</script>'), issueNumber: '43', issueAuthor: 'tester' }),
  /不支持的 HTML/
)

const originalBody = `
### 领域

处境

### 主分支

### 主题词

ADHD 与学习
番茄钟调整

### 次要领域

- 数学

### 内容形式

经验与方法

### 页面标题

把学习时间切成适合自己的形状

### 页面简介

一份根据注意力变化安排学习节奏的实践记录。

### 署名

测试投稿者

### 先修知识


### 内容范围

适合希望调整学习节奏的读者。

### 阅读收获

- 识别自己的注意力周期

### 主要内容

从记录一周的精力变化开始，再调整任务长度。

### 资料链接


### 附件


### 补充说明


### 媒体平台转发偏好

允许转发并保留署名

### 授权确认

- [x] 我确认对原创内容和上传附件拥有相应权利，并同意以 CC BY-SA 4.0 发布；引用内容已经标明来源。
`

const originalSubmission = prepareSubmission({ body: originalBody, issueNumber: '52', issueAuthor: 'tester' })
const originalOutput = renderSubmission(template, originalSubmission.replacements)
assert.equal(originalSubmission.directory, 'docs/situation')
assert.equal(originalSubmission.origin, 'original')
assert.equal(originalSubmission.branchId, '')
assert.deepEqual(originalSubmission.candidateTopics, ['番茄钟调整'])
assert.match(originalOutput, /topic_ids: \["situation\.adhd-learning"\]/)
assert.match(originalOutput, /secondary_domain_ids: \["mathematics"\]/)
assert.match(originalOutput, /keywords: \["番茄钟调整"\]/)
assert.match(originalOutput, /content_type: experience/)
assert.match(originalOutput, /## 阅读收获/)

assert.throws(
  () => prepareSubmission({
    body: originalBody.replace('处境\n\n### 主分支', '数学\n\n### 主分支'),
    issueNumber: '53',
    issueAuthor: 'tester'
  }),
  /需要选择主分支/
)

const resourceBody = `
### 领域

物理

### 主分支

物理 / 原子、分子与量子科学

### 主题词

量子力学

### 次要领域

- 数学

### 资源类型

书籍

### 页面标题

量子力学概论

### 页面简介

适合第一次系统学习量子力学的教材。

### 资源作者或机构

David J. Griffiths

### 来源地址

https://example.com/quantum-book

### 访问方式

图书馆或正规书店

### 版权或使用依据

本站只提供导览和原始页面链接。

### 推荐说明

讲解清楚，习题难度循序渐进。

### 导览署名

测试导览者

### 先修知识

线性代数

### 附件


### 补充说明


### 媒体平台转发偏好

不允许原野象群媒体账号转发

### 授权确认

- [x] 我确认推荐说明可以以 CC BY-SA 4.0 发布；资源来源和权利信息真实，上传附件具有分发依据。
`

const resourceSubmission = prepareSubmission({ body: resourceBody, issueNumber: '53', issueAuthor: 'tester' })
const resourceOutput = renderSubmission(template, resourceSubmission.replacements)
assert.equal(resourceSubmission.directory, 'docs/physics/quantum-modern')
assert.equal(resourceSubmission.origin, 'resource')
assert.equal(resourceSubmission.branchId, 'physics.atomic-quantum')
assert.match(resourceOutput, /origin: resource/)
assert.match(resourceOutput, /resource_type: book/)
assert.match(resourceOutput, /source_url: "https:\/\/example\.com\/quantum-book"/)
assert.match(resourceOutput, /## 资源信息/)
assert.match(resourceOutput, /## 推荐说明/)
assert.doesNotMatch(resourceOutput, /## 附件/)

console.log('内容投稿自动化测试通过。')
