export interface ColumnDef {
  key: string
  title: string
  width?: number
  minWidth?: number
  maxWidth?: number
  fixed?: 'left' | 'right'
}

export interface GroupDef<T = unknown> {
  key: string
  label: string
  items: T[]
  collapsed?: boolean
}

export type ScrollAlign = 'start' | 'center' | 'end' | 'auto'

export interface ScrollToOptions {
  index: number
  align?: ScrollAlign
}

/** Options for `scrollTo` / `scrollToOffset` on VirtualList and friends. */
export interface ScrollBehaviorOptions {
  /** 'smooth' animates via the browser's native smooth-scroll; 'auto' jumps instantly (default). */
  behavior?: ScrollBehavior
}

export interface VisibleRange {
  start: number
  end: number
}

export type VirtualRowType = 'header' | 'item'

export interface VirtualRow<T = unknown> {
  type: VirtualRowType
  index: number
  item?: T
  groupKey?: string
  groupLabel?: string
  /**
   * Stable key for the underlying VirtualList's own `key-field` — GroupedVirtualList
   * populates this (header vs. item, group-scoped, falling back to `index`) since
   * VirtualList's default key-field lookup can't unwrap `item`/distinguish row types
   * on its own.
   */
  _key?: string
}

export interface SortChange {
  key: string
  direction: 'asc' | 'desc' | null
}

/** Exposed API of VirtualList component (use instead of InstanceType for generic components) */
export interface VirtualListExpose {
  scrollTo: (
    index: number,
    align?: 'start' | 'center' | 'end' | 'auto',
    options?: ScrollBehaviorOptions,
  ) => void
  scrollToOffset: (offset: number, options?: ScrollBehaviorOptions) => void
  measureItem: (index: number, height: number) => void
  /** Returns the element that actually scrolls (for pairing with VirtualScrollbar). */
  getScrollElement: () => HTMLElement | null
}

/** Exposed API of GroupedVirtualList component */
export interface GroupedVirtualListExpose {
  toggle: (groupKey: string) => void
  scrollTo: (
    index: number,
    align?: 'start' | 'center' | 'end' | 'auto',
    options?: ScrollBehaviorOptions,
  ) => void
  getScrollElement: () => HTMLElement | null
}
