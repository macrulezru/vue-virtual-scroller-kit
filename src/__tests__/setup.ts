import { vi, beforeEach, afterEach } from 'vitest'

// Mock ResizeObserver (not in jsdom)
class ResizeObserverMock {
  private callback: ResizeObserverCallback
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()

  constructor(cb: ResizeObserverCallback) {
    this.callback = cb
  }

  // Test helper: trigger observation with given size
  trigger(entries: ResizeObserverEntry[]) {
    this.callback(entries, this)
  }
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver

// Mock IntersectionObserver (not in jsdom)
export class IntersectionObserverMock {
  // Test helper: every constructed instance is tracked here so tests can reach into
  // "the observer this composable/component built" without the production code
  // needing to expose it — mirrors how a real IO is opaque to its caller.
  static instances: IntersectionObserverMock[] = []

  root: Element | Document | null
  rootMargin: string
  thresholds: number[]
  private callback: IntersectionObserverCallback
  private observed = new Set<Element>()
  observe = vi.fn((el: Element) => this.observed.add(el))
  unobserve = vi.fn((el: Element) => this.observed.delete(el))
  disconnect = vi.fn(() => this.observed.clear())
  takeRecords = vi.fn(() => [])

  constructor(callback: IntersectionObserverCallback, options: IntersectionObserverInit = {}) {
    this.callback = callback
    this.root = options.root ?? null
    this.rootMargin = options.rootMargin ?? '0px'
    this.thresholds = Array.isArray(options.threshold)
      ? options.threshold
      : [options.threshold ?? 0]
    IntersectionObserverMock.instances.push(this)
  }

  // Test helper: simulate the browser reporting intersection changes for a subset of
  // the currently-observed elements (unobserved elements are ignored, like a real IO).
  trigger(entries: Array<{ target: Element; isIntersecting: boolean }>): void {
    const filtered = entries.filter((e) => this.observed.has(e.target))
    this.callback(filtered as IntersectionObserverEntry[], this as unknown as IntersectionObserver)
  }
}
globalThis.IntersectionObserver = IntersectionObserverMock as unknown as typeof IntersectionObserver

// jsdom doesn't implement Element.scrollTo/scrollBy — polyfill with an instant jump
// (matches jsdom's own no-op window.scrollTo/scrollBy behavior, ignores `behavior`).
if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = function (
    this: HTMLElement,
    arg?: ScrollToOptions | number,
    y?: number,
  ) {
    if (typeof arg === 'object' && arg !== null) {
      if (arg.top !== undefined) this.scrollTop = arg.top
      if (arg.left !== undefined) this.scrollLeft = arg.left
    } else if (typeof arg === 'number') {
      this.scrollLeft = arg
      if (y !== undefined) this.scrollTop = y
    }
  }
}
if (!Element.prototype.scrollBy) {
  Element.prototype.scrollBy = function (
    this: HTMLElement,
    arg?: ScrollToOptions | number,
    y?: number,
  ) {
    if (typeof arg === 'object' && arg !== null) {
      if (arg.top !== undefined) this.scrollTop += arg.top
      if (arg.left !== undefined) this.scrollLeft += arg.left
    } else if (typeof arg === 'number') {
      this.scrollLeft += arg
      if (y !== undefined) this.scrollTop += y
    }
  }
}

// jsdom doesn't implement document.elementsFromPoint (used for pointer-based hit-testing
// during drag interactions). Default to no hits; individual tests override the return value.
if (!document.elementsFromPoint) {
  document.elementsFromPoint = vi.fn(() => [])
}

// Mock requestAnimationFrame / cancelAnimationFrame
let rafCallbacks: Map<number, FrameRequestCallback> = new Map()
let rafId = 0

globalThis.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
  const id = ++rafId
  rafCallbacks.set(id, cb)
  return id
})
globalThis.cancelAnimationFrame = vi.fn((id: number) => {
  rafCallbacks.delete(id)
})

// Flush all pending rAF callbacks
export function flushRAF() {
  const cbs = [...rafCallbacks.values()]
  rafCallbacks.clear()
  cbs.forEach((cb) => cb(performance.now()))
}

beforeEach(() => {
  rafCallbacks = new Map()
  rafId = 0
  IntersectionObserverMock.instances = []
})

afterEach(() => {
  vi.clearAllTimers()
  vi.clearAllMocks()
})
