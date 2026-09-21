<script setup lang="ts">
import { computed, ref } from 'vue'
import { withBase } from 'vitepress'
import taxonomyNodes from '../../../../config/taxonomy/nodes.json'
import { data as publishedPages, type ContentOrigin } from '../../../content.data'
import OriginFilter from './OriginFilter.vue'

const props = defineProps<{ branchId: string }>()
const filter = ref<'all' | ContentOrigin>('all')
const branch = computed(() => taxonomyNodes.find((node) => node.id === props.branchId))
const pages = computed(() => publishedPages.filter((page) => page.branchId === props.branchId))
const visiblePages = computed(() => filter.value === 'all' ? pages.value : pages.value.filter((page) => page.origin === filter.value))
const counts = computed(() => ({
  all: pages.value.length,
  original: pages.value.filter((page) => page.origin === 'original').length,
  resource: pages.value.filter((page) => page.origin === 'resource').length
}))
</script>

<template>
  <section class="branch-directory" :aria-label="`${branch?.label || ''}已收录内容`">
    <OriginFilter v-model="filter" :counts="counts" />

    <div v-if="visiblePages.length" class="content-shelf">
      <a v-for="entry in visiblePages" :key="entry.url" :href="withBase(entry.url)" class="content-shelf__entry">
        <span class="content-shelf__meta">{{ entry.origin === 'resource' ? '资源导览' : '原创内容' }}</span>
        <strong>{{ entry.title }}</strong>
        <span v-if="entry.description && entry.description !== entry.title">{{ entry.description }}</span>
        <span class="content-shelf__arrow" aria-hidden="true">→</span>
      </a>
    </div>
    <div v-else class="collection-empty">
      <p>这个分支正在开放收录。</p>
      <a :href="withBase('/guide/contributing')">分享内容或推荐资源</a>
    </div>
  </section>
</template>
