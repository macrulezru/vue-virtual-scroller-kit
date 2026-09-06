# **Virtual Scroller Kit**

![Virtual Scroller Kit](https://github.com/macrulezru/assets/blob/master/packages-images/vue-virtual-scroller-kit.png?raw=true)

Virtual list, table, grid, tree, and select for Vue 3. Dynamic row heights measured by `ResizeObserver`, grouping with animated expand/collapse, sticky headers, infinite scroll, keyboard navigation, drag-to-reorder, RTL support, and full SSR support — all with a single peer dependency (Vue 3).

---

## Features

- **Dynamic row heights** — `ResizeObserver` measures each row after render; position manager updates in O(log n)
- **VirtualList** — flat list, external scroll container, page-mode (window scroll), DOM recycling pool, scroll restoration, opt-in `horizontal` layout
- **GroupedVirtualList** — collapsible sections with smooth expand/collapse CSS animation, opt-in sticky group-header overlay
- **VirtualTable** — native `<table>` with spacer-row virtual scroll, sticky header, fixed left/right columns, single and multi-column sort, drag-to-resize _and_ drag-to-reorder columns, column show/hide, column virtualization, pinned top/bottom rows, built-in lazy loading
- **VirtualGrid** — fixed-height cells in a responsive auto-column or fixed-column grid, or opt-in per-row dynamic height
- **VirtualTree** — hierarchical expand/collapse with lazy child loading, configurable indent
- **InfiniteLoader** — trigger `onLoadMore` near the bottom, top, or both ends; scroll-position preservation when prepending
- **VirtualSelect** — virtualized dropdown with client-side or async/remote search (debounced, with a loading slot) and keyboard navigation
- **VirtualScrollbar** — themable custom scrollbar overlay that syncs with any of the components above (or any scrollable element)
- **Smooth programmatic scrolling** — `scrollTo`/`scrollToOffset` accept `{ behavior: 'smooth' }`, using the browser's native smooth-scroll
- **Motion blur** — opt-in `motionBlur` prop applies a velocity-scaled CSS blur while scrolling fast, clearing once scrolling settles
- **Anchor-compensated reflow** — when a row above the viewport is measured to a different height, scroll position is adjusted by the same delta so visible content never jumps
- **RTL support** — CSS logical properties throughout, plus `scrollLeft` normalization for column virtualization, horizontal `VirtualList`, and the scrollbar
- **useVirtualScroll** — raw composable for custom containers; returns `visibleRange`, `totalHeight`, `scrollTo`; supports a `horizontal` axis
- **useVirtualKeyboardNav** — arrow keys, Home/End, PageUp/PageDown, Enter/Space; plugs into any virtual list
- **useDraggableList** — pointer-event drag-to-reorder with animated gap, ghost element, auto-scroll, disabled-item support
- **useRowSelection** — dataset-agnostic click/Shift-click row selection (single or multi), pairs with `VirtualList` or `VirtualTable`
- **useVisibilityTracker** — per-key enter/leave-viewport events backed by a real `IntersectionObserver`
- **PositionManager** — segment tree (O(log n) updates and prefix-sum queries) exposed for advanced use
- **autoColWidths** — estimates column widths from a data sample via Canvas `measureText`; SSR-safe fallback
- **SSR-safe** — first N rows rendered on the server, hydration without layout shift
- **Zero external dependencies** — only Vue 3 as peer dep
- **Tree-shakeable ESM + CJS** dual build

---

## When you'd reach for this

A plain v-for creates one DOM node per array item, so the difference between 50 rows and 50,000 becomes the difference between "just works" and "the tab hangs the browser" — vue-virtual-scroller-kit keeps only what's actually visible in the DOM.

- **A data table grows faster than the screen can show it** — Thousands of rows, multi-column sorting, pinned rows, and infinite loading as you scroll — only the visible slice ever gets rendered, not the whole table at once.
- **A long list is split into collapsible sections** — Product categories, calendar days, notification groups — both the groups and their contents stay virtualized, and the current section's header stays in view as you scroll through it.
- **Items need to be reordered by dragging** — A playlist, a kanban column, a prioritized task list — items can be dragged and reordered with animated neighbor offsets and auto-scroll, even when only a fraction of the whole list is on screen.
- **A dropdown searches a huge reference list** — A list of countries, tickers, or users running into the thousands — the dropdown itself stays fast through virtualization, and search with on-demand loading replaces rendering every option at once.

---

## Installation

Requires Vue `3.3+`. No other runtime dependencies — the package has zero dependencies of its own.

```bash
npm install vue-virtual-scroller-kit
```

Peer dependency:

```bash
npm install vue@>=3.3
```

### Quick start

```vue
<script setup lang="ts">
import { VirtualList } from 'vue-virtual-scroller-kit'

interface Row {
  id: number
  text: string
}

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

### More examples

#### Groups with sticky headers and collapsing

`GroupedVirtualList` virtualizes a list inside collapsible sections — the current group's header stays pinned at the top, and `toggle()` expands or collapses any group programmatically.

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { GroupedVirtualList } from 'vue-virtual-scroller-kit'
import type { GroupDef, GroupedVirtualListExpose } from 'vue-virtual-scroller-kit'

interface Contact {
  id: number
  name: string
  email: string
}

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
</script>

<template>
  <GroupedVirtualList
    ref="listRef"
    :groups="groups"
    :estimated-item-size="56"
    sticky-group-headers
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

#### Drag-to-reorder without a single external library

`useDraggableList` tracks the ghost element under the cursor, animates neighboring rows out of the way, and auto-scrolls the container near its edges — you just spread `getItemProps` across the markup.

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useDraggableList } from 'vue-virtual-scroller-kit'

interface Card {
  id: number
  label: string
}

const cards = ref<Card[]>(Array.from({ length: 50 }, (_, i) => ({ id: i, label: `Card ${i + 1}` })))
const listRef = ref<HTMLElement | null>(null)

const { isDragging, dragIndex, ghostStyle, getItemStyle, getItemProps } = useDraggableList({
  items: cards,
  scrollContainer: listRef,
  onReorder: (newItems) => {
    cards.value = newItems
  },
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
    <div v-if="isDragging && dragIndex >= 0" class="card card--ghost" :style="ghostStyle">
      ⣿ {{ cards[dragIndex]?.label }}
    </div>
  </Teleport>
</template>
```

---

## Documentation & links

- 📖 **Full documentation:** [npm.vuecraft.ru/en/packages/vue-virtual-scroller-kit](https://npm.vuecraft.ru/en/packages/vue-virtual-scroller-kit/guide/overview.html)
- 🌐 **VueCraft:** [vuecraft.ru/en](https://vuecraft.ru/en)
- 👤 **Author:** [macrulez.ru/en](https://macrulez.ru/en)
- 💻 **GitHub:** [macrulezru/vue-virtual-scroller-kit](https://github.com/macrulezru/vue-virtual-scroller-kit)
- 📦 **NPM:** [vue-virtual-scroller-kit](https://www.npmjs.com/package/vue-virtual-scroller-kit)
- 🐛 **Issues:** [github.com/macrulezru/vue-virtual-scroller-kit/issues](https://github.com/macrulezru/vue-virtual-scroller-kit/issues)

---

## License

MIT

---

## 💖 Support the project

Open source takes time and effort. If this library saves you time or brings value, consider supporting further development.

<a href="https://donate.cryptocloud.plus/M6O34NIN" target="_blank">
  <img src="https://img.shields.io/badge/Donate-CryptoCloud-8A2BE2?style=for-the-badge&logo=cryptocurrency&logoColor=white" alt="Donate via CryptoCloud">
</a>

Thank you for being part of this journey. ❤️
