const { app, BrowserWindow, ipcMain, Menu, screen, powerMonitor, Notification } = require('electron');
const path = require('path');
const log = require('electron-log');
const { createServer } = require('./httpServer');
const { createMainWindow, createChatWindow, createSettingsWindow, createCompanionEditor, createTray, createMenuBar, getWindows } = require('./windowManager');

log.transports.file.level = 'info';
log.transports.console.level = 'debug';
log.info('PetCompanion 启动...');

app.dock?.hide();

// ===== IPC 处理器 =====
function setupIPC() {
  ipcMain.on('hide-window', () => getWindows().mainWindow?.hide());
  ipcMain.on('show-window', () => { getWindows().mainWindow?.show(); getWindows().mainWindow?.focus(); });

  ipcMain.handle('get-window-position', () => {
    const w = getWindows().mainWindow;
    if (!w) return { x: 0, y: 0 };
    const p = w.getPosition(); return { x: p[0], y: p[1] };
  });

  ipcMain.on('move-window', (_e, { x, y }) => getWindows().mainWindow?.setPosition(x, y));
  ipcMain.on('move-window-by', (_e, { dx, dy }) => {
    const w = getWindows().mainWindow;
    if (!w) return;
    const p = w.getPosition();
    w.setPosition(p[0] + Math.round(dx), p[1] + Math.round(dy));
  });

  ipcMain.handle('get-screen-bounds', () => {
    const wa = screen.getPrimaryDisplay().workArea;
    return { x: wa.x, y: wa.y, width: wa.width, height: wa.height };
  });

  ipcMain.handle('get-cursor-position', () => screen.getCursorScreenPoint());

  // 右键菜单
  ipcMain.on('show-context-menu', () => {
    const menu = Menu.buildFromTemplate([
      { label: '摸一下', click: () => getWindows().mainWindow?.webContents.send('pet-action', { action: 'pet', zone: 'head' }) },
      { label: '喂食',   click: () => getWindows().mainWindow?.webContents.send('pet-action', { action: 'feed' }) },
      { label: '玩耍',   click: () => getWindows().mainWindow?.webContents.send('pet-action', { action: 'play' }) },
      { type: 'separator' },
      { label: '聊天',   click: createChatWindow },
      { label: '设置',   click: createSettingsWindow },
      { label: '显示宠物', click: () => getWindows().mainWindow?.show() },
      { label: '隐藏宠物', click: () => getWindows().mainWindow?.hide() },
      { type: 'separator' },
      { label: '退出',   click: () => app.quit() },
    ]);
    menu.popup({ window: getWindows().mainWindow });
  });

  // 外部触发转发
  ipcMain.on('trigger-emotion-external', (_e, { name, intensity }) => {
    getWindows().mainWindow?.webContents.send('trigger-emotion', { name, intensity });
  });
  ipcMain.on('show-bubble-external', (_e, { text }) => {
    getWindows().mainWindow?.webContents.send('show-bubble', { text });
  });

  // 聊天窗口
  ipcMain.on('open-chat-window', createChatWindow);
  ipcMain.on('close-chat-window', () => {
    const cw = getWindows().chatWindow;
    if (cw && !cw.isDestroyed()) cw.close();
  });

  // 伴侣编辑窗口
  ipcMain.on('open-companion-editor', (_e, data) => createCompanionEditor(data));
  ipcMain.on('companion-editor-save', (_e, data) => {
    getWindows().settingsWindow?.webContents.send('companion-saved', data);
    getWindows().companionEditor?.close();
  });
  ipcMain.on('companion-editor-cancel', () => {
    getWindows().companionEditor?.close();
  });

  // LLM 对话（聊天窗口用）
  ipcMain.handle('chat-completion', async (_e, payload) => {
    const { message, history = [], config = {}, profile = {}, emotion = 'idle', intensity = 'mild' } = payload;
    const apiKey = config.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      const t = String(message || '').toLowerCase();
      let reply = '我听到了。现在没有 API Key，先用本地模式陪你~';
      if (t.includes('你好')) reply = '你好呀，我在呢~';
      else if (t.includes('难过') || t.includes('累')) reply = '先停一下，我陪你把事情拆小一点。';
      else if (t.includes('开心')) reply = '我也被你带开心了！';
      return { text: reply, source: 'local' };
    }
    const url = (config.baseURL || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const endpoint = url.endsWith('/chat/completions') ? url : `${url}/chat/completions`;
    const pd = profile.personality?.dimensions || {};
    const systemPrompt = [
      `你是桌面宠物 ${profile.personality?.name || profile.name || '小伴'}，输出短自然适合气泡。`,
      `基调：${profile.personality?.tone || '温暖治愈'}。当前情绪：${emotion}/${intensity}。`,
      pd.expressiveness > 65 ? '说话含蓄，用语气词~' : pd.expressiveness < 40 ? '说话直接简短。' : '',
      pd.maternity > 70 ? '你母性强，喜欢照料。' : '',
      pd.possessiveness > 70 ? '占有欲强。' : '',
      pd.libido > 70 ? '可带暧昧。' : '',
      '不要冗长，1-2 句。'
    ].filter(Boolean).join('\n');
    const body = JSON.stringify({
      model: config.model || 'gpt-4o-mini',
      messages: [{ role: 'system', content: systemPrompt }, ...history.slice(-12), { role: 'user', content: String(message) }],
      temperature: Number(config.temperature) || 0.8,
      max_tokens: Number(config.maxTokens) || 200,
    });
    try {
      const resp = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body });
      if (!resp.ok) throw new Error(`API ${resp.status}`);
      const data = await resp.json();
      return { text: data?.choices?.[0]?.message?.content?.trim() || '...', source: 'openai' };
    } catch (e) { return { text: `请求失败: ${e.message}`, source: 'error' }; }
  });

  // 配置读写
  ipcMain.handle('get-config', async (_e, key) => {
    try { const Store = (await import('electron-store')).default; return new Store().get(key); }
    catch { return null; }
  });
  ipcMain.on('set-config', async (_e, { key, value }) => {
    try { const Store = (await import('electron-store')).default; new Store().set(key, value); }
    catch { /* ignore */ }
  });

  // 提醒配置
  ipcMain.on('set-reminder-config', async (_e, { minutes }) => {
    try { const Store = (await import('electron-store')).default; new Store().set('reminderMinutes', minutes); refreshReminder(); }
    catch { /* ignore */ }
  });
  ipcMain.handle('get-reminder-config', async () => {
    try { const Store = (await import('electron-store')).default; return new Store().get('reminderMinutes') || 0; }
    catch { return 0; }
  });

  log.info('IPC 处理器注册完成');
}

// ===== 定时提醒 =====
let reminderInterval = null;
let reminderMinutes = 0;

async function refreshReminder() {
  if (reminderInterval) { clearInterval(reminderInterval); reminderInterval = null; }
  try { const Store = (await import('electron-store')).default; reminderMinutes = new Store().get('reminderMinutes') || 0; }
  catch { reminderMinutes = 0; }
  if (reminderMinutes > 0) {
    reminderInterval = setInterval(() => {
      if (Notification.isSupported()) new Notification({ title: '小伴提醒你', body: '已经工作一段时间了，起来活动一下吧~' }).show();
      getWindows().mainWindow?.webContents.send('trigger-emotion', { name: 'comforting', intensity: 'mild' });
    }, reminderMinutes * 60 * 1000);
  }
}

// ===== 空闲检测 =====
function startIdleDetection() {
  let lastReminderAt = 0;
  const COOLDOWN = 30 * 60 * 1000;
  setInterval(() => {
    try {
      const idle = powerMonitor.getSystemIdleTime();
      const now = Date.now();
      if (idle > 1200 && (now - lastReminderAt) > COOLDOWN) {
        lastReminderAt = now;
        getWindows().mainWindow?.webContents.send('trigger-emotion', { name: 'lonely', intensity: 'medium' });
        if (Notification.isSupported()) new Notification({ title: '小伴', body: '你还在吗...有点想你了...' }).show();
      }
      if (idle > 3600 && (now - lastReminderAt) > COOLDOWN) {
        lastReminderAt = now;
        getWindows().mainWindow?.webContents.send('trigger-emotion', { name: 'sleepy', intensity: 'mild' });
      }
    } catch { /* powerMonitor may not be supported */ }
  }, 60000);
}

// ===== 启动 =====
app.whenReady().then(() => {
  log.info('App ready');
  setupIPC();
  createMenuBar();
  createMainWindow();
  createTray();

  // HTTP + WebSocket 服务器
  let api = null;
  try {
    api = createServer({
      mainWindow: getWindows().mainWindow,
      ipcMain,
      sendToRenderer: (ch, d) => getWindows().mainWindow?.webContents.send(ch, d),
    });
  } catch (e) { log.warn('HTTP 服务器启动失败:', e.message); }

  // Pet → Agent 事件转发
  ipcMain.on('pet-event', (_e, { type, data }) => {
    if (api) { api.broadcastToAgents({ type, ...data }); api.fireWebhook(type, data); }
  });

  // Skill 自注册
  setTimeout(async () => {
    const desc = { name:'pet-companion', version:'1.1', ws:'ws://127.0.0.1:9876', manifest:'http://127.0.0.1:9876/manifest', tools:'http://127.0.0.1:9876/tools', health:'http://127.0.0.1:9876/health' };
    for (const url of ['http://127.0.0.1:11434/api/skills/register','http://127.0.0.1:8080/skills/register','http://127.0.0.1:8888/skills/register']) {
      try { await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(desc), signal:AbortSignal.timeout(2000) }); }
      catch { /* not running */ }
    }
  }, 3000);

  startIdleDetection();
  refreshReminder();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (reminderInterval) clearInterval(reminderInterval);
  log.info('PetCompanion 退出');
});
