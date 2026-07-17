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

export interface VirtualScrollOptions {
  itemCount: number | { value: number }
  estimatedItemSize?: number
  overscan?: number
  getScrollElement: () => HTMLElement | null
}

export interface UseVirtualScrollReturn {
  visibleRange: { readonly value: VisibleRange }
  totalHeight: { readonly value: number }
  offsetTop: (index: number) => number
  scrollTo: (index: number, align?: ScrollAlign) => void
  scrollToOffset: (offset: number) => void
  measureItem: (index: number, height: number) => void
}

export type VirtualRowType = 'header' | 'item'

export interface VirtualRow<T = unknown> {
  type: VirtualRowType
  index: number
  item?: T
  groupKey?: string
  groupLabel?: string
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
