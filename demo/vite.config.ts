import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      // Use source directly for hot-reload during development
      'vue-virtual-scroller-kit': resolve(__dirname, '../src/index.ts'),
    },
    dedupe: ['vue'],
  },
})
