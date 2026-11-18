# 交接：源界战斗（2026-11-18 凌晨）

> 给新窗口：先读第 1、2 节。上一份交接是 `docs/HANDOFF-cocos-battle-2026-11-17.md`，世界观、HUD 定稿、数值方案都在里面，这里只写之后发生的事和现在的状态。
> 用户沟通：中文口语，嫌慢、嫌汇报多，要看真东西（截图），不要拿“素材就这样”当理由。动手前先把用户给的素材全部看一遍（这次漏看了两个压缩包，被骂得对）。

## 1. 一句话现状

`/battle3d/` 已经是**能完整打一局的回合战斗**：HUD（网页）驱动回合，Cocos 3.8.8 负责画面。分支 `cocos-battle`，最新提交 `01ee31f`，已推送，PR #5 未合并。

**待用户拍板的大事：引擎要不要换 Unity。** 用户指出：HUD 本来就是网页叠在引擎画面上，换 Unity WebGL 时 HUD 一行不用改，所以当初“不迁 Unity 因为 UI 要重做”的理由已经不成立；用户还明确**不需要考虑手机浏览器**。助手的建议是换 Unity（泛光、粒子、Spine/Live2D 官方插件、后处理都是 Unity 的长处，正好是用户要的东西）。尚未开始，也还没确认本机 Unity 安装位置（PATH 里有 `AppData/Local/Unity/bin`，未核实）。
- 换引擎能原样带走的：`js/battle/**`（规则）、`battle3d/play.js` / `play.css`（HUD、飘字、状态面板、选择、自动、结算）、`data/battle/*`、特效序列帧（`work/fxbake*`）、大招视频。
- 要用 C# 重做的：场景搭建、分层小人和动作、若叶凛演出、表现接口（见第 3 节，接口形状可以照抄）。

## 2. 怎么跑、怎么发布

- 本地预览：`python -I C:\Users\86193\repos\tools\serve.py 8765 C:\Users\86193\repos\yuanjie`，打开 `http://127.0.0.1:8765/battle3d/`。
- 操作：Q 普攻、E 战技（同一个键按两次 = 确认），A/D 换目标、空格确认，R 或 1～4 插入终结技，点状态图标看说明。右上角“自动”“×2”可用。
- 发布：编辑器里保存 → **关掉编辑器** → `CocosCreator.exe --project cocos/battle --build "platform=web-desktop;debug=false;md5Cache=false;sourceMaps=false"`（退出码 36 = 成功）→ 复制 `cocos/battle/build/web-desktop` 到 `battle3d/game` → `python cocos/tools/patch_web_build.py battle3d/game`。HUD 结构改了才跑 `make_overlay.py`（它现在只引入 play.js / play.css）。
- 验收脚本（都在 `C:\Users\86193\repos\tools\`，playwright 装在那里）：`play_test.mjs`（手动一招 + 自动打完，定时截图到 `work/scratch/shots`）、`play_test2.mjs`（选中、状态面板、两段大招视频，截到 `shots2`）。**必须用 `channel: 'msedge'`**，自带 Chromium 放不了 H.264。

## 3. 代码地图

| 位置 | 内容 |
| --- | --- |
| `battle3d/play.js` | HUD 主逻辑：`buildMatch` → `nextActor` 循环；一次行动的事件先收集再按顺序演（`present()`）；`LOOK` / `DERIVED_FX` / `STATUS_FX` 是每招的特效配方；`playVideo()` 大招视频；`openStatus()` 状态面板；`window.yjHud` 调试接口 |
| `battle3d/play.css` | 飘字（D-DIN，崩铁式渐变 + 同色描边 + 外发光）、选中箭头、状态面板、结算、视频演出 |
| `js/battle/match.js` | `buildMatch / nextActor / autoAction / canUlt / ultCost`；能量点、击破规则 |
| `js/battle/core/Battle.js` | 新增 `insertAction`（终结技插入，不占回合） |
| `js/battle/core/Damage.js` | 新增暴击区 |
| `data/battle/encounter-cocos.json` | 演示遭遇（策划数值，自动 200 局平均 6 轮），`build.extra` 是演示用频谱词条 |
| `cocos/battle/assets/scripts/stage/StageApi.ts` | 表现接口，挂在 `window.yjBattle`：`act / hit / flash / fx(名, 节点, 高度比例, 缩放, 循环键, 染色) / select / target / shot(close·low·enemies·base) / screenPos / hitstop / die / reset / stopLoop / preload` |
| `cocos/battle/assets/scripts/stage/CutsceneDirector.ts` | 演出导演 + 暴露上面的接口；开场把演出 UI 透明度归零 |
| `cocos/battle/assets/resources/fx/` | 特效 JPG 图集 + `index.json`，由 `cocos/tools/pack_fx.py` 生成（g_ 开头的来自 145 套古风包） |
| `cocos/battle/assets/resources/effects/yj-sprite-flash.effect` | 小人受击闪白、选中柔光用的精灵材质 |
| `cocos/battle/tools/stage/30-anims.js` | 动作曲线（已改柔：抬手 40～45°，smootherstep，头发裙摆跟随） |
| `cocos/battle/tools/stage/40-ult-rin.js` | 若叶凛大招，`TIME_MAP` 把原 9.6 秒压到 5.75 秒 |
| `cocos/battle/tools/stage/12-post.js` | 雾改成 19～46 米；泛光保持关闭（见第 4 节） |
| `assets/battle/ult/siwei-ult.mp4`、`vera-ult.mp4` | 用户给的大招视频 |
| `fonts/yj-ddin*.woff2`、`yj-num-*.woff2` | D-DIN、Barlow Condensed（均 OFL） |

## 4. 坑（都踩过）

- **泛光（BuiltinPipelineSettings）会让 RenderRoot2D 里的小人和特效整个不渲染**。已在场景和 StageApi 里关掉。要泛光：小人改成 3D 面片（MeshRenderer），或换引擎。
- **重新执行 40-ult-rin.js 会把 `playOnStart` 设成演示循环**（已改脚本，但别忘了检查场景里 `"playOnStart": ""`），否则一进场就在放大招、把人物挡住。
- 场景里保存的镜头可能停在演出的某一帧；StageApi 开场会强制回到常态机位 `(0.16, 3.55, 13.6)` 看 `(0.14, 0.62, 0)`。
- Cocos 构建是 loose 模式：`[...map]` 会变成 `[map]`，遍历 Map 用 `Array.from(map.entries())`。
- iframe 里 Cocos 会吞按键：HUD 在 iframe 的 window 上用**捕获阶段**转发 keydown。
- 雾原来 11～22 米，正好把整个战场罩灰（用户问“编辑器里好看、实战一般”就是这个）。
- 不能 `rm -rf` 当前工作目录或其上级（安全检查会拦，整条命令都不执行）。

## 5. 素材

- `Documents\SP43_145套SPine古风技能.rar`：Spine **3.8.75 二进制**。已解到 `work/sp145`，用 `repos/tools/bake38.mjs` + `work/spine38/bake.html`（2019-10 的 spine-ts，新版运行库拒绝 3.8.75）烘焙了 141 套到 `work/fxbake38`，总览图 `work/scratch/sheet38_0.jpg`、`sheet38_1.jpg`。质量明显高于 800 套卡通包。
- `Documents\spine源文件_…800多套….zip`：Spine 2.1，烘了 45 套在 `work/fxbake`，卡通风，观感廉价，逐步淘汰。
- `Documents\TX040125C.zip`（10MB）：**还没打开过**。
- 用户桌面 `源界\战斗小人加原图\`：四人 PSD 和原图、思惟诺姆大招 mp4、薇拉大招 mp4 + 两张图。

## 6. 还没做 / 已知问题

1. 引擎决定（第 1 节）。
2. 泛光（见坑）；首领头像、终结技按钮之外的“柔和外发光”。
3. 新特效只按总览图配了，没有逐招截命中瞬间验收；用户觉得哪招不对就换 `LOOK` 里的名字。
4. 旧卡通图集还在 `resources/fx` 里没删，包体多几 MB；一个 404 请求未查。
5. 幻海的场景着色（冰面/水面 `params.z`、远景和雾转深蓝紫）未做，现在只有展开时的特效和横幅。
6. 其余三人的插画版大招、样板怪物（拆层 + 网格变形 + 法线）、Blender 断柱碎石，见上一份交接第 5 节。
