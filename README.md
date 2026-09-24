# voice-canvas

基于 [Excalidraw](https://github.com/excalidraw/excalidraw) 的本地中文画布与命令行控制工具。主干只保留画布和 CLI，不包含语音采集、转写、Laya 或大模型调用。

## 启动

### npm 安装（首次发布成功后可用）

```sh
npm install -g voice-canvas
voice-canvas serve
# 浏览器打开 http://127.0.0.1:5178/，另一个终端执行：
voice-canvas add "新想法" --x 100 --y 100
voice-canvas state
```

也可用 `npx voice-canvas serve` 启动。包内含预构建画布，运行时无需 Vite、React 开发依赖或任何模型配置。服务仅监听本机，端口固定 5178；如果开发服务器还在运行，请先停止它。

### 从源码启动

需要 Node.js 22.14 或更新版本与 npm。

```sh
npm ci
npm run dev
```

打开 http://127.0.0.1:5178/ ，保持一个画布标签页在线。CLI 依赖开发服务器的桥接接口，单独部署 `dist` 静态文件不提供 CLI 服务。

画布保存在当前浏览器 localStorage。重要内容请从画布菜单导出 `.excalidraw` 备份；浏览器存储不是跨设备同步。升级沿用原有画布存储键，不删除现有内容。

## CLI

在项目目录运行：

```sh
./canvas state
./canvas add "保留人的主动性" --x 100 --y 100
./canvas list
./canvas rename ELEMENT_ID "帮助人保持专注"
./canvas move ELEMENT_ID --x 400 --y 200
./canvas connect FROM_ID TO_ID
./canvas select ELEMENT_ID
./canvas delete ELEMENT_ID
./canvas undo
./canvas redo
./canvas json '{"op":"add","text":"新想法","x":100,"y":300}'
```

也可使用 `node src/cli/canvas.mjs ...`。返回 JSON，错误以非零状态退出。新增元素 ID 在 `result.createdIds` 中。`state` 返回元素、选中项和撤销/重做步数。

命令通过本地 HTTP `/api/canvas` 与 WebSocket `/canvas-ws` 转发给浏览器，执行并确认后返回。服务只监听 `127.0.0.1`，请勿暴露到公网。本机其他程序也可调用此接口，因此仅在可信本机环境使用。

当前限制：

- 只支持一个活动画布连接；被占用的页面每 3 秒尝试重连，请关闭多余标签。
- CLI 新增和改名面向独立文字；画布界面支持其他形状。
- CLI 连线跟随节点位置更新。
- 撤销/重做保存最近 100 次元素快照，刷新后历史不保留；图片文件不包含在快照中。
- 正在拖动或编辑文字时拒绝 CLI 写入，完成编辑后重试。

## 目录结构

```text
src/
  main.jsx                # React 画布入口
  commands.js             # 浏览器画布命令执行
  style.css               # 页面样式
  cli/canvas.mjs          # CLI 实现
  server/canvas-bridge.js  # HTTP / WebSocket 桥接
tests/
  cli.test.mjs            # CLI 集成测试
canvas                    # 稳定的 shell 启动入口
index.html                # Vite HTML 入口
vite.config.js            # 构建与开发服务配置
```

## 验证命令

```sh
npm run build
# 服务运行且一个画布标签在线时：
npm run test:cli
```

CLI 测试覆盖新增、改名、移动、连线、选中、删除、撤销/重做及无效输入；仅清理自身测试元素，检查原有画布元素未改变。

## 历史实验版本

`archive/voice-laya` 分支保留语音、Laya 完整性判断、大模型结构整理及 Debug 面板。它是实验归档，外部转写服务和本地模型权重不包含在仓库中；主干不需要这些依赖。密钥、用户画布数据和本地模型配置均未提交。

## 许可证

[MIT](LICENSE)。Excalidraw 等第三方依赖仍遵循各自许可证。

## npm 发布维护

工作流为 `.github/workflows/publish.yml`。首次发布前，在仓库的 Actions secrets 中设置 `NPM_TOKEN`，使用有权发布此包的 npm granular token，并满足 npm 的 2FA 发布要求；不要将 token 写进仓库或聊天。首次发布后可在 npm 包设置中配置 GitHub Trusted Publisher（owner `scottzx`，repo `voice-canvas`，workflow `publish.yml`），随后移除 token secret，使用 OIDC 发布。

发布方式：更新 `package.json` 和锁文件中的版本并推送，创建与版本一致的 GitHub Release（例如 `v0.1.0`）。也可在 Actions 手动运行 Publish npm package，勾选 `publish`。不勾选时仅构建、测试及检查包内容。已发布的 npm 版本不能覆盖。

工作流执行 `npm ci`、构建、独立服务器自动测试和包检查，成功后公开发布并附带 provenance。`npm run test:cli` 是需要真实浏览器的额外本地测试，不在无浏览器的发布流程中运行。
