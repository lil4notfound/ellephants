import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { createSidebar, markdownBody, parseFrontmatter } from './content.mjs'
import {
  contentAreas,
  inferContentClassification,
  publicTaxonomy,
  resolveSubmissionArea,
  resolveTopics,
  validateTaxonomy
} from './taxonomy.mjs'

const projectRoot = resolve(import.meta.dirname, '..')
const docsRoot = resolve(projectRoot, 'docs')

for (const filename of ['content-submission.yml', 'resource-submission.yml']) {
  const formPath = resolve(projectRoot, '.github/ISSUE_TEMPLATE', filename)
  const form = parseYaml(readFileSync(formPath, 'utf8'))
  const allowedTypes = new Set(['input', 'dropdown', 'textarea', 'checkboxes', 'markdown'])
  const ids = new Set()
  assert.ok(Array.isArray(form.body) && form.body.length > 0, `${filename} 缺少表单字段`)
  for (const field of form.body) {
    assert.ok(allowedTypes.has(field.type), `${filename} 使用了不支持的字段类型 ${field.type}`)
    if (field.type !== 'markdown') {
      assert.ok(field.id && !ids.has(field.id), `${filename} 的字段 ID 缺失或重复`)
      ids.add(field.id)
    }
    if (field.type === 'dropdown') assert.ok(Array.isArray(field.attributes?.options), `${filename} 的选项无效`)
  }
  const branchField = form.body.find((field) => field.id === 'branch')
  assert.equal(branchField.validations?.required, false)
  assert.ok(branchField.attributes.options.every((option) => /^(数学|物理) \/ /.test(option)))
}

assert.deepEqual(validateTaxonomy(), [])
assert.equal(contentAreas().length, 21)
assert.equal(resolveSubmissionArea('数学 / 组合数学')?.branchId, 'math.discrete')
assert.equal(resolveSubmissionArea('物理 / 光学')?.branchId, 'physics.optics-photonics')
assert.equal(resolveSubmissionArea('物理 / 实验物理'), undefined)
assert.equal(resolveSubmissionArea('物理 / 数学物理方法'), undefined)
assert.deepEqual(resolveTopics('量子力学\n线性代数\n新主题'), {
  topicIds: ['physics.quantum-mechanics', 'math.linear-algebra'],
  keywords: ['新主题']
})
assert.deepEqual(
  inferContentClassification({ url: '/physics/quantum-modern/contribution-1', tags: [] }),
  { domainId: 'physics', branchId: 'physics.atomic-quantum' }
)

const publicGraph = publicTaxonomy({ usedTopicIds: ['physics.quantum-mechanics'] })
assert.ok(publicGraph.nodes.some((node) => node.id === 'physics.quantum-mechanics'))
assert.ok(publicGraph.nodes.every((node) => !Object.hasOwn(node, 'externalRefs')))

const quantumPath = resolve(docsRoot, 'physics/quantum-modern/contribution-1.md')
const quantumSource = readFileSync(quantumPath, 'utf8')
const quantumFrontmatter = parseFrontmatter(quantumSource)
const normalizedBody = markdownBody(quantumSource).replace(/\r\n/g, '\n')
const bodyHash = createHash('sha256').update(normalizedBody).digest('hex')
assert.equal(bodyHash, '89dfef8b59f967cc2ccd30c04416d9fa9e6d27b4119aa928ded9f3c3235c517b')
assert.equal(quantumFrontmatter.content_id, 'contribution-1')
assert.equal(quantumFrontmatter.branch_id, 'physics.atomic-quantum')
assert.deepEqual(quantumFrontmatter.topic_ids, ['physics.quantum-mechanics'])
assert.equal(quantumFrontmatter.attachments, undefined)

const sidebarSource = JSON.stringify(createSidebar(docsRoot))
assert.match(sidebarSource, /\/physics\/quantum-modern\/contribution-1/)
assert.match(sidebarSource, /\/physics\/electromagnetism\//)
assert.match(sidebarSource, /\/physics\/optics-photonics\//)
assert.doesNotMatch(sidebarSource, /\/physics\/experiments/)
assert.doesNotMatch(sidebarSource, /\/physics\/optics\//)
assert.doesNotMatch(sidebarSource, /\/physics\/mathematical-methods/)
assert.match(sidebarSource, /组合、图论与离散结构/)
assert.match(sidebarSource, /处境/)
assert.match(sidebarSource, /毛茸茸/)
assert.doesNotMatch(sidebarSource, /\/topics\//)

console.log('分类结构和量子页面保护测试通过。')
