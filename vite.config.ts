import { defineConfig } from 'vite';
import type { UserConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig(({ command }: { command: 'build' | 'serve' }) => {
  const config: UserConfig = {
    plugins:
      command === 'build'
        ? [
            dts({
              outDirs: ['dist'],
              include: ['src'],
              insertTypesEntry: true,
              entryRoot: 'src',
            }),
          ]
        : [],
    esbuild: {
      drop: command === 'build' ? ['console', 'debugger'] : [],
    },
    build: {
      lib: {
        entry: 'src/main.ts',
        name: 'ClickTone',
        formats: ['es', 'cjs', 'umd'],
        fileName: (format) => {
          if (format === 'umd') return 'index.umd.js';
          if (format === 'cjs') return 'index.cjs.js';
          return 'index.es.js';
        },
      },
      emptyOutDir: true,
      sourcemap: true,
      minify: 'esbuild',
      rollupOptions: {
        output: {
          assetFileNames: 'index.[ext]',
        },
      },
    },
  };

  return config;
});
