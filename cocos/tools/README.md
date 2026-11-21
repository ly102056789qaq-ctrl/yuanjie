# Cocos 战斗工程的开发工具

| 文件 | 作用 |
| --- | --- |
| `cc.py` | 给正在运行的 Cocos 编辑器发指令（经工程内扩展 `extensions/yj-bridge`）。`python cc.py --js lib.js 某步骤.js` |
| `../battle/tools/stage/*.js` | 场景搭建步骤：10 环境、15 导入设置、20 角色站位、25 近景物件、30 角色动画、40 若叶凛大招演出。可重复执行 |
| `retexture.py` | 战斗小人重贴图：PSD 拆层对齐原图、补回丢失部件、清杂点、Real-ESRGAN 放大 2 倍，输出图层与 rig.json |
| `spine21_bake.py` / `bake_all.py` | 把 Spine 2.1 特效烘焙成黑底序列帧（引擎内用叠加混合） |
| `make_overlay.py` | 由定稿 HUD 设计稿生成上线页 `battle3d/index.html`（HUD 叠在 Cocos 画面上） |
| `patch_web_build.py` | 把 Cocos web-desktop 构建产物改成全屏 |
| `shot.mjs` / `record.mjs` | Playwright 截图与录屏，用于验收 |

发布流程：编辑器里保存场景 → 关闭编辑器 → `CocosCreator.exe --project cocos/battle --build "platform=web-desktop;debug=false;md5Cache=false;sourceMaps=false"`（退出码 36 表示成功）→ 复制 `cocos/battle/build/web-desktop` 到 `battle3d/game` → `python patch_web_build.py battle3d/game` → `python make_overlay.py`。
