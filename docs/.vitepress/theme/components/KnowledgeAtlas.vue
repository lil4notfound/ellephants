<script setup lang="ts">
import { computed } from 'vue'
import { withBase } from 'vitepress'
import taxonomyNodes from '../../../../config/taxonomy/nodes.json'

const domains = computed(() => taxonomyNodes
  .filter((node) => node.kind === 'domain' && node.status === 'active')
  .sort((left, right) => (left.order || 9999) - (right.order || 9999)))

</script>

<template>
  <section class="knowledge-atlas" aria-label="知识领域">
    <div class="knowledge-atlas__domains">
      <a v-for="(domain, index) in domains" :key="domain.id" :href="withBase(domain.route)" class="domain-card">
        <span class="domain-card__number" aria-hidden="true">{{ String(index + 1).padStart(2, '0') }}</span>
        <strong>{{ domain.label }}</strong>
        <span>{{ domain.description }}</span>
        <span class="domain-card__arrow" aria-hidden="true">↗</span>
      </a>
    </div>

  </section>
</template>
