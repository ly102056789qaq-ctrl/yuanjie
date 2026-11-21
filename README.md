# 源界 ASTERIAL

游戏大厅入口是仓库根目录的 `index.html`。在大厅可更换看板同行者、配置四人队伍并进入 Unity 战场。原世界观首页位于 `atlas.html`，也可从大厅的「档案」进入。

从 GitHub 克隆此分支后，在仓库根目录运行 `git lfs pull` 取回 Unity WebGL 的数据和程序文件，再启动本地服务。购买的 Unity 原始资源保存在开发机，需要重新构建战场时使用。

设计与美术交接请读[《源界》美术与 UI 设计手册](docs/源界美术与UI设计手册.md)，内含实机图例、主页配色与材质、战斗反馈、出图要求和待定事项。

遇到改稿返工、字体缺字、HUD 重影、多段特效、战报数据或本地服务问题，可以按现象查[《源界》已知踩坑与避雷记录](docs/源界已知踩坑与避雷记录.md)。

资源都用相对路径，所以站点放在域名根目录，或放在 GitHub 项目页的 `/yuanjie/` 下，都可以加载。

## 本地预览

在仓库根目录启动静态服务器：

```bash
python3 -m http.server 8080
```

打开 <http://127.0.0.1:8080/>。

角色模组页：

- <http://127.0.0.1:8080/character.html?id=siwei&tab=module>
- <http://127.0.0.1:8080/character.html?id=dekeke&tab=module>
- <http://127.0.0.1:8080/character.html?id=vera&tab=module>

要按线上子路径检查，把仓库放到一个名为 `yuanjie` 的目录里再启动服务器，然后访问 `/yuanjie/`。

## GitHub Pages

发布配置在 `.github/workflows/pages.yml`。合并到 `main` 之后，这个工作流把仓库根目录（不含 `.git` 和 `.github`）作为静态站点上传。

仓库根目录的 `.nojekyll` 用来关掉 Jekyll，避免 `data/skills/_template.json` 这类以下划线开头的文件被跳过。

Pages 成功发布后的项目页地址是：

<https://ly102056789qaq-ctrl.github.io/yuanjie/>

这个地址要等下面两步都完成，并且 Actions 里的 “Deploy GitHub Pages” 显示成功，才算上线。

1. 把包含该工作流的提交合并到 `main`。
2. 仓库管理员打开 Settings → Pages → Build and deployment，把 Source 设为 **GitHub Actions**。

当前仓库还没有 Pages 站点（GitHub Pages API 返回 404）。在 Source 设好并且工作流成功之前，不要把上面的地址当作已上线。

## 许可

这个仓库还没有选定许可证。在作者另外说明之前，不授予代码或美术的再使用许可。
