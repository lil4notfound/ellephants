<script setup lang="ts">
import { withBase } from 'vitepress'

const entries = [
  {
    index: '01',
    title: '数学目录',
    link: '/mathematics/'
  },
  {
    index: '02',
    title: '物理目录',
    link: '/physics/'
  },
  {
    index: '03',
    title: '处境',
    link: '/situation/'
  },
  {
    index: '04',
    title: '毛茸茸',
    link: '/furry/'
  }
]
</script>

<template>
  <section class="home-topics" aria-label="知识库入口">
    <div class="home-topics__list">
      <a
        v-for="entry in entries"
        :key="entry.index"
        class="home-topic"
        :href="withBase(entry.link)"
        :aria-label="entry.title"
      >
        <span class="home-topic__index" aria-hidden="true">{{ entry.index }}</span>
        <span class="home-topic__copy">
          <strong>{{ entry.title }}</strong>
        </span>
        <span class="home-topic__arrow" aria-hidden="true">→</span>
      </a>
    </div>
  </section>
</template>
