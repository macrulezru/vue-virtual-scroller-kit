<script setup lang="ts" generic="T">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import VirtualList from './VirtualList.vue'
import type { VirtualListExpose } from '../types'

const props = withDefaults(
  defineProps<{
    items: T[]
    onLoadMore: () => Promise<void>
    threshold?: number
    direction?: 'down' | 'up' | 'both'
    isLoading: boolean
    hasMore: boolean
    keyField?: string
    estimatedItemSize?: number
    overscan?: number
  }>(),
  {
    threshold: 200,
    direction: 'down',
    keyField: 'id',
    estimatedItemSize: 50,
    overscan: 3,
  },
)

const emit = defineEmits<{
  scroll: [event: Event]
  'visible-range-change': [range: { start: number; end: number }]
}>()

const listRef = ref<VirtualListExpose | null>(null)
const containerRef = ref<HTMLElement | null>(null)

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let isLoadingMore = false

async function checkThreshold(el: HTMLElement): Promise<void> {
  if (props.isLoading || isLoadingMore) return

  const scrollTop = el.scrollTop
  const scrollHeight = el.scrollHeight
  const clientHeight = el.clientHeight

  // Down direction
  if ((props.direction === 'down' || props.direction === 'both') && props.hasMore) {
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight
    if (distanceFromBottom <= props.threshold) {
      isLoadingMore = true
      try {
        await props.onLoadMore()
      } finally {
        isLoadingMore = false
      }
      return
    }
  }

  // Up direction
  if ((props.direction === 'up' || props.direction === 'both') && props.hasMore) {
    if (scrollTop <= props.threshold) {
      const savedScrollHeight = el.scrollHeight
      const savedScrollTop = el.scrollTop
      isLoadingMore = true
      try {
        await props.onLoadMore()
        // Restore scroll position after prepending items
        requestAnimationFrame(() => {
          el.scrollTop = savedScrollTop + (el.scrollHeight - savedScrollHeight)
        })
      } finally {
        isLoadingMore = false
      }
    }
  }
}

function onScroll(e: Event): void {
  emit('scroll', e)
  const el = e.target as HTMLElement
  if (debounceTimer !== null) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    void checkThreshold(el)
  }, 50)
}

onMounted(() => {
  // Initial check in case items don't fill the viewport
  const el = containerRef.value
  if (el) void checkThreshold(el)
})

onUnmounted(() => {
  if (debounceTimer !== null) clearTimeout(debounceTimer)
})

// Re-check after loading completes and more items are available
watch(
  () => props.isLoading,
  (loading) => {
    if (!loading) {
      const el = containerRef.value
      if (el) void checkThreshold(el)
    }
  },
)

defineExpose({
  scrollTo: (index: number, align?: 'start' | 'center' | 'end' | 'auto') =>
    listRef.value?.scrollTo(index, align),
  scrollToOffset: (offset: number) => listRef.value?.scrollToOffset(offset),
})
</script>

<template>
  <div
    ref="containerRef"
    class="vvsk-infinite-loader"
    style="overflow-y: auto; height: 100%"
    @scroll="onScroll"
  >
    <!-- Up loading indicator -->
    <div
      v-if="isLoading && (direction === 'up' || direction === 'both')"
      class="vvsk-infinite-loader__indicator vvsk-infinite-loader__indicator--top"
    >
      <slot name="loading-indicator">
        <div style="padding: 8px; text-align: center">Loading...</div>
      </slot>
    </div>

    <VirtualList
      ref="listRef"
      :items="items"
      :key-field="keyField"
      :estimated-item-size="estimatedItemSize"
      :overscan="overscan"
      :is-loading="isLoading"
      :scroll-element="containerRef"
      @visible-range-change="$emit('visible-range-change', $event)"
    >
      <template #default="slotProps">
        <slot v-bind="slotProps" />
      </template>
      <template #empty>
        <slot name="empty" />
      </template>
    </VirtualList>

    <!-- Down loading indicator -->
    <div
      v-if="isLoading && (direction === 'down' || direction === 'both')"
      class="vvsk-infinite-loader__indicator vvsk-infinite-loader__indicator--bottom"
    >
      <slot name="loading-indicator">
        <div style="padding: 8px; text-align: center">Loading...</div>
      </slot>
    </div>
  </div>
</template>
