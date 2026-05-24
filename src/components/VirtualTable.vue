<script setup lang="ts" generic="T">
import { computed, onUnmounted, ref, watch } from 'vue'
import VirtualList from './VirtualList.vue'
import { PositionManager } from '../core/PositionManager'
import type { ColumnDef, SortChange, VirtualListExpose } from '../types'

const props = withDefaults(
  defineProps<{
    columns: ColumnDef[]
    rows: T[]
    rowHeight?: number | 'auto'
    stickyHeader?: boolean
    stickyHeaderOffset?: number
    /** Single-column sort */
    sortable?: boolean
    /** Enable Shift+click multi-column sort */
    multiSort?: boolean
    estimatedItemSize?: number
    overscan?: number
    keyField?: string
    /** Rows pinned to the top (rendered outside virtual list) */
    pinnedTopRows?: T[]
    /** Rows pinned to the bottom (rendered outside virtual list) */
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
    rowHeight: 'auto',
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

const scrollContainerRef = ref<HTMLElement | null>(null)
const listRef = ref<VirtualListExpose | null>(null)
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

function getSortIcon(key: string): string {
  const entry = sortStack.value.find((s) => s.key === key)
  if (!entry || entry.direction === null) return '↕'
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
  const newWidth = Math.max(40, resizeStartWidth + delta)
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

  let start = colManager.findIndex(left)
  let end = colManager.findIndex(right)
  // include columns fixed left/right always
  const fixedKeys = new Set(props.columns.filter((c) => c.fixed).map((c) => c.key))
  start = Math.max(0, start - 1)
  end = Math.min(props.columns.length - 1, end + 1)

  return props.columns.filter((col, i) => fixedKeys.has(col.key) || (i >= start && i <= end))
})

const colsContainerStyle = computed((): Record<string, string> => {
  if (!props.virtualizeColumns || !colManager) return {}
  const containerWidth = scrollContainerRef.value?.clientWidth ?? window.innerWidth
  const left = scrollLeft.value

  const start = Math.max(0, colManager.findIndex(left) - 1)
  const paddingLeft = colManager.getOffset(start)
  const totalCols = props.columns.length
  const totalWidth = colManager.totalSize
  const end = Math.min(totalCols - 1, colManager.findIndex(left + containerWidth) + 1)
  const lastOffset = colManager.getOffset(end + 1)
  const paddingRight = totalWidth - lastOffset

  return {
    paddingLeft: `${paddingLeft}px`,
    paddingRight: `${paddingRight}px`,
  }
})

// ── Fixed columns ─────────────────────────────────────────────────────────────

const leftColumns = computed(() => props.columns.filter((c) => c.fixed === 'left'))
const rightColumns = computed(() => props.columns.filter((c) => c.fixed === 'right'))

function getColStyle(col: ColumnDef, isHeader = false): Record<string, string> {
  const w = getEffectiveWidth(col)
  const style: Record<string, string> = {
    width: `${w}px`,
    minWidth: `${col.minWidth ?? w}px`,
    flexShrink: '0',
    overflow: 'hidden',
  }
  if (col.fixed === 'left') {
    style.position = 'sticky'
    style.left = getFixedLeft(col) + 'px'
    style.zIndex = isHeader ? '11' : '2'
    style.background = 'inherit'
  }
  if (col.fixed === 'right') {
    style.position = 'sticky'
    style.right = getFixedRight(col) + 'px'
    style.zIndex = isHeader ? '11' : '2'
    style.background = 'inherit'
  }
  return style
}

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

function getCellValue(row: T, col: ColumnDef): unknown {
  return (row as Record<string, unknown>)[col.key]
}

// ── Sticky header ─────────────────────────────────────────────────────────────

const headerStyle = computed(() => ({
  position: 'sticky' as const,
  top: `${props.stickyHeaderOffset}px`,
  zIndex: 10,
  background: 'inherit',
}))

// ── Scroll ────────────────────────────────────────────────────────────────────

function onScroll(e: Event): void {
  const el = e.target as HTMLElement
  isScrolled.value = el.scrollLeft > 0
  scrollLeft.value = el.scrollLeft
  emit('scroll', e)

  if (props.onLoadMore && props.hasMore && !props.isLoading) {
    const { scrollTop, scrollHeight, clientHeight } = el
    if (scrollHeight - scrollTop - clientHeight < props.loadMoreThreshold!) {
      props.onLoadMore()
    }
  }
}

// ── Pinned rows ───────────────────────────────────────────────────────────────

const pinnedTopStyle: Record<string, string> = {
  position: 'sticky',
  top: '0',
  zIndex: '5',
  background: 'inherit',
}

const pinnedBottomStyle: Record<string, string> = {
  position: 'sticky',
  bottom: '0',
  zIndex: '5',
  background: 'inherit',
}

// ── Expose ────────────────────────────────────────────────────────────────────

defineExpose({
  scrollTo: (index: number, align?: 'start' | 'center' | 'end' | 'auto') =>
    listRef.value?.scrollTo(index, align),
  scrollToOffset: (offset: number) => listRef.value?.scrollToOffset(offset),
  getSortStack: () => [...sortStack.value],
  clearSort: () => {
    sortStack.value = []
  },
})

onUnmounted(() => {
  colManager = null
})
</script>

<template>
  <div
    ref="scrollContainerRef"
    class="vvsk-table"
    style="overflow: auto; position: relative"
    :class="{ 'vvsk-table--scrolled': isScrolled }"
    @scroll="onScroll"
  >
    <!-- Sticky header -->
    <div v-if="stickyHeader" :style="headerStyle" class="vvsk-table__header">
      <div style="display: flex" :style="colsContainerStyle">
        <div
          v-for="col in visibleColumns"
          :key="col.key"
          class="vvsk-table__header-cell"
          :style="getColStyle(col, true)"
          :class="{ 'vvsk-table__header-cell--sortable': sortable || multiSort }"
          @click="handleSortClick(col, $event)"
        >
          <slot name="header-cell" :column="col">
            <span>{{ col.title }}</span>
            <span v-if="sortable || multiSort" class="vvsk-table__sort-icon">
              {{ getSortIcon(col.key) }}
              <sup v-if="getSortOrder(col.key) !== null" class="vvsk-table__sort-order">
                {{ getSortOrder(col.key) }}
              </sup>
            </span>
          </slot>

          <!-- Resize handle -->
          <div
            v-if="resizableColumns"
            class="vvsk-table__resize-handle"
            @pointerdown="startResize(col, $event)"
            @pointermove="onResizeMove($event)"
            @pointerup="stopResize($event)"
          />
        </div>
      </div>
    </div>

    <!-- Pinned top rows -->
    <div
      v-if="pinnedTopRows && pinnedTopRows.length > 0"
      class="vvsk-table__pinned vvsk-table__pinned--top"
      :style="pinnedTopStyle"
    >
      <div
        v-for="(row, idx) in pinnedTopRows"
        :key="idx"
        class="vvsk-table__pinned-row"
        style="display: flex"
        :style="colsContainerStyle"
      >
        <slot name="pinned-row" :row="row" :index="idx" :position="'top'">
          <div
            v-for="col in visibleColumns"
            :key="col.key"
            class="vvsk-table__cell vvsk-table__cell--pinned"
            :style="getColStyle(col)"
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
          </div>
        </slot>
      </div>
    </div>

    <!-- Virtual body -->
    <VirtualList
      ref="listRef"
      :items="rows"
      :key-field="keyField"
      :estimated-item-size="estimatedItemSize"
      :overscan="overscan"
      :scroll-element="scrollContainerRef"
      @visible-range-change="$emit('visible-range-change', $event)"
    >
      <template #default="{ item, index }">
        <slot name="row" :row="item as T" :index="index">
          <div style="display: flex" :style="colsContainerStyle">
            <div
              v-for="col in visibleColumns"
              :key="col.key"
              class="vvsk-table__cell"
              :class="{
                'vvsk-table__cell--fixed-left': col.fixed === 'left',
                'vvsk-table__cell--fixed-right': col.fixed === 'right',
              }"
              :style="getColStyle(col)"
            >
              <slot
                name="cell"
                :row="item as T"
                :column="col"
                :value="getCellValue(item as T, col)"
              >
                {{ getCellValue(item as T, col) }}
              </slot>
            </div>
          </div>
        </slot>
      </template>
    </VirtualList>

    <!-- Load more indicator -->
    <div v-if="isLoading && hasMore" class="vvsk-table__loading">
      <slot name="loading-indicator">
        <div class="vvsk-table__loading-default">Loading…</div>
      </slot>
    </div>

    <!-- Pinned bottom rows -->
    <div
      v-if="pinnedBottomRows && pinnedBottomRows.length > 0"
      class="vvsk-table__pinned vvsk-table__pinned--bottom"
      :style="pinnedBottomStyle"
    >
      <div
        v-for="(row, idx) in pinnedBottomRows"
        :key="idx"
        class="vvsk-table__pinned-row"
        style="display: flex"
        :style="colsContainerStyle"
      >
        <slot name="pinned-row" :row="row" :index="idx" :position="'bottom'">
          <div
            v-for="col in visibleColumns"
            :key="col.key"
            class="vvsk-table__cell vvsk-table__cell--pinned"
            :style="getColStyle(col)"
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
          </div>
        </slot>
      </div>
    </div>
  </div>
</template>

<style scoped>
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

/* Fixed body cells — must be opaque to cover scrolling siblings */
.vvsk-table__cell--fixed-left,
.vvsk-table__cell--fixed-right {
  background-color: var(--vvsk-sticky-bg, #fff);
}

/* Shadow on fixed left columns when scrolled */
.vvsk-table--scrolled .vvsk-table__cell[style*='position: sticky'][style*='left'] {
  box-shadow: 2px 0 4px rgb(0, 0, 0, 0.15);
}

.vvsk-table--scrolled .vvsk-table__header-cell[style*='position: sticky'][style*='left'] {
  box-shadow: 2px 0 4px rgb(0, 0, 0, 0.15);
}
</style>
