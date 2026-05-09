import { defineStore } from 'pinia';
import { useSoulStore } from './soulStore';

export const useMovementStore = defineStore('movement', {
  state: () => ({
    moveState: 'idle',
    windowX: 0, windowY: 0,
    targetX: null, targetY: null,
    facing: 'right', isMoving: false,
    screenWidth: 0, screenHeight: 0,
    windowW: 200, windowH: 240,
    decisionTimer: null, stepTimer: null, cursorPoller: null,
    manualOverride: false,
  }),

  actions: {
    _cfg() {
      const ss = useSoulStore();
      return {
        wanderProb: ss.movement?.wanderProbability ?? 0.40,
        speed: ss.movement?.moveSpeedPxPerSec ?? 80,
        stepMs: ss.movement?.stepIntervalMs ?? 50,
      };
    },

    async init() {
      const bounds = await window.electronAPI?.getScreenBounds();
      if (bounds) { this.screenWidth = bounds.width; this.screenHeight = bounds.height; }
      const pos = await window.electronAPI?.getWindowPosition();
      if (pos) { this.windowX = pos.x; this.windowY = pos.y; }
      this.startDecisionLoop(); this.startCursorPolling();
    },

    destroy() { this.stopDecisionLoop(); this.stopStepLoop(); this.stopCursorPolling(); },

    setManualOverride(v) { this.manualOverride = v; if (v) { this.moveState = 'manual'; this.stopStepLoop(); } },

    syncPosition(x, y) { this.windowX = x; this.windowY = y; },

    startDecisionLoop() {
      this.stopDecisionLoop();
      const next = () => {
        const delay = 8000 + Math.random() * 12000;
        this.decisionTimer = setTimeout(() => { this.decideNextAction(); next(); }, delay);
      };
      next();
    },
    stopDecisionLoop() { if (this.decisionTimer) { clearTimeout(this.decisionTimer); this.decisionTimer = null; } },

    decideNextAction() {
      if (this.manualOverride) return;
      if (Math.random() < this._cfg().wanderProb) this.startWandering();
    },

    startWandering() {
      if (this.moveState === 'wandering' || this.manualOverride) return;
      const m = 60;
      const minX = m, maxX = Math.max(this.screenWidth - this.windowW - m, m);
      const minY = m, maxY = Math.max(this.screenHeight - this.windowH - m, m);
      this.targetX = minX + Math.floor(Math.random() * (maxX - minX));
      this.targetY = minY + Math.floor(Math.random() * (maxY - minY));
      this.moveState = 'wandering';
      this.startStepLoop();
    },

    startStepLoop() {
      this.stopStepLoop();
      this.stepTimer = setInterval(() => this.stepTowardTarget(), this._cfg().stepMs);
    },
    stopStepLoop() { if (this.stepTimer) { clearInterval(this.stepTimer); this.stepTimer = null; } this.isMoving = false; },

    stepTowardTarget() {
      if (this.moveState !== 'wandering' || this.targetX === null || this.manualOverride) { this.stopStepLoop(); return; }
      const dx = this.targetX - this.windowX, dy = this.targetY - this.windowY;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < 8) { this.windowX = this.targetX; this.windowY = this.targetY; this.moveState = 'idle'; this.isMoving = false; this.targetX = null; this.targetY = null; this.stopStepLoop(); return; }
      const speed = this._cfg().speed / (1000 / this._cfg().stepMs);
      const sx = Math.sign(dx) * Math.min(Math.abs(dx), speed);
      const sy = Math.sign(dy) * Math.min(Math.abs(dy), speed);
      this.windowX += sx; this.windowY += sy;
      this.facing = dx > 0 ? 'right' : 'left';
      this.isMoving = true;
      window.electronAPI?.moveWindowBy(sx, sy);
    },

    startCursorPolling() {
      this.stopCursorPolling();
      this.cursorPoller = setInterval(async () => {
        if (this.manualOverride) return;
        const pos = await window.electronAPI?.getCursorPosition();
        if (!pos) return;
        const cx = pos.x, cy = pos.y;
        const pcx = this.windowX + this.windowW / 2;
        this.facing = cx < pcx ? 'left' : 'right';
        const dist = Math.sqrt((cx-pcx)**2 + (cy-this.windowY-this.windowH/2)**2);
        if (dist < 200 && this.moveState === 'idle') { /* approach not implemented */ }
      }, 500);
    },
    stopCursorPolling() { if (this.cursorPoller) { clearInterval(this.cursorPoller); this.cursorPoller = null; } },

    moveTo(x, y) {
      this.targetX = Math.max(0, Math.min(x, this.screenWidth - this.windowW));
      this.targetY = Math.max(0, Math.min(y, this.screenHeight - this.windowH));
      this.moveState = 'wandering'; this.startStepLoop();
    },
  },
});
