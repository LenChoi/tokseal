import { defineConfig } from 'tsup';

// Ship the CLI as one self-contained file: @tokseal/core and picocolors are
// inlined so `npx tokseal` has zero runtime dependencies and never breaks on
// a missing scoped package.
export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm'],
  platform: 'node',
  target: 'node18',
  outDir: 'dist',
  clean: true,
  minify: false,
  sourcemap: false,
  noExternal: ['@tokseal/core', 'picocolors'],
});
