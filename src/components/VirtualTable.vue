<script setup lang="ts" generic="T">
import { computed, onMounted, onUnmounted, ref, watch, type CSSProperties } from 'vue'
import { useVirtualScroll } from '../core/useVirtualScroll'
import { PositionManager } from '../core/PositionManager'
import type { ColumnDef, SortChange } from '../types'

const props = withDefaults(
  defineProps<{
    columns: ColumnDef[]
    rows: T[]
    stickyHeader?: boolean
    stickyHeaderOffset?: number
    /** Single-column sort */
    sortable?: boolean
    /** Enable Shift+click multi-column sort */
    multiSort?: boolean
    estimatedItemSize?: number
    overscan?: number
    keyField?: string
    /** Rows pinned to the top (rendered inside <thead>, always visible) */
    pinnedTopRows?: T[]
    /** Rows pinned to the bottom (rendered inside <tfoot>, always visible) */
    pinnedBottomRows?: T[]
    /** Render only horizontally visible columns */
    virtualizeColumns?: boolean
    /** Allow drag-to-resize column borders */
    resizableColumns?: boolean
    /** Called when user scrolls near the bottom and hasMore is true */
    onLoadMore?: () => void
    /** Whether more rows are available to load */
    hasMore?: boolean
    /** Whether a load is currently in progress (prevents duplicate calls) */
    isLoading?: boolean
    /** Pixels from bottom edge that triggers onLoadMore (default 150) */
    loadMoreThreshold?: number
  }>(),
  {
    stickyHeader: true,
    stickyHeaderOffset: 0,
    sortable: false,
    multiSort: false,
    estimatedItemSize: 40,
    overscan: 3,
    keyField: 'id',
    pinnedTopRows: () => [],
    pinnedBottomRows: () => [],
    virtualizeColumns: false,
    resizableColumns: false,
    hasMore: false,
    isLoading: false,
    loadMoreThreshold: 150,
  },
)

const emit = defineEmits<{
  'sort-change': [sort: SortChange | SortChange[]]
  scroll: [event: Event]
  'visible-range-change': [range: { start: number; end: number }]
  'column-resize': [key: string, width: number]
}>()

defineSlots<{
  'header-cell'(props: { column: ColumnDef }): unknown
  'cell'(props: { row: T; column: ColumnDef; value: unknown }): unknown
  'row'(props: { row: T; index: number }): unknown
  'pinned-row'(props: { row: T; index: number; position: 'top' | 'bottom' }): unknown
  'pinned-cell'(props: {
    row: T
    column: ColumnDef
    value: unknown
    position: 'top' | 'bottom'
  }): unknown
  'loading-indicator'(props: Record<string, never>): unknown
}>()

const scrollContainerRef = ref<HTMLElement | null>(null)
const isScrolled = ref(false)
const scrollLeft = ref(0)

// ── Sort ─────────────────────────────────────────────────────────────────────

const sortStack = ref<SortChange[]>([])

function handleSortClick(col: ColumnDef, event: MouseEvent): void {
  if (!props.sortable && !props.multiSort) return
  const useMulti = props.multiSort && event.shiftKey

  if (useMulti) {
    const idx = sortStack.value.findIndex((s) => s.key === col.key)
    if (idx === -1) {
      sortStack.value = [...sortStack.value, { key: col.key, direction: 'asc' }]
    } else {
      const entry = sortStack.value[idx]
      if (entry.direction === 'asc') {
        sortStack.value = sortStack.value.map((s, i) =>
          i === idx ? { ...s, direction: 'desc' } : s,
        )
      } else {
        sortStack.value = sortStack.value.filter((_, i) => i !== idx)
      }
    }
    emit('sort-change', [...sortStack.value])
  } else {
    const current = sortStack.value[0]
    let direction: 'asc' | 'desc' | null
    if (!current || current.key !== col.key || current.direction === null) {
      direction = 'asc'
    } else if (current.direction === 'asc') {
      direction = 'desc'
    } else {
      direction = null
    }
    const next: SortChange = { key: col.key, direction }
    sortStack.value = direction ? [next] : []
    emit('sort-change', next)
  }
}

function getSortIcon(key: string): string | null {
  const entry = sortStack.value.find((s) => s.key === key)
  if (!entry || entry.direction === null) return null
  return entry.direction === 'asc' ? '↑' : '↓'
}

function getSortOrder(key: string): number | null {
  if (!props.multiSort || sortStack.value.length < 2) return null
  const idx = sortStack.value.findIndex((s) => s.key === key)
  return idx === -1 ? null : idx + 1
}

// ── Column widths (resizing) ──────────────────────────────────────────────────

const colWidths = ref<Map<string, number>>(new Map())

function getEffectiveWidth(col: ColumnDef): number {
  return colWidths.value.get(col.key) ?? col.width ?? col.minWidth ?? 100
}

let resizingKey: string | null = null
let resizeStartX = 0
let resizeStartWidth = 0

function startResize(col: ColumnDef, event: PointerEvent): void {
  if (!props.resizableColumns) return
  event.preventDefault()
  resizingKey = col.key
  resizeStartX = event.clientX
  resizeStartWidth = getEffectiveWidth(col)
  ;(event.target as HTMLElement).setPointerCapture(event.pointerId)
}

function onResizeMove(event: PointerEvent): void {
  if (!resizingKey) return
  const delta = event.clientX - resizeStartX
  const col = props.columns.find((c) => c.key === resizingKey)
  if (!col) return
  const minW = col.minWidth ?? 40
  const maxW = col.maxWidth ?? 2000
  const newWidth = Math.min(maxW, Math.max(minW, resizeStartWidth + delta))
  colWidths.value = new Map(colWidths.value).set(resizingKey, newWidth)
}

function stopResize(event: PointerEvent): void {
  if (!resizingKey) return
  const key = resizingKey
  resizingKey = null
  emit('column-resize', key, getEffectiveWidth({ key } as ColumnDef))
  ;(event.target as HTMLElement).releasePointerCapture(event.pointerId)
}

// ── Horizontal column virtualization ─────────────────────────────────────────

let colManager: PositionManager | null = null

function buildColManager(): void {
  if (!props.virtualizeColumns) return
  colManager = new PositionManager(props.columns.length, (i) => getEffectiveWidth(props.columns[i]))
}

watch(() => props.columns, buildColManager, { immediate: true })
watch(colWidths, buildColManager, { deep: true })

const visibleColumns = computed((): ColumnDef[] => {
  if (!props.virtualizeColumns || !colManager) return props.columns
  const containerWidth = scrollContainerRef.value?.clientWidth ?? window.innerWidth
  const left = scrollLeft.value
  const right = left + containerWidth

  const fixedKeys = new Set(props.columns.filter((c) => c.fixed).map((c) => c.key))
  const start = Math.max(0, colManager.findIndex(left) - 1)
  const end = Math.min(props.columns.length - 1, colManager.findIndex(right) + 1)

  return props.columns.filter((col, i) => fixedKeys.has(col.key) || (i >= start && i <= end))
})

// ── Fixed columns ─────────────────────────────────────────────────────────────

const leftColumns = computed(() => props.columns.filter((c) => c.fixed === 'left'))
const rightColumns = computed(() => props.columns.filter((c) => c.fixed === 'right'))

function getFixedLeft(target: ColumnDef): number {
  let offset = 0
  for (const col of leftColumns.value) {
    if (col.key === target.key) break
    offset += getEffectiveWidth(col)
  }
  return offset
}

function getFixedRight(target: ColumnDef): number {
  const rights = [...rightColumns.value].reverse()
  let offset = 0
  for (const col of rights) {
    if (col.key === target.key) break
    offset += getEffectiveWidth(col)
  }
  return offset
}

function getThStyle(col: ColumnDef): CSSProperties {
  const style: CSSProperties = {}
  if (col.fixed === 'left') {
    style.position = 'sticky'
    style.left = getFixedLeft(col) + 'px'
    style.zIndex = 3
  }
  if (col.fixed === 'right') {
    style.position = 'sticky'
    style.right = getFixedRight(col) + 'px'
    style.zIndex = 3
  }
  return style
}

function getTdStyle(col: ColumnDef): CSSProperties {
  const style: CSSProperties = {}
  if (col.fixed === 'left') {
    style.position = 'sticky'
    style.left = getFixedLeft(col) + 'px'
    style.zIndex = 2
    style.background = 'var(--vvsk-sticky-bg, #fff)'
  }
  if (col.fixed === 'right') {
    style.position = 'sticky'
    style.right = getFixedRight(col) + 'px'
    style.zIndex = 2
    style.background = 'var(--vvsk-sticky-bg, #fff)'
  }
  return style
}

function getCellValue(row: T, col: ColumnDef): unknown {
  return (row as Record<string, unknown>)[col.key]
}

// ── Virtual scroll ────────────────────────────────────────────────────────────

const itemCountRef = computed(() => props.rows.length)

const { visibleRange, totalHeight, offsetTop, scrollTo, scrollToOffset, measureItem } =
  useVirtualScroll({
    itemCount: itemCountRef,
    estimatedItemSize: props.estimatedItemSize,
    overscan: props.overscan,
    getScrollElement: () => scrollContainerRef.value,
  })

const topOffset = computed(() => offsetTop(visibleRange.value.start))

const bottomSpace = computed(() => {
  const end = visibleRange.value.end
  const endOffset = end + 1 < props.rows.length ? offsetTop(end + 1) : totalHeight.value
  return totalHeight.value - endOffset
})

const visibleRows = computed(() =>
  props.rows.slice(visibleRange.value.start, visibleRange.value.end + 1),
)

// ── Row height measurement ────────────────────────────────────────────────────

let rowRO: ResizeObserver | null = null

onMounted(() => {
  if (typeof ResizeObserver === 'undefined') return
  rowRO = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const el = entry.target as HTMLElement
      const idx = parseInt(el.dataset.vIdx ?? '', 10)
      if (!isNaN(idx)) {
        const h = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height
        measureItem(idx, h)
      }
    }
  })
})

onUnmounted(() => {
  rowRO?.disconnect()
  rowRO = null
  colManager = null
})

// Track by row key so cleanup works correctly when visibleRange.start shifts
const rowElMap = new Map<string, Element>()
const rowObserved = new WeakSet<Element>()

function setRowRef(el: Element | null, rowKey: string, absoluteIdx: number): void {
  if (!rowRO) return
  if (el) {
    // Always update the index attribute so ResizeObserver reads the current value
    ;(el as HTMLElement).dataset.vIdx = String(absoluteIdx)
    // Only observe once per element instance — re-observing triggers a spurious callback
    if (!rowObserved.has(el)) {
      rowRO.observe(el)
      rowObserved.add(el)
    }
    rowElMap.set(rowKey, el)
  } else {
    // rowKey is captured from the v-for closure at render time, so it's always correct
    const elem = rowElMap.get(rowKey)
    if (elem) {
      rowRO.unobserve(elem)
      rowObserved.delete(elem)
      rowElMap.delete(rowKey)
    }
  }
}

// ── Scroll ────────────────────────────────────────────────────────────────────

function onScroll(e: Event): void {
  const el = e.target as HTMLElement
  isScrolled.value = el.scrollLeft > 0
  scrollLeft.value = el.scrollLeft
  emit('scroll', e)
  emit('visible-range-change', { start: visibleRange.value.start, end: visibleRange.value.end })

  if (props.onLoadMore && props.hasMore && !props.isLoading) {
    const { scrollTop, scrollHeight, clientHeight } = el
    if (scrollHeight - scrollTop - clientHeight < props.loadMoreThreshold!) {
      props.onLoadMore()
    }
  }
}

// ── Expose ────────────────────────────────────────────────────────────────────

defineExpose({
  scrollTo: (index: number, align?: 'start' | 'center' | 'end' | 'auto') => scrollTo(index, align),
  scrollToOffset: (offset: number) => scrollToOffset(offset),
  measureItem,
  getSortStack: () => [...sortStack.value],
  clearSort: () => {
    sortStack.value = []
  },
})
</script>

<template>
  <div
    ref="scrollContainerRef"
    class="vvsk-table"
    :class="{ 'vvsk-table--scrolled': isScrolled }"
    style="overflow: auto; position: relative"
    @scroll="onScroll"
  >
    <table class="vvsk-table__table">
      <!-- Column widths — browser syncs header/body automatically -->
      <colgroup>
        <col
          v-for="col in visibleColumns"
          :key="col.key"
          :style="{ width: getEffectiveWidth(col) + 'px', minWidth: (col.minWidth ?? 40) + 'px' }"
        />
      </colgroup>

      <!-- Header + pinned top rows -->
      <thead
        v-if="stickyHeader || (pinnedTopRows && pinnedTopRows.length > 0)"
        class="vvsk-table__thead"
        :style="{
          position: stickyHeader ? 'sticky' : 'relative',
          top: stickyHeaderOffset + 'px',
          zIndex: 10,
        }"
      >
        <!-- Column headers -->
        <tr v-if="stickyHeader" class="vvsk-table__header-row">
          <th
            v-for="col in visibleColumns"
            :key="col.key"
            class="vvsk-table__header-cell"
            :class="{ 'vvsk-table__header-cell--sortable': sortable || multiSort }"
            :style="getThStyle(col)"
            @click="handleSortClick(col, $event)"
          >
            <slot name="header-cell" :column="col">
              <span>{{ col.title }}</span>
              <span
                v-if="(sortable || multiSort) && getSortIcon(col.key)"
                class="vvsk-table__sort-icon"
              >
                {{ getSortIcon(col.key) }}
                <sup v-if="getSortOrder(col.key) !== null" class="vvsk-table__sort-order">
                  {{ getSortOrder(col.key) }}
                </sup>
              </span>
            </slot>
            <div
              v-if="resizableColumns"
              class="vvsk-table__resize-handle"
              @pointerdown="startResize(col, $event)"
              @pointermove="onResizeMove($event)"
              @pointerup="stopResize($event)"
            />
          </th>
        </tr>

        <!-- Pinned top rows live inside <thead> — sticky for free -->
        <tr
          v-for="(row, idx) in pinnedTopRows"
          :key="`pt-${idx}`"
          class="vvsk-table__row vvsk-table__row--pinned vvsk-table__row--pinned-top"
        >
          <slot name="pinned-row" :row="row" :index="idx" :position="'top'">
            <td
              v-for="col in visibleColumns"
              :key="col.key"
              class="vvsk-table__cell vvsk-table__cell--pinned"
              :style="getTdStyle(col)"
            >
              <slot
                name="pinned-cell"
                :row="row"
                :column="col"
                :value="getCellValue(row, col)"
                :position="'top'"
              >
                {{ getCellValue(row, col) }}
              </slot>
            </td>
          </slot>
        </tr>
      </thead>

      <!-- Body: top spacer → visible rows → bottom spacer -->
      <tbody>
        <!-- Always rendered — height 0 when not needed, avoids DOM add/remove near scroll anchor -->
        <tr class="vvsk-table__spacer" aria-hidden="true">
          <td :colspan="visibleColumns.length" :style="{ height: topOffset + 'px' }"></td>
        </tr>

        <template
          v-for="(row, vIdx) in visibleRows"
          :key="(row as Record<string, unknown>)[keyField]"
        >
          <slot name="row" :row="row" :index="visibleRange.start + vIdx">
            <tr
              :ref="
                (el) =>
                  setRowRef(
                    el as Element | null,
                    String((row as Record<string, unknown>)[keyField]),
                    visibleRange.start + vIdx,
                  )
              "
              class="vvsk-table__row"
            >
              <td
                v-for="col in visibleColumns"
                :key="col.key"
                class="vvsk-table__cell"
                :style="getTdStyle(col)"
              >
                <slot name="cell" :row="row" :column="col" :value="getCellValue(row, col)">
                  {{ getCellValue(row, col) }}
                </slot>
              </td>
            </tr>
          </slot>
        </template>

        <!-- Always rendered — height 0 when not needed -->
        <tr class="vvsk-table__spacer" aria-hidden="true">
          <td :colspan="visibleColumns.length" :style="{ height: bottomSpace + 'px' }"></td>
        </tr>
      </tbody>

      <!-- Pinned bottom rows live in <tfoot> — sticky to bottom -->
      <tfoot
        v-if="pinnedBottomRows && pinnedBottomRows.length > 0"
        class="vvsk-table__tfoot"
        style="position: sticky; bottom: 0; z-index: 5"
      >
        <tr
          v-for="(row, idx) in pinnedBottomRows"
          :key="`pb-${idx}`"
          class="vvsk-table__row vvsk-table__row--pinned vvsk-table__row--pinned-bottom"
        >
          <slot name="pinned-row" :row="row" :index="idx" :position="'bottom'">
            <td
              v-for="col in visibleColumns"
              :key="col.key"
              class="vvsk-table__cell vvsk-table__cell--pinned"
              :style="getTdStyle(col)"
            >
              <slot
                name="pinned-cell"
                :row="row"
                :column="col"
                :value="getCellValue(row, col)"
                :position="'bottom'"
              >
                {{ getCellValue(row, col) }}
              </slot>
            </td>
          </slot>
        </tr>
      </tfoot>
    </table>

    <!-- Load more indicator (outside <table>) -->
    <div v-if="isLoading && hasMore" class="vvsk-table__loading">
      <slot name="loading-indicator">
        <div class="vvsk-table__loading-default">Loading…</div>
      </slot>
    </div>
  </div>
</template>

<style scoped>
/* Prevent browser scroll anchoring from adjusting scrollTop when spacer height changes */
.vvsk-table {
  overflow-anchor: none;
}

.vvsk-table__table {
  table-layout: fixed;
  border-collapse: collapse;
  width: max-content;
  min-width: 100%;
}

.vvsk-table__spacer td {
  padding: 0;
  border: none;
}

.vvsk-table__header-cell--sortable {
  cursor: pointer;
  user-select: none;
}

.vvsk-table__header-cell--sortable:hover {
  opacity: 0.8;
}

.vvsk-table__sort-icon {
  margin-left: 4px;
  opacity: 0.5;
}

.vvsk-table__sort-order {
  font-size: 0.65em;
  vertical-align: super;
}

.vvsk-table__header-cell {
  position: relative;
  text-align: left;
}

.vvsk-table__resize-handle {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: col-resize;
  z-index: 2;
}

.vvsk-table__resize-handle:hover,
.vvsk-table__resize-handle:active {
  background: rgb(99, 102, 241, 0.4);
}

.vvsk-table__cell--pinned {
  font-weight: 600;
  background-color: var(--vvsk-sticky-bg, #fff);
}

.vvsk-table__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
}

.vvsk-table__loading-default {
  font-size: 13px;
  opacity: 0.5;
}

/* Shadow on left-fixed columns when scrolled horizontally */
.vvsk-table--scrolled th[style*='position: sticky'][style*='left'],
.vvsk-table--scrolled td[style*='position: sticky'][style*='left'] {
  box-shadow: 2px 0 4px rgb(0, 0, 0, 0.15);
}
</style>
