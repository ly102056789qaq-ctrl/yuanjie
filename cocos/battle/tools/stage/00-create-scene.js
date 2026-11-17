// 新建 BattleStage 场景（内容取引擎默认场景），并在编辑器里打开。
const fs = require('fs');
const url = 'db://assets/scenes/BattleStage.scene';
let info = await Editor.Message.request('asset-db', 'query-asset-info', url);
if (!info) {
  const tpl = fs.readFileSync(Editor.App.path + '/../resources/3d/engine/editor/assets/default_file_content/scene/default.scene', 'utf8');
  info = await Editor.Message.request('asset-db', 'create-asset', url, tpl);
}
await Editor.Message.request('scene', 'open-scene', info.uuid);
return { uuid: info.uuid, app: Editor.App.path };
