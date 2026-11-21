'use strict';
/* 开发期桥：轮询 cmd/*.json，每个文件是 { steps: [...] }，按顺序执行，结果写入 out/<同名>.json。
   step 形式：
     { "msg": ["scene", "query-node-tree"] , "args": [...] }   → Editor.Message.request(频道, 消息, ...args)
     { "script": "方法名", "args": [...] }                     → 调用 scene.js 里的方法（运行在场景进程，可直接用 cc） */
const fs = require('fs');
const path = require('path');

const CMD = path.join(__dirname, 'cmd');
const OUT = path.join(__dirname, 'out');
let timer = null;
let busy = false;

async function runFile(file) {
  const src = path.join(CMD, file);
  let job;
  try { job = JSON.parse(fs.readFileSync(src, 'utf8')); } catch (e) { return; }
  fs.unlinkSync(src);
  const results = [];
  for (const step of job.steps || []) {
    try {
      let r;
      if (step.msg) r = await Editor.Message.request(step.msg[0], step.msg[1], ...(step.args || []));
      else if (step.script) r = await Editor.Message.request('scene', 'execute-scene-script', { name: 'yj-bridge', method: step.script, args: step.args || [] });
      results.push({ ok: true, result: r === undefined ? null : r });
    } catch (e) {
      results.push({ ok: false, error: String(e && e.stack || e) });
      if (!step.continueOnError) break;
    }
  }
  fs.writeFileSync(path.join(OUT, file), JSON.stringify(results, null, 2));
}

async function poll() {
  if (busy) return;
  busy = true;
  try {
    const files = fs.readdirSync(CMD).filter(f => f.endsWith('.json')).sort();
    for (const f of files) await runFile(f);
  } catch (e) { /* 目录暂时不可读时跳过 */ }
  busy = false;
}

exports.methods = {};
exports.load = function () {
  fs.mkdirSync(CMD, { recursive: true });
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, '_ready.json'), JSON.stringify({ loadedAt: new Date().toISOString() }));
  timer = setInterval(poll, 400);
};
exports.unload = function () { if (timer) clearInterval(timer); };
