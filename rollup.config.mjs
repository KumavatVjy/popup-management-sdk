import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';

export default [
  // 1. ESM distribution for modern applications and bundlers (Vite, Webpack, Rollup)
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/popup-manager.esm.js',
      format: 'esm',
      sourcemap: true,
    },
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
      }),
    ],
  },
  // 2. Minified IIFE distribution for direct browser <script> inclusion
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/popup-manager.min.js',
      format: 'iife',
      name: 'PopupManager',
      exports: 'named',
      sourcemap: true,
    },
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
      }),
      terser({
        format: {
          comments: false,
        },
      }),
    ],
  },
];
