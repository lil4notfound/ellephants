<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'

interface Attachment {
  name: string
  url: string
  size?: number
}

const { frontmatter } = useData()

const attachments = computed<Attachment[]>(() => {
  const value = frontmatter.value.attachments
  if (!Array.isArray(value)) return []

  return value.filter((item): item is Attachment => (
    typeof item === 'object' &&
    item !== null &&
    typeof item.name === 'string' &&
    typeof item.url === 'string'
  ))
})

function formatType(name: string) {
  const normalized = name.toLowerCase()
  if (normalized.endsWith('.tar.gz')) return 'TAR.GZ'

  const extension = normalized.match(/\.([a-z0-9]+)$/)?.[1]
  return extension?.toUpperCase() || '文件'
}

function formatSize(bytes?: number) {
  if (!Number.isFinite(bytes) || !bytes || bytes < 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
</script>

<template>
  <div v-if="attachments.length" class="article-attachments">
    <a
      v-for="attachment in attachments"
      :key="attachment.url"
      class="article-attachment"
      :href="withBase(attachment.url)"
      :download="attachment.name"
      :aria-label="`下载附件：${attachment.name}`"
    >
      <span class="article-attachment__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="20" height="20">
          <path d="M8.5 12.5 12 16l3.5-3.5M12 4v12m-6 4h12" />
        </svg>
      </span>
      <span class="article-attachment__copy">
        <strong>{{ attachment.name }}</strong>
        <span>
          {{ formatType(attachment.name) }}<template v-if="formatSize(attachment.size)"> · {{ formatSize(attachment.size) }}</template>
        </span>
      </span>
      <span class="article-attachment__arrow" aria-hidden="true">↘</span>
    </a>
  </div>
</template>
