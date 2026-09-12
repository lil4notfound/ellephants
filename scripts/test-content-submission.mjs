import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { prepareSubmission, renderSubmission } from './generate-content-from-issue.mjs'

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

### 补充说明

符号约定以后续版本为准。

### 媒体平台转发偏好

允许转发并保留署名

### 授权确认

- [x] 我确认对原创投稿内容拥有相应权利并同意以 CC BY-SA 4.0 发布；第三方内容已标明作者、来源和许可或使用依据。
`

const submission = prepareSubmission({ body: issueBody, issueNumber: '42', issueAuthor: 'tester' })
assert.equal(submission.directory, 'docs/physics/electromagnetism')
assert.equal(submission.filename, 'contribution-42.md')

const output = renderSubmission(template, submission.replacements)
assert.match(output, /title: "电磁学"/)
assert.match(output, /license: CC-BY-SA-4\.0/)
assert.match(output, /tags: \["物理","电磁学","theory"\]/)
assert.match(output, /media_repost_preference: attributed/)
assert.match(output, /<p class="article-byline"><span>作者：<\/span>测试贡献者<\/p>/)
assert.match(output, /## 页面定位/)
assert.match(output, /## 主要内容/)
assert.match(output, /## 资料链接/)
assert.match(output, /### 静电场/)
assert.match(output, /\[示例讲义\]\(https:\/\/example\.com\/notes\.pdf\)/)
assert.doesNotMatch(output, /\{\{[A-Z_]+\}\}/)

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
  () => prepareSubmission({ body: issueBody.replace('从库仑定律', '<script>bad()</script>'), issueNumber: '43', issueAuthor: 'tester' }),
  /不支持的 HTML/
)

console.log('内容投稿自动化测试通过。')
