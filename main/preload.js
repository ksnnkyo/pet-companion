const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 窗口控制
  hideWindow: () => ipcRenderer.send('hide-window'),
  showWindow: () => ipcRenderer.send('show-window'),
  getWindowPosition: () => ipcRenderer.invoke('get-window-position'),
  moveWindow: (x, y) => ipcRenderer.send('move-window', { x, y }),
  moveWindowBy: (dx, dy) => ipcRenderer.send('move-window-by', { dx, dy }),
  setWindowExpanded: (expanded) => ipcRenderer.send('set-window-expanded', expanded),

  // 屏幕信息
  getScreenBounds: () => ipcRenderer.invoke('get-screen-bounds'),
  getCursorPosition: () => ipcRenderer.invoke('get-cursor-position'),

  // 右键菜单
  showContextMenu: () => ipcRenderer.send('show-context-menu'),

  // 配置读写
  getConfig: (key) => ipcRenderer.invoke('get-config', key),
  setConfig: (key, value) => ipcRenderer.send('set-config', { key, value }),

  // OpenAI-compatible 对话
  chatCompletion: (payload) => ipcRenderer.invoke('chat-completion', payload),

  // 通用 send（供 renderer → main）
  send: (channel, data) => ipcRenderer.send(channel, data),

  // 状态上报（供 HTTP API 查询）
  getPetStatus: () => ipcRenderer.invoke('get-pet-status'),
  reportStatus: (status) => ipcRenderer.send('report-status', status),

  // 事件监听
  openChatWindow: () => ipcRenderer.send('open-chat-window'),
  closeChatWindow: () => ipcRenderer.send('close-chat-window'),
  onOpenChat: (callback) => {
    ipcRenderer.on('open-chat', callback);
  },
  removeOpenChatListener: (callback) => {
    ipcRenderer.removeListener('open-chat', callback);
  },
  onPetAction: (callback) => {
    ipcRenderer.on('pet-action', (_event, data) => callback(data));
  },
  removePetActionListener: (callback) => {
    ipcRenderer.removeListener('pet-action', callback);
  },
  onTriggerEmotion: (callback) => {
    ipcRenderer.on('trigger-emotion', (_event, data) => callback(data));
  },
  removeTriggerEmotionListener: (callback) => {
    ipcRenderer.removeListener('trigger-emotion', callback);
  },
  onShowBubble: (callback) => {
    ipcRenderer.on('show-bubble', (_event, data) => callback(data));
  },
  removeShowBubbleListener: (callback) => {
    ipcRenderer.removeListener('show-bubble', callback);
  },
  onRequestStatus: (callback) => {
    ipcRenderer.on('request-status', () => callback());
  },
  removeRequestStatusListener: (callback) => {
    ipcRenderer.removeListener('request-status', callback);
  },
  onAgentState: (callback) => {
    ipcRenderer.on('agent-state', (_e, data) => callback(data));
  },
  removeAgentStateListener: (callback) => {
    ipcRenderer.removeListener('agent-state', callback);
  },
  onAgentContext: (callback) => {
    ipcRenderer.on('agent-context', (_e, data) => callback(data));
  },
  removeAgentContextListener: (callback) => {
    ipcRenderer.removeListener('agent-context', callback);
  },
});
