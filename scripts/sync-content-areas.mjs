import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import contentAreas from '../config/content-areas.json' with { type: 'json' }

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const formPath = resolve(projectRoot, '.github/ISSUE_TEMPLATE/content-submission.yml')
const startMarker = '      # content-areas:start'
const endMarker = '      # content-areas:end'

function validateAreas() {
  if (!Array.isArray(contentAreas) || contentAreas.length === 0) {
    throw new Error('content-areas.json 至少需要一个领域')
  }

  const labels = new Set()
  const directories = new Set()

  for (const area of contentAreas) {
    if (!area.label || !area.directory || !Array.isArray(area.tags) || area.tags.length < 2) {
      throw new Error('每个领域都必须包含 label、directory 和至少两个 tags')
    }
    if (!area.directory.startsWith('docs/') || area.directory.includes('..')) {
      throw new Error(`领域目录不安全：${area.directory}`)
    }
    if (labels.has(area.label)) throw new Error(`领域名称重复：${area.label}`)
    if (directories.has(area.directory)) throw new Error(`领域目录重复：${area.directory}`)
    if (!existsSync(resolve(projectRoot, area.directory))) throw new Error(`领域目录不存在：${area.directory}`)

    labels.add(area.label)
    directories.add(area.directory)
  }
}

function expectedBlock() {
  return [
    startMarker,
    '      options:',
    ...contentAreas.map((area) => `        - ${JSON.stringify(area.label)}`),
    endMarker
  ].join('\n')
}

validateAreas()

const form = readFileSync(formPath, 'utf8')
const start = form.indexOf(startMarker)
const end = form.indexOf(endMarker)

if (start < 0 || end < start) throw new Error('内容投稿表单缺少领域同步标记')

const updated = `${form.slice(0, start)}${expectedBlock()}${form.slice(end + endMarker.length)}`
const checkOnly = process.argv.includes('--check')

if (checkOnly) {
  if (updated !== form) throw new Error('Issue 表单的领域选项未同步，请运行 npm run sync:content-areas')
  console.log('领域配置与 Issue 表单一致。')
} else {
  writeFileSync(formPath, updated, 'utf8')
  console.log('Issue 表单的领域选项已同步。')
}
