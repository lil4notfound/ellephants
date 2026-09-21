import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseFrontmatter } from './content.mjs'
import { inferContentClassification, publicTaxonomy } from './taxonomy.mjs'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const docsRoot = resolve(projectRoot, 'docs')
const outputPath = resolve(docsRoot, 'public/data/knowledge-graph.json')
const jsonLdPath = resolve(docsRoot, 'public/data/knowledge-graph.jsonld')

function collectMarkdown(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith('.') || entry.name === 'public') return []
    const entryPath = join(directory, entry.name)
    if (entry.isDirectory()) return collectMarkdown(entryPath)
    if (entry.isFile() && extname(entry.name) === '.md' && entry.name !== '_template.md') return [entryPath]
    return []
  })
}

function arrayValue(value) {
  if (Array.isArray(value)) return value.filter((item) => typeof item === 'string')
  return []
}

function routeFor(filePath) {
  const relativePath = relative(docsRoot, filePath).split(sep).join('/').replace(/\.md$/, '')
  if (relativePath === 'index') return '/'
  return relativePath.endsWith('/index') ? `/${relativePath.slice(0, -6)}` : `/${relativePath}`
}

function collectContent() {
  return collectMarkdown(docsRoot).flatMap((filePath) => {
    const source = readFileSync(filePath, 'utf8')
    const frontmatter = parseFrontmatter(source)
    if (!['course', 'article'].includes(frontmatter.type) || frontmatter.draft === true) return []

    const url = routeFor(filePath)
    const inferred = inferContentClassification({ url, tags: arrayValue(frontmatter.tags) })
    return [{
      id: String(frontmatter.content_id || url),
      type: 'content',
      label: String(frontmatter.title || '未命名页面'),
      description: String(frontmatter.description || ''),
      url,
      origin: frontmatter.origin === 'resource' ? 'resource' : 'original',
      domainId: String(frontmatter.domain_id || inferred.domainId),
      branchId: String(frontmatter.branch_id || inferred.branchId),
      topicIds: arrayValue(frontmatter.topic_ids),
      secondaryDomainIds: arrayValue(frontmatter.secondary_domain_ids)
    }]
  })
}

export function buildKnowledgeGraph() {
  const content = collectContent()
  const usedTopicIds = content.flatMap((entry) => entry.topicIds)
  const taxonomy = publicTaxonomy({ usedTopicIds })
  const contentRelations = content.flatMap((entry) => [
    ...(entry.domainId ? [{ from: entry.id, type: 'in_domain', to: entry.domainId }] : []),
    ...entry.secondaryDomainIds.map((domainId) => ({ from: entry.id, type: 'also_in_domain', to: domainId })),
    ...(entry.branchId ? [{ from: entry.id, type: 'in_branch', to: entry.branchId }] : []),
    ...entry.topicIds.map((topicId) => ({ from: entry.id, type: 'covers', to: topicId }))
  ])

  return {
    version: 1,
    nodes: [...taxonomy.nodes, ...content],
    relations: [...taxonomy.relations, ...contentRelations],
    collections: taxonomy.collections
  }
}

export function buildJsonLd(graph) {
  return {
    '@context': {
      '@vocab': 'urn:ellephants:schema:',
      id: '@id',
      type: '@type',
      label: 'https://www.w3.org/2004/02/skos/core#prefLabel',
      description: 'http://purl.org/dc/terms/description',
      url: { '@id': 'https://schema.org/url', '@type': '@id' },
      from: { '@id': 'urn:ellephants:schema:from', '@type': '@id' },
      to: { '@id': 'urn:ellephants:schema:to', '@type': '@id' }
    },
    '@graph': [
      ...graph.nodes.map((node) => ({ ...node, id: `urn:ellephants:${node.id}` })),
      ...graph.relations.map((relation, index) => ({
        id: `urn:ellephants:relation:${index + 1}`,
        type: relation.type,
        from: `urn:ellephants:${relation.from}`,
        to: `urn:ellephants:${relation.to}`
      }))
    ]
  }
}

function serialize(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function checkFile(path, expected) {
  return existsSync(path) && readFileSync(path, 'utf8') === expected
}

const graph = buildKnowledgeGraph()
const graphSource = serialize(graph)
const jsonLdSource = serialize(buildJsonLd(graph))

if (process.argv.includes('--check')) {
  if (!checkFile(outputPath, graphSource) || !checkFile(jsonLdPath, jsonLdSource)) {
    throw new Error('知识图谱静态数据未同步，请运行 npm run sync:graph')
  }
  console.log('知识图谱静态数据已同步。')
} else {
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, graphSource, 'utf8')
  writeFileSync(jsonLdPath, jsonLdSource, 'utf8')
  console.log('知识图谱静态数据已生成。')
}
