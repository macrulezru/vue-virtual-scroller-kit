/**
 * Segment Tree for O(log n) prefix-sum queries and updates.
 * Stores row heights; supports getOffset(i) = sum of heights[0..i-1]
 * and findIndex(offset) = first row whose cumulative height exceeds offset.
 */

export type SizeProvider = number | ((index: number) => number)

export class PositionManager {
  private readonly size: number
  private readonly tree: Float64Array
  private readonly heights: Float64Array
  private readonly estimatedSize: number

  constructor(count: number, estimatedItemSize: SizeProvider = 50) {
    this.size = count
    this.estimatedSize = typeof estimatedItemSize === 'number' ? estimatedItemSize : 50
    const n = nextPow2(count)
    this.tree = new Float64Array(2 * n)
    this.heights = new Float64Array(count)

    if (typeof estimatedItemSize === 'function') {
      for (let i = 0; i < count; i++) this.heights[i] = estimatedItemSize(i)
    } else {
      this.heights.fill(estimatedItemSize)
    }

    this.buildTree(n)
  }

  private buildTree(n: number): void {
    for (let i = 0; i < this.size; i++) {
      this.tree[n + i] = this.heights[i]
    }
    for (let i = n - 1; i >= 1; i--) {
      this.tree[i] = this.tree[2 * i] + this.tree[2 * i + 1]
    }
  }

  get totalSize(): number {
    return this.tree[1]
  }

  /** Update height of row at index. O(log n). */
  set(index: number, height: number): void {
    if (index < 0 || index >= this.size) return
    const n = nextPow2(this.size)
    const delta = height - this.heights[index]
    if (delta === 0) return
    this.heights[index] = height
    let pos = n + index
    this.tree[pos] += delta
    pos >>= 1
    while (pos >= 1) {
      this.tree[pos] = this.tree[2 * pos] + this.tree[2 * pos + 1]
      pos >>= 1
    }
  }

  /** Get cumulative height before row at index. O(log n). */
  getOffset(index: number): number {
    if (index <= 0) return 0
    if (index >= this.size) return this.totalSize
    return this.prefixSum(index)
  }

  /** Height of row at index. */
  getHeight(index: number): number {
    return this.heights[index] ?? this.estimatedSize
  }

  /**
   * Find the first row whose cumulative offset >= the given offset.
   * Binary search on segment tree. O(log n).
   */
  findIndex(offset: number): number {
    if (offset <= 0) return 0
    if (offset >= this.totalSize) return this.size - 1

    const n = nextPow2(this.size)
    let node = 1
    let remaining = offset

    while (node < n) {
      const left = 2 * node
      if (remaining < this.tree[left]) {
        node = left
      } else {
        remaining -= this.tree[left]
        node = left + 1
      }
    }
    return Math.min(node - n, this.size - 1)
  }

  private prefixSum(index: number): number {
    const n = nextPow2(this.size)
    let sum = 0
    let lo = n
    let hi = n + index - 1
    while (lo <= hi) {
      if (lo & 1) sum += this.tree[lo++]
      if (!(hi & 1)) sum += this.tree[hi--]
      lo >>= 1
      hi >>= 1
    }
    return sum
  }
}

function nextPow2(n: number): number {
  let p = 1
  while (p < n) p <<= 1
  return p
}
