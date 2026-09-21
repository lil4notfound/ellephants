import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'

const projectRoot = resolve(import.meta.dirname, '..')
const outputRoot = resolve(projectRoot, 'dist')
const errors = []

function collectTextFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name)
    if (entry.isDirectory()) return collectTextFiles(entryPath)
    return ['.html', '.js', '.json', '.css'].includes(extname(entry.name)) ? [entryPath] : []
  })
}

if (!existsSync(outputRoot)) {
  throw new Error('找不到客户端构建产物，请先运行 VitePress 构建')
}

const forbidden = [
  'MSC 2020',
  'PhySH',
  'GB/T 13745',
  'externalRefs',
  'taxonomy_candidates',
  '本页面由脚本生成',
  '迁移说明',
  '自动化说明'
]
for (const filePath of collectTextFiles(outputRoot)) {
  const source = readFileSync(filePath, 'utf8')
  for (const term of forbidden) {
    if (source.includes(term)) errors.push(`${filePath}: 客户端产物包含内部文字 ${term}`)
  }
}

const requiredOutputs = [
  'index.html',
  'guide/index.html',
  'guide/contributing.html',
  'guide/writing.html',
  'knowledge-map/index.html',
  'mathematics/index.html',
  'mathematics/algebra-number-theory/index.html',
  'mathematics/analysis-equations/index.html',
  'mathematics/applied-mathematics/index.html',
  'mathematics/geometry-topology/index.html',
  'mathematics/probability-statistics/index.html',
  'physics/index.html',
  'physics/condensed-matter/index.html',
  'physics/electromagnetism/index.html',
  'physics/general-physics/index.html',
  'physics/mechanics/index.html',
  'physics/optics-photonics/index.html',
  'physics/quantum-modern/index.html',
  'physics/quantum-modern/contribution-1.html',
  'physics/thermal-statistical/index.html'
]
for (const output of requiredOutputs) {
  if (!existsSync(resolve(outputRoot, output))) errors.push(`必要路由未生成：${output}`)
}

for (const output of [
  'physics/experiments/index.html',
  'physics/mathematical-methods/index.html',
  'physics/optics/index.html',
  'topics/index.html',
  'topics/combinatorics.html',
  'topics/quantum-mechanics.html',
  'topics/mathematical-physics.html',
  'topics/complex-systems.html',
  'topics/science-fiction.html'
]) {
  if (existsSync(resolve(outputRoot, output))) errors.push(`已删除的主题页面仍被生成：${output}`)
}

const quantumOutput = resolve(outputRoot, 'physics/quantum-modern/contribution-1.html')
if (!existsSync(quantumOutput)) {
  errors.push('量子力学页面的公开路由未生成')
} else {
  const quantumHtml = readFileSync(quantumOutput, 'utf8')
  if (!quantumHtml.includes('量子力学教材推荐')) errors.push('量子力学页面标题未进入构建产物')
  if (quantumHtml.includes('attachment-downloads')) errors.push('无附件的量子力学页面不应显示附件区域')
}

const searchIndex = collectTextFiles(outputRoot)
  .find((filePath) => filePath.includes('@localSearchIndex'))
if (!searchIndex || !readFileSync(searchIndex, 'utf8').includes('量子力学教材推荐')) {
  errors.push('量子力学页面未进入本地搜索索引')
}

if (errors.length) {
  console.error(`客户端产物检查失败，共 ${errors.length} 项：`)
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('客户端产物与量子页面路由检查通过。')
