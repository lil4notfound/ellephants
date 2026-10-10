<script setup lang="ts">
import { withBase } from 'vitepress'

defineProps<{ href: string }>()
</script>

<template>
  <a :href="withBase(href)" target="_self"><slot /></a>
</template>
