# vue-virtual-scroller-kit

Virtual list, table, grid, tree, and select for Vue 3. Dynamic row heights measured by `ResizeObserver`, grouping with animated expand/collapse, sticky headers, infinite scroll, keyboard navigation, drag-to-reorder, and full SSR support — all with a single peer dependency (Vue 3).

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
- [useVirtualScroll](#usevirtualscroll)
- [useVirtualKeyboardNav](#usevirtualkeyboardnav)
- [useDraggableList](#usedraggablelist)
- [PositionManager](#positionmanager)
- [TypeScript types](#typescript-types)
- [Accessibility](#accessibility)
- [SSR compatibility](#ssr-compatibility)
- [Architecture](#architecture)
- [Bundle size & peer dependencies](#bundle-size--peer-dependencies)

---

## Features

- **Dynamic row heights** — `ResizeObserver` measures each row after render; position manager updates in O(log n)
- **VirtualList** — flat list, external scroll container, page-mode (window scroll), DOM recycling pool, scroll restoration
- **GroupedVirtualList** — collapsible sections with smooth expand/collapse CSS animation
- **VirtualTable** — sticky header, fixed left/right columns, single and multi-column sort, drag-to-resize columns, column virtualization, pinned top/bottom rows, built-in lazy loading (`onLoadMore` / `hasMore` / `isLoading`)
- **VirtualGrid** — fixed-height cells in a responsive auto-column or fixed-column grid
- **VirtualTree** — hierarchical expand/collapse with lazy child loading, configurable indent
- **InfiniteLoader** — trigger `onLoadMore` near the bottom, top, or both ends; scroll-position preservation when prepending
- **VirtualSelect** — virtualized dropdown with client-side search and keyboard navigation
- **useVirtualScroll** — raw composable for custom containers; returns `visibleRange`, `totalHeight`, `scrollTo`
- **useVirtualKeyboardNav** — arrow keys, Home/End, PageUp/PageDown, Enter/Space; plugs into any virtual list
- **useDraggableList** — pointer-event drag-to-reorder with animated gap, ghost element, auto-scroll, disabled-item support
- **PositionManager** — segment tree (O(log n) updates and prefix-sum queries) exposed for advanced use
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
| **VirtualList** | Flat list, 10 000 items, mixed row heights |
| **GroupedVirtualList** | Collapsible groups, expand/collapse all |
| **VirtualTable** | Sortable, resizable, fixed columns, pinned rows |
| **VirtualGrid** | Auto-column responsive grid |
| **VirtualTree** | Nested hierarchy, lazy child loading |
| **InfiniteLoader** | Bidirectional infinite scroll |
| **VirtualSelect** | Virtualized searchable dropdown |
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
| `estimatedItemSize` | `number \| (item, index) => number` | `50` | Initial height estimate per row |
| `overscan` | `number` | `3` | Extra rows rendered above/below viewport |
| `minHeight` | `number` | `0` | Minimum total list height in px |
| `scrollElement` | `HTMLElement \| null` | `null` | External scroll container (mutually exclusive with `pageMode`) |
| `pageMode` | `boolean` | `false` | Use `window` as the scroll container |
| `isLoading` | `boolean` | `false` | Shows the `#skeleton` slot when `items` is empty |
| `restoreKey` | `string` | — | Key used to save/restore scroll position in `sessionStorage` |
| `ssrPreloadCount` | `number` | `20` | Number of rows rendered on the server |
| `recyclePool` | `boolean` | `false` | Reuse DOM nodes instead of unmounting them (better scroll FPS, disables key-based transitions) |

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
listRef.value?.scrollToOffset(px)         // scroll to a pixel offset
listRef.value?.measureItem(index, height) // manually set a row height
```

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

A virtual table built on top of `VirtualList`. Features a sticky header, fixed left/right columns, single/multi-column sort, optional drag-to-resize column borders, horizontal column virtualization, and pinned top/bottom rows.

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `columns` | `ColumnDef[]` | — | Column definitions |
| `rows` | `T[]` | — | Data rows |
| `rowHeight` | `number \| 'auto'` | `'auto'` | Fixed row height, or `'auto'` for measured heights |
| `estimatedItemSize` | `number` | `40` | Estimated row height when `rowHeight` is `'auto'` |
| `stickyHeader` | `boolean` | `true` | Pin the header to the top |
| `stickyHeaderOffset` | `number` | `0` | Top offset for the sticky header (use when a navbar sits above) |
| `sortable` | `boolean` | `false` | Enable single-column sort on header click |
| `multiSort` | `boolean` | `false` | Enable Shift+click multi-column sort |
| `virtualizeColumns` | `boolean` | `false` | Render only horizontally visible columns (for 50+ columns) |
| `resizableColumns` | `boolean` | `false` | Allow drag-to-resize column borders |
| `pinnedTopRows` | `T[]` | `[]` | Rows pinned above the virtual body |
| `pinnedBottomRows` | `T[]` | `[]` | Rows pinned below the virtual body |
| `overscan` | `number` | `3` | Extra rows rendered outside the viewport |
| `keyField` | `string` | `'id'` | Row key field |
| `onLoadMore` | `() => void` | — | Called when user scrolls near the bottom and `hasMore` is `true` |
| `hasMore` | `boolean` | `false` | Whether more rows are available to load |
| `isLoading` | `boolean` | `false` | Whether a load is in progress (prevents duplicate calls) |
| `loadMoreThreshold` | `number` | `150` | Distance from the bottom edge in px that triggers `onLoadMore` |

### `ColumnDef`

```ts
interface ColumnDef {
  key: string          // matches the row object property
  title: string        // header label
  width?: number       // fixed column width in px
  minWidth?: number    // minimum width (also used as fallback)
  fixed?: 'left' | 'right'  // sticky fixed column
}
```

### Slots

| Slot | Scope | Description |
|---|---|---|
| `#header-cell` | `{ column: ColumnDef }` | Custom header cell |
| `#row` | `{ row: T, index: number }` | Replace entire row rendering |
| `#cell` | `{ row: T, column: ColumnDef, value: unknown }` | Custom cell content |
| `#pinned-row` | `{ row: T, index: number, position: 'top' \| 'bottom' }` | Custom pinned row |
| `#pinned-cell` | `{ row: T, column: ColumnDef, value: unknown, position }` | Custom pinned cell |
| `#loading-indicator` | — | Shown at the bottom when `isLoading && hasMore` |

### Emits

| Event | Payload | Description |
|---|---|---|
| `sort-change` | `SortChange \| SortChange[]` | Single sort object, or array for multi-sort |
| `column-resize` | `[key: string, width: number]` | Fires after a column is resized |
| `scroll` | `Event` | Native scroll event |
| `visible-range-change` | `{ start: number; end: number }` | Visible row range |

### `SortChange`

```ts
interface SortChange {
  key: string
  direction: 'asc' | 'desc' | null
}
```

### Exposed API

```ts
const tableRef = ref<{ scrollTo: ...; clearSort: () => void; getSortStack: () => SortChange[] } | null>(null)

tableRef.value?.scrollTo(rowIndex, 'start')
tableRef.value?.clearSort()
tableRef.value?.getSortStack()   // current sort state
```

### Example

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { VirtualTable } from 'vue-virtual-scroller-kit'
import type { ColumnDef, SortChange } from 'vue-virtual-scroller-kit'

interface User { id: number; name: string; email: string; age: number }

const columns: ColumnDef[] = [
  { key: 'id',    title: '#',     width: 60, fixed: 'left' },
  { key: 'name',  title: 'Name',  width: 180 },
  { key: 'email', title: 'Email', minWidth: 200 },
  { key: 'age',   title: 'Age',   width: 80 },
]

const rows = ref<User[]>([
  { id: 1, name: 'Alice', email: 'alice@example.com', age: 28 },
  // …
])

function onSort(sort: SortChange | SortChange[]) {
  const s = Array.isArray(sort) ? sort[0] : sort
  if (!s.direction) {
    rows.value = [...originalRows]
    return
  }
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

**Lazy loading (infinite scroll in table):**

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import { VirtualTable } from 'vue-virtual-scroller-kit'
import type { ColumnDef, SortChange } from 'vue-virtual-scroller-kit'

interface Row { id: number; name: string; email: string }

const columns: ColumnDef[] = [
  { key: 'id',    title: '#',     width: 60 },
  { key: 'name',  title: 'Name',  width: 200 },
  { key: 'email', title: 'Email', minWidth: 160 },
  { key: '__actions', title: '', width: 80, fixed: 'right' },
]

const rows = ref<Row[]>([])
const total = ref(0)
const isLoading = ref(false)
const hasMore = computed(() => rows.value.length < total.value)

async function loadRows(page = 1, replace = false) {
  if (isLoading.value) return
  isLoading.value = true
  try {
    const res = await fetch(`/api/rows?page=${page}&limit=100`)
    const data = await res.json()
    rows.value = replace ? data.rows : [...rows.value, ...data.rows]
    total.value = data.total
  } finally {
    isLoading.value = false
  }
}

async function onSort(sort: SortChange | SortChange[]) {
  // reset and reload with new sort
  rows.value = []
  await loadRows(1, true)
}

loadRows()
</script>

<template>
  <VirtualTable
    :columns="columns"
    :rows="rows"
    key-field="id"
    sortable
    resizable-columns
    :on-load-more="() => loadRows(Math.floor(rows.length / 100) + 1)"
    :has-more="hasMore"
    :is-loading="isLoading"
    :load-more-threshold="200"
    style="height: 600px"
    @sort-change="onSort"
  >
    <template #cell="{ row, column }">
      <template v-if="column.key === '__actions'">
        <button @click="edit(row)">✏</button>
        <button @click="remove(row)">✕</button>
      </template>
      <span v-else>{{ row[column.key] }}</span>
    </template>
    <template #loading-indicator>
      <div style="padding: 12px; text-align: center; opacity: 0.5">Loading…</div>
    </template>
  </VirtualTable>
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
| `rowHeight` | `number` | `200` | Fixed cell height in px |
| `gap` | `number` | `8` | Gap between cells in px |
| `keyField` | `string` | `'id'` | Key field |
| `overscan` | `number` | `2` | Extra rows outside the viewport |
| `isLoading` | `boolean` | `false` | Shows skeleton when `items` is empty |

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
loaderRef.value?.scrollToOffset(px)
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
| `#empty` | — | Shown when `filteredOptions` is empty |

### Exposed API

```ts
selectRef.value?.open()
selectRef.value?.close()
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
| `pageMode` | `boolean` | `false` | Use `window` as the scroll container |

```ts
type SizeProvider = number | ((index: number) => number)
```

### Return value

| Property | Type | Description |
|---|---|---|
| `visibleRange` | `Readonly<Ref<VisibleRange>>` | `{ start, end }` — first and last visible item indices |
| `totalHeight` | `Readonly<Ref<number>>` | Total scrollable height in px |
| `offsetTop` | `(index: number) => number` | Pixel offset of item at index |
| `scrollTo` | `(index, align?) => void` | Scroll to item (`'start' \| 'center' \| 'end' \| 'auto'`) |
| `scrollToOffset` | `(offset: number) => void` | Scroll to a raw pixel offset |
| `measureItem` | `(index, height) => void` | Report a measured row height |
| `handleScroll` | `() => void` | Manually trigger a visible-range recalculation |

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

Components that use browser-only APIs (`ResizeObserver`, `requestAnimationFrame`, `window.scroll`) guard those APIs with `typeof window !== 'undefined'` and `onMounted`. All core logic and slot rendering is SSR-safe.

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
│
├── VirtualList
│     scrollElement / pageMode / window scroll
│     ResizeObserver per visible row (dynamic heights)
│     Scroll restoration via sessionStorage
│     DOM recycling pool (recyclePool prop)
│
├── GroupedVirtualList
│     Flattens GroupDef[] → VirtualRow[] (headers + items)
│     Animated collapse/expand state machine per group
│     Backed by VirtualList
│
├── VirtualTable
│     Sticky header, fixed columns, sort, resize, column virtualization
│     Pinned top/bottom rows, built-in lazy loading (onLoadMore / hasMore / isLoading)
│     Backed by VirtualList
│
├── VirtualGrid
│     Auto-column count from container width (ResizeObserver)
│     rowHeightWithGap fed as Ref to useVirtualScroll
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
│     Client-side filter, keyboard nav, open/close lifecycle
│     Backed by VirtualList
│
├── useVirtualKeyboardNav
│     Standalone composable — keydown on target or document
│
└── useDraggableList
      Pointer events (no HTML5 Drag API)
      Ghost element via fixed positioning + Teleport
      Gap animation via translateY on neighbours
      Auto-scroll RAF loop when near scroll container edges
```

---

## Bundle size & peer dependencies

| Entry point | Peer deps | Notes |
|---|---|---|
| `vue-virtual-scroller-kit` | `vue ^3.3` | Full bundle — all components and composables |

The package ships as tree-shakeable ESM (`dist/index.js`) + CJS (`dist/index.cjs`) dual build. Importing only `VirtualList` and leaving `VirtualTable`, `VirtualTree`, etc. unused results in those modules being dropped by your bundler.

---

## License

MIT

---

## Author

Danil Lisin Vladimirovich aka Macrulez

GitHub: [macrulezru](https://github.com/macrulezru) · Website: [macrulez.ru/en](https://macrulez.ru/en)

Questions and bugs — [issues](https://github.com/macrulezru/vue-virtual-scroller-kit/issues)
