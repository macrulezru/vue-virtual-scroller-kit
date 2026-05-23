<script setup lang="ts" generic="T">
import { computed, onMounted, onUnmounted, ref, watch, type Ref } from 'vue'
import { useVirtualScroll } from '../core/useVirtualScroll'

const props = withDefaults(
  defineProps<{
    items: T[]
    keyField?: string
    estimatedItemSize?: number | ((item: T, index: number) => number)
    overscan?: number
    minHeight?: number
    /** External scroll container. Mutually exclusive with pageMode. */
    scrollElement?: HTMLElement | null
    /** Use window as scroll container (page-mode). */
    pageMode?: boolean
    isLoading?: boolean
    /** Save/restore scroll position across mounts via sessionStorage. */
    restoreKey?: string
    ssrPreloadCount?: number
    /**
     * Reuse DOM nodes instead of unmounting them when items scroll out of view.
     * Improves scroll performance for heavy row content at the cost of disabling
     * item-keyed transitions/animations.
     */
    recyclePool?: boolean
  }>(),
  {
    keyField: 'id',
    estimatedItemSize: 50,
    overscan: 3,
    minHeight: 0,
    scrollElement: null,
    pageMode: false,
    isLoading: false,
    ssrPreloadCount: 20,
    recyclePool: false,
  },
)

const emit = defineEmits<{
  scroll: [event: Event]
  'visible-range-change': [range: { start: number; end: number }]
}>()

const containerRef = ref<HTMLElement | null>(null)
const isSSR = typeof window === 'undefined'

// Wrap item-based estimatedItemSize function to index-based for useVirtualScroll
const estimatedSizeArg = computed(() => {
  const es = props.estimatedItemSize
  if (typeof es === 'function') {
    return (index: number) => {
      const item = props.items[index]
      return item != null ? (es as (item: T, index: number) => number)(item, index) : 50
    }
  }
  return es ?? 50
})

const itemCountRef = computed(() => props.items.length) as Ref<number>

function getScrollEl(): HTMLElement | null {
  if (props.pageMode) return containerRef.value
  if (props.scrollElement) return props.scrollElement
  return containerRef.value
}

const {
  visibleRange,
  totalHeight,
  offsetTop,
  scrollTo,
  scrollToOffset,
  measureItem,
  handleScroll,
} = useVirtualScroll({
  itemCount: itemCountRef,
  estimatedItemSize: estimatedSizeArg.value,
  overscan: props.overscan,
  getScrollElement: getScrollEl,
  pageMode: props.pageMode,
})

// When an external scrollElement is provided it may be null on first render
// (Vue template refs are set after the DOM commit). Watch with flush:'post' so
// we re-attach the scroll listener once the element becomes available.
watch(
  () => props.scrollElement,
  (newEl, oldEl) => {
    if (!newEl) return
    // Remove listener that useVirtualScroll attached on mount to the previous
    // target (containerRef when oldEl was null, or oldEl itself otherwise).
    const prevEl = oldEl ?? containerRef.value
    prevEl?.removeEventListener('scroll', handleScroll)
    newEl.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    // Track viewport size changes on the external element so visible range
    // recalculates when the container grows/shrinks (useVirtualScroll's own
    // ResizeObserver only covers the element known at mount time).
    viewportRO?.disconnect()
    if (typeof ResizeObserver !== 'undefined') {
      viewportRO = new ResizeObserver(() => handleScroll())
      viewportRO.observe(newEl)
    }
  },
  { flush: 'post' },
)

defineExpose({ scrollTo, scrollToOffset, measureItem })

watch(visibleRange, (range) => emit('visible-range-change', range))

// Re-build position manager when estimatedItemSize function changes
watch(
  () => props.estimatedItemSize,
  () => {
    // Force range recalc; actual manager rebuild happens via itemCount watch
  },
)

// SSR: first N rows with estimated heights
const ssrCount = computed(() =>
  isSSR ? Math.min(props.items.length, props.ssrPreloadCount) : props.items.length,
)

const visibleItems = computed(() => {
  if (isSSR) {
    return props.items.slice(0, ssrCount.value).map((item, index) => {
      const es = props.estimatedItemSize
      const h = typeof es === 'function' ? es(item, index) : (es ?? 50)
      return {
        item,
        index,
        style: { position: 'absolute' as const, top: `${index * h}px`, width: '100%' },
      }
    })
  }

  const { start, end } = visibleRange.value
  const result = []
  for (let i = start; i <= end && i < props.items.length; i++) {
    result.push({
      item: props.items[i],
      index: i,
      style: { position: 'absolute' as const, top: `${offsetTop(i)}px`, width: '100%' },
    })
  }
  return result
})

const containerStyle = computed(() => ({
  position: 'relative' as const,
  height: `${Math.max(totalHeight.value, props.minHeight)}px`,
  width: '100%',
}))

// ResizeObserver — single instance for all visible rows
let resizeObserver: ResizeObserver | null = null
// Separate observer that watches the scroll container size (triggers visible range recalc)
let viewportRO: ResizeObserver | null = null
const rowElements = new Map<number, Element>()
// Reverse map: element → the item index it currently represents.
// Used to correctly clean up rowElements when recyclePool reuses a DOM node
// for a different item index.
const rowElementIndex = new WeakMap<Element, number>()

function setupResizeObserver(): void {
  if (isSSR || typeof ResizeObserver === 'undefined') return
  resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const el = entry.target as HTMLElement
      const indexStr = el.dataset['virtualIndex']
      if (indexStr == null) continue
      const height = entry.contentRect.height
      if (height > 0) measureItem(parseInt(indexStr, 10), height)
    }
  })
}

function observeRow(el: Element, index: number): void {
  if (!resizeObserver) return
  // When recyclePool is on, the same DOM node may be reassigned to a different
  // item. Clean up the stale forward entry so the old index isn't orphaned.
  const prevIndex = rowElementIndex.get(el)
  if (prevIndex !== undefined && prevIndex !== index) {
    if (rowElements.get(prevIndex) === el) rowElements.delete(prevIndex)
  }
  const existing = rowElements.get(index)
  if (existing && existing !== el) resizeObserver.unobserve(existing)
  rowElementIndex.set(el, index)
  rowElements.set(index, el)
  resizeObserver.observe(el)
}

function unobserveRow(index: number): void {
  const el = rowElements.get(index)
  if (el) {
    if (resizeObserver) resizeObserver.unobserve(el)
    rowElementIndex.delete(el)
  }
  rowElements.delete(index)
}

// Scroll restoration
const RESTORE_PREFIX = 'vvsk:restore:'

function saveScroll(): void {
  if (!props.restoreKey || isSSR) return
  const el = props.pageMode ? null : getScrollEl()
  const pos = el ? el.scrollTop : props.pageMode ? window.scrollY : 0
  try {
    sessionStorage.setItem(RESTORE_PREFIX + props.restoreKey, String(pos))
  } catch {
    // sessionStorage may be blocked (private mode, etc.)
  }
}

function restoreScroll(): void {
  if (!props.restoreKey || isSSR) return
  try {
    const saved = sessionStorage.getItem(RESTORE_PREFIX + props.restoreKey)
    if (saved != null) scrollToOffset(parseFloat(saved))
  } catch {
    // ignore
  }
}

onMounted(() => {
  setupResizeObserver()
  if (!props.pageMode) {
    const el = containerRef.value
    el?.addEventListener('scroll', (e) => emit('scroll', e), { passive: true })
    el?.addEventListener('scroll', saveScroll, { passive: true })
  } else {
    window.addEventListener('scroll', saveScroll, { passive: true })
  }
  // Restore after first paint so offsetTop values are ready
  requestAnimationFrame(restoreScroll)
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  viewportRO?.disconnect()
  rowElements.clear()
  if (props.pageMode) {
    window.removeEventListener('scroll', saveScroll)
  }
})

function getItemKey(item: T, index: number): string | number {
  const val = (item as Record<string, unknown>)[props.keyField as string]
  return val != null ? (val as string | number) : index
}
</script>

<template>
  <div
    ref="containerRef"
    class="vvsk-list"
    :style="
      pageMode || scrollElement
        ? { position: 'relative' }
        : { overflowY: 'auto', position: 'relative' }
    "
    role="list"
    :aria-rowcount="items.length"
    :aria-busy="isLoading || undefined"
  >
    <!-- Skeleton: shown while list is empty AND loading -->
    <slot v-if="items.length === 0 && isLoading" name="skeleton">
      <div class="vvsk-list__skeleton" aria-hidden="true">
        <div v-for="i in ssrPreloadCount" :key="i" class="vvsk-list__skeleton-row" />
      </div>
    </slot>

    <template v-else>
      <div :style="containerStyle">
        <div
          v-for="({ item, index, style }, slotIdx) in visibleItems"
          :ref="(el) => el && observeRow(el as Element, index)"
          :key="recyclePool ? slotIdx : getItemKey(item, index)"
          :data-virtual-index="index"
          :style="style"
          role="listitem"
          :aria-rowindex="index + 1"
          @vue:unmounted="unobserveRow(index)"
        >
          <slot :item="item" :index="index" :style="style" />
        </div>
      </div>

      <slot v-if="items.length === 0" name="empty" />
      <slot v-if="isLoading" name="loading" />
    </template>
  </div>
</template>

<style scoped>
.vvsk-list__skeleton {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
}

.vvsk-list__skeleton-row {
  height: 48px;
  border-radius: 6px;
  background: linear-gradient(
    90deg,
    var(--vvsk-skeleton-base, #2a2d3e) 25%,
    var(--vvsk-skeleton-shine, #3a3d52) 50%,
    var(--vvsk-skeleton-base, #2a2d3e) 75%
  );
  background-size: 200% 100%;
  animation: vvsk-shimmer 1.4s infinite;
}

@keyframes vvsk-shimmer {
  0% {
    background-position: 200% 0;
  }

  100% {
    background-position: -200% 0;
  }
}
</style>
