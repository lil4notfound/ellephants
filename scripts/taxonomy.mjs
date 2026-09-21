import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const taxonomyRoot = resolve(projectRoot, 'config/taxonomy')

function readJson(filename) {
  return JSON.parse(readFileSync(resolve(taxonomyRoot, filename), 'utf8'))
}

export const taxonomyNodes = readJson('nodes.json')
export const taxonomyRelations = readJson('relations.json')
export const taxonomyCollections = readJson('collections.json')
export const taxonomyExternalMappings = readJson('external-mappings.json')
export const taxonomyCoverage = readJson('coverage.json')

export const nodesById = new Map(taxonomyNodes.map((node) => [node.id, node]))
export const domains = taxonomyNodes
  .filter((node) => node.kind === 'domain' && node.status === 'active')
  .sort(compareByOrder)
export const branches = taxonomyNodes
  .filter((node) => node.kind === 'branch' && node.status === 'active')
  .sort(compareByOrder)
export const concepts = taxonomyNodes
  .filter((node) => node.kind === 'concept' && node.status === 'active')

function compareByOrder(left, right) {
  const orderDifference = (left.order ?? 9999) - (right.order ?? 9999)
  return orderDifference || left.label.localeCompare(right.label, 'zh-CN')
}

export function getNode(id) {
  return nodesById.get(id)
}

export function branchesForDomain(domainId) {
  return branches.filter((branch) => branch.primaryParentId === domainId)
}

function normalizeLookup(value) {
  return String(value || '')
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('zh-CN')
    .replace(/[\s/／、，,]+/g, ' ')
}

export function contentAreas() {
  const result = []

  for (const domain of domains) {
    const domainBranches = branchesForDomain(domain.id)
    if (domainBranches.length === 0) {
      result.push({
        label: domain.label,
        directory: domain.directory,
        tags: [domain.label],
        domainId: domain.id,
        branchId: ''
      })
      continue
    }

    for (const branch of domainBranches) {
      result.push({
        label: `${domain.label} / ${branch.label}`,
        directory: branch.directory,
        tags: [domain.label, branch.label],
        domainId: domain.id,
        branchId: branch.id
      })
    }
  }

  return result
}

const areaLookup = new Map()
for (const area of contentAreas()) {
  const domain = getNode(area.domainId)
  const branch = area.branchId ? getNode(area.branchId) : undefined
  const labels = new Set([area.label])

  if (branch) {
    for (const alias of branch.aliases || []) labels.add(`${domain.label} / ${alias}`)
  } else {
    labels.add(domain.label)
  }

  for (const label of labels) areaLookup.set(normalizeLookup(label), area)
}

export function resolveSubmissionArea(label) {
  return areaLookup.get(normalizeLookup(label))
}

const topicLookup = new Map()
for (const concept of concepts) {
  for (const candidate of [concept.id, concept.label, ...(concept.aliases || [])]) {
    const key = normalizeLookup(candidate)
    if (!topicLookup.has(key)) topicLookup.set(key, concept)
  }
}

export function splitTerms(value) {
  if (!value || /^(?:无|暂无|none)$/i.test(String(value).trim())) return []

  return [...new Set(String(value)
    .split(/[\r\n,，、;；]+/)
    .map((term) => term.replace(/^\s*(?:[-*+]\s+|\d+[.)、]\s*)/, '').trim())
    .filter(Boolean))]
}

export function resolveTopics(value) {
  const topicIds = []
  const keywords = []

  for (const term of splitTerms(value)) {
    const concept = topicLookup.get(normalizeLookup(term))
    if (concept) {
      if (!topicIds.includes(concept.id)) topicIds.push(concept.id)
    } else if (!keywords.includes(term)) {
      keywords.push(term)
    }
  }

  return { topicIds, keywords }
}

export function inferContentClassification({ url = '', tags = [] } = {}) {
  const normalizedTags = Array.isArray(tags) ? tags : []
  const matchingBranch = branches.find((branch) => {
    const directories = branch.contentDirectories || [branch.directory]
    const routeMatches = directories.some((directory) => {
      const routePrefix = `/${directory.replace(/^docs\//, '').replace(/\\/g, '/')}/`
      return url.startsWith(routePrefix)
    })
    const labelMatches = normalizedTags.some((tag) => tag === branch.label || (branch.aliases || []).includes(tag))
    return routeMatches || labelMatches
  })

  if (matchingBranch) {
    return {
      domainId: matchingBranch.primaryParentId,
      branchId: matchingBranch.id
    }
  }

  const matchingDomain = domains.find((domain) => (
    url.startsWith(domain.route) || normalizedTags.includes(domain.label)
  ))

  return {
    domainId: matchingDomain?.id || '',
    branchId: ''
  }
}

function findCycle(edges, type) {
  const outgoing = new Map()
  for (const [from, to] of edges) {
    if (!outgoing.has(from)) outgoing.set(from, [])
    outgoing.get(from).push(to)
  }

  const active = new Set()
  const complete = new Set()

  function visit(node) {
    if (active.has(node)) return node
    if (complete.has(node)) return undefined
    active.add(node)
    for (const target of outgoing.get(node) || []) {
      const found = visit(target)
      if (found) return found
    }
    active.delete(node)
    complete.add(node)
    return undefined
  }

  for (const node of outgoing.keys()) {
    const found = visit(node)
    if (found) return `${type} 关系存在循环，涉及 ${found}`
  }

  return undefined
}

export function validateTaxonomy() {
  const errors = []
  const ids = new Set()
  const routes = new Set()
  const allowedKinds = new Set(['domain', 'branch', 'concept'])
  const allowedStatuses = new Set(['candidate', 'active', 'deprecated'])
  const allowedVisibility = new Set(['public', 'when-used', 'hidden'])
  const allowedRelations = new Set(['broader', 'related', 'requires', 'part_of', 'applies_to', 'uses_method', 'inspired_by'])

  for (const node of taxonomyNodes) {
    if (!node.id || ids.has(node.id)) errors.push(`taxonomy 节点 ID 无效或重复：${node.id || '(空)'}`)
    ids.add(node.id)
    if (!allowedKinds.has(node.kind)) errors.push(`${node.id}: kind 无效`)
    if (!node.label || !node.slug || !node.description) errors.push(`${node.id}: 缺少 label、slug 或 description`)
    if (!allowedStatuses.has(node.status)) errors.push(`${node.id}: status 无效`)
    if (!allowedVisibility.has(node.visibility)) errors.push(`${node.id}: visibility 无效`)
    if (node.primaryParentId && !nodesById.has(node.primaryParentId)) errors.push(`${node.id}: primaryParentId 不存在`)
    for (const parentId of node.secondaryParentIds || []) {
      if (!nodesById.has(parentId)) errors.push(`${node.id}: secondaryParentId 不存在：${parentId}`)
    }
    if (node.route) {
      if (routes.has(node.route)) errors.push(`${node.id}: route 重复：${node.route}`)
      routes.add(node.route)
    }
  }

  const hierarchyEdges = taxonomyNodes.flatMap((node) => [
    ...(node.primaryParentId ? [[node.id, node.primaryParentId]] : []),
    ...(node.secondaryParentIds || []).map((parentId) => [node.id, parentId])
  ])
  const hierarchyCycle = findCycle(hierarchyEdges, '层级')
  if (hierarchyCycle) errors.push(hierarchyCycle)

  const relationKeys = new Set()
  const prerequisiteEdges = []
  for (const relation of taxonomyRelations) {
    if (!nodesById.has(relation.from) || !nodesById.has(relation.to)) {
      errors.push(`关系引用了不存在的节点：${relation.from} -> ${relation.to}`)
    }
    if (relation.from === relation.to) errors.push(`关系不能指向自身：${relation.from}`)
    if (!allowedRelations.has(relation.type)) errors.push(`关系类型无效：${relation.type}`)
    if (!['candidate', 'approved'].includes(relation.status)) errors.push(`关系审核状态无效：${relation.status}`)
    if (!relation.provenance) errors.push(`关系缺少来源：${relation.from} -> ${relation.to}`)
    const key = relation.type === 'related'
      ? `related:${[relation.from, relation.to].sort().join(':')}`
      : `${relation.type}:${relation.from}:${relation.to}`
    if (relationKeys.has(key)) errors.push(`关系重复：${key}`)
    relationKeys.add(key)
    if (relation.type === 'requires' && relation.status === 'approved') prerequisiteEdges.push([relation.from, relation.to])
  }

  const prerequisiteCycle = findCycle(prerequisiteEdges, '前置')
  if (prerequisiteCycle) errors.push(prerequisiteCycle)

  for (const collection of taxonomyCollections) {
    for (const topicId of collection.topicIds || []) {
      if (!nodesById.has(topicId)) errors.push(`${collection.id}: 专题引用不存在的主题 ${topicId}`)
    }
  }

  for (const mapping of taxonomyExternalMappings.mappings || []) {
    if (!nodesById.has(mapping.nodeId)) errors.push(`外部映射引用不存在的节点：${mapping.nodeId}`)
  }

  for (const [domainId, section] of Object.entries(taxonomyCoverage)) {
    const expected = new Set(section.expectedTopLevelCodes || section.expectedDisciplines || [])
    const accounted = new Set(Object.values(section.branches).flat())
    for (const item of expected) {
      if (!accounted.has(item)) errors.push(`${domainId} 覆盖矩阵遗漏：${item}`)
    }
    for (const branchId of Object.keys(section.branches)) {
      if (!nodesById.has(branchId)) errors.push(`${domainId} 覆盖矩阵引用不存在的分支：${branchId}`)
    }
  }

  return errors
}

export function publicTaxonomy({ usedTopicIds = [] } = {}) {
  const used = new Set(usedTopicIds)
  const visibleIds = new Set(taxonomyNodes
    .filter((node) => node.status === 'active' && (
      node.kind !== 'concept' || node.visibility === 'public' || used.has(node.id)
    ))
    .map((node) => node.id))

  const directlyVisibleIds = new Set(visibleIds)
  for (const relation of taxonomyRelations) {
    if (relation.status !== 'approved') continue
    if (directlyVisibleIds.has(relation.from) || directlyVisibleIds.has(relation.to)) {
      const from = nodesById.get(relation.from)
      const to = nodesById.get(relation.to)
      if (from?.status === 'active') visibleIds.add(from.id)
      if (to?.status === 'active') visibleIds.add(to.id)
    }
  }

  const publicNodes = taxonomyNodes
    .filter((node) => visibleIds.has(node.id))
    .map(({ externalRefs: _externalRefs, directory: _directory, contentDirectories: _contentDirectories, status: _status, visibility: _visibility, ...node }) => node)

  const hierarchyRelations = publicNodes.flatMap((node) => [
    ...(node.primaryParentId && visibleIds.has(node.primaryParentId)
      ? [{ from: node.id, type: 'broader', to: node.primaryParentId }]
      : []),
    ...(node.secondaryParentIds || [])
      .filter((parentId) => visibleIds.has(parentId))
      .map((parentId) => ({ from: node.id, type: 'related', to: parentId }))
  ])

  const semanticRelations = taxonomyRelations
    .filter((relation) => relation.status === 'approved' && visibleIds.has(relation.from) && visibleIds.has(relation.to))
    .map(({ provenance: _provenance, status: _status, note: _note, ...relation }) => relation)

  return {
    nodes: publicNodes,
    relations: [...hierarchyRelations, ...semanticRelations],
    collections: taxonomyCollections.map(({ id, label, description, route, topicIds }) => ({
      id,
      label,
      description,
      route,
      topicIds: topicIds.filter((topicId) => visibleIds.has(topicId))
    }))
  }
}
