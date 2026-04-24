import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import postcss from 'rollup-plugin-postcss';
import vue from 'rollup-plugin-vue';
import replace from '@rollup/plugin-replace';
import 'dotenv/config';

export default {
  input: 'src/index.js',
  output: {
    file: 'dist/bundle.js',
    format: 'iife',
    globals: { vue: 'Vue' },
  },
  plugins: [
    replace({
      preventAssignment: true,
      '__FORUM_SHARED_SECRET__': JSON.stringify(process.env.FORUM_SHARED_SECRET),
    }),
    vue(),
    resolve({ browser: true }),
    commonjs(),
    postcss({
      extract: 'dist/bundle.css',
      minimize: false,
    }),
  ],
};
