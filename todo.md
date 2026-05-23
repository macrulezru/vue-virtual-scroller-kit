# vue-virtual-scroller-kit — Feature Roadmap

## Core enhancements

- [x] `estimatedItemSize` as function `(item, index) => number` — smarter initial layout
- [x] Scroll restoration (`restoreKey` prop) — saves/restores scroll position via sessionStorage
- [x] Page-mode scrolling (`pageMode` prop) — use `window` as scroll container
- [x] Skeleton rows slot (`#skeleton`) — placeholder while content loads

## VirtualTable improvements

- [x] Multi-column sort — Shift+click adds secondary sort key
- [x] Pinned / frozen rows — sticky top & bottom rows outside virtual list
- [x] Horizontal column virtualization — render only visible columns (for 50+ cols)
- [x] Column resizing — drag column border to resize

## New composables

- [x] `useVirtualKeyboardNav` — ArrowUp/Down/Home/End/Enter navigation + a11y
- [x] `useDraggableList` — pointer-events drag-to-reorder rows

## New components

- [x] `VirtualTree` — hierarchical tree with lazy-loaded children
- [x] `VirtualGrid` — fixed-cell 2-D grid (photo gallery, dashboards)
- [x] `VirtualSelect` — virtualized `<select>` dropdown for 10k+ options

## Performance

- [x] DOM node recycling / pooling — reuse row elements instead of unmount

## Housekeeping

- [x] Export all new public APIs from `src/index.ts`
- [x] Add tests for new features
- [x] Update demo app with new components
