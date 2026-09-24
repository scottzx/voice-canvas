# voice-canvas

基于 [Excalidraw](https://github.com/excalidraw/excalidraw) 的本地中文画布与命令行控制工具。主干只保留画布和 CLI，不包含语音采集、转写、Laya 或大模型调用。

## 启动

需要 Node.js 22 或更新版本与 npm。

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

也可使用 `node canvas.mjs ...`。返回 JSON，错误以非零状态退出。新增元素 ID 在 `result.createdIds` 中。`state` 返回元素、选中项和撤销/重做步数。

命令通过本地 HTTP `/api/canvas` 与 WebSocket `/canvas-ws` 转发给浏览器，执行并确认后返回。服务只监听 `127.0.0.1`，请勿暴露到公网。本机其他程序也可调用此接口，因此仅在可信本机环境使用。

当前限制：

- 只支持一个活动画布连接；被占用的页面每 3 秒尝试重连，请关闭多余标签。
- CLI 新增和改名面向独立文字；画布界面支持其他形状。
- CLI 连线跟随节点位置更新。
- 撤销/重做保存最近 100 次元素快照，刷新后历史不保留；图片文件不包含在快照中。
- 正在拖动或编辑文字时拒绝 CLI 写入，完成编辑后重试。

## 验证

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
