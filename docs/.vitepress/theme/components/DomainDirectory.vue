<script setup lang="ts">
import { computed, ref } from 'vue'
import { withBase } from 'vitepress'
import taxonomyNodes from '../../../../config/taxonomy/nodes.json'
import { data as publishedPages, type ContentOrigin } from '../../../content.data'
import OriginFilter from './OriginFilter.vue'

const props = defineProps<{ domainId: string }>()
const filter = ref<'all' | ContentOrigin>('all')
const domain = computed(() => taxonomyNodes.find((node) => node.id === props.domainId))
const branches = computed(() => taxonomyNodes
  .filter((node) => node.kind === 'branch' && node.primaryParentId === props.domainId && node.status === 'active')
  .sort((left, right) => (left.order || 9999) - (right.order || 9999)))
const domainPages = computed(() => publishedPages.filter((page) => (
  page.domainId === props.domainId || page.secondaryDomainIds.includes(props.domainId)
)))
const filteredPages = computed(() => filter.value === 'all'
  ? domainPages.value
  : domainPages.value.filter((page) => page.origin === filter.value))
const counts = computed(() => ({
  all: domainPages.value.length,
  original: domainPages.value.filter((page) => page.origin === 'original').length,
  resource: domainPages.value.filter((page) => page.origin === 'resource').length
}))

function branchCount(branchId: string) {
  return filteredPages.value.filter((page) => page.branchId === branchId).length
}
</script>

<template>
  <section class="domain-directory" :aria-label="`${domain?.label || ''}目录`">
    <OriginFilter v-model="filter" :counts="counts" />

    <div v-if="branches.length" class="branch-grid">
      <a
        v-for="(branch, index) in branches"
        :key="branch.id"
        class="branch-card"
        :href="withBase(branch.route)"
      >
        <span class="branch-card__number" aria-hidden="true">{{ String(index + 1).padStart(2, '0') }}</span>
        <strong>{{ branch.label }}</strong>
        <span>{{ branch.description }}</span>
        <small v-if="branchCount(branch.id)">{{ branchCount(branch.id) }} 篇已收录内容</small>
        <span class="branch-card__arrow" aria-hidden="true">→</span>
      </a>
    </div>

    <div v-if="filteredPages.length" class="content-shelf">
      <a v-for="entry in filteredPages" :key="entry.url" :href="withBase(entry.url)" class="content-shelf__entry">
        <span class="content-shelf__meta">{{ entry.origin === 'resource' ? '资源导览' : '原创内容' }}</span>
        <strong>{{ entry.title }}</strong>
        <span v-if="entry.description && entry.description !== entry.title">{{ entry.description }}</span>
        <span class="content-shelf__arrow" aria-hidden="true">→</span>
      </a>
    </div>

    <div v-else-if="!branches.length" class="collection-empty">
      <p>这里正在开放收录。你可以分享自己的经验与创作，也可以推荐值得被看见的资源。</p>
      <a :href="withBase('/guide/contributing')">查看投稿方式</a>
    </div>
  </section>
</template>
