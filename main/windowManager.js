const { BrowserWindow, Tray, Menu, nativeImage, screen, app } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let chatWindow = null;
let settingsWindow = null;
let companionEditor = null;
let tray = null;

const W = 200, H = 240;           // 主窗口
const CW = 380, CH = 520;         // 聊天窗口
const SW = 420, SH = 600;         // 设置窗口
const EW = 500, EH = 700;         // 伴侣编辑窗口
const HEART = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAUCAYAAACEYr13AAAAPElEQVR4nGNgQAP/gQBdjBg5sCQpgCLNGIaMGkAFAyiORqoYQIohOFMjMYbg1UzIEKI04zKEJM2jgM4AAAY9VccO2D9MAAAAAElFTkSuQmCC';
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function placeWindow(w, h) {
  const wa = screen.getPrimaryDisplay().workArea;
  return { width: w, height: h, x: wa.x + wa.width - w - 24, y: wa.y + wa.height - h - 24 };
}

async function loadRenderer(window) {
  const distIndex = path.join(__dirname, '../renderer/dist/index.html');
  const devURL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
  if (app.isPackaged) { await window.loadFile(distIndex); return; }
  for (let i = 0; i < 12; i++) {
    try { const r = await fetch(devURL, { method: 'HEAD' }); if (r.ok) { await window.loadURL(devURL); return; } }
    catch { await new Promise(r => setTimeout(r, 250)); }
  }
  if (fs.existsSync(distIndex)) await window.loadFile(distIndex);
  else await window.loadURL(devURL);
}

function createMainWindow() {
  const b = placeWindow(W, H);
  mainWindow = new BrowserWindow({
    width: W, height: H, x: b.x, y: b.y,
    frame: false, transparent: true, alwaysOnTop: true,
    resizable: false, hasShadow: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true, preload: path.join(__dirname, 'preload.js') },
  });
  loadRenderer(mainWindow).catch(e => console.error('Renderer load failed:', e));
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setAlwaysOnTop(true, 'floating');
  mainWindow.on('closed', () => { mainWindow = null; });
  return mainWindow;
}

function createChatWindow() {
  if (chatWindow && !chatWindow.isDestroyed()) { chatWindow.show(); chatWindow.focus(); return chatWindow; }
  const wa = screen.getPrimaryDisplay().workArea;
  chatWindow = new BrowserWindow({
    width: CW, height: CH,
    x: Math.round(wa.x + (wa.width - CW) / 2),
    y: Math.round(wa.y + (wa.height - CH) / 2),
    show: true, title: '小伴 · 聊天', resizable: true, minimizable: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true, preload: path.join(__dirname, 'preload.js') },
  });
  const file = path.join(__dirname, '../renderer/chat.html');
  chatWindow.loadFile(file).catch(e => console.error('Chat load failed:', e));
  chatWindow.on('closed', () => { chatWindow = null; });
  return chatWindow;
}

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) { settingsWindow.show(); settingsWindow.focus(); return settingsWindow; }
  const wa = screen.getPrimaryDisplay().workArea;
  settingsWindow = new BrowserWindow({
    width: SW, height: SH,
    x: Math.round(wa.x + (wa.width - SW) / 2),
    y: Math.round(wa.y + (wa.height - SH) / 2),
    show: true, title: '小伴 · 设置', resizable: true, minimizable: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true, preload: path.join(__dirname, 'preload.js') },
  });
  const file = path.join(__dirname, '../renderer/settings.html');
  settingsWindow.loadFile(file).catch(e => console.error('Settings load failed:', e));
  settingsWindow.on('closed', () => { settingsWindow = null; });
  return settingsWindow;
}

function createTray() {
  let icon;
  try { icon = nativeImage.createFromDataURL(HEART); icon = icon.resize({ width: 16, height: 16 }); }
  catch { icon = nativeImage.createEmpty(); }
  tray = new Tray(icon);
  const ctxMenu = Menu.buildFromTemplate([
    { label: '打开聊天', click: createChatWindow },
    { label: '打开设置', click: createSettingsWindow },
    { type: 'separator' },
    { label: '显示宠物', click: () => mainWindow?.show() },
    { label: '隐藏宠物', click: () => mainWindow?.hide() },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() },
  ]);
  tray.setToolTip('PetCompanion');
  tray.setContextMenu(ctxMenu);
  tray.on('click', () => tray.popUpContextMenu(ctxMenu));
  return tray;
}

function createMenuBar() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: '♥', submenu: [
      { label: '打开聊天', accelerator: 'Cmd+Shift+L', click: createChatWindow },
      { label: '打开设置', accelerator: 'Cmd+Shift+S', click: createSettingsWindow },
      { type: 'separator' },
      { role: 'quit', label: '退出 PetCompanion' },
    ]},
  ]));
}

function createCompanionEditor(companionData) {
  if (companionEditor && !companionEditor.isDestroyed()) { companionEditor.show(); companionEditor.focus(); return companionEditor; }
  const wa = screen.getPrimaryDisplay().workArea;
  companionEditor = new BrowserWindow({
    width: EW, height: EH,
    x: Math.round(wa.x + (wa.width - EW) / 2),
    y: Math.round(wa.y + (wa.height - EH) / 2),
    show: true, title: '编辑伴侣', resizable: true, minimizable: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true, preload: path.join(__dirname, 'preload.js') },
  });
  const file = path.join(__dirname, '../renderer/companion-editor.html');
  companionEditor.loadFile(file).catch(e => console.error('Editor load failed:', e));
  companionEditor.on('closed', () => { companionEditor = null; });
  // 编辑器就绪后发送数据
  const ipc = require('electron').ipcMain;
  const onReady = (_e) => {
    if (companionEditor && !companionEditor.isDestroyed()) {
      companionEditor.webContents.send('companion-data', companionData || {});
    }
  };
  ipc.once('companion-editor-ready', onReady);
  companionEditor.on('closed', () => { ipc.removeListener('companion-editor-ready', onReady); });
  return companionEditor;
}

function getWindows() { return { mainWindow, chatWindow, settingsWindow, companionEditor, tray }; }

module.exports = { createMainWindow, createChatWindow, createSettingsWindow, createCompanionEditor, createTray, createMenuBar, getWindows, placeWindow, W, H };
