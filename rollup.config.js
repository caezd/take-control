import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import postcss from 'rollup-plugin-postcss';
import vue from 'rollup-plugin-vue';

export default {
  input: 'src/index.js',
  output: {
    file: 'dist/bundle.js',
    format: 'iife',
    globals: { vue: 'Vue' },
  },
  plugins: [
    vue(),
    resolve({ browser: true }),
    commonjs(),
    postcss({
      extract: 'dist/bundle.css',
      minimize: false,
    }),
  ],
};
