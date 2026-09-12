<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'
import { data as publishedPages } from '../../../content.data'

const { page } = useData()

const pages = computed(() => {
  const currentDirectory = `/${page.value.relativePath.replace(/index\.md$/, '')}`
  return publishedPages.filter((entry) => entry.directory === currentDirectory)
})

function hasUsefulDescription(title: string, description: string) {
  return description && description !== title
}
</script>

<template>
  <div v-if="pages.length" class="directory-contents">
    <a
      v-for="entry in pages"
      :key="entry.url"
      class="directory-entry"
      :href="withBase(entry.url)"
    >
      <span class="directory-entry__copy">
        <strong>{{ entry.title }}</strong>
        <span v-if="hasUsefulDescription(entry.title, entry.description)">
          {{ entry.description }}
        </span>
      </span>
      <span class="directory-entry__arrow" aria-hidden="true">→</span>
    </a>
  </div>
  <p v-else class="directory-contents__empty">暂无已收录页面。</p>
</template>
