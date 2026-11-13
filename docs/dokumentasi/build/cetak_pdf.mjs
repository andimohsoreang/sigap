import { chromium } from '/Users/andimohamad/Documents/WORK/SIDE DISH/PengaduanKementrans/pengaduankmntrans/sigap-repo/sigap/node_modules/playwright/index.mjs';
import { pathToFileURL, fileURLToPath } from 'node:url';
const here = fileURLToPath(new URL('.', import.meta.url));
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage();
await p.goto(pathToFileURL(here + 'SIGAP-Dokumentasi-Fitur.html').href, { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);
await p.pdf({
  path: here + '../SIGAP-Dokumentasi-Fitur.pdf',
  format: 'A4',
  printBackground: true,
  preferCSSPageSize: true,
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate: '<div style="width:100%;font-family:Arial,sans-serif;font-size:7.5pt;color:#667382;padding:0 18mm;display:flex;justify-content:space-between"><span>SIGAP · Dokumentasi Fitur &amp; Use Case</span><span>Halaman <span class="pageNumber"></span> dari <span class="totalPages"></span></span></div>',
});
await b.close();
console.log('PDF selesai');
