# PetCompanion

> AI 桌面宠物伴侣 —— 可跟随 Agent 运行状态调整情绪，支持双向实时通信。

一个最小化、独立运行的 macOS 桌面宠物。基于 Electron + Vue 3 + Canvas 高分辨率渲染，支持 15 维人格系统、LLM 情绪引擎、World Info 记忆、Agent 协作。

---

## 特性

- **精致的桌面宠物**：200×240 窗口，高分辨率 Canvas 渲染，15 种情绪 × 3 种强度的全身像
- **LLM 驱动情绪引擎**：情绪由 AI 根据人格、上下文、时间动态决定，不是硬编码
- **15 维人格系统**：外向性、敏感度、粘人性、活力值、表达欲、世故度、智性恋、包容度、浪漫/务实、豁达/焦虑、依恋型、占有欲、情欲、支配欲、母性
- **3 套人格预设**：温柔人妻、职场御姐、高需求小娇妻，一键切换
- **World Info 记忆**：LLM 自动从对话提取词条，关键词匹配注入上下文
- **关系变量追踪**：好感度、信任度、熟悉度随互动自然演变
- **Agent 进度可视化**：thinking → 闪烁问号，working → 进度条，done → 对勾+烟花
- **独立聊天窗口**：对话 LLM，支持 OpenAI/Ollama/Anthropic/DeepSeek
- **统一设置窗口**：人格/记忆/变量/LLM/宠物信息，5 Tab
- **菜单栏心形图标**：托盘常驻，右键快速交互

---

## 安装与运行

```bash
# 克隆
git clone https://github.com/Ksnnkyo/pet-companion.git
cd pet-companion

# 安装依赖
npm install

# 开发模式运行
npm run dev

# 构建
npm run build:renderer
npm run start
```

- macOS 13.0+, Node.js 20+
- 无需 Docker、无需数据库

---

## Agent 协作

PetCompanion 可以作为 Hermes / OpenClaw / 任何 HTTP 客户端的 **Skill** 运行。

### HTTP API

```bash
# 触发情绪
curl -X POST localhost:9876/emotion \
  -H 'Content-Type: application/json' \
  -d '{"name":"happy","intensity":"medium"}'

# 显示气泡
curl -X POST localhost:9876/say \
  -d '{"text":"重构完成啦~"}'

# 上报 Agent 状态
curl -X POST localhost:9876/agent-state \
  -d '{"status":"working","task":"重构","taskType":"refactor","progress":0.7}'

# 推送上下文
curl -X POST localhost:9876/context \
  -d '{"source":"hermes","content":"正在分析 3 个文件"}'

# 查询状态
curl localhost:9876/status

# 能力清单
curl localhost:9876/manifest
```

### WebSocket

```js
const ws = new WebSocket('ws://127.0.0.1:9876');

// Agent → Pet
ws.send(JSON.stringify({ type: 'emotion', name: 'proud', intensity: 'medium' }));
ws.send(JSON.stringify({ type: 'say', text: '任务完成！' }));
ws.send(JSON.stringify({ type: 'agent-state', status: 'thinking', task: '分析中' }));

// Pet → Agent（自动推送）
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  // msg.type: 'status' | 'clicked' | 'emotion-changed' | 'user_message'
};
```

---

## 架构

```
Agent Framework (Hermes/OpenClaw/curl)
        │
        ├── HTTP / WebSocket ──┐
        │                      ▼
        │              ┌──────────────┐
        │              │  httpServer  │  REST + WS
        │              │  main.js     │  编排器
        │              │  windowMgr   │  窗口/托盘/菜单
        │              └──────┬───────┘
        │                     │ IPC
        │              ┌──────▼───────┐
        │              │   Renderer   │
        └── 状态推送 ──│  emotionBrain│  LLM 情绪引擎
                       │  petStore    │  情绪执行器
                       │  personality │  15 维人格
                       │  memoryStore │  World Info
                       │  variables   │  关系追踪
                       │  PetView     │  Canvas 渲染
                       └──────────────┘
```

---

## 项目结构

```
pet-companion/
├── main/
│   ├── main.js              # 编排器
│   ├── windowManager.js     # 窗口/托盘/菜单
│   ├── httpServer.js        # HTTP + WebSocket API
│   └── preload.js           # 上下文桥接
├── renderer/
│   ├── App.vue              # 根组件
│   ├── main.js              # Vue 入口
│   ├── components/
│   │   ├── PetView.vue      # Canvas 角色渲染
│   │   ├── BubbleView.vue   # 对话气泡
│   │   └── ChatPanel.vue    # 聊天面板
│   ├── composables/
│   │   ├── useBubble.js     # 气泡管理
│   │   ├── useDrag.js       # 拖拽逻辑
│   │   └── useAgentState.js # Agent 状态映射
│   ├── stores/
│   │   ├── petStore.js       # 情绪执行器
│   │   ├── emotionBrain.js   # LLM 情绪引擎
│   │   ├── personalityStore.js # 15 维人格
│   │   ├── memoryStore.js    # World Info 记忆
│   │   ├── variablesStore.js # 关系变量追踪
│   │   ├── soulStore.js      # 情绪/对话数据
│   │   ├── agentStore.js     # LLM 对话
│   │   ├── movementStore.js  # 自主移动
│   │   └── audioStore.js     # Web Audio 音效
│   ├── assets/
│   │   ├── soul.json         # 统一数据源
│   │   └── personality.json  # 人格定义+预设
│   ├── chat.html             # 聊天窗口
│   └── settings.html         # 设置窗口
├── pet-companion.skill.json  # Skill 描述符
├── soul.md                   # 人类可读规范
├── IMPROVEMENT.md            # 改进方案（参考 airi + SillyTavern）
└── package.json
```

---

## 鸣谢

设计参考了以下优秀开源项目：

- [airi](https://github.com/moeru-ai/airi) — Live2D/VRM 渲染、流式 TTS 管道、插件系统
- [SillyTavern](https://github.com/SillyTavern/SillyTavern) — World Info 记忆、角色卡格式、情绪分类

---

## License

MIT
