import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { contentAreas, domains } from './taxonomy.mjs'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const areasPath = resolve(projectRoot, 'config/content-areas.json')
const formPaths = [
  resolve(projectRoot, '.github/ISSUE_TEMPLATE/content-submission.yml'),
  resolve(projectRoot, '.github/ISSUE_TEMPLATE/resource-submission.yml')
]
const checkOnly = process.argv.includes('--check')

function replaceMarkedBlock(source, markerName, lines) {
  const startMarker = `      # ${markerName}:start`
  const endMarker = `      # ${markerName}:end`
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker)
  if (start < 0 || end < start) throw new Error(`Issue 表单缺少同步标记：${markerName}`)

  const block = [
    startMarker,
    '      options:',
    ...lines.map((line) => `        - ${JSON.stringify(line)}`),
    endMarker
  ].join('\n')

  return `${source.slice(0, start)}${block}${source.slice(end + endMarker.length)}`
}

const expectedAreas = contentAreas()
const selectableBranchAreas = expectedAreas.filter((area) => area.branchId)
const expectedAreasSource = `${JSON.stringify(expectedAreas, null, 2)}\n`
const currentAreasSource = readFileSync(areasPath, 'utf8')

if (checkOnly && JSON.stringify(JSON.parse(currentAreasSource)) !== JSON.stringify(expectedAreas)) {
  throw new Error('content-areas.json 与 taxonomy 不一致，请运行 npm run sync:content-areas')
}
if (!checkOnly) writeFileSync(areasPath, expectedAreasSource, 'utf8')

for (const formPath of formPaths) {
  if (!existsSync(formPath)) throw new Error(`缺少投稿表单：${formPath}`)
  const form = readFileSync(formPath, 'utf8')
  let updated = replaceMarkedBlock(form, 'taxonomy-domains', domains.map((domain) => domain.label))
  updated = replaceMarkedBlock(updated, 'taxonomy-branches', selectableBranchAreas.map((area) => area.label))

  if (checkOnly && updated !== form) {
    throw new Error(`${formPath} 的分类选项未同步，请运行 npm run sync:content-areas`)
  }
  if (!checkOnly) writeFileSync(formPath, updated, 'utf8')
}

console.log(checkOnly ? '分类配置与投稿表单一致。' : '分类配置与投稿表单已同步。')
