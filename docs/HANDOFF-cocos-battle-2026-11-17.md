# 交接：源界战斗迁移 Cocos（2026-11-17 晚）

> 给新窗口：先读第 1～3 节就能接着干。用户最想要的是**今晚看到一个完整的对局**，第 5 节是按优先级排好的任务清单。
> 用户沟通：中文口语，嫌慢、嫌汇报多。每做完一块就截图或录屏给她看（她要看真东西），汇报要短。不要拿基础几何体冒充建模，动效幅度要大到肉眼能看出来，迁移要先原样搬旧版再加强。

## 1. 现状一句话

Cocos Creator 3.8.8 工程已经能跑：夜景战场，四人分层小人，两个敌人，定稿的 HUD（第六版）叠在画面上，若叶凛终结技「等雨停的时候」整段演出可以播放。**还没有回合战斗逻辑**：现在只是场景加演出，点终结技只会播演出。

- 分支 `cocos-battle` 已推送，**PR #5 待用户自己合并**：<https://github.com/ly102056789qaq-ctrl/yuanjie/pull/5>。Claude Code 的安全规则不允许助手合并到 main，用户已登录 GitHub，推送、开 PR 都能用。API 调用脚本是 `C:\Users\86193\repos\tools\gh_api.py`，它读取 Git 凭据管理器里的凭据，**不会打印**。
- 合并后正式地址是 `https://ly102056789qaq-ctrl.github.io/yuanjie/battle3d/`。主站暂时不加入口，原网站的页面一个都没改。
- 本地预览：
  - 先启动服务：`python -I C:\Users\86193\repos\tools\serve.py 8765 C:\Users\86193\repos\yuanjie`
  - 打开 `http://127.0.0.1:8765/battle3d/`
  - Windows 自带的 http.server 会给 .js 错误的 MIME 类型，所以必须用这个 serve.py。
- 编辑器实时预览：在 Cocos 编辑器打开着的情况下，访问 `http://127.0.0.1:7456/`。

## 2. 目录与工具

| 位置 | 内容 |
| --- | --- |
| `cocos/battle/` | Cocos 工程，场景 `assets/scenes/BattleStage.scene` |
| `cocos/battle/tools/stage/*.js` | 场景搭建步骤，都可以重复执行：`10-environment` 环境、`15-import-settings` 导入设置、`20-actors` 站位、`25-props` 近景物件、`30-anims` 角色动画、`40-ult-rin` 大招 |
| `cocos/battle/extensions/yj-bridge/` | 编辑器桥：往 `cmd/` 写 JSON，编辑器执行后把结果写到 `out/` |
| `cocos/tools/cc.py` | 发指令给编辑器，例如 `python cc.py --js <stage>/lib.js <stage>/20-actors.js '{"msg":["scene","save-scene"]}'` |
| `cocos/battle/assets/scripts/stage/` | 组件：`FxPlayer` 序列帧、`FaceCamera` 朝向镜头、`CutsceneDirector` 演出导演（事件帧调用 `fx` / `act` / `shake`，并提供网页接口 `window.yjBattle.playCutscene`）、`IceCrystals`、`ActorDemo`（已弃用） |
| `cocos/battle/assets/effects/` | `yj-backdrop` 全屏远景、`yj-ice-floor` / `yj-water`（移植自旧版 scene3d.js，带幻海强度参数）、`yj-grade` 暗角颗粒、`yj-fx-additive` 叠加特效、`yj-cg-live` 插画呼吸/发丝/雨水变形 |
| `cocos/battle/assets/art/fx/seq/` | 已烘焙的序列帧特效 13 套（黑底，叠加混合） |
| `battle3d/` | 上线页：`index.html` 是 HUD 层，`game/` 是 Cocos 构建 |
| `design/hud/` | HUD 设计稿 v1～v6、`hpbar-study.html`、染色状态图标 `icons/` |
| `docs/cocos-hud-spec.md` | HUD 规格和已定的决定 |
| `cocos/tools/` | `retexture.py` 小人重贴图放大、`spine21_bake.py` 特效烘焙、`make_overlay.py`、`patch_web_build.py`、截图录屏脚本 |

外部资源（不在仓库）：
- `C:\Users\86193\repos\work\fxbake\` 已烘焙的 45 套特效；`work\fx800\` 是原始的 Spine 2.1 文件。
- 800 套特效原包在 `Documents\spine源文件_…zip`，共 348 个目录，**大多能烘焙**，用 `bake_all.py` 处理。
- 生图通道是 LCgame 的 `D:\LCgame\.env.image-relay.local`，脚本 `repos/tools/gen_image.py`，支持参考图。中转返回的是 URL。**每次生成前先告诉用户要生成什么、几张**。
- Blender 4.2 免安装版在 `C:\Blender\blender-4.2.3-windows-x64\blender.exe`，可以用 `--background --python` 跑脚本建模。

### 发布流程
1. 在编辑器里保存场景，然后关闭编辑器（构建时项目会被锁）。
2. 执行构建：
   ```
   C:\Cocos\Creator-3.8.8\CocosCreator.exe --project C:\Users\86193\repos\yuanjie\cocos\battle --build "platform=web-desktop;debug=false;md5Cache=false;sourceMaps=false"
   ```
   **退出码 36 表示成功**。
3. 把 `cocos/battle/build/web-desktop` 复制到 `battle3d/game`。
4. 执行 `python cocos/tools/patch_web_build.py battle3d/game` 改成全屏。
5. HUD 有改动时，执行 `python cocos/tools/make_overlay.py`。
6. 提交、推送、开 PR，由用户合并。

## 3. 用户已经定下的事

- 迁移到 Cocos；原网站继续负责养成、档案和世界观；战斗页放在 `/battle3d/`。
- HUD：漂浮式，**角色状态栏不加深色底板**；血条用**方案 B**（星铁式细条）；四人之间留 34px 间距；数字用粗斜体。详见 `docs/cocos-hud-spec.md`。UI 部件不用 AI 生成。
- 大招做法（用户原话）：“生成一张或者几张图片，用网格化做仿 live2d 呼吸效果，然后加上运镜，这就是大招演出”。插画的变形幅度要明显，用户批评过“硬放”。
- 人物可以再放大。战斗小人要高清：已用原图重贴并放大 2 倍。两只手是分开的图层，可以单手动作。
- 怪物**不做 3D 模型**，沿用 2D 立绘放在 3D 场景里的做法，和角色统一。
- 场景近景要有**真正的 3D 模型**，比如断柱、碎石：用 Blender 做，或用 CC0 模型。基础几何体的占位已经隐藏（`Environment/Props/Column_*`）。
- **数值由我们来定**：用户授权参考二游的通行做法，把“数据锁定”的数值填上（见第 6 节），角色页和战斗读同一份数据。世界观、剧情、档案文字照旧不编。
- 生图已经用了 4 张（UI 测试 1、夜景远景 1、若叶凛大招插画 2），都是用户同意过的。

## 4. 已知问题

- 序列帧特效约 23MB、构建总共 34MB，加载慢。要压成图集或 webp。
- 敌人头顶条和准星没有跟随 3D 位置，叠加层里暂时去掉了。
- 战斗小人还没有网格变形，只有轴心旋转缩放；动作偏僵。
- 若叶凛大招的插画变形参数刚加大（呼吸 2.2%、发丝 1.2%），需要录屏确认。
- 用户那边出现过一次画面被拉伸，刷新或重置页面缩放后恢复了。再出现的话，就限制最高渲染分辨率。
- `battle.html` 的旧版不要删，留作对照。

## 4.5 本窗口最后完成的（未接画面）

- **对局逻辑已写好并在 Node 跑通一局**（四人对两敌，33 次行动 6 轮胜利；伤害、治疗、导电、花期、幻海、击破、拉条都触发）：
  - `data/battle/stats.json`：数值方案（第 6 节），`js/battle/stats.js` 的 `statsFor()` / `energyPerAction()`
  - `js/battle/match.js`：`buildMatch()` 组装对局（含受击回能、敌人随机普攻），`nextActor()` 逐步推进
  - `js/battle/kits/support.js`：德可可（同步增益、拉条）、薇拉（导电、跳电、过载）、若叶凛（花期按自身行动计、花信自动救援、花荫减伤、净化）；治疗走 `heal` 事件，不触发协同/复现
  - `js/battle/core/Status.js`：状态可声明 `unit: 'action'`（按行动次数计，由机制自己扣）
  - 自测脚本思路：Node 里 `buildMatch` 后循环 `nextActor` + `takeTurn`（见提交说明）
- **还差的是把它接到画面**：HUD 层驱动回合、玩家选技能/目标、按事件调 Cocos 表现、伤害飘字。CutsceneDirector 需要补公开的 `act / fx / shake / flash / screenPos` 网页接口（现在只有 `playCutscene`）；敌人还没有 hit/attack 剪辑。

## 4.6 用户最后补充的要求（2026-11-17 晚）

- **发光**：参考星铁截图，Boss 头像圈、终结技就绪按钮要有柔和外发光（不是廉价霓虹）；怪物也有光效。
- **场景光效**：开 Cocos 内置管线的泛光（`BuiltinPipelineSettings` 组件挂主镜头，bloom），加飘落粒子、地面光斑；做出“边缘发光、充盈”的高级感。
- **大招插画**：直接用生图通道一次生成可提取的分层素材（人物、前景、背景分开或纯色底便于抠），放进 `yj-cg-live` 做网格呼吸 + 运镜。
- **怪物体积感**（用户问怎么做，想参考新月同行“又 2D 又 3D”的怪物；世界观里怪物不必像大众怪物，越掉 san 越好）：做法是生图出原画 → 拆部件（分别生成或分割）→ 分层绑定 + 网格变形（蠕动、呼吸）→ 由深度估计生成法线贴图，让场景灯光打出明暗和边缘高光 → 发光部位单独自发光层 + 粒子雾。新窗口先出一只样板怪物给她看再推广。
- **伤害飘字**（详见第 5 节第 2 项）：只在暴击时出现“暴击”二字；按元素着色。
- 用户要开新窗口继续；她最想尽快“战斗爽”：**先接通可玩对局**，再做视觉加强。

## 4.7 已接通可玩对局（2026-11-18 凌晨，未提交）

- `battle3d/play.js` + `play.css`：HUD 层驱动回合（`js/battle/match.js` 的 `buildMatch / nextActor / autoAction / canUlt`），收集一次行动的事件后按顺序演出。`make_overlay.py` 现在只引入这两个文件，不再内联脚本。
- 遭遇 `data/battle/encounter-cocos.json`（策划数值，自动 200 局平均 6 轮）；`rules.json` 新增能量点、击破规则；`Damage.js` 加暴击区；`Battle.insertAction` 插入终结技。
- Cocos 表现接口 `StageApi.ts`（由 CutsceneDirector 挂到 `window.yjBattle`）：act / hit / flash / fx / select / target / screenPos / hitstop / die / reset。闪白材质 `resources/effects/yj-sprite-flash.effect`；特效图集 `resources/fx/*.jpg` 由 `cocos/tools/pack_fx.py` 生成（15 套 2.3MB）。
- 大招视频：`assets/battle/ult/siwei-ult.mp4`、`vera-ult.mp4`，HUD 层全屏播放。Playwright 自带 Chromium 不能放 H.264，验收要用 `channel: 'msedge'`。
- 数字字体换成 Barlow Condensed（`fonts/yj-num-*.woff2`，OFL），`--num` 变量一处可改回。
- 动作曲线 `30-anims.js` 重写（抬手 40～45°、smootherstep、头发裙摆跟随），已在编辑器执行并保存场景。
- 坑：Cocos 构建是 loose 模式，`[...map]` 会变成 `[map]`，遍历 Map 一律用 `Array.from(map.entries())`；iframe 里 Cocos 会拦截按键冒泡，转发要用捕获阶段。
- 验收脚本在 `repos/tools/play_test.mjs`、`play_test2.mjs`。

## 5. 今晚任务清单（按优先级）

1. **接通回合对局**（最高优先级）：
   - 用仓库已有的 `js/battle/core`（Battle / Timeline / Damage / Status / Domain）和 `kits/siwei.js`。逻辑放在 HUD 层或 Cocos 里都可以，**推荐放在 HUD 层**：`battle3d/index.html` 引入 `../js/battle/index.js`，按事件调用 Cocos 的 `window.yjBattle` 接口来表现，比如 `act(角色, 动作)`、`fx(...)`、`hit(目标)`、`playCutscene`。需要给 CutsceneDirector 补公开方法。
   - 流程：行动条按行动值排序 → 我方回合选普攻/战技/终结技和目标 → 敌人自动攻击 → 血条、超限值、能量点实时变化 → 胜负结算 → 重开。
   - 德可可、薇拉、若叶凛还没有 kit。先写简化版并在界面标“简化”：德可可普攻加全队攻击增益；薇拉雷电伤害加「导电」负面效果；若叶凛的花期、花信、花荫按设计 V1.0 实现，见交接文档附录 A，**治疗不触发协同和复现**。
2. **崩铁式伤害飘字**，在 HUD 层实现：
   - 颜色按元素，取 `data/characters.json` 的 `settings.elements[].color`。
   - 数字用粗斜体窄字、2～3px 深色描边、上亮下深的渐变，字号随伤害量级变化。
   - **只有暴击才显示“暴击”二字**，字号更大。多段命中错位堆叠。
   - 治疗用绿色加号，持续伤害用小字。
   - 画面右上角显示本次行动“总伤害”。队伍卡片上显示每人本轮伤害。
   - Cocos 侧负责把命中点的屏幕坐标传给 HUD。
3. **受击效果**：命中瞬间闪白，用 Sprite 颜色或叠加材质；画面停顿约 0.06 秒；目标后仰击退（已有 `hit` 动作剪辑）；命中点放元素色闪光（`shanguang__*` 各色）；重击加震屏。敌人也要有 `hit` 剪辑。
4. **技能特效接入**：
   - 思惟诺姆（负相）：`diaochan_skill2` 紫环、`zhangchunhua_skill3__001` 暗环、`shanguang__zise`。
   - 薇拉（雷电）：`zhangjiao_skill3` 劈雷、`zhugeliang_skill3__001` 雷爆，导电状态用 `shandianzi1` 循环。
   - 德可可（辐照）：`zuoci_skill4`、`zuoci_skill1__003` 金爆。
   - 若叶凛：`xiaoqiao_skill1__002` 加花瓣 `juexing_female`。
   - 有几套还没导进工程，要从 `work/fxbake` 复制过来。
5. **幻海表现**：冰地和水面着色器的 `params.z` 是幻海强度；远景 tint、雾色、环境光一起过渡到深蓝紫；再加漂浮粒子和地面波纹环。参照旧版 scene3d.js 的 `setDomain` 和 `update`。
6. **负面效果**：敌人头顶条跟随 3D 位置，挂染色状态图标（`design/hud/icons`）和层数，持续特效挂在目标身上。
7. 其余三人的终结技：先做战场版，镜头加特效；再像若叶凛那样做插画版，每人 2 张，生成前先问用户。
8. 用 Blender 做断柱、碎石，导出 glb，替换隐藏的占位。

## 6. 数值方案（用户授权由我们来定，落地前截图给她看）

建议在 `data/` 新增 `stats.json`，角色页和战斗都读它：
- **基础属性**按职业定，下表是 Lv80 时的数值，6★ 再乘 1.08：

  | 职业 | 生命 | 攻击 | 防御 | 速度 |
  | --- | --- | --- | --- | --- |
  | 强攻 | 1100 | 700 | 480 | 102 |
  | 干涉 | 1050 | 650 | 460 | 104 |
  | 蚀变 | 1000 | 640 | 450 | 106 |
  | 破阵 | 1150 | 620 | 500 | 100 |
  | 支援 | 1080 | 560 | 480 | 106 |
  | 守护 | 1300 | 520 | 600 | 101 |

- 通用属性：暴击率 5%，暴击伤害 50%，效果命中 0，效果抵抗 0，能量恢复 100%，超限值上限取各角色技能数据（若叶凛是 110）。
- 养成叠加：
  - 等级：按 1～80 线性成长，1 级时为 80 级的 15%。
  - 潜能：属性节点按各角色定稿，比如若叶凛生命 +16%、效果抵抗 +10%、速度 +4。
  - 升格：按定稿效果。
  - 模组：5★ 在 Lv80 时攻击 530 / 生命 1060 / 防御 400，按定位取其一或二。
  - 频谱：主副词条参考崩铁遗器，4 件套效果按定稿。
- 战斗单位的构建要写成一个函数：`statsFor(id, build)` → `makeUnit`。演示对局默认 Lv80、零升格、满潜能。

## 7. 参考

- 旧交接（世界观、角色定稿、红线）：`C:\Users\86193\Downloads\yuanjie-handoff-2026-11-17.md`。若叶凛完整定稿在其附录 A。
- 用户给过的参考图：新月同行整体 HUD、1999 站位、星铁行动条和状态栏、星铁伤害飘字（按元素着色，多段堆叠，只有暴击才标“暴击”）。
