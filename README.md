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
