import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';

import { jalurWeb, SALINAN } from './scripts/salinan-sigap.mjs';

export default defineConfig([
    ...nextVitals,
    ...nextTs,
    prettier,
    // next/image dilarang (rencana §8.1): <img> biasa dengan atribut yang sama dengan Laravel.
    { rules: { '@next/next/no-img-element': 'off' } },
    // Salinan sigap/resources/js wajib identik dengan Laravel (scripts/salinan-sigap.mjs), jadi saran aturan React
    // Compiler tidak bisa diterapkan di sana; perbaikannya masuk backlog pasca cutover bersama sumber Laravel.
    { files: SALINAN.map(jalurWeb), rules: { 'react-hooks/set-state-in-effect': 'off' } },
    globalIgnores(['.next/**', 'next-env.d.ts', '.cek-css/**', 'dist/**']),
]);
