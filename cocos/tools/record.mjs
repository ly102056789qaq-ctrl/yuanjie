// 录屏：node record.mjs <url> <输出目录> <秒数>
import { chromium } from 'playwright';
const [url, dir, secs] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 1920, height: 1150 }, recordVideo: { dir, size: { width: 1920, height: 1150 } } });
const p = await ctx.newPage();
await p.goto(url, { waitUntil: 'networkidle' });
try { await p.getByText('Show FPS', { exact: true }).first().click(); } catch {}
await p.waitForTimeout(+secs * 1000);
const v = p.video();
await ctx.close(); await b.close();
console.log(await v.path());
