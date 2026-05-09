# PetCompanion 综合改进方案

> 基于 airi (moeru-ai/airi) 和 SillyTavern (SillyTavern/SillyTavern) 的深度分析

---

## 一、当前状态总览

| 维度 | pet-companion 当前 | airi | SillyTavern | 差距 |
|------|:---:|:---:|:---:|------|
| 渲染引擎 | Canvas 程序化 | Live2D + VRM 双引擎 | PNG 精灵图 | 可多后端 |
| 情绪数量 | 15 | 9 | **28** | 太少 |
| 情绪决定 | LLM | LLM 工具调用 | **本地 ONNX + LLM** | 缺本地 |
| 记忆 | 无 | pgvector + DuckDB + notebook | **World Info 词条** | 空白 |
| 角色定义 | 硬编码 | 最小 | **角色卡 PNG 标准** | 不可分享 |
| TTS 语音 | 无 | 流式 token→语音管道 | Whisper+ElevenLabs 本地 | 空白 |
| STT 语音输入 | 无 | VAD+流式多后端 | Whisper 本地 | 空白 |
| 插件/扩展 | HTTP API | 完整 SDK+运行时加载 | 前端扩展+服务端插件 | 不同定位 |
| Prompt 系统 | 单一定制 | 内置 | **三层预设+Handlebars** | 不可配置 |
| 持久变量 | 无 | 无 | **关系/情绪/状态变量** | 空白 |
| 多人/群聊 | 无 | 无 | 视觉小说群聊模式 | 不适用 |
| 多平台 | Electron only | Electron+Web+iOS/Android | Electron+Web | 可扩展 |
| LLM 提供商 | OpenAI 兼容 | **38+** 提供商抽象层 | **20+** +本地模型 | 可扩展 |

---

## 二、综合改进清单（按能力域）

### A 组：记忆系统（来自两个项目的融合）

**SillyTavern 贡献**：World Info 词条匹配——不需要向量数据库
**airi 贡献**：角色 Notebook（笔记/日记/任务）+ 多层记忆架构

**实施方案**：三层记忆，逐步深入

```
L1：World Info 词条（最优先）
  - 用户说"我养猫叫咪咪" → LLM 自动提取 → 存为词条 {key:"猫",content:"..."}
  - 下次对话提到"猫" → 自动注入 prompt
  - 实现：memoryStore.js + electron-store，约 150 行

L2：角色笔记本
  - 记录用户偏好、重要事件、待办提醒
  - "你答应过今天要重构那个模块" ← pet 提醒用户
  - 实现：notebookStore.js + electron-store

L3：关系变量追踪
  - {affection:65, trust:70, familiarity:55, energy:80}
  - 每次互动自动微调数值
  - LLM prompt 注入当前关系值 → 影响对话风格
  - 实现：variablesStore.js
```

### B 组：语音（两个项目验证的方向）

**airi 贡献**：企业级流式 TTS 管道架构（意图优先级、并发生成、顺序播放）
**SillyTavern 贡献**：本地 Whisper STT + ElevenLabs/本地 TTS

**实施方案**：分步走

```
B1：TTS 输出（极简起步）
  - macOS: exec('say -v Tingting "文字"')
  - 配置中选择系统语音
  - ~20 行代码

B2：TTS 升级（可选）
  - 接入 ElevenLabs / OpenAI TTS API
  - 提供者模式（同 airi 的 provider 架构）
  - 气泡显示 + 语音同步播放

B3：STT 输入（可选）
  - 浏览器 Web Speech API → 文本
  - 或本地 Whisper（同 SillyTavern）
  - 对宠物"说话" → 自动转文字 → 发给 LLM
```

### C 组：情绪系统增强

**SillyTavern 贡献**：28 情绪分类 + 本地 ONNX 模型 + 精灵图映射
**airi 贡献**：LLM 可调用的 expression tools + Live2D 参数控制

**实施方案**：

```
C1：情绪从 15 → 28（扩展 soul.json）
  新增：admiration, amusement, annoyance, boredom, confidence,
        confusion, craving, desire, disgust, embarrassment, envy,
        fear, gratitude, hope, jealousy, love, nervousness,
        pain, panic, realization, relief, remorse, tiredness

C2：本地 ONNX 情绪分类（来自 SillyTavern）
  - Cohee/distilbert-base-uncased-go-emotions-onnx
  - Transformers.js 浏览器端运行
  - 用户消息 → 本地分类 → 快速情绪反应（无需 LLM）
  - 作为 emotionBrain 的快速通道

C3：情绪 → 精灵图映射接口（来自 SillyTavern）
  - happy.png → emotion:happy
  - 支持多张变体：happy-1.png, happy-2.png
  - 淡入淡出过渡动画（200ms）
  - 为将来替换 Canvas 绘制预留
```

### D 组：角色系统标准化

**SillyTavern 贡献**：角色卡 PNG 格式（V2/V3 spec）+ CharX 格式
**airi 贡献**：多角色支持

**实施方案**：

```
D1：角色卡导入导出
  - 拖入 PNG 角色卡 → 自动解析为 pet 人格
  - 导出当前 pet 配置为角色卡 PNG
  - 兼容 SillyTavern 生态（可互操作）

D2：角色卡字段映射
  SillyTavern       →  pet-companion
  ─────────────────────────────────
  name              →  personalityStore.name
  description       →  外观设定
  personality       →  人格描述文本
  scenario          →  场景设定（可切换）
  first_mes         →  初次见面问候
  mes_example       →  LLM few-shot 示例
  system_prompt     →  自定义系统指令
  character_book    →  内嵌 World Info

D3：多角色切换
  - 预设三套人格 + 可导入角色卡
  - 托盘菜单中切换
  - 可定义"切换台词"
```

### E 组：Prompt 工程化

**SillyTavern 贡献**：三层预设（Context + Instruct + System）+ Handlebars 模板
**airi 贡献**：38+ LLM 提供商的统一抽象层 + 自动降级

**实施方案**：

```
E1：Prompt 模板化
  当前：emotionBrain.buildPrompt() 硬编码字符串
  改为：prompt-templates.json（Handlebars 模板）
  {{personality}} {{agentState}} {{memories}} {{variables}} {{time}}
  用户可编辑模板

E2：多后端支持（来自 airi 的 provider 模式）
  当前：仅 OpenAI-compatible
  扩展：Ollama、Anthropic、Google Gemini、DeepSeek
  每个 provider = {id, createClient, capabilities}

E3：自动降级（来自 airi 的 auto-degrade）
  Claude 不支持 tool → 自动去掉 tool
  模型不支持 json_object → 改用 markdown 解析
```

### F 组：渲染层可替换

**airi 贡献**：Live2D(PixiJS) + VRM(Three.js) 双后端互换架构
**SillyTavern 贡献**：PNG 精灵图 + 淡入淡出过渡

**实施方案**：

```
F1：渲染器接口抽象
  interface PetRenderer {
    setEmotion(name, intensity): void
    setBehavior(name): void
    setFacing(dir): void
    getBounds(): Rect
  }
  
  renderers = {
    procedural: ProceduralRenderer,  // 当前 Canvas
    sprite: SpriteRenderer,          // PNG 精灵图（参考 ST）
    live2d: Live2DRenderer,          // Live2D 模型（参考 airi）
  }

F2：精灵图渲染器（来自 SillyTavern 的 sprite 系统）
  - 加载目录下所有 PNG
  - 文件名 → 情绪映射
  - 平滑过渡动画
  - 多帧 GIF/APNG 支持

F3：Agent 进度可视化（pet-companion 独有优势）
  - 画布叠加进度条/旋转指示器
  - thinking → 闪烁问号
  - working → 进度条 + 任务名
  - deploy → 火箭动画
  - done → 烟花粒子
```

### G 组：外部协作增强

**airi 贡献**：WebSocket 消息总线 + 多服务（Discord/Telegram/Twitter 机器人）+ MCP 协议
**SillyTavern 贡献**：服务端插件系统 + API 端点

**实施方案**：

```
G1：上下文注入 API（从 airi 的 context-registry 学习）
  POST localhost:9876/context
  {"source":"hermes","content":"正在分析 3 个文件...","priority":"high"}
  → emotionBrain 构建 prompt 时自动注入

G2：MCP 工具发现（从 airi 的 MCP store 学习）
  GET localhost:9876/tools → 返回 function-calling schema
  Agent 自动发现 pet 的能力并注册为可用工具

G3：Skill 注册协议增强
  当前：简单 POST 注册
  改进：
  - 心跳保活
  - 能力协商（capability negotiation）
  - 版本检查
  - 降级优雅处理
```

---

## 三、优先级矩阵

按 工作量 × 影响力 排序：

```
影响力  ↑
 高     │  C2 本地情绪  │  A1 词条记忆  │
        │  B1 TTS语音   │  D1 角色卡    │  F3 进度可视化
        │  G1 上下文API │  A3 变量追踪  │
  ──────┼───────────────┼───────────────┼──────────────
 中     │  C3 精灵图接口│  E1 Prompt模板│  D2 角色卡映射
        │  F1 渲染器接口│  B2 TTS升级   │  E2 多后端
  ──────┼───────────────┼───────────────┼──────────────
 低     │  G2 MCP发现   │  C1 情绪扩展  │  D3 多角色
        │               │               │  B3 STT输入
        └───────────────┴───────────────┴──────────────
          小工作量          中工作量          大工作量
```

---

## 四、推荐实施路线

### 第一阶段：立刻见效（3 项，约 300 行代码）

| # | 功能 | 来自 | 效果 |
|---|------|------|------|
| 1 | **World Info 词条记忆** | ST | pet 记住用户说过的话，下次自动关联 |
| 2 | **TTS 语音输出** | 两者 | 气泡文字同时用系统语音读出 |
| 3 | **变量追踪** | ST | 关系值/好感度随互动累积演变 |

### 第二阶段：情绪升级（3 项，约 500 行）

| # | 功能 | 来自 | 效果 |
|---|------|------|------|
| 4 | **本地 ONNX 情绪分类** | ST | 离线快速情绪反应，不依赖 LLM |
| 5 | **精灵图渲染器接口** | ST + airi | 不锁死 Canvas，可换 PNG/Live2D |
| 6 | **Agent 进度可视化** | 独家 | thinking/working/done → 画布动画 |

### 第三阶段：生态兼容（4 项，约 800 行）

| # | 功能 | 来自 | 效果 |
|---|------|------|------|
| 7 | **角色卡 PNG 导入导出** | ST | 兼容 SillyTavern 生态，可分享 |
| 8 | **Prompt 模板化** | ST | 用户可自定义 prompt 结构 |
| 9 | **多 LLM 后端** | airi | Ollama + Anthropic + Gemini |
| 10 | **上下文注入 API** | airi | Agent 可向 pet 推送上下文 |

### 第四阶段：体验打磨（可选）

| # | 功能 | 来自 |
|---|------|------|
| 11 | 情绪扩展 15→28 + 多帧精灵图 | ST |
| 12 | TTS 升级（十一labs / API） | airi |
| 13 | STT 语音输入 | 两者 |
| 14 | 多角色切换 | 两者 |
| 15 | MCP 工具发现协议 | airi |

---

## 五、关键设计原则

从 airi 学到的：
- **Provider 抽象**：不要绑死一个 LLM 后端
- **渲染器可替换**：Live2D/VRM/Canvas 共用接口
- **DI 管理依赖**：避免 god object

从 SillyTavern 学到的：
- **词条匹配优于向量搜索**：简单、可解释、零基础设施
- **三层 Prompt 分离**：Context + Instruct + System
- **PNG 作为角色容器**：格式自描述、生态兼容

pet-companion 独有的：
- **Agent 进度可视化**：两个参考项目都没做——这是差异化优势
- **最小化**：不需要 48 个包，一个目录就够了
