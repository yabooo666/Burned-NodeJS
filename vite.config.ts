import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteSingleFile } from 'vite-plugin-singlefile'
import path from 'node:path'

export default defineConfig({
  plugins: [vue(), viteSingleFile()],
  build: {
    outDir: 'dist-ui',
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100000000 // Inlines all assets like logo.png as base64
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
