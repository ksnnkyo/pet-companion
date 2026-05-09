import { defineStore } from 'pinia';

/**
 * 情绪执行器 — 接收 emotionBrain 或外部 API 的情绪指令并执行。
 * 不再有自主的随机状态机。所有情绪变化由外部驱动。
 */
export const usePetStore = defineStore('pet', {
  state: () => ({
    currentEmotion: 'idle',
    currentBehavior: 'idle',
    currentIntensity: 'mild',
    lastDialogue: '',
  }),

  actions: {
    // 情绪执行（由 emotionBrain 或外部 API 调用）
    setEmotion(name, intensity = 'mild') {
      this.currentEmotion = name;
      this.currentIntensity = intensity;
    },

    // 设置行为（影响动画）
    setBehavior(name) {
      this.currentBehavior = name;
    },

    // 设置对话（同时触发气泡显示）
    setLastDialogue(text) {
      this.lastDialogue = text;
    },

    // ===== 手动触发（右键菜单、点击等，向后兼容） =====
    triggerEmotion(name, intensity = 'mild') {
      this.setEmotion(name, intensity);
    },

    triggerBehavior(name) {
      this.setBehavior(name);
    },

    // 重置到 idle
    resetToIdle() {
      this.currentEmotion = 'idle';
      this.currentIntensity = 'mild';
      this.lastDialogue = '';
    },

    // 兼容旧代码的 getRandomDialogue（现在由 emotionBrain 决定对话）
    getRandomDialogue() {
      return this.lastDialogue;
    },
  },
});
