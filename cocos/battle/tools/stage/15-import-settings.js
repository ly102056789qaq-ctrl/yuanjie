// 导入设置：角色、敌人图片用 sprite-frame，开 mipmap + 三线性过滤（缩小时不发虚、不闪），边缘夹取。
// 同时把设计分辨率设为 1920×1080。
await Editor.Message.request('asset-db', 'refresh-asset', 'db://assets');
const dirs = ['db://assets/art/actors', 'db://assets/art/enemies', 'db://assets/art/fx/seq', 'db://assets/art/cg', 'db://assets/art/fx/white.png'];
let changed = 0;
for (const d of dirs) {
  const list = await Editor.Message.request('asset-db', 'query-assets', { pattern: d.endsWith('.png') ? d : d + '/**/*', ccType: 'cc.ImageAsset' });
  for (const a of list) {
    const meta = await Editor.Message.request('asset-db', 'query-asset-meta', a.uuid);
    const want = (m) => {
      let dirty = false;
      if (m.userData.type !== 'sprite-frame') { m.userData.type = 'sprite-frame'; dirty = true; }
      for (const k of Object.keys(m.subMetas)) {
        const u = m.subMetas[k].userData;
        if (!u || m.subMetas[k].importer !== 'texture') continue;
        const target = { wrapModeS: 'clamp-to-edge', wrapModeT: 'clamp-to-edge', minfilter: 'linear', magfilter: 'linear', mipfilter: 'linear' };
        for (const [kk, vv] of Object.entries(target)) if (u[kk] !== vv) { u[kk] = vv; dirty = true; }
      }
      return dirty;
    };
    if (!want(meta)) continue;
    await Editor.Message.request('asset-db', 'save-asset-meta', a.uuid, JSON.stringify(meta));
    await Editor.Message.request('asset-db', 'reimport-asset', a.uuid);
    // 改成 sprite-frame 后会多出纹理子资源，再检查一遍过滤设置
    const meta2 = await Editor.Message.request('asset-db', 'query-asset-meta', a.uuid);
    if (want(meta2)) {
      await Editor.Message.request('asset-db', 'save-asset-meta', a.uuid, JSON.stringify(meta2));
      await Editor.Message.request('asset-db', 'reimport-asset', a.uuid);
    }
    changed++;
  }
}
let res = null;
try {
  await Editor.Message.request('project', 'set-config', 'project', 'general.designResolution', { width: 1920, height: 1080, fitWidth: true, fitHeight: false });
  res = await Editor.Message.request('project', 'query-config', 'project', 'general.designResolution');
} catch (e) { res = String(e); }
return { changed, designResolution: res };
