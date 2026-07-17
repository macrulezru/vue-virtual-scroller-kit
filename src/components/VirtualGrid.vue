<script setup lang="ts" generic="T">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useVirtualScroll } from '../core/useVirtualScroll'
import type { ScrollBehaviorOptions } from '../types'

const props = withDefaults(
  defineProps<{
    items: T[]
    /** Number of columns. Pass 0 to auto-compute from columnWidth. */
    columns?: number
    /** Fixed cell width for auto-column calculation */
    columnWidth?: number
    /** Fixed cell height */
    rowHeight?: number
    /** Gap between cells in pixels */
    gap?: number
    keyField?: string
    overscan?: number
    isLoading?: boolean
    /** Apply a CSS blur while scrolling fast, clearing once scrolling settles. Off by default. */
    motionBlur?: boolean
    /**
     * Measure each row's actual height via ResizeObserver instead of using a fixed
     * `rowHeight`. `rowHeight` becomes the initial estimate. Off by default (zero cost
     * when disabled — cells stay individually absolutely-positioned as before).
     */
    dynamicRowHeight?: boolean
  }>(),
  {
    columns: 0,
    columnWidth: 200,
    rowHeight: 200,
    gap: 8,
    keyField: 'id',
    overscan: 2,
    isLoading: false,
    motionBlur: false,
    dynamicRowHeight: false,
  },
)

const emit = defineEmits<{
  scroll: [event: Event]
  'visible-range-change': [range: { start: number; end: number }]
}>()

const containerRef = ref<HTMLElement | null>(null)
const containerWidth = ref(0)

const colCount = computed(() => {
  if (props.columns > 0) return props.columns
  if (containerWidth.value === 0) return 1
  return Math.max(
    1,
    Math.floor((containerWidth.value + props.gap) / (props.columnWidth + props.gap)),
  )
})

const rowCount = computed(() => Math.ceil(props.items.length / colCount.value))

const rowHeightWithGap = computed(() => props.rowHeight + props.gap)

const itemCountRef = computed(() => rowCount.value)

const {
  visibleRange,
  totalHeight,
  offsetTop,
  scrollTo: scrollToRow,
  blurAmount,
  measureItem,
} = useVirtualScroll({
  itemCount: itemCountRef,
  estimatedItemSize: rowHeightWithGap,
  overscan: props.overscan,
  getScrollElement: () => containerRef.value,
  motionBlur: computed(() => props.motionBlur),
})

watch(visibleRange, (range) => emit('visible-range-change', range))

const visibleRows = computed(() => {
  const { start, end } = visibleRange.value
  const result: Array<{
    rowIndex: number
    cells: Array<{ item: T; index: number } | null>
    top: number
  }> = []
  for (let r = start; r <= end && r < rowCount.value; r++) {
    const cells: Array<{ item: T; index: number } | null> = []
    for (let c = 0; c < colCount.value; c++) {
      const idx = r * colCount.value + c
      cells.push(idx < props.items.length ? { item: props.items[idx], index: idx } : null)
    }
    result.push({ rowIndex: r, cells, top: offsetTop(r) })
  }
  return result
})

const containerStyle = computed(() => ({
  position: 'relative' as const,
  height: `${totalHeight.value + props.gap}px`,
  width: '100%',
  filter: blurAmount.value > 0 ? `blur(${blurAmount.value}px)` : undefined,
  transition: props.motionBlur ? 'filter 150ms ease-out' : undefined,
}))

function getItemKey(item: T, index: number): string | number {
  const val = (item as Record<string, unknown>)[props.keyField as string]
  return val != null ? (val as string | number) : index
}

function cellStyle(colIndex: number, top: number): Record<string, string> {
  const colWidth =
    props.columns > 0
      ? `${Math.floor((containerWidth.value - (colCount.value - 1) * props.gap) / colCount.value)}px`
      : `${props.columnWidth}px`
  return {
    position: 'absolute',
    top: `${top + props.gap}px`,
    insetInlineStart: `${colIndex * (props.columnWidth + props.gap) + props.gap}px`,
    width: colWidth,
    height: `${props.rowHeight}px`,
  }
}

// ── dynamicRowHeight: row-wrapper layout (flex, natural height) ─────────────────

function rowWrapperStyle(top: number): Record<string, string> {
  return {
    position: 'absolute',
    top: `${top + props.gap}px`,
    insetInlineStart: `${props.gap}px`,
    insetInlineEnd: `${props.gap}px`,
    display: 'flex',
    gap: `${props.gap}px`,
  }
}

function dynamicCellStyle(): Record<string, string> {
  const colWidth =
    props.columns > 0
      ? `${Math.floor((containerWidth.value - (colCount.value - 1) * props.gap) / colCount.value)}px`
      : `${props.columnWidth}px`
  return { width: colWidth, flexShrink: '0' }
}

let rowResizeObserver: ResizeObserver | null = null
const rowElements = new Map<number, Element>()

function observeRow(el: Element, rowIndex: number): void {
  if (!rowResizeObserver) return
  const existing = rowElements.get(rowIndex)
  if (existing && existing !== el) rowResizeObserver.unobserve(existing)
  rowElements.set(rowIndex, el)
  rowResizeObserver.observe(el)
}

function unobserveRow(rowIndex: number): void {
  const el = rowElements.get(rowIndex)
  if (el) {
    rowResizeObserver?.unobserve(el)
    rowElements.delete(rowIndex)
  }
}

// Watch container width for responsive column count
let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  if (containerRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(([entry]) => {
      containerWidth.value = entry.contentRect.width
    })
    resizeObserver.observe(containerRef.value)
    containerWidth.value = containerRef.value.clientWidth
  }
  containerRef.value?.addEventListener('scroll', (e) => emit('scroll', e), { passive: true })

  if (props.dynamicRowHeight && typeof ResizeObserver !== 'undefined') {
    rowResizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const el = entry.target as HTMLElement
        const idxStr = el.dataset['virtualRowIndex']
        if (idxStr == null) continue
        const height = entry.contentRect.height
        if (height > 0) measureItem(parseInt(idxStr, 10), height)
      }
    })
  }
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  rowResizeObserver?.disconnect()
  rowElements.clear()
})

function scrollTo(index: number, options?: ScrollBehaviorOptions): void {
  const row = Math.floor(index / colCount.value)
  scrollToRow(row, 'start', options)
}

defineExpose({ scrollTo, getScrollElement: () => containerRef.value })
</script>

<template>
  <div
    ref="containerRef"
    class="vvsk-grid"
    style="overflow-y: auto; position: relative"
    role="grid"
    :aria-rowcount="rowCount"
    :aria-colcount="colCount"
    :aria-busy="isLoading || undefined"
  >
    <slot v-if="items.length === 0 && isLoading" name="skeleton">
      <div class="vvsk-grid__skeleton">
        <div
          v-for="i in 12"
          :key="i"
          class="vvsk-grid__skeleton-cell"
          :style="{ width: `${columnWidth}px`, height: `${rowHeight}px` }"
        />
      </div>
    </slot>

    <template v-else>
      <div class="vvsk-grid__content" :style="containerStyle">
        <template v-if="dynamicRowHeight">
          <div
            v-for="{ rowIndex, cells, top } in visibleRows"
            :key="rowIndex"
            :ref="(el) => el && observeRow(el as Element, rowIndex)"
            :data-virtual-row-index="rowIndex"
            :style="rowWrapperStyle(top)"
            @vue:unmounted="unobserveRow(rowIndex)"
          >
            <div
              v-for="(cell, colIndex) in cells"
              :key="cell ? getItemKey(cell.item, cell.index) : `empty-${rowIndex}-${colIndex}`"
              :style="dynamicCellStyle()"
              :role="cell ? 'gridcell' : undefined"
              :aria-rowindex="cell ? Math.floor(cell.index / colCount) + 1 : undefined"
              :aria-colindex="cell ? (cell.index % colCount) + 1 : undefined"
            >
              <slot
                v-if="cell"
                :item="cell.item"
                :index="cell.index"
                :row="rowIndex"
                :col="colIndex"
              />
            </div>
          </div>
        </template>

        <template v-else>
          <template v-for="{ rowIndex, cells, top } in visibleRows" :key="rowIndex">
            <div
              v-for="(cell, colIndex) in cells"
              :key="cell ? getItemKey(cell.item, cell.index) : `empty-${rowIndex}-${colIndex}`"
              :style="cellStyle(colIndex, top)"
              :role="cell ? 'gridcell' : undefined"
              :aria-rowindex="cell ? Math.floor(cell.index / colCount) + 1 : undefined"
              :aria-colindex="cell ? (cell.index % colCount) + 1 : undefined"
            >
              <slot
                v-if="cell"
                :item="cell.item"
                :index="cell.index"
                :row="rowIndex"
                :col="colIndex"
              />
            </div>
          </template>
        </template>
      </div>

      <slot v-if="items.length === 0" name="empty">
        <div class="vvsk-grid__empty">No items</div>
      </slot>
    </template>
  </div>
</template>

<style scoped>
.vvsk-grid__skeleton {
  display: flex;
  flex-wrap: wrap;
  gap: v-bind('`${gap}px`');
  padding: v-bind('`${gap}px`');
}

.vvsk-grid__skeleton-cell {
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

.vvsk-grid__empty {
  padding: 32px;
  text-align: center;
  opacity: 0.5;
}
</style>
