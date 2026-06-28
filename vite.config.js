import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 4096,
    rollupOptions: {
      output: {
        // Rolldown (Vite 8) requires manualChunks as a function
        manualChunks(id) {
          if (id.includes('node_modules/three'))  return 'three'
          if (id.includes('node_modules/gsap'))   return 'gsap'
        },
      },
    },
  },
})
