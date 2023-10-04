import typescript from '@rollup/plugin-typescript';
import image from '@rollup/plugin-image';
import serve from 'rollup-plugin-serve';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import fs from 'fs';

const showAddress = () => ({
  load: () => console.log('\x1b[35m%s\x1b[0m', `Current registry address: http://localhost:3001/dapplet.json`),
});

export default [
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'lib/index.js',
        format: 'cjs',
        exports: 'named',
      },
    ],
    plugins: [
      typescript(),
      json(),
      resolve({ browser: true }),
      commonjs(),
      image(),
      serve({
        port: 3001,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      }),
      showAddress(),
    ],
  },
];
