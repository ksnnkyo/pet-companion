---
name: pet-companion
description: "macOS 桌面宠物伴侣应用。基于 Electron + Vue 3 + Canvas 像素画渲染，支持情绪状态机、自主移动、外部 Agent HTTP 联动。"
---

# Pet Companion

macOS 桌面宠物伴侣，基于 Electron + Vue 3，通过 Canvas 程序化绘制像素风格角色。

## 项目结构

```
pet-companion/
├── SKILL.md                    # 本文件
├── soul.md                     # 人类可读的情绪/对话规范
├── package.json                # npm 项目配置
├── vite.config.js              # Vite 构建配置
├── main/
│   ├── main.js                 # Electron 主进程
│   ├── preload.js              # 上下文桥接
│   └── httpServer.js           # 外部 Agent HTTP API
└── renderer/
    ├── index.html
    ├── main.js                 # Vue 入口
    ├── App.vue                 # 根组件
    ├── components/
    │   ├── PetView.vue         # Canvas 像素画渲染器
    │   ├── BubbleView.vue      # 对话气泡
    │   └── ChatPanel.vue       # AI 聊天面板
    ├── stores/
    │   ├── petStore.js         # 情绪状态机
    │   ├── soulStore.js        # 情绪/对话数据
    │   ├── agentStore.js       # AI 对话管理
    │   ├── movementStore.js    # 自主移动控制
    │   └── audioStore.js       # 音效合成
    ├── assets/
    │   └── soul.json           # 统一数据源
    └── styles/
        └── base.css
```

## 运行

```bash
cd ~/CodeSpace/AIProject/pet-companion
npm run dev      # 开发模式（Vite + Electron）
npm run start    # 仅 Electron（需先 build:renderer）
```

## 外部 Agent 联动

宠物在 `localhost:9876` 提供 HTTP API：

```bash
# 触发情绪
curl -X POST localhost:9876/emotion -H 'Content-Type: application/json' \
  -d '{"name":"happy","intensity":"medium"}'

# 显示气泡
curl -X POST localhost:9876/say -H 'Content-Type: application/json' \
  -d '{"text":"你好呀"}'

# 查询状态
curl localhost:9876/status
```

任何支持 HTTP 的工具/Agent 都可以通过这个接口与宠物互动。
