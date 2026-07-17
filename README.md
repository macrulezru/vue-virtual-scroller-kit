<div align="center" style="background:#111827;border-radius:20px;padding:28px 20px 20px;margin-bottom:32px">
  <h1 style="color:#f9fafb;margin:0 0 32px;font-size:2.2em;letter-spacing:-0.03em;font-weight:700;font-family:sans-serif">
    vue-virtual-scroller-kit
  </h1>
  <img
    src="https://s3.twcstorage.ru/c9a2cc89-780f97fd-311d-4a1a-b86f-c25665c9dc46/images/npm/vue-virtual-scroller-kit.webp"
    alt="vue-virtual-scroller-kit"
    style="max-width:100%;width:auto;height:300px;border-radius:12px"
  />
</div>

Virtual list, table, grid, tree, and select for Vue 3. Dynamic row heights measured by `ResizeObserver`, grouping with animated expand/collapse, sticky headers, infinite scroll, keyboard navigation, drag-to-reorder, RTL support, and full SSR support — all with a single peer dependency (Vue 3).

[![CI](https://github.com/macrulezru/vue-virtual-scroller-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/macrulezru/vue-virtual-scroller-kit/actions/workflows/ci.yml)

---

## Contents

- [Features](#features)
- [Demo](#demo)
- [Installation](#installation)
- [Quick start](#quick-start)
- [VirtualList](#virtuallist)
- [GroupedVirtualList](#groupedvirtuallist)
- [VirtualTable](#virtualtable)
- [VirtualGrid](#virtualgrid)
- [VirtualTree](#virtualtree)
- [InfiniteLoader](#infiniteloader)
- [VirtualSelect](#virtualselect)
- [VirtualScrollbar](#virtualscrollbar)
- [useVirtualScroll](#usevirtualscroll)
- [useVirtualKeyboardNav](#usevirtualkeyboardnav)
- [useDraggableList](#usedraggablelist)
- [useRowSelection](#userowselection)
- [useVisibilityTracker](#usevisibilitytracker)
- [PositionManager](#positionmanager)
- [autoColWidths](#autocolwidths)
- [TypeScript types](#typescript-types)
- [Accessibility](#accessibility)
- [SSR compatibility](#ssr-compatibility)
- [RTL support](#rtl-support)
- [Architecture](#architecture)
- [Performance](#performance)
- [Bundle size & peer dependencies](#bundle-size--peer-dependencies)
- [Development](#development)

---

## Features

- **Dynamic row heights** — `ResizeObserver` measures each row after render; position manager updates in O(log n)
- **VirtualList** — flat list, external scroll container, page-mode (window scroll), DOM recycling pool, scroll restoration, opt-in `horizontal` layout
- **GroupedVirtualList** — collapsible sections with smooth expand/collapse CSS animation, opt-in sticky group-header overlay
- **VirtualTable** — native `<table>` with spacer-row virtual scroll, sticky header, fixed left/right columns, single and multi-column sort, drag-to-resize *and* drag-to-reorder columns, column show/hide, column virtualization, pinned top/bottom rows (`<thead>`/`<tfoot>`), built-in lazy loading (`onLoadMore` / `hasMore` / `isLoading`)
- **VirtualGrid** — fixed-height cells in a responsive auto-column or fixed-column grid, or opt-in per-row dynamic height
- **VirtualTree** — hierarchical expand/collapse with lazy child loading, configurable indent
- **InfiniteLoader** — trigger `onLoadMore` near the bottom, top, or both ends; scroll-position preservation when prepending
- **VirtualSelect** — virtualized dropdown with client-side or async/remote search (debounced, with a loading slot) and keyboard navigation
- **VirtualScrollbar** — themable custom scrollbar overlay that syncs with any of the components above (or any scrollable element)
- **Smooth programmatic scrolling** — `scrollTo`/`scrollToOffset` accept `{ behavior: 'smooth' }`, using the browser's native smooth-scroll
- **Motion blur** — opt-in `motionBlur` prop applies a velocity-scaled CSS blur while scrolling fast, clearing once scrolling settles
- **Anchor-compensated reflow** — when a row above the viewport is measured to a different height, scroll position is adjusted by the same delta so visible content never jumps
- **RTL support** — CSS logical properties throughout, plus `scrollLeft` normalization for column virtualization, horizontal `VirtualList`, and the scrollbar; wrap your app in `dir="rtl"`, nothing else required
- **useVirtualScroll** — raw composable for custom containers; returns `visibleRange`, `totalHeight`, `scrollTo`; supports a `horizontal` axis
- **useVirtualKeyboardNav** — arrow keys, Home/End, PageUp/PageDown, Enter/Space; plugs into any virtual list
- **useDraggableList** — pointer-event drag-to-reorder with animated gap, ghost element, auto-scroll, disabled-item support
- **useRowSelection** — dataset-agnostic click/Shift-click row selection (single or multi), pairs with `VirtualList` or `VirtualTable`
- **useVisibilityTracker** — per-key enter/leave-viewport events backed by a real `IntersectionObserver`, for highlighting a nav/minimap item while its row is on screen
- **PositionManager** — segment tree (O(log n) updates and prefix-sum queries) exposed for advanced use
- **autoColWidths** — estimates column widths from a data sample via Canvas `measureText`; SSR-safe fallback
- **SSR-safe** — first N rows rendered on the server, hydration without layout shift
- **Zero external dependencies** — only Vue 3 as peer dep
- **Tree-shakeable ESM + CJS** dual build

---

## Demo

```bash
npm install
npm run demo
```

Opens at **http://localhost:5174**:

| Page | What it shows |
|---|---|
| **VirtualList** | Flat list, 10 000 items, mixed row heights, vertical/horizontal layout toggle, "Watchlist" (`useVisibilityTracker`) |
| **GroupedVirtualList** | Collapsible groups, expand/collapse all |
| **VirtualTable** | Sortable, resizable, fixed columns, pinned rows, column show/hide, checkbox row selection |
| **VirtualGrid** | Auto-column responsive grid |
| **VirtualTree** | Nested hierarchy, lazy child loading |
| **InfiniteLoader** | Bidirectional infinite scroll |
| **VirtualSelect** | Virtualized searchable dropdown, simulated async/remote search |
| **Composables** | Keyboard navigation + drag-to-reorder |

---

## Installation

```bash
npm install vue-virtual-scroller-kit
```

Peer dependency:

```bash
npm install vue@>=3.3
```

---

## Quick start

```vue
<script setup lang="ts">
import { VirtualList } from 'vue-virtual-scroller-kit'

interface Row { id: number; text: string }

const items: Row[] = Array.from({ length: 100_000 }, (_, i) => ({
  id: i,
  text: `Row ${i + 1}`,
}))
</script>

<template>
  <VirtualList :items="items" :estimated-item-size="48" style="height: 600px">
    <template #default="{ item, index }">
      <div style="padding: 12px 16px; border-bottom: 1px solid #eee">
        {{ index + 1 }}. {{ item.text }}
      </div>
    </template>
  </VirtualList>
</template>
```

---

## VirtualList

The core component. Renders only the rows visible in the viewport plus an overscan buffer. `ResizeObserver` measures each row after mount so variable-height rows are handled automatically.

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `items` | `T[]` | — | Data array |
| `keyField` | `string` | `'id'` | Field used as the `:key` for each row |
| `estimatedItemSize` | `number \| (item, index) => number` | `50` | Initial size estimate per row — height, or width when `horizontal` is set |
| `overscan` | `number` | `3` | Extra rows rendered above/below viewport |
| `minHeight` | `number` | `0` | Minimum total list height in px (vertical mode) |
| `minWidth` | `number` | `0` | Minimum total list width in px (`horizontal` mode) |
| `scrollElement` | `HTMLElement \| null` | `null` | External scroll container (mutually exclusive with `pageMode`) |
| `pageMode` | `boolean` | `false` | Use `window` as the scroll container. Fixed at mount — see note below |
| `horizontal` | `boolean` | `false` | Virtualize along `scrollLeft`/`clientWidth` instead of `scrollTop`/`clientHeight`. RTL-safe. Fixed at mount — see note below |
| `isLoading` | `boolean` | `false` | Shows the `#skeleton` slot when `items` is empty |
| `restoreKey` | `string` | — | Key used to save/restore scroll position in `sessionStorage` |
| `ssrPreloadCount` | `number` | `20` | Number of rows rendered on the server |
| `recyclePool` | `boolean` | `false` | Reuse DOM nodes instead of unmounting them (better scroll FPS, disables key-based transitions) |
| `motionBlur` | `boolean` | `false` | Apply a CSS blur that scales with scroll velocity, clearing ~150ms after scrolling settles |

> `pageMode` and `horizontal` are read once at mount, like an axis/mode choice rather than a
> live-reactive prop. If your UI lets users toggle `horizontal` at runtime, bind `:key` to the
> value driving it (e.g. `:key="layout"`) so Vue remounts the component instead of leaving the
> previous axis wired up — see the VirtualList demo tab's Layout toggle for a working example.

### Slots

| Slot | Scope | Description |
|---|---|---|
| `#default` | `{ item: T, index: number, style }` | Row content |
| `#empty` | — | Rendered when `items` is empty and not loading |
| `#skeleton` | — | Rendered when `items` is empty and `isLoading` is true |
| `#loading` | — | Rendered at the bottom while `isLoading` is true |

### Emits

| Event | Payload | Description |
|---|---|---|
| `scroll` | `Event` | Native scroll event |
| `visible-range-change` | `{ start: number; end: number }` | Fires when the visible slice changes |

### Exposed API (`VirtualListExpose`)

```ts
import type { VirtualListExpose } from 'vue-virtual-scroller-kit'

const listRef = ref<VirtualListExpose | null>(null)

listRef.value?.scrollTo(index, align)     // 'start' | 'center' | 'end' | 'auto'
listRef.value?.scrollTo(index, 'start', { behavior: 'smooth' }) // native smooth-scroll animation
listRef.value?.scrollToOffset(px)         // scroll to a pixel offset
listRef.value?.scrollToOffset(px, { behavior: 'smooth' })
listRef.value?.measureItem(index, height) // manually set a row height
listRef.value?.getScrollElement()         // the element that actually scrolls — pair with VirtualScrollbar
```

> `behavior: 'smooth'` defaults to `'auto'` (instant jump, unchanged from before). Smooth-scrolling to a
> far-off virtualized index targets the current *estimated* offset. A direct `scrollTop` write (e.g. from
> the anchor-compensation described below) would otherwise cancel an in-progress native smooth-scroll, so
> that compensation is suppressed for ~1s after any `behavior: 'smooth'` call.

### Examples

**Fixed-height rows:**

```vue
<VirtualList :items="rows" :estimated-item-size="48" style="height: 500px">
  <template #default="{ item }">
    <div class="row">{{ item.name }}</div>
  </template>
</VirtualList>
```

**Variable-height rows (per-item estimate):**

```vue
<VirtualList
  :items="posts"
  :estimated-item-size="(item) => item.isExpanded ? 200 : 60"
  style="height: 600px"
>
  <template #default="{ item }">
    <PostCard :post="item" />
  </template>
</VirtualList>
```

**External scroll container:**

```vue
<div ref="scrollEl" style="overflow-y: auto; height: 400px">
  <VirtualList :items="rows" :scroll-element="scrollEl" :estimated-item-size="48">
    <template #default="{ item }"><Row :data="item" /></template>
  </VirtualList>
</div>
```

**Page-mode (whole page scrolls):**

```vue
<VirtualList :items="rows" page-mode :estimated-item-size="80">
  <template #default="{ item }"><Article :post="item" /></template>
</VirtualList>
```

**Skeleton loading state:**

```vue
<VirtualList :items="items" :is-loading="isLoading" :estimated-item-size="56" style="height: 500px">
  <template #default="{ item }"><Item :data="item" /></template>
  <template #skeleton>
    <SkeletonRow v-for="i in 10" :key="i" />
  </template>
  <template #empty>
    <div>No items found.</div>
  </template>
</VirtualList>
```

**Scroll restoration:**

```vue
<VirtualList :items="rows" restore-key="my-list" :estimated-item-size="48" style="height: 500px">
  <template #default="{ item }"><Row :data="item" /></template>
</VirtualList>
```

**DOM recycling pool (high-FPS heavy rows):**

```vue
<VirtualList :items="rows" recycle-pool :estimated-item-size="80" style="height: 500px">
  <template #default="{ item }"><HeavyRow :data="item" /></template>
</VirtualList>
```

> Note: `recyclePool` reuses DOM nodes so keyed Vue transitions on individual items won't work. Use it when render performance matters more than per-item animations.

**Motion blur while scrolling fast:**

```vue
<VirtualList :items="rows" motion-blur :estimated-item-size="48" style="height: 500px">
  <template #default="{ item }">
    <div class="row">{{ item.name }}</div>
  </template>
</VirtualList>
```

**Horizontal layout (card strip):**

```vue
<VirtualList
  horizontal
  :items="cards"
  :estimated-item-size="220"
  style="height: 240px"
>
  <template #default="{ item }">
    <div class="card" style="width: 220px; height: 100%">{{ item.title }}</div>
  </template>
</VirtualList>
```

> In horizontal mode, `estimatedItemSize` is a width estimate and each row is positioned via
> `inset-inline-start` (RTL-safe) with `height: 100%` — the slot content is responsible for its
> own `width` (fixed, or measured dynamically via `ResizeObserver`, same as row heights in
> vertical mode). Pair with `<VirtualScrollbar orientation="horizontal">` for a themable scrollbar.

---

## GroupedVirtualList

Renders items grouped under collapsible section headers. Each group can be expanded or collapsed with a smooth CSS animation.

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `groups` | `GroupDef<T>[]` | — | Array of group definitions |
| `estimatedItemSize` | `number` | `50` | Estimated height of item rows |
| `estimatedGroupHeaderSize` | `number` | `40` | Estimated height of group header rows |
| `overscan` | `number` | `3` | Extra rows rendered outside viewport |
| `keyField` | `string` | `'id'` | Field used as the item key |
| `motionBlur` | `boolean` | `false` | Apply a CSS blur that scales with scroll velocity while scrolling fast |
| `stickyGroupHeaders` | `boolean` | `false` | Keep the current group's header pinned to the top as its items scroll underneath (overlay, see below) |

> `stickyGroupHeaders` renders as a persistent overlay above the list, reusing the `#group-header`
> slot for whichever group is currently at the top of the viewport — not a real CSS `position: sticky`
> row, which can't work here because virtualized rows are `position: absolute`. It snaps instantly to
> the next group (no "push" animation).

### `GroupDef<T>`

```ts
interface GroupDef<T> {
  key: string      // unique identifier for the group
  label: string    // display label
  items: T[]       // items in this group
  collapsed?: boolean // initial collapsed state
}
```

### Slots

| Slot | Scope | Description |
|---|---|---|
| `#group-header` | `{ group: GroupDef<T>, toggle: () => void, isCollapsed: boolean }` | Custom group header |
| `#default` | `{ item: T, index: number, groupKey: string }` | Item row content |
| `#empty` | — | Shown when all groups are empty |

### Emits

Same as `VirtualList`: `scroll`, `visible-range-change`.

### Exposed API (`GroupedVirtualListExpose`)

```ts
import type { GroupedVirtualListExpose } from 'vue-virtual-scroller-kit'

const listRef = ref<GroupedVirtualListExpose | null>(null)

listRef.value?.toggle('group-key')  // toggle a group open/closed
listRef.value?.scrollTo(index)      // scroll to a flat row index
listRef.value?.scrollTo(index, 'start', { behavior: 'smooth' })
listRef.value?.getScrollElement()   // pair with VirtualScrollbar
```

### Example

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { GroupedVirtualList } from 'vue-virtual-scroller-kit'
import type { GroupDef, GroupedVirtualListExpose } from 'vue-virtual-scroller-kit'

interface Contact { id: number; name: string; email: string }

const groups = ref<GroupDef<Contact>[]>([
  {
    key: 'a',
    label: 'A',
    items: [
      { id: 1, name: 'Alice', email: 'alice@example.com' },
      { id: 2, name: 'Aaron', email: 'aaron@example.com' },
    ],
  },
  {
    key: 'b',
    label: 'B',
    items: [{ id: 3, name: 'Bob', email: 'bob@example.com' }],
    collapsed: true,
  },
])

const listRef = ref<GroupedVirtualListExpose | null>(null)

function expandAll() {
  groups.value = groups.value.map((g) => ({ ...g, collapsed: false }))
}
function collapseAll() {
  groups.value = groups.value.map((g) => ({ ...g, collapsed: true }))
}
</script>

<template>
  <button @click="expandAll">Expand all</button>
  <button @click="collapseAll">Collapse all</button>

  <GroupedVirtualList
    ref="listRef"
    :groups="groups"
    :estimated-item-size="56"
    style="height: 500px"
  >
    <template #group-header="{ group, toggle, isCollapsed }">
      <div class="group-header" @click="toggle">
        {{ isCollapsed ? '▶' : '▼' }} {{ group.label }}
        <span>({{ group.items.length }})</span>
      </div>
    </template>

    <template #default="{ item }">
      <div class="contact-row">
        <strong>{{ item.name }}</strong>
        <span>{{ item.email }}</span>
      </div>
    </template>
  </GroupedVirtualList>
</template>
```

---

## VirtualTable

A virtual table rendered as a native `<table>` element. The component uses `<thead>` / `<tbody>` / `<tfoot>` with two spacer rows (top and bottom) to create the virtual scroll effect while keeping the browser's built-in column width synchronisation between header and body. Row heights are measured by `ResizeObserver` after each render, so rows can have arbitrary content.

Features: sticky header, fixed left/right columns, single/multi-column sort with sort-stack indicator, optional drag-to-resize columns, horizontal column virtualization, pinned top/bottom rows, and built-in infinite scroll (`onLoadMore`).

### Architecture

```
<div class="vvsk-table">          ← scroll container (overflow: auto)
  <table>
    <colgroup>                    ← column widths, auto-syncs header ↔ body
    <thead>                       ← position: sticky top; contains header row
      <tr> … <th> …               ← column headers (sort on click)
      <tr> … <td> …               ← pinnedTopRows (always visible, sticky)
    <tbody>
      <tr class="spacer">         ← top virtual space (height = offsetTop)
      <tr v-for visibleRows>      ← only rendered rows
      <tr class="spacer">         ← bottom virtual space
    <tfoot>                       ← position: sticky bottom; pinnedBottomRows
```

> The browser's native scroll anchoring (`overflow-anchor`) is disabled on `.vvsk-table` because it
> conflicts with the spacer-row virtual-scroll technique. Instead, `useVirtualScroll` performs its own
> anchor compensation: when a row above the viewport is measured to a different height, the scroll
> position is nudged by the same delta so visible rows never jump.

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `columns` | `ColumnDef[]` | — | Column definitions |
| `rows` | `T[]` | — | Data rows |
| `estimatedItemSize` | `number` | `40` | Estimated row height used before measurement |
| `stickyHeader` | `boolean` | `true` | Pin the header row to the top |
| `stickyHeaderOffset` | `number` | `0` | Top offset for the sticky header (e.g. navbar height) |
| `sortable` | `boolean` | `false` | Enable single-column sort on header click |
| `multiSort` | `boolean` | `false` | Enable Shift+click multi-column sort |
| `virtualizeColumns` | `boolean` | `false` | Render only horizontally visible columns (for 50+ columns) |
| `resizableColumns` | `boolean` | `false` | Allow drag-to-resize column borders |
| `reorderableColumns` | `boolean` | `false` | Allow dragging a whole header to reorder columns (independent of `resizableColumns`) |
| `pinnedTopRows` | `T[]` | `[]` | Rows pinned inside `<thead>`, always visible at the top |
| `pinnedBottomRows` | `T[]` | `[]` | Rows pinned inside `<tfoot>`, always visible at the bottom |
| `overscan` | `number` | `3` | Extra rows rendered outside the viewport |
| `keyField` | `string` | `'id'` | Row key field (must be unique per row) |
| `onLoadMore` | `() => void` | — | Called when user scrolls near the bottom and `hasMore` is `true` |
| `hasMore` | `boolean` | `false` | Whether more rows are available to load |
| `isLoading` | `boolean` | `false` | Whether a load is in progress (prevents duplicate calls) |
| `loadMoreThreshold` | `number` | `150` | Distance from the bottom edge in px that triggers `onLoadMore` |
| `uniformRowHeight` | `boolean` | `false` | All rows have identical height — disables `ResizeObserver` to prevent scroll drift. Set `estimatedItemSize` to the exact row height |
| `motionBlur` | `boolean` | `false` | Apply a CSS blur that scales with scroll velocity while scrolling fast |

### `ColumnDef`

```ts
interface ColumnDef {
  key: string                    // matches the row object property
  title: string                  // header label
  width?: number                 // column width in px (fallback: minWidth ?? 100)
  minWidth?: number              // minimum width after drag-resize
  maxWidth?: number              // maximum width after drag-resize
  fixed?: 'left' | 'right'      // sticky fixed column
}
```

### Slots

| Slot | Scope | Description |
|---|---|---|
| `#header-cell` | `{ column: ColumnDef }` | Custom header cell content. Default renders title + sort arrow (↑/↓) for the active sort column only |
| `#row` | `{ row: T, index: number }` | Replace entire `<tr>` rendering |
| `#cell` | `{ row: T, column: ColumnDef, value: unknown, index: number }` | Custom cell content |
| `#pinned-row` | `{ row: T, index: number, position: 'top' \| 'bottom' }` | Replace entire pinned `<tr>` |
| `#pinned-cell` | `{ row: T, column: ColumnDef, value: unknown, position: 'top' \| 'bottom', index: number }` | Custom pinned cell content |
| `#loading-indicator` | — | Shown below the table when `isLoading && hasMore` |

### Emits

| Event | Payload | Description |
|---|---|---|
| `sort-change` | `SortChange \| SortChange[]` | Single sort object (sortable), or array (multiSort) |
| `column-resize` | `[key: string, width: number]` | Fires after a column drag-resize ends |
| `column-reorder` | `[order: string[]]` | Fires after a column drag-reorder ends, with the new column key order |
| `column-visibility-change` | `{ key: string; visible: boolean }` | Fires after `setColumnVisible`/`toggleColumnVisible` changes a column's visibility |
| `scroll` | `Event` | Native scroll event from the container |
| `visible-range-change` | `{ start: number; end: number }` | Fires on scroll with the current visible row indices |

### `SortChange`

```ts
interface SortChange {
  key: string
  direction: 'asc' | 'desc' | null
}
```

### Exposed API

```ts
import type { VirtualListExpose } from 'vue-virtual-scroller-kit'

const tableRef = ref<VirtualListExpose & {
  getSortStack: () => SortChange[]
  clearSort: () => void
  setColumnVisible: (key: string, visible: boolean) => void
  toggleColumnVisible: (key: string) => void
  getHiddenColumns: () => string[]
} | null>(null)

tableRef.value?.scrollTo(rowIndex, 'start')   // 'start' | 'center' | 'end' | 'auto'
tableRef.value?.scrollTo(rowIndex, 'start', { behavior: 'smooth' })
tableRef.value?.scrollToOffset(px)
tableRef.value?.clearSort()
tableRef.value?.getSortStack()                 // current sort state
tableRef.value?.getScrollElement()             // pair with VirtualScrollbar
tableRef.value?.toggleColumnVisible('email')   // hide/show a column at runtime
tableRef.value?.setColumnVisible('email', false)
tableRef.value?.getHiddenColumns()             // current hidden column keys
```

> Hiding a column is runtime/interactive state — like sort or column order — so it's exposed via
> the template ref rather than a prop. Hidden columns are dropped from rendering, column
> virtualization, and fixed-column offset math uniformly.

### CSS custom property

Fixed columns and pinned rows use `--vvsk-sticky-bg` for their cell background to cover scrolling content behind them. Set it on the table element to match your theme:

```css
.my-table { --vvsk-sticky-bg: var(--surface-color); }
```

Default fallback is `#fff`.

### Examples

**Basic — sort, fixed columns, custom cells, resizable columns:**

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { VirtualTable } from 'vue-virtual-scroller-kit'
import type { ColumnDef, SortChange } from 'vue-virtual-scroller-kit'

interface User { id: number; name: string; email: string; age: number }

const originalRows: User[] = [
  { id: 1, name: 'Alice', email: 'alice@example.com', age: 28 },
  { id: 2, name: 'Bob',   email: 'bob@example.com',   age: 35 },
  // …
]

const columns: ColumnDef[] = [
  { key: 'id',    title: '#',     width: 60,  fixed: 'left' },
  { key: 'name',  title: 'Name',  width: 180 },
  { key: 'email', title: 'Email', minWidth: 200 },
  { key: 'age',   title: 'Age',   width: 80 },
]

const rows = ref<User[]>([...originalRows])

function onSort(sort: SortChange | SortChange[]) {
  const s = Array.isArray(sort) ? sort[0] : sort
  if (!s || !s.direction) { rows.value = [...originalRows]; return }
  rows.value = [...rows.value].sort((a, b) =>
    s.direction === 'asc'
      ? String(a[s.key as keyof User]).localeCompare(String(b[s.key as keyof User]))
      : String(b[s.key as keyof User]).localeCompare(String(a[s.key as keyof User])),
  )
}
</script>

<template>
  <VirtualTable
    :columns="columns"
    :rows="rows"
    key-field="id"
    sortable
    resizable-columns
    style="height: 500px"
    @sort-change="onSort"
  >
    <template #cell="{ column, value }">
      <span v-if="column.key === 'age'" :style="{ color: (value as number) < 30 ? 'green' : 'inherit' }">
        {{ value }}
      </span>
      <span v-else>{{ value }}</span>
    </template>
  </VirtualTable>
</template>
```

---

**Multi-column sort** (Shift+click to add columns to sort stack):

```vue
<VirtualTable
  :columns="columns"
  :rows="rows"
  multi-sort
  style="height: 500px"
  @sort-change="onMultiSort"
/>
```

```ts
function onMultiSort(sort: SortChange | SortChange[]) {
  const stack = Array.isArray(sort) ? sort : [sort]
  rows.value = [...rows.value].sort((a, b) => {
    for (const { key, direction } of stack) {
      if (!direction) continue
      const cmp = String(a[key as keyof Row]).localeCompare(String(b[key as keyof Row]))
      if (cmp !== 0) return direction === 'asc' ? cmp : -cmp
    }
    return 0
  })
}
```

---

**Auto column widths** — measure content with Canvas before rendering:

```ts
import { autoColWidths } from 'vue-virtual-scroller-kit'
import type { ColumnDef } from 'vue-virtual-scroller-kit'

const rawCols = [
  { key: 'id',    title: 'ID' },
  { key: 'name',  title: 'Name' },
  { key: 'email', title: 'Email' },
]

// Call after rows are loaded
const widths = autoColWidths(rawCols, rows, {
  font: '12px Inter, sans-serif',
  padding: 24,
  maxWidth: 400,
})

const columns: ColumnDef[] = rawCols.map(c => ({
  key: c.key,
  title: c.title,
  width: widths.get(c.key) ?? 120,
  minWidth: 60,
}))
```

---

**Pinned rows** — rows that stay visible while the body scrolls. Top rows live in `<thead>` (sticky to top), bottom rows live in `<tfoot>` (sticky to bottom):

```vue
<script setup lang="ts">
const pinnedTop    = [{ id: -1, name: '📌 Pinned', score: 0 }]
const pinnedBottom = [{ id: -2, name: '∑ Total',  score: totalScore }]
</script>

<template>
  <VirtualTable
    :columns="columns"
    :rows="rows"
    :pinned-top-rows="pinnedTop"
    :pinned-bottom-rows="pinnedBottom"
    style="height: 500px; --vvsk-sticky-bg: #fff"
  >
    <template #pinned-cell="{ row, column, position }">
      <strong v-if="position === 'bottom'">{{ row[column.key] }}</strong>
      <span v-else>{{ row[column.key] }}</span>
    </template>
  </VirtualTable>
</template>
```

> Pinned cells automatically receive `background-color: var(--vvsk-sticky-bg, #fff)` so they always cover the scrolling rows behind them.

---

**Lazy loading** — infinite scroll triggered when near the bottom:

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import { VirtualTable, autoColWidths } from 'vue-virtual-scroller-kit'
import type { ColumnDef, SortChange } from 'vue-virtual-scroller-kit'

interface Row { id: number; name: string; email: string }

const PAGE = 100
const rows      = ref<Row[]>([])
const total     = ref(0)
const loading   = ref(false)
const hasMore   = computed(() => rows.value.length < total.value)

// Columns sized from data after first load
const colWidths = ref<Map<string, number>>(new Map())
const rawCols   = [{ key: 'id', title: '#' }, { key: 'name', title: 'Name' }, { key: 'email', title: 'Email' }]
const columns   = computed((): ColumnDef[] => [
  ...rawCols.map(c => ({ key: c.key, title: c.title, width: colWidths.value.get(c.key) ?? 120, minWidth: 60 })),
  { key: '__actions', title: '', width: 80, fixed: 'right' as const },
])

async function fetchRows(page: number, replace: boolean) {
  if (loading.value) return
  loading.value = true
  try {
    const res  = await fetch(`/api/rows?page=${page}&limit=${PAGE}`)
    const data = await res.json()
    rows.value  = replace ? data.rows : [...rows.value, ...data.rows]
    total.value = data.total
    if (replace) colWidths.value = autoColWidths(rawCols, rows.value, { font: '12px Inter, sans-serif' })
  } finally {
    loading.value = false
  }
}

function loadMore() { fetchRows(Math.floor(rows.value.length / PAGE) + 1, false) }

function onSort(sort: SortChange | SortChange[]) {
  rows.value = []
  fetchRows(1, true)
}

fetchRows(1, true)
</script>

<template>
  <VirtualTable
    :columns="columns"
    :rows="rows"
    key-field="id"
    sortable
    resizable-columns
    :on-load-more="loadMore"
    :has-more="hasMore"
    :is-loading="loading"
    :load-more-threshold="200"
    style="height: 600px; --vvsk-sticky-bg: #fff"
    @sort-change="onSort"
  >
    <template #cell="{ row, column }">
      <template v-if="column.key === '__actions'">
        <button @click="edit(row)">✏</button>
        <button @click="remove(row)">✕</button>
      </template>
      <span v-else>{{ row[column.key as keyof Row] }}</span>
    </template>
    <template #loading-indicator>
      <div style="padding: 12px; text-align: center; opacity: 0.5">Loading…</div>
    </template>
  </VirtualTable>
</template>
```

---

**Column virtualization** — for very wide tables (100+ columns), render only visible columns:

```vue
<VirtualTable
  :columns="columns"
  :rows="rows"
  :virtualize-columns="true"
  style="height: 500px"
/>
```

---

**Drag-to-reorder columns** — drag a whole header to move it; independent of `resizableColumns`
(dragging the resize handle at the column edge never triggers a reorder):

```vue
<script setup lang="ts">
function onColumnReorder(order: string[]) {
  // Persist the new column order, e.g. to localStorage.
  localStorage.setItem('table-column-order', JSON.stringify(order))
}
</script>

<template>
  <VirtualTable
    :columns="columns"
    :rows="rows"
    reorderable-columns
    style="height: 500px"
    @column-reorder="onColumnReorder"
  />
</template>
```

> Column order is tracked internally (like `resizableColumns` widths) and not written back to your
> `columns` prop — listen for `column-reorder` if you want to persist it.

---

**Column show/hide** — a checklist toggling columns at runtime:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { VirtualTable } from 'vue-virtual-scroller-kit'

const tableRef = ref<InstanceType<typeof VirtualTable> | null>(null)
</script>

<template>
  <label v-for="col in columns" :key="col.key">
    <input
      type="checkbox"
      checked
      @change="tableRef?.toggleColumnVisible(col.key)"
    />
    {{ col.title }}
  </label>

  <VirtualTable ref="tableRef" :columns="columns" :rows="rows" style="height: 500px" />
</template>
```

> Like `columnOrder`, hidden state lives in the component (not written back to `columns`) — listen
> for `column-visibility-change` to persist it.

---

**Row selection with checkboxes** — pairs `useRowSelection` with the `index` now exposed on
`#cell`/`#pinned-cell`. Click to toggle, Shift+click to select a range:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { VirtualTable, useRowSelection } from 'vue-virtual-scroller-kit'
import type { ColumnDef } from 'vue-virtual-scroller-kit'

interface User { id: number; name: string; email: string }
const rows = ref<User[]>([/* … */])

const selection = useRowSelection<User>({ items: rows })

const columns: ColumnDef[] = [
  { key: '__select', title: '', width: 36, fixed: 'left' },
  { key: 'name', title: 'Name' },
  { key: 'email', title: 'Email' },
]
</script>

<template>
  <VirtualTable :columns="columns" :rows="rows" key-field="id" style="height: 500px">
    <template #cell="{ column, row, index }">
      <input
        v-if="column.key === '__select'"
        type="checkbox"
        :checked="selection.isSelected(row, index)"
        @click="selection.toggle(row, index, $event)"
      />
      <span v-else>{{ row[column.key as keyof User] }}</span>
    </template>
  </VirtualTable>
  <p>{{ selection.selectedItems.value.length }} selected</p>
</template>
```

---

## VirtualGrid

A virtual grid that arranges items in rows and columns. Column count can be fixed or auto-calculated from `columnWidth` and the container width.

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `items` | `T[]` | — | Data array |
| `columns` | `number` | `0` | Fixed column count. Pass `0` to auto-compute from `columnWidth` |
| `columnWidth` | `number` | `200` | Cell width for auto-column calculation |
| `rowHeight` | `number` | `200` | Cell height in px — the initial estimate when `dynamicRowHeight` is on |
| `gap` | `number` | `8` | Gap between cells in px |
| `keyField` | `string` | `'id'` | Key field |
| `overscan` | `number` | `2` | Extra rows outside the viewport |
| `isLoading` | `boolean` | `false` | Shows skeleton when `items` is empty |
| `motionBlur` | `boolean` | `false` | Apply a CSS blur that scales with scroll velocity while scrolling fast |
| `dynamicRowHeight` | `boolean` | `false` | Measure each row's actual height via `ResizeObserver` instead of a fixed `rowHeight` (row height = max of that row's cells) |

### Slots

| Slot | Scope | Description |
|---|---|---|
| `#default` | `{ item: T, index: number, row: number, col: number }` | Cell content |
| `#empty` | — | Shown when `items` is empty |
| `#skeleton` | — | Shown when empty and `isLoading` |

### Emits

`scroll`, `visible-range-change`.

### Example

```vue
<script setup lang="ts">
import { VirtualGrid } from 'vue-virtual-scroller-kit'

interface Photo { id: number; url: string; title: string }

const photos: Photo[] = Array.from({ length: 10_000 }, (_, i) => ({
  id: i,
  url: `https://picsum.photos/seed/${i}/200/200`,
  title: `Photo ${i + 1}`,
}))
</script>

<template>
  <VirtualGrid
    :items="photos"
    :column-width="220"
    :row-height="220"
    :gap="12"
    style="height: 600px"
  >
    <template #default="{ item }">
      <div class="photo-card">
        <img :src="item.url" :alt="item.title" />
        <p>{{ item.title }}</p>
      </div>
    </template>
  </VirtualGrid>
</template>
```

---

**Dynamic row height** — when cell content height varies (e.g. captions of different lengths),
row height is measured per row instead of fixed:

```vue
<VirtualGrid
  :items="photos"
  :column-width="220"
  :row-height="220"
  dynamic-row-height
  :gap="12"
  style="height: 600px"
>
  <template #default="{ item }">
    <div class="photo-card" style="height: auto">
      <img :src="item.url" :alt="item.title" />
      <p>{{ item.title }}</p>
      <p v-if="item.caption" class="photo-card__caption">{{ item.caption }}</p>
    </div>
  </template>
</VirtualGrid>
```

> With `dynamicRowHeight`, cells no longer get a fixed `height` from the grid — give them
> `height: auto` (or leave `height` unset) so their content determines the row's real height.

---

## VirtualTree

A tree view with expand/collapse, configurable indent per depth level, and optional lazy (async) child loading.

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `nodes` | `TreeNode<T>[]` | — | Root nodes |
| `indent` | `number` | `20` | Pixel indent per depth level |
| `estimatedItemSize` | `number` | `36` | Estimated row height |
| `overscan` | `number` | `5` | Extra rows outside the viewport |
| `onLoadChildren` | `(node) => Promise<TreeNode<T>[]>` | — | Called when a node with `hasChildren: true` is first expanded |
| `motionBlur` | `boolean` | `false` | Apply a CSS blur that scales with scroll velocity while scrolling fast |

### `TreeNode<T>`

```ts
interface TreeNode<T extends Record<string, unknown> = Record<string, unknown>> {
  id: string | number
  data: T
  children?: TreeNode<T>[]
  hasChildren?: boolean   // true = has children that haven't been loaded yet
}
```

### `FlatTreeRow<T>`

The slot scope exposes:

```ts
interface FlatTreeRow<T> {
  node: TreeNode<T>
  depth: number
  isExpanded: boolean
  hasChildren: boolean
  isLoading: boolean      // true while onLoadChildren is running
}
```

### Slots

| Slot | Scope | Description |
|---|---|---|
| `#default` | `{ row: FlatTreeRow<T>, index: number }` | Custom row content. The toggle button is rendered by the component. |
| `#empty` | — | Empty state |

### Emits

| Event | Payload |
|---|---|
| `node-expand` | `TreeNode<T>` |
| `node-collapse` | `TreeNode<T>` |
| `node-click` | `[TreeNode<T>, depth: number]` |

### Exposed API

```ts
treeRef.value?.expandAll()
treeRef.value?.collapseAll()
treeRef.value?.scrollTo(index)
treeRef.value?.expandedIds  // Readonly<Ref<Set<string | number>>>
```

### Example

```vue
<script setup lang="ts">
import { VirtualTree } from 'vue-virtual-scroller-kit'
import type { TreeNode, FlatTreeRow } from 'vue-virtual-scroller-kit'

interface FileNode { name: string; type: 'file' | 'folder' }

const nodes: TreeNode<FileNode>[] = [
  {
    id: 1,
    data: { name: 'src', type: 'folder' },
    children: [
      { id: 2, data: { name: 'main.ts', type: 'file' } },
      { id: 3, data: { name: 'App.vue', type: 'file' } },
    ],
  },
  {
    id: 4,
    data: { name: 'node_modules', type: 'folder' },
    hasChildren: true,   // lazy-loaded
  },
]

async function loadChildren(node: TreeNode<FileNode>): Promise<TreeNode<FileNode>[]> {
  const res = await fetch(`/api/children/${node.id}`)
  return res.json()
}
</script>

<template>
  <VirtualTree
    :nodes="nodes"
    :indent="20"
    :on-load-children="loadChildren"
    style="height: 400px"
    @node-click="(node, depth) => console.log(node.data.name, depth)"
  >
    <template #default="{ row }">
      <span>{{ row.node.data.type === 'folder' ? '📁' : '📄' }} {{ row.node.data.name }}</span>
    </template>
  </VirtualTree>
</template>
```

---

## InfiniteLoader

Wraps `VirtualList` and calls `onLoadMore` when the user scrolls within `threshold` pixels of the bottom (or top, or both).

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `items` | `T[]` | — | Current data array |
| `onLoadMore` | `() => Promise<void>` | — | Called when more data is needed |
| `isLoading` | `boolean` | — | Whether a load is in progress |
| `hasMore` | `boolean` | — | Whether more data exists |
| `threshold` | `number` | `200` | Distance from edge (px) at which to trigger `onLoadMore` |
| `direction` | `'down' \| 'up' \| 'both'` | `'down'` | Which edge(s) trigger loading |
| `estimatedItemSize` | `number` | `50` | Estimated row height |
| `overscan` | `number` | `3` | Extra rows outside viewport |
| `keyField` | `string` | `'id'` | Row key field |
| `motionBlur` | `boolean` | `false` | Apply a CSS blur that scales with scroll velocity while scrolling fast |

### Slots

| Slot | Scope | Description |
|---|---|---|
| `#default` | `{ item: T, index: number, style }` | Row content |
| `#loading-indicator` | — | Custom loading spinner (shown at top/bottom depending on `direction`) |
| `#empty` | — | Empty state |

### Emits

`scroll`, `visible-range-change`.

### Exposed API

```ts
loaderRef.value?.scrollTo(index, align)
loaderRef.value?.scrollTo(index, 'start', { behavior: 'smooth' })
loaderRef.value?.scrollToOffset(px)
loaderRef.value?.getScrollElement()
```

### Example

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { InfiniteLoader } from 'vue-virtual-scroller-kit'

interface Post { id: number; title: string }

const posts = ref<Post[]>([])
const isLoading = ref(false)
const hasMore = ref(true)
let page = 0

async function loadMore() {
  if (isLoading.value || !hasMore.value) return
  isLoading.value = true
  try {
    const res = await fetch(`/api/posts?page=${page}`)
    const data: Post[] = await res.json()
    posts.value = [...posts.value, ...data]
    hasMore.value = data.length === 20
    page++
  } finally {
    isLoading.value = false
  }
}

await loadMore()
</script>

<template>
  <InfiniteLoader
    :items="posts"
    :on-load-more="loadMore"
    :is-loading="isLoading"
    :has-more="hasMore"
    :estimated-item-size="72"
    style="height: 600px"
  >
    <template #default="{ item }">
      <div class="post-row">{{ item.title }}</div>
    </template>
    <template #loading-indicator>
      <div style="padding: 16px; text-align: center">Loading…</div>
    </template>
  </InfiniteLoader>
</template>
```

---

## VirtualSelect

A searchable select input backed by a virtualized dropdown. Handles hundreds of thousands of options without DOM overhead.

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `options` | `T[]` | — | Option objects |
| `modelValue` | `T \| null` | `null` | Currently selected option |
| `labelField` | `string` | `'label'` | Field to display in the trigger and dropdown |
| `valueField` | `string` | `'value'` | Field used for equality comparison |
| `placeholder` | `string` | `'Select an option…'` | Placeholder text |
| `disabled` | `boolean` | `false` | Disable the select |
| `clearable` | `boolean` | `false` | Show a clear button when a value is selected |
| `searchable` | `boolean` | `true` | Show a search input when the dropdown opens |
| `estimatedItemSize` | `number` | `36` | Estimated option row height |
| `maxVisibleRows` | `number` | `8` | Max rows shown before the dropdown scrolls |
| `motionBlur` | `boolean` | `false` | Apply a CSS blur that scales with scroll velocity while scrolling fast |
| `remote` | `boolean` | `false` | Skip client-side filtering — `options` is rendered as-is; you update it yourself in response to `search` |
| `debounceMs` | `number` | `0` | Delay before the `search` event fires after typing stops (coalesces keystrokes for a server round-trip). `0` keeps today's synchronous behavior |
| `isLoading` | `boolean` | `false` | Shows the `#loading` slot in the dropdown, checked before the `#empty` slot so an in-flight remote search doesn't flash "No options" |

### Emits

| Event | Payload |
|---|---|
| `update:modelValue` | `T \| null` |
| `change` | `T \| null` |
| `search` | `string` |

### Slots

| Slot | Scope | Description |
|---|---|---|
| `#default` | `{ option: T, index: number, selected: boolean }` | Custom option row |
| `#empty` | — | Shown when `filteredOptions` is empty and not loading |
| `#loading` | — | Shown while `isLoading` is true, in place of the option list |

### Exposed API

```ts
selectRef.value?.open()
selectRef.value?.close()
selectRef.value?.getScrollElement() // pair with VirtualScrollbar
```

### Example

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { VirtualSelect } from 'vue-virtual-scroller-kit'

interface Country { value: string; label: string; flag: string }

const countries: Country[] = [
  { value: 'us', label: 'United States', flag: '🇺🇸' },
  { value: 'de', label: 'Germany', flag: '🇩🇪' },
  // … hundreds more
]

const selected = ref<Country | null>(null)
</script>

<template>
  <VirtualSelect
    v-model="selected"
    :options="countries"
    label-field="label"
    value-field="value"
    clearable
    style="width: 300px"
  >
    <template #default="{ option }">
      {{ option.flag }} {{ option.label }}
    </template>
  </VirtualSelect>
</template>
```

**Async/remote search** — `options` is populated from a server, filtering happens there instead of client-side:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { VirtualSelect } from 'vue-virtual-scroller-kit'

interface Country { value: string; label: string }

const selected = ref<Country | null>(null)
const results = ref<Country[]>([])
const isLoading = ref(false)
let requestId = 0

async function onSearch(query: string) {
  const id = ++requestId
  isLoading.value = true
  try {
    const res = await fetch(`/api/countries?q=${encodeURIComponent(query)}`)
    const data: Country[] = await res.json()
    if (id !== requestId) return // a newer keystroke already fired another request
    results.value = data
  } finally {
    if (id === requestId) isLoading.value = false
  }
}
</script>

<template>
  <VirtualSelect
    v-model="selected"
    :options="results"
    remote
    :debounce-ms="300"
    :is-loading="isLoading"
    label-field="label"
    value-field="value"
    style="width: 300px"
    @search="onSearch"
  >
    <template #loading>Searching…</template>
  </VirtualSelect>
</template>
```

---

## VirtualScrollbar

A themable custom scrollbar overlay. Decoupled from `useVirtualScroll` — it works with the scroll
element exposed by any component above (via `getScrollElement()`), or any scrollable element you pass
directly. Renders a track + draggable thumb sized and positioned from `scrollHeight`/`clientHeight`/`scrollTop`,
and drags with pointer events.

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `target` | `() => HTMLElement \| null` | — | Returns the scroll element to sync with |
| `orientation` | `'vertical' \| 'horizontal'` | `'vertical'` | Scroll axis to track |
| `minThumbSize` | `number` | `24` | Minimum thumb size in px, so a huge list doesn't shrink it to an ungrabbable sliver |

### CSS custom properties

| Property | Default | Description |
|---|---|---|
| `--vvsk-scrollbar-size` | `10px` | Thickness of the track/thumb |
| `--vvsk-scrollbar-track` | `transparent` | Track background |
| `--vvsk-scrollbar-thumb` | `rgb(255 255 255 / 25%)` | Thumb background |
| `--vvsk-scrollbar-thumb-hover` | `rgb(255 255 255 / 40%)` | Thumb background while hovered/dragged |

### Example

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { VirtualList, VirtualScrollbar } from 'vue-virtual-scroller-kit'
import type { VirtualListExpose } from 'vue-virtual-scroller-kit'

const listRef = ref<VirtualListExpose | null>(null)
const items = Array.from({ length: 10_000 }, (_, i) => ({ id: i, text: `Row ${i + 1}` }))
</script>

<template>
  <div style="position: relative; display: flex; height: 500px">
    <VirtualList
      ref="listRef"
      :items="items"
      :estimated-item-size="48"
      class="vvsk-scrollbar-hidden"
      style="flex: 1"
    >
      <template #default="{ item }">
        <div style="padding: 12px 16px; border-bottom: 1px solid #eee">{{ item.text }}</div>
      </template>
    </VirtualList>

    <VirtualScrollbar :target="() => listRef?.getScrollElement() ?? null" />
  </div>
</template>
```

Hide the native scrollbar on the paired container when using `VirtualScrollbar` (optional — the two can
coexist if you want both):

```css
.vvsk-scrollbar-hidden {
  scrollbar-width: none; /* Firefox */
}
.vvsk-scrollbar-hidden::-webkit-scrollbar {
  display: none; /* Chrome, Safari, Edge */
}
```

---

## useVirtualScroll

The low-level composable that powers all components. Use it when you need to build a custom virtual container.

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `itemCount` | `number \| Ref<number>` | — | Total item count |
| `estimatedItemSize` | `SizeProvider \| Ref<SizeProvider>` | `50` | Estimated item height: number or `(index) => number`. A `Ref` triggers a full rebuild when it changes |
| `overscan` | `number` | `3` | Extra items rendered outside the viewport |
| `getScrollElement` | `() => HTMLElement \| null` | — | Returns the scroll container |
| `pageMode` | `boolean` | `false` | Use `window` as the scroll container. Read once, not reactive — see note below |
| `horizontal` | `boolean` | `false` | Virtualize `scrollLeft`/`clientWidth` instead of `scrollTop`/`clientHeight`, RTL-safe via `normalizeScrollLeft`. Read once, not reactive — see note below |
| `motionBlur` | `boolean` | `false` | Track scroll velocity and expose it as `blurAmount` (px). Off by default — zero cost when disabled |

```ts
type SizeProvider = number | ((index: number) => number)
```

> `pageMode` and `horizontal` are captured from `options` once when the composable is set up —
> changing them on a live instance has no effect. If you need to switch axes at runtime, remount
> the component that calls `useVirtualScroll` (e.g. via `:key`).

### Return value

| Property | Type | Description |
|---|---|---|
| `visibleRange` | `Readonly<Ref<VisibleRange>>` | `{ start, end }` — first and last visible item indices |
| `totalHeight` | `Readonly<Ref<number>>` | Total scrollable size in px along the scroll axis (height, or width when `horizontal`) |
| `offsetTop` | `(index: number) => number` | Pixel offset of item at index along the scroll axis (top, or left when `horizontal`) |
| `scrollTo` | `(index, align?, options?) => void` | Scroll to item (`'start' \| 'center' \| 'end' \| 'auto'`). `options.behavior` is `'auto'` (default, instant) or `'smooth'` |
| `scrollToOffset` | `(offset: number, options?) => void` | Scroll to a raw pixel offset. Same `options.behavior` |
| `measureItem` | `(index, height) => void` | Report a measured row height |
| `handleScroll` | `() => void` | Manually trigger a visible-range recalculation |
| `blurAmount` | `Readonly<Ref<number>>` | Current motion-blur radius in px. Always `0` unless the `motionBlur` option is enabled |

### Example

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useVirtualScroll } from 'vue-virtual-scroller-kit'

const ITEMS = Array.from({ length: 50_000 }, (_, i) => `Item ${i + 1}`)
const containerRef = ref<HTMLElement | null>(null)

const { visibleRange, totalHeight, offsetTop } = useVirtualScroll({
  itemCount: ITEMS.length,
  estimatedItemSize: 40,
  getScrollElement: () => containerRef.value,
})
</script>

<template>
  <div ref="containerRef" style="height: 500px; overflow-y: auto; position: relative">
    <div :style="{ height: `${totalHeight}px`, position: 'relative' }">
      <div
        v-for="i in visibleRange.end - visibleRange.start + 1"
        :key="visibleRange.start + i - 1"
        :style="{ position: 'absolute', top: `${offsetTop(visibleRange.start + i - 1)}px`, width: '100%', height: '40px' }"
      >
        {{ ITEMS[visibleRange.start + i - 1] }}
      </div>
    </div>
  </div>
</template>
```

---

## useVirtualKeyboardNav

Keyboard navigation composable. Attaches `keydown` listeners and manages a focused index. Works with any virtual list component.

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `itemCount` | `Ref<number> \| number` | — | Total item count |
| `scrollTo` | `(index, align?) => void` | — | Called to scroll the list when focus moves |
| `target` | `Ref<HTMLElement \| null> \| HTMLElement` | `document` | Element that receives keyboard events |
| `onActivate` | `(index: number) => void` | — | Called on Enter or Space |
| `onChange` | `(index: number) => void` | — | Called when the focused index changes |
| `loop` | `boolean` | `false` | Whether to wrap around at boundaries |

### Return value

| Property | Type | Description |
|---|---|---|
| `focusedIndex` | `Readonly<Ref<number>>` | Currently focused index, `-1` if nothing focused |
| `setFocus` | `(index: number) => void` | Programmatically set focus |
| `isFocused` | `(index: number) => boolean` | Whether `index` is focused |

### Keys handled

| Key | Action |
|---|---|
| `↑` | Move focus up |
| `↓` | Move focus down |
| `Home` | Focus first item |
| `End` | Focus last item |
| `PageUp` | Jump −10 items |
| `PageDown` | Jump +10 items |
| `Enter` / `Space` | Call `onActivate` |

### Example

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { VirtualList, useVirtualKeyboardNav } from 'vue-virtual-scroller-kit'
import type { VirtualListExpose } from 'vue-virtual-scroller-kit'

const items = ref(Array.from({ length: 1000 }, (_, i) => ({ id: i, label: `Item ${i + 1}` })))
const listRef = ref<VirtualListExpose | null>(null)

const { focusedIndex, setFocus, isFocused } = useVirtualKeyboardNav({
  itemCount: computed(() => items.value.length),
  scrollTo: (i, align) => listRef.value?.scrollTo(i, align),
  onActivate: (i) => console.log('Activated', items.value[i]),
  loop: false,
})
</script>

<template>
  <div tabindex="0" style="outline: none; border: 1px solid #ccc">
    <VirtualList ref="listRef" :items="items" :estimated-item-size="48" style="height: 400px">
      <template #default="{ item, index }">
        <div
          :class="{ focused: isFocused(index) }"
          :aria-selected="isFocused(index)"
          role="option"
          @click="setFocus(index)"
        >
          {{ item.label }}
        </div>
      </template>
    </VirtualList>
  </div>
</template>
```

---

## useDraggableList

Pointer-event drag-to-reorder composable. Shows a fixed-position ghost element that follows the cursor, animates neighbouring items with `translateY`, and auto-scrolls the container when dragging near the edges.

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `items` | `Ref<T[]>` | — | Reactive items array |
| `onReorder` | `(newItems, from, to) => void` | — | Called after a successful drop with the reordered array |
| `isDragDisabled` | `(item, index) => boolean` | — | Return `true` to prevent an item from being dragged |
| `scrollContainer` | `HTMLElement \| Ref<HTMLElement \| null>` | — | Container for auto-scroll when dragging near its edges |

### Return value

| Property | Type | Description |
|---|---|---|
| `dragIndex` | `Readonly<Ref<number>>` | Index of the item being dragged, `-1` when idle |
| `overIndex` | `Readonly<Ref<number>>` | Index of the current drop target |
| `isDragging` | `Readonly<Ref<boolean>>` | Whether a drag is in progress |
| `ghostStyle` | `Readonly<Ref<CSSProperties>>` | Fixed-position styles for the ghost element |
| `getItemStyle` | `(index: number) => CSSProperties` | Per-item styles: `opacity:0` for the placeholder, `translateY` for animated neighbours |
| `getItemProps` | `(index: number) => DraggableItemProps` | Props to spread on each draggable item (`data-drag-index`, `onPointerdown`, CSS classes) |

### CSS classes added by `getItemProps`

| Class | When |
|---|---|
| `vvsk-drag--dragging` | Applied to the placeholder (the item being dragged) |
| `vvsk-drag--over` | Applied to the current drop target |
| `vvsk-drag--disabled` | Applied when `isDragDisabled` returns `true` |

### Auto-scroll

When `scrollContainer` is provided, the list automatically scrolls up or down when the cursor enters a 60 px zone near the container edges. Scroll speed is proportional to the distance (max 14 px per frame).

### Example

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useDraggableList } from 'vue-virtual-scroller-kit'

interface Card { id: number; label: string }

const cards = ref<Card[]>(
  Array.from({ length: 50 }, (_, i) => ({ id: i, label: `Card ${i + 1}` })),
)
const listRef = ref<HTMLElement | null>(null)

const { isDragging, dragIndex, ghostStyle, getItemStyle, getItemProps } = useDraggableList({
  items: cards,
  scrollContainer: listRef,
  onReorder: (newItems) => { cards.value = newItems },
})
</script>

<template>
  <div ref="listRef" style="display: flex; flex-direction: column; gap: 6px; overflow-y: auto; height: 500px">
    <div
      v-for="(card, index) in cards"
      :key="card.id"
      v-bind="getItemProps(index)"
      :style="getItemStyle(index)"
      class="card"
    >
      ⣿ {{ card.label }}
    </div>
  </div>

  <Teleport to="body">
    <div
      v-if="isDragging && dragIndex >= 0"
      class="card card--ghost"
      :style="ghostStyle"
    >
      ⣿ {{ cards[dragIndex]?.label }}
    </div>
  </Teleport>
</template>

<style>
.card { padding: 12px 16px; background: #fff; border: 1px solid #ddd; border-radius: 6px; cursor: grab; user-select: none; }
.card--ghost { box-shadow: 0 16px 40px rgba(0,0,0,0.3); transform: scale(1.02); pointer-events: none; }
</style>
```

---

## useRowSelection

Dataset-agnostic click / Shift-click row selection — works with `VirtualList`, `VirtualTable`, or any
plain array. Not tied to a specific component: pair `isSelected`/`toggle` with whichever row-index
slot scope your component exposes.

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `items` | `Ref<T[]> \| ComputedRef<T[]>` | — | Reactive items array |
| `getKey` | `(item: T, index: number) => string \| number` | `item.id ?? index` | Identity used for the selection set |
| `multiple` | `boolean` | `true` | `false` restricts to a single selected row; a new `toggle` call replaces the selection instead of adding to it |

### Return value

| Property | Type | Description |
|---|---|---|
| `selectedKeys` | `Readonly<Ref<Set<string \| number>>>` | Currently selected keys |
| `selectedItems` | `ComputedRef<T[]>` | Currently selected items, derived from `items` + `selectedKeys` |
| `isSelected` | `(item: T, index: number) => boolean` | Whether a row is selected |
| `toggle` | `(item: T, index: number, event?: MouseEvent \| KeyboardEvent) => void` | Toggle a row. `event.shiftKey` fills the range from the last-toggled row to this one (Gmail-checkbox convention), on top of whatever's already selected |
| `selectAll` | `() => void` | Select every row in `items` |
| `clearSelection` | `() => void` | Clear the selection and reset the shift-range anchor |

### Example

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { VirtualList, useRowSelection } from 'vue-virtual-scroller-kit'

interface Row { id: number; label: string }
const items = ref<Row[]>(Array.from({ length: 1000 }, (_, i) => ({ id: i, label: `Row ${i + 1}` })))

const selection = useRowSelection<Row>({ items })
</script>

<template>
  <VirtualList :items="items" key-field="id" :estimated-item-size="40" style="height: 500px">
    <template #default="{ item, index }">
      <label>
        <input
          type="checkbox"
          :checked="selection.isSelected(item, index)"
          @click="selection.toggle(item, index, $event)"
        />
        {{ item.label }}
      </label>
    </template>
  </VirtualList>
  <p>{{ selection.selectedItems.value.length }} selected</p>
</template>
```

> Click toggles one row in place; Shift+click fills the range from the last-toggled row. For
> `VirtualTable`, pair this with the `index` now available on the `#cell` slot — see the
> [row-selection example](#virtualtable) above.

---

## useVisibilityTracker

Per-key "entered viewport" / "left viewport" tracking, backed by a real `IntersectionObserver`
rather than diffing `visibleRange` — so it's accurate even with a large `overscan` buffer or
partial-visibility thresholds. Dataset-agnostic: you decide which elements to `observe()`, each
under whatever key you like (a row id, an index, anything).

Typical use: highlight a nav/minimap entry, a table-of-contents item, or a "jump to" button in a
control panel while the corresponding row is actually on screen in a virtualized list or table —
turning it off the instant the row scrolls back out.

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `root` | `() => HTMLElement \| null` | — | Returns the scroll container to intersect against. Omit to use the browser viewport |
| `rootMargin` | `string` | `'0px'` | IntersectionObserver `rootMargin` — grow/shrink the root's effective bounds (e.g. trigger slightly early) |
| `threshold` | `number \| number[]` | `0` | Fraction of the element that must be visible to count as "visible" |
| `onVisible` | `(key: string \| number) => void` | — | Called when a tracked key becomes visible |
| `onHidden` | `(key: string \| number) => void` | — | Called when a tracked key becomes hidden (including via `unobserve` while it was visible) |

### Return value

| Property | Type | Description |
|---|---|---|
| `visibleKeys` | `Readonly<Ref<Set<string \| number>>>` | Keys currently intersecting the root |
| `isVisible` | `(key: string \| number) => boolean` | Whether `key` is currently visible |
| `observe` | `(el: Element \| null, key: string \| number) => void` | Start tracking an element under `key` — bind via a template ref callback |
| `unobserve` | `(key: string \| number) => void` | Stop tracking `key` (e.g. on row unmount) |

> `root` may resolve after this composable's own setup runs (e.g. a sibling `VirtualList`'s
> template ref) — it's polled for a few frames, and rebuilt automatically if the resolved root
> element ever changes (such as after a `:key`-forced remount).

### Example

Watch specific rows and mirror their visibility into a sidebar panel — same pattern used by the
VirtualList demo's "Watchlist":

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { VirtualList, useVisibilityTracker } from 'vue-virtual-scroller-kit'
import type { VirtualListExpose } from 'vue-virtual-scroller-kit'

interface Row { id: number; title: string }
const items = ref<Row[]>(Array.from({ length: 100_000 }, (_, i) => ({ id: i + 1, title: `Row ${i + 1}` })))
const listRef = ref<VirtualListExpose | null>(null)
const watchedIds = ref<Set<number>>(new Set([1, 50_000]))

const tracker = useVisibilityTracker({
  root: () => listRef.value?.getScrollElement() ?? null,
})

// Rows unmount when scrolled out of the virtualized range, so track/untrack on
// mount/unmount rather than assuming an observed element stays alive.
function onRowMount(el: Element, id: number) {
  if (watchedIds.value.has(id)) tracker.observe(el, id)
}
function onRowUnmount(id: number) {
  tracker.unobserve(id)
}
</script>

<template>
  <VirtualList ref="listRef" :items="items" key-field="id" :estimated-item-size="48" style="height: 500px">
    <template #default="{ item }">
      <div
        :ref="(el) => el && onRowMount(el as Element, item.id)"
        @vue:unmounted="onRowUnmount(item.id)"
        :style="{ background: watchedIds.has(item.id) && tracker.isVisible(item.id) ? '#fef08a' : 'transparent' }"
      >
        {{ item.title }}
      </div>
    </template>
  </VirtualList>
</template>
```

---

## PositionManager

The internal segment tree exposed for advanced use cases. Stores row heights and answers prefix-sum queries in O(log n).

```ts
import { PositionManager } from 'vue-virtual-scroller-kit'

const manager = new PositionManager(
  10_000,          // item count
  50,              // uniform estimated height (or a function (index) => number)
)

manager.totalSize              // total height of all items
manager.getOffset(index)       // pixel offset of item i = sum of heights[0..i-1]
manager.getHeight(index)       // stored height of item i
manager.findIndex(scrollTop)   // first item index visible at scrollTop
manager.set(index, height)     // update measured height, O(log n)
```

Use `PositionManager` when building completely custom virtualised layouts that don't fit the provided components.

---

## autoColWidths

Utility function that estimates column widths from a data sample using the Canvas API `measureText`. Useful for setting initial `ColumnDef.width` values in `VirtualTable` based on actual content.

```ts
import { autoColWidths } from 'vue-virtual-scroller-kit'

const widths = autoColWidths(columns, rows, options)
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `cols` | `{ key: string; title: string }[]` | Column definitions — key and header title |
| `rows` | `T[]` | Data rows to measure |
| `options` | `AutoColWidthsOptions` | Optional settings (see below) |

### `AutoColWidthsOptions`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `font` | `string` | `'12px sans-serif'` | CSS font string — should match your cell font |
| `padding` | `number` | `24` | Extra px added to measured width (accounts for cell padding) |
| `minWidth` | `number` | `60` | Minimum column width in px |
| `maxWidth` | `number` | `320` | Maximum column width in px |

### Return value

`Map<string, number>` — maps each column key to a pixel width.

### Example

```ts
import { autoColWidths } from 'vue-virtual-scroller-kit'
import type { ColumnDef } from 'vue-virtual-scroller-kit'

const rawCols = [
  { key: 'id', title: 'ID' },
  { key: 'name', title: 'Name' },
  { key: 'email', title: 'Email' },
]

const widths = autoColWidths(rawCols, rows, {
  font: '12px Inter, sans-serif',
  padding: 24,
  maxWidth: 400,
})

const columns: ColumnDef[] = rawCols.map(c => ({
  key: c.key,
  title: c.title,
  width: widths.get(c.key) ?? 120,
  minWidth: 60,
}))
```

> **SSR note:** `autoColWidths` uses `document.createElement('canvas')` internally. In SSR environments where `document` is unavailable it falls back to a uniform width of `120px`.

---

## TypeScript types

All public types are exported from the package root:

```ts
import type {
  // Column definition for VirtualTable
  ColumnDef,

  // Group definition for GroupedVirtualList
  GroupDef,

  // Scroll alignment
  ScrollAlign,           // 'start' | 'center' | 'end' | 'auto'

  // Options for scrollTo/scrollToOffset — { behavior?: 'auto' | 'smooth' }
  ScrollBehaviorOptions,

  // Visible range returned by useVirtualScroll
  VisibleRange,          // { start: number; end: number }

  // Exposed API of VirtualList (use instead of InstanceType for generic components)
  VirtualListExpose,

  // Exposed API of GroupedVirtualList
  GroupedVirtualListExpose,

  // Sort event payload from VirtualTable
  SortChange,            // { key: string; direction: 'asc' | 'desc' | null }

  // Low-level type for GroupedVirtualList row
  VirtualRow,
  VirtualRowType,

  // Tree types exported from VirtualTree
  TreeNode,
  FlatTreeRow,

  // Size provider for PositionManager / useVirtualScroll
  SizeProvider,          // number | ((index: number) => number)

  // Options/return types for useRowSelection
  UseRowSelectionOptions,
  UseRowSelectionReturn,

  // Options/return types for useVisibilityTracker
  UseVisibilityTrackerOptions,
  UseVisibilityTrackerReturn,
} from 'vue-virtual-scroller-kit'
```

### `VirtualListExpose` vs `InstanceType`

Generic Vue SFCs (`generic="T"`) are not compatible with `InstanceType<typeof Component>`. Use the dedicated expose interfaces instead:

```ts
// ✗ Does not work for generic SFCs
const listRef = ref<InstanceType<typeof VirtualList> | null>(null)

// ✓ Correct
import type { VirtualListExpose } from 'vue-virtual-scroller-kit'
const listRef = ref<VirtualListExpose | null>(null)
```

---

## Accessibility

| Feature | Implementation |
|---|---|
| `role="list"` / `role="listitem"` | Applied on `VirtualList` container and each visible row |
| `aria-rowcount` | Set to total item count on the list container |
| `aria-rowindex` | Set to `index + 1` on each visible row |
| `aria-busy` | Set to `"true"` on the container while `isLoading` is true |
| `role="grid"` / `role="gridcell"` | Used on `VirtualGrid` |
| `aria-rowindex` / `aria-colindex` | Set on `VirtualGrid` cells |
| `role="treeitem"` | Used on `VirtualTree` rows |
| `aria-expanded` / `aria-level` | Set on tree rows with children |
| `role="combobox"` / `role="listbox"` / `role="option"` | Used on `VirtualSelect` |
| `aria-expanded` / `aria-haspopup` / `aria-selected` | Set on select trigger and options |
| Keyboard support | Full keyboard navigation via `useVirtualKeyboardNav` |

---

## SSR compatibility

All components render the first `ssrPreloadCount` rows (default 20) on the server with estimated heights. Client-side hydration replaces estimated positions with measured heights incrementally using `ResizeObserver` — no layout shift or scroll jump occurs.

Components that use browser-only APIs (`ResizeObserver`, `IntersectionObserver`, `requestAnimationFrame`, `window.scroll`) guard those APIs with `typeof window !== 'undefined'` and `onMounted`. All core logic and slot rendering is SSR-safe.

---

## RTL support

Wrap your app (or just the parts using this library) in `dir="rtl"` — no `rtl` prop exists anywhere,
because none is needed:

```vue
<VirtualTable :columns="columns" :rows="rows" dir="rtl" style="height: 500px" />
```

Every component uses **CSS logical properties** (`inset-inline-start`/`inset-inline-end`,
`padding-inline-start`, `margin-inline-start`) instead of physical `left`/`right` for positioning —
`VirtualTree` indent, `VirtualTable` fixed columns and the column-resize handle, `VirtualGrid` cell
placement, and `VirtualScrollbar`'s horizontal thumb all mirror automatically whenever the browser
resolves `direction: rtl`, with zero JavaScript direction-branching.

The one place that genuinely needs JS is `element.scrollLeft`, whose sign/origin differs in RTL across
browsers (0 at the start edge, negative going toward the end, per the modern spec). `VirtualTable`'s
column virtualization, `VirtualScrollbar`'s horizontal mode, and `VirtualList`'s `horizontal` layout
all read/write it through `normalizeScrollLeft` / `setNormalizedScrollLeft` rather than the raw
property — both are also exported from `vue-virtual-scroller-kit` if you need the same normalization
in your own code. Column drag-to-resize also flips its pointer-delta sign in RTL, since the resize
handle sits on the physical left edge there.

```ts
import { normalizeScrollLeft, setNormalizedScrollLeft } from 'vue-virtual-scroller-kit'

const distanceFromStart = normalizeScrollLeft(el) // works the same in LTR and RTL
setNormalizedScrollLeft(el, distanceFromStart + 100)
```

---

## Architecture

```
vue-virtual-scroller-kit
│
├── PositionManager (segment tree)
│     O(log n) height updates and prefix-sum queries
│
├── useVirtualScroll
│     itemCount + estimatedItemSize → visibleRange, totalHeight, scrollTo
│     ResizeObserver on scroll container (viewport resize)
│     RAF-batched recalc, debounced row measurements
│     Anchor-compensated reflow: height changes above the viewport nudge
│     scrollTop by the same delta so visible rows never jump
│     Optional velocity tracking → blurAmount (motionBlur option)
│     Optional horizontal axis (scrollLeft/clientWidth, RTL-safe via
│     normalizeScrollLeft); fixed at mount, like pageMode
│
├── VirtualList
│     scrollElement / pageMode / window scroll
│     ResizeObserver per visible row (dynamic heights)
│     Scroll restoration via sessionStorage
│     DOM recycling pool (recyclePool prop)
│     Optional horizontal layout (horizontal prop)
│
├── GroupedVirtualList
│     Flattens GroupDef[] → VirtualRow[] (headers + items)
│     Animated collapse/expand state machine per group
│     Optional sticky-header overlay (stickyGroupHeaders), tracks the group
│     at visibleRange.start — not a real CSS sticky row (rows are absolute)
│     Backed by VirtualList
│
├── VirtualTable
│     Sticky header, fixed columns, sort, resize, reorder, column virtualization
│     Pinned top/bottom rows, built-in lazy loading (onLoadMore / hasMore / isLoading)
│     Column order (columnOrder) and visibility (hiddenColumnKeys) tracked
│     internally, both overlay the columns prop
│     Backed by VirtualList
│
├── VirtualGrid
│     Auto-column count from container width (ResizeObserver)
│     rowHeightWithGap fed as Ref to useVirtualScroll
│     Optional dynamicRowHeight: per-row wrapper (flex) + ResizeObserver,
│     row height = max of that row's cells, instead of individually
│     absolutely-positioned fixed-height cells
│     Backed by useVirtualScroll directly
│
├── VirtualTree
│     Recursive flattenNodes with lazy-load support
│     Backed by VirtualList
│
├── InfiniteLoader
│     Threshold check on scroll (debounced 50 ms)
│     Scroll-position preservation for up-direction prepend
│     Backed by VirtualList
│
├── VirtualSelect
│     Client-side filter or opt-in remote mode (debounced search event,
│     isLoading slot), keyboard nav, open/close lifecycle
│     Backed by VirtualList
│
├── VirtualScrollbar
│     Decoupled from useVirtualScroll — syncs to any getScrollElement()
│     via its own scroll/ResizeObserver listeners
│     Pointer-drag thumb + click-to-jump track
│
├── useVirtualKeyboardNav
│     Standalone composable — keydown on target or document
│
├── useDraggableList
│     Pointer events (no HTML5 Drag API)
│     Ghost element via fixed positioning + Teleport
│     Gap animation via translateY on neighbours
│     Auto-scroll RAF loop when near scroll container edges
│
├── useRowSelection
│     Dataset-agnostic (works with VirtualList, VirtualTable, plain arrays)
│     Click toggles in place; Shift+click fills a range from the
│     last-toggled index (Gmail-checkbox convention)
│
└── useVisibilityTracker
      Per-key observe()/unobserve(), backed by a real IntersectionObserver
      (not visibleRange diffing — accurate under overscan/partial thresholds)
      Root polled + rebuilt automatically if it resolves late or changes
```

---

## Performance

`src/__bench__/` has Vitest benchmarks (`vitest bench`, tinybench under the hood) for the two
pieces that carry the package's O(log n) claim: the `PositionManager` segment tree directly, and
`useVirtualScroll`'s mount/rebuild cost on top of it. Run them yourself with:

```bash
npm run bench
```

> Benchmarking is an experimental Vitest feature — numbers can shift between Vitest versions.
> These are isolated micro-benchmarks in jsdom (component mount/unmount, no real paint or layout),
> not a substitute for profiling an actual app. Treat them as *relative* evidence of the O(log n)
> design, not as absolute numbers for your hardware.

**`PositionManager`** — per-operation mean time, one developer machine, single run:

| Items (n) | `construct` (fixed height) | `findIndex` | `set` (resize) | `getOffset` |
|---:|---:|---:|---:|---:|
| 1,000 | 0.0125 ms | 0.0001 ms | 0.0001 ms | 0.0001 ms |
| 10,000 | 0.166 ms | 0.0002 ms | 0.0001 ms | 0.0002 ms |
| 100,000 | 0.612 ms | 0.0002 ms | 0.0002 ms | 0.0002 ms |

`construct` is the one O(n) operation (it builds the whole tree once) — its cost grows with `n`, as
expected. `findIndex`, `set`, and `getOffset` are the O(log n) operations queried on every scroll
event and every row measurement; their per-call cost barely moves from 1,000 to 100,000 items —
this is the segment tree doing its job.

**`useVirtualScroll`** — mounting the composable in a real Vue component, and rebuilding its
internal `PositionManager` on an `itemCount` change:

| Items (n) | Mount | `itemCount` change (rebuild) |
|---:|---:|---:|
| 1,000 | 0.204 ms | 0.206 ms |
| 10,000 | 0.352 ms | 0.373 ms |
| 100,000 | 1.51 ms | 2.22 ms |

Both scale with the `PositionManager` construction cost inside them, plus Vue's own
mount/reactivity overhead — still comfortably sub-millisecond to low-millisecond even at 100k rows.

---

## Bundle size & peer dependencies

| Entry point | Peer deps | Notes |
|---|---|---|
| `vue-virtual-scroller-kit` | `vue ^3.3` | Full bundle — all components and composables |

The package ships as tree-shakeable ESM (`dist/index.js`) + CJS (`dist/index.cjs`) dual build. Importing only `VirtualList` and leaving `VirtualTable`, `VirtualTree`, etc. unused results in those modules being dropped by your bundler.

---

## Development

```bash
npm install
npm run typecheck   # vue-tsc
npm run lint        # eslint
npm run lint:css    # stylelint
npm test            # vitest — unit tests (src/__tests__)
npm run demo        # starts the demo app at http://localhost:5173
```

End-to-end tests drive the demo app in a real browser (Playwright) and live in `demo/e2e/` — this is
what actually catches scroll-timing and browser-API bugs that jsdom can't (real smooth-scroll
animation, real `ResizeObserver`/`requestAnimationFrame` timing, real RTL layout):

```bash
cd demo
npm install
npm run test:e2e
```

CI (`.github/workflows/ci.yml`) runs typecheck, lint, unit tests, and build on Node 18 and 20, plus
the e2e suite, on every push and pull request.

---

## License

MIT

---

## Author

Danil Lisin Vladimirovich aka Macrulez

GitHub: [macrulezru](https://github.com/macrulezru) · Website: [macrulez.ru/en](https://macrulez.ru/en)

Questions and bugs — [issues](https://github.com/macrulezru/vue-virtual-scroller-kit/issues)

---

## 💖 Support the project

Open source takes time and effort. If my work saves you time or brings value, consider supporting further development.

<a href="https://donate.cryptocloud.plus/M6O34NIN" target="_blank">
  <img src="https://img.shields.io/badge/Donate-CryptoCloud-8A2BE2?style=for-the-badge&logo=cryptocurrency&logoColor=white" alt="Donate via CryptoCloud">
</a>

Thank you for being part of this journey. ❤️
