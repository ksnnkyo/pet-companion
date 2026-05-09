const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = 9876;
const HOST = '127.0.0.1';

let wss = null;
let broadcastToPet = null;  // 主进程注入：向 renderer 发送消息

function sendJSON(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (e) { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

// ===== 存储（进程内缓存） =====
const state = {
  agentWebhook: '',
  agentStatusUrl: '',
  lastAgentStatus: null,
  // 缓存的 pet 状态，避免每次 /status 都 4 次 IPC
  cachedPetStatus: { emotion: 'idle', intensity: 'mild', behavior: 'idle' },
};

// ===== WebSocket 处理 =====
function setupWebSocket(server) {
  wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    console.log('[WS] Agent connected');

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        handleWSMessage(msg, ws);
      } catch (e) {
        ws.send(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });

    ws.on('close', () => {
      console.log('[WS] Agent disconnected');
    });

    // 发送欢迎消息
    ws.send(JSON.stringify({
      type: 'connected',
      manifest: getManifest(),
    }));
  });
}

function handleWSMessage(msg, ws) {
  switch (msg.type) {
    case 'emotion':
      broadcastToPet?.('trigger-emotion', { name: msg.name, intensity: msg.intensity || 'mild' });
      break;
    case 'say':
      broadcastToPet?.('show-bubble', { text: msg.text });
      break;
    case 'move':
      broadcastToPet?.('move-window-to', { x: msg.x, y: msg.y });
      break;
    case 'notification':
      if (msg.title || msg.body) {
        const { Notification } = require('electron');
        new Notification({ title: msg.title || 'PetCompanion', body: msg.body || '' }).show();
      }
      break;
    case 'agent-state':
      state.lastAgentStatus = { ...msg, timestamp: Date.now() };
      // 转发给 renderer 触发情绪映射
      broadcastToPet?.('agent-state', state.lastAgentStatus);
      break;
    case 'get-status':
      broadcastToPet?.('request-status');
      // 状态会通过 report-status IPC 返回，然后通过 WS 发送
      break;
    default:
      ws.send(JSON.stringify({ type: 'error', message: `Unknown type: ${msg.type}` }));
  }
}

// 向所有 WS 客户端广播（Pet → Agent 事件）
function broadcastToAgents(data) {
  if (!wss) return;
  wss.clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  });
}

// ===== Webhook 回调 =====
async function fireWebhook(event, data) {
  const url = state.agentWebhook;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, ...data, timestamp: Date.now() }),
    });
  } catch (e) {
    // webhook 失败静默
  }
}

// ===== MCP / Function-Calling Tools Schema =====
// 兼容 OpenAI function-calling / Anthropic tool-use 格式
function getTools() {
  return {
    format: 'openai-function-calling',
    tools: [
      {
        type: 'function',
        function: {
          name: 'pet_emotion',
          description: '设置桌面宠物的情绪状态。根据 Agent 当前任务进展调用，让宠物展示对应的表情。',
          parameters: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                enum: ['happy','sad','angry','surprised','curious','proud','excited','sleepy','worried','lonely','comforting','affectionate','shy','coquettish','dazed'],
                description: '情绪名称。常用映射：任务开始→curious，进展顺利→happy，遇到错误→worried/angry，完成→proud/excited，等待用户→lonely'
              },
              intensity: {
                type: 'string',
                enum: ['mild','medium','intense'],
                description: '强度。mild=轻微表情，medium=明显，intense=强烈。默认 medium'
              }
            },
            required: ['name']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'pet_say',
          description: '让宠物显示对话气泡。用于向用户传递简短消息、鼓励、提醒。1-2 句，放在气泡里。',
          parameters: {
            type: 'object',
            properties: {
              text: {
                type: 'string',
                description: '气泡显示的文字。应简短（20字以内），自然口语。例如"重构完成啦~"、"这个 Bug 有点难搞..."'
              }
            },
            required: ['text']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'pet_notify',
          description: '通过宠物发送 macOS 系统通知。用于重要提醒、任务完成告知。',
          parameters: {
            type: 'object',
            properties: {
              title: { type: 'string', description: '通知标题' },
              body: { type: 'string', description: '通知正文' }
            },
            required: ['title']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'pet_agent_state',
          description: '上报 Agent 运行状态，宠物会根据状态自动调整情绪和对话。',
          parameters: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: ['idle','thinking','working','done','error','waiting'],
                description: 'Agent 状态'
              },
              task: { type: 'string', description: '当前任务描述，如"重构 UserService"' },
              taskType: {
                type: 'string',
                enum: ['code','debug','review','refactor','deploy','chat','research','other'],
                description: '任务类型'
              },
              progress: { type: 'number', minimum: 0, maximum: 1, description: '进度 0~1' },
              details: { type: 'string', description: '补充信息' }
            },
            required: ['status']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'pet_move',
          description: '移动宠物窗口到屏幕指定位置。',
          parameters: {
            type: 'object',
            properties: {
              x: { type: 'number', description: '屏幕 X 坐标' },
              y: { type: 'number', description: '屏幕 Y 坐标' }
            },
            required: ['x','y']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'pet_status',
          description: '查询宠物当前情绪、位置等状态。',
          parameters: { type: 'object', properties: {} }
        }
      }
    ],
    usage: 'Agent 在 system prompt 中包含这些 tools，完成子任务后自动调用对应函数。',
    examples: {
      '任务开始': { tool: 'pet_emotion', params: { name: 'curious', intensity: 'mild' } },
      '重构完成': { tool: 'pet_emotion', params: { name: 'proud', intensity: 'medium' } },
      '重构完成+说': [
        { tool: 'pet_emotion', params: { name: 'proud', intensity: 'medium' } },
        { tool: 'pet_say', params: { text: '重构完成！清爽多了~' } }
      ],
      '遇到错误': { tool: 'pet_emotion', params: { name: 'wronged', intensity: 'medium' } },
      '长时间思考': { tool: 'pet_agent_state', params: { status: 'thinking', task: '分析架构', progress: 0.5 } },
      '提醒休息': { tool: 'pet_notify', params: { title: '小伴提醒', body: '工作一个多小时了，起来活动下~' } }
    }
  };
}

// ===== Manifest =====
function getManifest() {
  return {
    name: 'pet-companion',
    version: '1.1',
    description: 'AI Desktop Pet Companion — 情感交互桌面宠物智能体',
    protocol: 'http+ws',
    host: `${HOST}:${PORT}`,
    capabilities: ['emotion', 'dialogue', 'notification', 'movement', 'status', 'agent-state-subscribe'],
    endpoints: {
      'POST /emotion':     { desc: '触发情绪', body: { name: 'happy|sad|angry|...', intensity: 'mild|medium|intense' } },
      'POST /say':         { desc: '显示气泡', body: { text: 'string' } },
      'POST /move':        { desc: '移动窗口', body: { x: 'number', y: 'number' } },
      'POST /notification':{ desc: '系统通知', body: { title: 'string', body: 'string' } },
      'POST /agent-state': { desc: '上报 Agent 状态', body: { status: 'thinking|done|error|idle', task: 'string', progress: '0-1' } },
      'POST /config':      { desc: '配置 webhook/agent-url', body: { agentWebhook: 'url', agentStatusUrl: 'url' } },
      'GET  /status':      { desc: '查询 Pet 当前状态' },
      'GET  /manifest':    { desc: '本描述' },
      'GET  /health':      { desc: '健康检查' },
      'ws://...':          { desc: 'WebSocket 双向通道：send JSON {type, ...}' },
    },
    emotions: ['shy','affectionate','coquettish','happy','sad','angry','lonely','excited','sleepy','dazed','curious','proud','comforting','wronged','surprised'],
    intensities: ['mild','medium','intense'],
    wsMessageTypes: {
      'Agent→Pet': ['emotion','say','move','notification','agent-state','get-status'],
      'Pet→Agent': ['status','clicked','message','emotion-changed'],
    },
  };
}

// ===== HTTP 路由 =====
function handlePost(pathname, data, res, { mainWindow }) {
  switch (pathname) {
    case '/emotion':
      if (!data.name) { sendJSON(res, 400, { error: 'Missing "name"' }); return; }
      broadcastToPet?.('trigger-emotion', { name: data.name, intensity: data.intensity || 'mild' });
      sendJSON(res, 200, { ok: true });
      break;

    case '/say':
      if (!data.text) { sendJSON(res, 400, { error: 'Missing "text"' }); return; }
      broadcastToPet?.('show-bubble', { text: String(data.text) });
      sendJSON(res, 200, { ok: true });
      break;

    case '/move':
      if (data.x === undefined || data.y === undefined) { sendJSON(res, 400, { error: 'Missing x/y' }); return; }
      mainWindow?.setPosition(Math.round(data.x), Math.round(data.y));
      sendJSON(res, 200, { ok: true });
      break;

    case '/notification':
      if (!data.title && !data.body) { sendJSON(res, 400, { error: 'Missing title/body' }); return; }
      { const { Notification } = require('electron');
        new Notification({ title: data.title || 'PetCompanion', body: data.body || '' }).show(); }
      sendJSON(res, 200, { ok: true });
      break;

    case '/agent-state':
      state.lastAgentStatus = { ...data, timestamp: Date.now() };
      broadcastToPet?.('agent-state', state.lastAgentStatus);
      sendJSON(res, 200, { ok: true });
      break;

    case '/context':
      if (!data.content) { sendJSON(res, 400, { error: 'Missing "content"' }); return; }
      broadcastToPet?.('agent-context', {
        source: data.source || 'external',
        content: data.content,
        priority: data.priority || 'normal',
      });
      sendJSON(res, 200, { ok: true });
      break;

    case '/config':
      if (data.agentWebhook !== undefined) state.agentWebhook = data.agentWebhook;
      if (data.agentStatusUrl !== undefined) state.agentStatusUrl = data.agentStatusUrl;
      sendJSON(res, 200, { ok: true, config: { agentWebhook: state.agentWebhook, agentStatusUrl: state.agentStatusUrl } });
      break;

    default:
      sendJSON(res, 404, { error: `Unknown: ${pathname}` });
  }
}

async function handleGet(pathname, res, { mainWindow }) {
  switch (pathname) {
    case '/status':
      // O(1) 直接返回缓存，无 IPC 往返
      sendJSON(res, 200, state.cachedPetStatus);
      break;

    case '/tools':
      sendJSON(res, 200, getTools());
      break;

    case '/manifest':
      sendJSON(res, 200, getManifest());
      break;

    case '/health':
      sendJSON(res, 200, { ok: true, uptime: process.uptime() });
      break;

    default:
      sendJSON(res, 404, { error: `Unknown: ${pathname}` });
  }
}

// ===== 创建服务器 =====
function createServer({ mainWindow, ipcMain, sendToRenderer }) {
  broadcastToPet = sendToRenderer || ((channel, data) => {
    mainWindow?.webContents.send(channel, data);
  });

  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

    const url = new URL(req.url, `http://${HOST}:${PORT}`);

    try {
      if (req.method === 'POST') {
        const data = await readBody(req);
        handlePost(url.pathname, data, res, { mainWindow });
      } else if (req.method === 'GET') {
        await handleGet(url.pathname, res, { mainWindow });
      } else {
        sendJSON(res, 405, { error: 'Method not allowed' });
      }
    } catch (e) {
      sendJSON(res, 400, { error: e.message });
    }
  });

  setupWebSocket(server);

  // 监听 renderer 上报状态 → 缓存 + 转发
  const { ipcMain: ipc } = require('electron');
  ipc.on('report-status', (_e, status) => {
    state.cachedPetStatus = { ...state.cachedPetStatus, ...status };
    broadcastToAgents({ type: 'status', ...status });
  });
  // 定时同步最新状态（兜底）
  setInterval(() => { broadcastToPet?.('request-status'); }, 10000);

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[HTTP] Port ${PORT} in use, server not started.`);
    } else {
      console.error('[HTTP] Error:', err.message);
    }
  });

  server.listen(PORT, HOST, () => {
    console.log(`[HTTP] API     http://${HOST}:${PORT}`);
    console.log(`[WS]  WebSocket ws://${HOST}:${PORT}`);
    console.log(`[API] Endpoints: /emotion /say /move /notification /agent-state /config /status /manifest /health`);
  });

  return { server, broadcastToAgents, fireWebhook, getState: () => state };
}

module.exports = { createServer };
