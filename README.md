# 末日频道：幸存者

一个面向手机浏览器的 PWA 生存聊天文字游戏原型。

## 当前功能
- 四位有不同性格的幸存者 NPC：林野、米拉、老周、灰鸦
- 私聊界面、快捷提问和简易探索事件
- 体力、食物等状态
- 使用 localStorage 在本机保存对话和状态
- PWA 清单与 Service Worker 离线缓存

## 重要说明
当前 NPC 回复由本地关键词与预设文本生成，不是真正的云端 AI，也不支持多人实时联网聊天。要实现真人般的开放式对话，需要另行接入后端和大语言模型 API。

## GitHub Pages 部署
在仓库 Settings → Pages 中，将 Build and deployment 的 Source 设置为 **Deploy from a branch**，Branch 选择 **main**，目录选择 **/(root)**，然后 Save。等待部署完成后，网址通常为：

https://xiaoeeb-ui.github.io/afterfall-survivor-public/

在手机浏览器打开网址后，可通过浏览器菜单选择“添加到主屏幕”安装。
