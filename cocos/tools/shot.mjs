import { chromium } from 'playwright';
const [url, out, w = 1920, h = 1080, wait = 6000] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('[console]', m.type(), m.text()); });
p.on('pageerror', e => console.log('[pageerror]', e.message));
await p.goto(url, { waitUntil: 'networkidle' });
if (process.env.CLICK) { await p.getByText(process.env.CLICK, { exact: true }).first().click(); await p.waitForTimeout(500); }
if (process.env.CSS) await p.addStyleTag({ content: process.env.CSS });
await p.waitForTimeout(+wait);
if (process.env.SEL) await p.locator(process.env.SEL).first().screenshot({ path: out }); else await p.screenshot({ path: out });
await b.close();
