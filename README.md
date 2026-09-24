# 对话画布

基于官方 `@excalidraw/excalidraw` React 组件的本地体验原型。

启动：`npm install`，然后 `npm run dev -- --port 5178`。

访问 http://127.0.0.1:5178/ 。构建：`npm run build`。

当前支持中文画布、浏览器本地保存、实时 CLI，以及语音 → 本地 transcribe → Laya 完整性判断 → 大模型结构整理 → 程序渲染。重要内容请使用画布菜单导出 `.excalidraw` 文件备份。

## 语音输入

需要服务端 PATH 中已安装 `transcribe` 和 `ffmpeg`，并已下载 SenseVoice 模型。本机验证版本为 `@1agents/transcribe v0.4.1`，复用原有 CLI，没有修改 transcribe 项目。

访问本地画布（不是 excalidraw.com），点击“开始监听”并授权麦克风。绿色表示监听、红色表示正在说话。基础能量 VAD 在约 1.2 秒静音后提交音频，单段最多 25 秒；转写时继续采集后续讲话。音频只发送本机转写服务，临时音频处理后清理。已转写的原话会发送到你配置的远程整理模型。背景噪声可能影响 VAD，暂非生产级降噪方案。

Laya 只判断是否说完，complete 概率达到 0.8 才自动交给大模型，否则保留原话。连续 15 秒未检测到讲话时强制交给大模型；重新开口会重置计时，空池不会发送。若转写尚未完成，会等音频转写结束再发送。兜底只绕过完整性判断，不绕过 JSON 校验。大模型只能返回节点标题、是否带框、关系；程序负责布局与渲染，无任意工具执行权限。新结果追加到现有画布，不自动修改旧节点。

待处理原话可展开查看；停止监听且处理结束后可编辑，并点击“重新判断 / 重试”。失败保留文字/未转写音频，文字备份在当前浏览器 localStorage；音频仅保存在内存，刷新可能丢失。已渲染批次携带原话与批次 ID，重试同批次不会重复绘图。渲染整批可撤销。补充文字输入走同一判断流程并应用 15 秒兜底。旧正则语音命令面板不再使用；手动 CLI 仍可使用。

`node test-pipeline.mjs` 测试文本池、陈旧判断、失败重试和静音计时；`node test-live-voice.mjs` 使用系统合成音频调用真实 transcribe、Laya、已配置的大模型，并在当前画布追加测试图（会产生模型调用费用）。真人麦克风采集需要实际试用验证。

## 命令行

在项目目录中运行（先启动服务并打开一个画布标签）：

```sh
./canvas add "保留人的主动性" --x 100 --y 100
./canvas list
./canvas rename ELEMENT_ID "帮助人保持专注"
./canvas move ELEMENT_ID --x 400 --y 200
./canvas connect FROM_ID TO_ID
./canvas select ELEMENT_ID
./canvas delete ELEMENT_ID
./canvas undo
./canvas redo
./canvas state
./canvas json '{"op":"add","text":"语音转写后的内容","x":100,"y":300}'
```

也可使用 `node canvas.mjs ...`。所有命令输出 JSON，错误返回非零退出码。新增结果中的 `result.createdIds` 为新元素 ID；列表提供实时元素及选中状态。

命令通过本地 Vite 服务 `/api/canvas` 转发给浏览器，浏览器执行后返回结果。语音适配器发送相同的 JSON 命令。HTTP 接受本机 CLI 和同源页面请求，WebSocket 仅接受同源连接；不应将该开发服务器暴露到公网。

当前约束：只连接一个活动画布标签；改名仅支持独立文字。CLI 连线记录两端元素 ID，节点移动后自动更新。撤销/重做为会话内最近 100 次元素快照，鼠标拖动和文字编辑结束后记录；CLI、按钮和 Cmd/Ctrl+Z 共用，刷新后历史不保留。图片文件不包含在历史快照中。操作中的文字编辑/拖动会拒绝 CLI 写入，请完成编辑再重试。

验证：`node test-cli.mjs`（需要打开画布），`npm run build`。测试只清理自己创建的测试元素，原有内容保留。

Excalidraw 项目：https://github.com/excalidraw/excalidraw （MIT）。
# 模型设置

画布右上角点击「模型设置」，填写 OpenAI 兼容服务的 Base URL（包含服务要求的 `/v1` 等前缀）和 API Key，点击「获取模型列表」，选择模型 ID 后保存。模型列表通过服务端调用 `GET {Base URL}/models` 获取，不需要手写 ID；接口不支持此协议时会显示错误，不编造候选项。列表中可能包括不支持聊天的模型，请选择可用的文本聊天模型。

设置保存在 `~/.config/voice-canvas/model.json`，权限为 `0600`，密钥是本机明文文件，不是系统钥匙串。浏览器读取设置时仅返回是否存在密钥，不回传密钥本身。更换 Base URL 后需要重新输入密钥，防止旧密钥被发送给新地址。保存立即作用于服务端整理接口，无须重启。未保存设置时可以使用 `.env.local` 中的 `CANVAS_LLM_BASE_URL`、`CANVAS_LLM_MODEL`、`CANVAS_LLM_API_KEY` 作为初始配置。

设置模块测试：`node test-model-settings.mjs`（使用临时配置目录和本地模拟模型服务，不调用真实模型）。
