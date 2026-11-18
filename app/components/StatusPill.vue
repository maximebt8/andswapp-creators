<script setup>
import { STATUS_EN, STATUS_FR, STATUS_TONE } from '~~/shared/utils/collab'
const props = defineProps({ status: { type: String, required: true }, lang: { type: String, default: 'en' } })
const label = computed(() => (props.lang === 'fr' ? STATUS_FR : STATUS_EN)[props.status] ?? props.status)
const tone = computed(() => STATUS_TONE[props.status] ?? 'bg-gray-100 text-gray-600')
</script>

<template>
  <span class="pill" :class="tone">{{ label }}</span>
</template>
