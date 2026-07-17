<script setup lang="ts" generic="T">
import { computed, onMounted, onUnmounted, ref, watch, type CSSProperties } from 'vue'
import { useVirtualScroll } from '../core/useVirtualScroll'
import { PositionManager } from '../core/PositionManager'
import { normalizeScrollLeft } from '../utils/normalizeScrollLeft'
import type { ColumnDef, ScrollBehaviorOptions, SortChange } from '../types'

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
    /** Allow dragging a column header to reorder it. Independent of resizableColumns. */
    reorderableColumns?: boolean
    /** Called when user scrolls near the bottom and hasMore is true */
    onLoadMore?: () => void
    /** Whether more rows are available to load */
    hasMore?: boolean
    /** Whether a load is currently in progress (prevents duplicate calls) */
    isLoading?: boolean
    /** Pixels from bottom edge that triggers onLoadMore (default 150) */
    loadMoreThreshold?: number
    /** All rows have the same height — skips ResizeObserver to prevent scroll drift */
    uniformRowHeight?: boolean
    /** Apply a CSS blur while scrolling fast, clearing once scrolling settles. Off by default. */
    motionBlur?: boolean
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
    reorderableColumns: false,
    hasMore: false,
    isLoading: false,
    loadMoreThreshold: 150,
    uniformRowHeight: false,
    motionBlur: false,
  },
)

const emit = defineEmits<{
  'sort-change': [sort: SortChange | SortChange[]]
  scroll: [event: Event]
  'visible-range-change': [range: { start: number; end: number }]
  'column-resize': [key: string, width: number]
  'column-reorder': [order: string[]]
  'column-visibility-change': [payload: { key: string; visible: boolean }]
}>()

defineSlots<{
  'header-cell'(props: { column: ColumnDef }): unknown
  'cell'(props: { row: T; column: ColumnDef; value: unknown; index: number }): unknown
  'row'(props: { row: T; index: number }): unknown
  'pinned-row'(props: { row: T; index: number; position: 'top' | 'bottom' }): unknown
  'pinned-cell'(props: {
    row: T
    column: ColumnDef
    value: unknown
    position: 'top' | 'bottom'
    index: number
  }): unknown
  'loading-indicator'(props: Record<string, never>): unknown
}>()

const scrollContainerRef = ref<HTMLElement | null>(null)
const isScrolled = ref(false)
const scrollLeft = ref(0)

// ── Column order (reordering) ──────────────────────────────────────────────────
// Overlays props.columns without mutating it, same pattern as colWidths for resize.

const columnOrder = ref<string[]>(props.columns.map((c) => c.key))

watch(
  () => props.columns,
  (cols) => {
    const currentKeys = new Set(cols.map((c) => c.key))
    const preserved = columnOrder.value.filter((k) => currentKeys.has(k))
    const preservedSet = new Set(preserved)
    const added = cols.map((c) => c.key).filter((k) => !preservedSet.has(k))
    columnOrder.value = [...preserved, ...added]
  },
)

const orderedColumns = computed((): ColumnDef[] => {
  const byKey = new Map(props.columns.map((c) => [c.key, c]))
  const ordered: ColumnDef[] = []
  for (const key of columnOrder.value) {
    const col = byKey.get(key)
    if (col) ordered.push(col)
  }
  return ordered
})

// ── Column visibility (show/hide) ────────────────────────────────────────────
// Another overlay in the same spirit as columnOrder/colWidths — runtime/interactive
// state exposed via the imperative API rather than a prop.

const hiddenColumnKeys = ref<Set<string>>(new Set())

const shownColumns = computed((): ColumnDef[] =>
  orderedColumns.value.filter((c) => !hiddenColumnKeys.value.has(c.key)),
)

function setColumnVisible(key: string, visible: boolean): void {
  if (hiddenColumnKeys.value.has(key) === !visible) return
  const next = new Set(hiddenColumnKeys.value)
  if (visible) next.delete(key)
  else next.add(key)
  hiddenColumnKeys.value = next
  emit('column-visibility-change', { key, visible })
}

function toggleColumnVisible(key: string): void {
  setColumnVisible(key, hiddenColumnKeys.value.has(key))
}

function getHiddenColumns(): string[] {
  return [...hiddenColumnKeys.value]
}

// ── Sort ─────────────────────────────────────────────────────────────────────

const sortStack = ref<SortChange[]>([])

function handleSortClick(col: ColumnDef, event: MouseEvent): void {
  if (reorderSuppressClick) {
    reorderSuppressClick = false
    return
  }
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
  // The resize handle sits on the column's *end* edge (inset-inline-end), which is
  // the physical left side in RTL — dragging toward the start edge should still grow
  // the column, so the raw pointer delta is flipped there.
  const isRtl = scrollContainerRef.value
    ? getComputedStyle(scrollContainerRef.value).direction === 'rtl'
    : false
  const rawDelta = event.clientX - resizeStartX
  const delta = isRtl ? -rawDelta : rawDelta
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

// ── Column reordering (drag whole header) ────────────────────────────────────
// A movement threshold disambiguates this from a sort click on the same <th>.

const DRAG_REORDER_THRESHOLD_PX = 5

const reorderDragKey = ref<string | null>(null)
const reorderOverKey = ref<string | null>(null)

let reorderStartX = 0
let reorderStartY = 0
let reorderThresholdCrossed = false
let reorderSuppressClick = false

function onHeaderPointerDown(col: ColumnDef, event: PointerEvent): void {
  if (!props.reorderableColumns) return
  if ((event.target as HTMLElement).closest('.vvsk-table__resize-handle')) return
  reorderDragKey.value = col.key
  reorderStartX = event.clientX
  reorderStartY = event.clientY
  reorderThresholdCrossed = false
  window.addEventListener('pointermove', onHeaderPointerMove)
  window.addEventListener('pointerup', onHeaderPointerUp)
  window.addEventListener('pointercancel', onHeaderPointerUp)
}

function onHeaderPointerMove(event: PointerEvent): void {
  if (!reorderDragKey.value) return
  if (!reorderThresholdCrossed) {
    const dx = event.clientX - reorderStartX
    const dy = event.clientY - reorderStartY
    if (Math.abs(dx) < DRAG_REORDER_THRESHOLD_PX && Math.abs(dy) < DRAG_REORDER_THRESHOLD_PX) return
    reorderThresholdCrossed = true
    reorderSuppressClick = true
    reorderOverKey.value = reorderDragKey.value
  }
  for (const el of document.elementsFromPoint(event.clientX, event.clientY)) {
    const key = (el as HTMLElement).dataset?.['colKey']
    if (key) {
      reorderOverKey.value = key
      break
    }
  }
}

function onHeaderPointerUp(): void {
  window.removeEventListener('pointermove', onHeaderPointerMove)
  window.removeEventListener('pointerup', onHeaderPointerUp)
  window.removeEventListener('pointercancel', onHeaderPointerUp)

  const from = reorderDragKey.value
  const to = reorderOverKey.value
  if (reorderThresholdCrossed && from && to && from !== to) {
    const order = [...columnOrder.value]
    const fromIdx = order.indexOf(from)
    const toIdx = order.indexOf(to)
    if (fromIdx !== -1 && toIdx !== -1) {
      order.splice(fromIdx, 1)
      order.splice(toIdx, 0, from)
      columnOrder.value = order
      emit('column-reorder', [...order])
    }
  }

  reorderDragKey.value = null
  reorderOverKey.value = null
  reorderThresholdCrossed = false
}

// ── Horizontal column virtualization ─────────────────────────────────────────

let colManager: PositionManager | null = null

function buildColManager(): void {
  if (!props.virtualizeColumns) return
  const cols = shownColumns.value
  colManager = new PositionManager(cols.length, (i) => getEffectiveWidth(cols[i]))
}

watch(shownColumns, buildColManager, { immediate: true })
watch(colWidths, buildColManager, { deep: true })

const visibleColumns = computed((): ColumnDef[] => {
  const cols = shownColumns.value
  if (!props.virtualizeColumns || !colManager) return cols
  const containerWidth = scrollContainerRef.value?.clientWidth ?? window.innerWidth
  const left = scrollLeft.value
  const right = left + containerWidth

  const fixedKeys = new Set(cols.filter((c) => c.fixed).map((c) => c.key))
  const start = Math.max(0, colManager.findIndex(left) - 1)
  const end = Math.min(cols.length - 1, colManager.findIndex(right) + 1)

  return cols.filter((col, i) => fixedKeys.has(col.key) || (i >= start && i <= end))
})

// ── Fixed columns ─────────────────────────────────────────────────────────────

const leftColumns = computed(() => shownColumns.value.filter((c) => c.fixed === 'left'))
const rightColumns = computed(() => shownColumns.value.filter((c) => c.fixed === 'right'))

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
    style.insetInlineStart = getFixedLeft(col) + 'px'
    style.zIndex = 3
  }
  if (col.fixed === 'right') {
    style.position = 'sticky'
    style.insetInlineEnd = getFixedRight(col) + 'px'
    style.zIndex = 3
  }
  return style
}

function getTdStyle(col: ColumnDef): CSSProperties {
  const style: CSSProperties = {}
  if (col.fixed === 'left') {
    style.position = 'sticky'
    style.insetInlineStart = getFixedLeft(col) + 'px'
    style.zIndex = 2
    style.background = 'var(--vvsk-sticky-bg, #fff)'
  }
  if (col.fixed === 'right') {
    style.position = 'sticky'
    style.insetInlineEnd = getFixedRight(col) + 'px'
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
const estimatedItemSizeRef = computed(() => props.estimatedItemSize)

const { visibleRange, totalHeight, offsetTop, scrollTo, scrollToOffset, measureItem, blurAmount } =
  useVirtualScroll({
    itemCount: itemCountRef,
    estimatedItemSize: estimatedItemSizeRef,
    overscan: props.overscan,
    getScrollElement: () => scrollContainerRef.value,
    motionBlur: computed(() => props.motionBlur),
  })

const scrollContainerStyle = computed(() => ({
  overflow: 'auto' as const,
  position: 'relative' as const,
  filter: blurAmount.value > 0 ? `blur(${blurAmount.value}px)` : undefined,
  transition: props.motionBlur ? 'filter 150ms ease-out' : undefined,
}))

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
  if (typeof ResizeObserver === 'undefined' || props.uniformRowHeight) return
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
  const normalizedLeft = normalizeScrollLeft(el)
  isScrolled.value = normalizedLeft > 0
  scrollLeft.value = normalizedLeft
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
  scrollTo: (
    index: number,
    align?: 'start' | 'center' | 'end' | 'auto',
    options?: ScrollBehaviorOptions,
  ) => scrollTo(index, align, options),
  scrollToOffset: (offset: number, options?: ScrollBehaviorOptions) =>
    scrollToOffset(offset, options),
  measureItem,
  getSortStack: () => [...sortStack.value],
  clearSort: () => {
    sortStack.value = []
  },
  getScrollElement: () => scrollContainerRef.value,
  setColumnVisible,
  toggleColumnVisible,
  getHiddenColumns,
})
</script>

<template>
  <div
    ref="scrollContainerRef"
    class="vvsk-table"
    :class="{ 'vvsk-table--scrolled': isScrolled }"
    :style="scrollContainerStyle"
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
            :class="{
              'vvsk-table__header-cell--sortable': sortable || multiSort,
              'vvsk-table__header-cell--dragging': reorderDragKey === col.key,
              'vvsk-table__header-cell--over':
                reorderOverKey === col.key && reorderDragKey !== col.key,
            }"
            :style="getThStyle(col)"
            :data-col-key="col.key"
            @click="handleSortClick(col, $event)"
            @pointerdown="onHeaderPointerDown(col, $event)"
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
              @pointerdown.stop="startResize(col, $event)"
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
                :index="idx"
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
                <slot
                  name="cell"
                  :row="row"
                  :column="col"
                  :value="getCellValue(row, col)"
                  :index="visibleRange.start + vIdx"
                >
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
                :index="idx"
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

.vvsk-table__header-cell--dragging {
  opacity: 0.5;
}

.vvsk-table__header-cell--over {
  box-shadow: inset 0 0 0 2px var(--vvsk-reorder-indicator, #6366f1);
}

.vvsk-table__sort-icon {
  margin-inline-start: 4px;
  opacity: 0.5;
}

.vvsk-table__sort-order {
  font-size: 0.65em;
  vertical-align: super;
}

.vvsk-table__header-cell {
  position: relative;
  text-align: start;
}

.vvsk-table__resize-handle {
  position: absolute;
  inset-inline-end: 0;
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
