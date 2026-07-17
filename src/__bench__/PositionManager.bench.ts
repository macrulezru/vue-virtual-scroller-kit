import { bench, describe } from 'vitest'
import { PositionManager } from '../core/PositionManager'

const SIZES = [1_000, 10_000, 100_000]

for (const n of SIZES) {
  describe(`PositionManager (n=${n})`, () => {
    bench('construct (fixed height)', () => {
      new PositionManager(n, 50)
    })

    bench('construct (variable height fn)', () => {
      new PositionManager(n, (i) => 40 + (i % 5) * 10)
    })

    const manager = new PositionManager(n, 50)
    bench('findIndex (random offsets)', () => {
      const offset = Math.random() * manager.totalSize
      manager.findIndex(offset)
    })

    bench('set (random index resize)', () => {
      const index = Math.floor(Math.random() * n)
      manager.set(index, 40 + Math.random() * 40)
    })

    bench('getOffset (random index)', () => {
      const index = Math.floor(Math.random() * n)
      manager.getOffset(index)
    })
  })
}
