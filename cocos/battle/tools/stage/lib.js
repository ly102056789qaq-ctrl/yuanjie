// 场景搭建脚本的公共函数。由 repos/tools/cc.py 拼接在各步骤脚本前，在编辑器场景进程里执行（可用 cc、scene）。
const MESH = {
  plane: '1263d74c-8167-4928-91a6-4e2672411f47@2e76e',
  quad: '1263d74c-8167-4928-91a6-4e2672411f47@fc873',
  cylinder: '1263d74c-8167-4928-91a6-4e2672411f47@8abdc',
  box: '1263d74c-8167-4928-91a6-4e2672411f47@a804a',
  cone: '1263d74c-8167-4928-91a6-4e2672411f47@38fd2',
};
const PROJECT = 'C:/Users/86193/repos/yuanjie/cocos/battle';

async function uuidOf(url) {
  const info = await Editor.Message.request('asset-db', 'query-asset-info', url);
  if (!info) throw new Error('找不到资源 ' + url);
  return info.uuid;
}
function load(uuid) {
  return new Promise((res, rej) => cc.assetManager.loadAny({ uuid }, (err, a) => (err ? rej(err) : res(a))));
}
async function tex(url) { return load((await uuidOf(url)) + '@6c48a'); }
async function sframe(url) { return load((await uuidOf(url)) + '@f9941'); }

/* 把运行时对象存成资源（已存在则覆盖），返回加载好的资源 */
async function saveAsset(url, obj) {
  const content = EditorExtends.serialize(obj);
  const info = await Editor.Message.request('asset-db', 'query-asset-info', url);
  let uuid;
  if (info) { await Editor.Message.request('asset-db', 'save-asset', info.uuid, content); uuid = info.uuid; }
  else uuid = (await Editor.Message.request('asset-db', 'create-asset', url, content)).uuid;
  const cached = cc.assetManager.assets.get(uuid);
  if (cached) cc.assetManager.releaseAsset(cached);
  // 刚保存的资源要等编辑器重新导入完才能加载
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 250));
    try { return await load(uuid); } catch (e) { if (i === 39) throw e; }
  }
}

/* 材质：effect 名 + defines + 属性 */
async function material(url, effectName, { technique = 0, defines = {}, props = {} } = {}) {
  const m = new cc.Material();
  m.initialize({ effectName, technique, defines });
  for (const [k, v] of Object.entries(props)) m.setProperty(k, v);
  return saveAsset(url, m);
}

/* 按名字取子节点；reset=true 时先删掉同名旧节点（让脚本可以重复执行） */
function child(parent, name, reset = false) {
  let n = parent.getChildByName(name);
  if (n && reset) { n.destroy(); n = null; }
  if (!n) { n = new cc.Node(name); n.parent = parent; }
  return n;
}
function v3(x, y, z) { return new cc.Vec3(x, y, z); }
function col(hex) { return new cc.Color(hex); }

async function meshNode(parent, name, meshUuid, mat, { pos = [0, 0, 0], scale = [1, 1, 1], euler = [0, 0, 0], shadows = true } = {}) {
  const n = child(parent, name, true);
  n.setPosition(...pos); n.setScale(...scale); n.setRotationFromEuler(...euler);
  const mr = n.addComponent(cc.MeshRenderer);
  mr.mesh = await load(meshUuid);
  mr.setMaterial(mat, 0);
  mr.shadowCastingMode = shadows ? 1 : 0;
  mr.receiveShadow = shadows ? 1 : 0;
  return n;
}
