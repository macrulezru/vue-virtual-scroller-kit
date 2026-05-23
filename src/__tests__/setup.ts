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
})

afterEach(() => {
  vi.clearAllTimers()
  vi.clearAllMocks()
})
