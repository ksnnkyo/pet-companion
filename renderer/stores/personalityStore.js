import { defineStore } from 'pinia';
import personalityData from '../assets/personality.json';
import { useSoulStore } from './soulStore';

export const usePersonalityStore = defineStore('personality', {
  state: () => ({
    dimensions: { ...personalityData.presets['温柔人妻'] },
    name: '小伴',
    tone: '温暖治愈',
    presets: personalityData.presets,
    meta: personalityData.dimensions,
    modifiers: personalityData.emotionModifiers,
  }),

  getters: {
    profile() {
      return {
        name: this.name,
        tone: this.tone,
        dimensions: { ...this.dimensions },
      };
    },

    // 行为修正因子
    wanderProbMod() { return 1 + this.getMod('extraversion', 'wanderProb') * (this.dimensions.extraversion - 50) / 50; },
    idleIntervalMod() { return 1 + this.getMod('extraversion', 'idleInterval') * (this.dimensions.extraversion - 50) / 50; },
    chainProbMod() { return 1 + this.getMod('sensitivity', 'chainProb') * (this.dimensions.sensitivity - 50) / 50; },
    approachProbMod() { return 1 + this.getMod('clinginess', 'approachProb') * (this.dimensions.clinginess - 50) / 50; },
    lonelyDelayMod() { return 1 + this.getMod('clinginess', 'lonelyDelay') * (this.dimensions.clinginess - 50) / 50; },
    fpsMod() { return 1 + this.getMod('energy', 'fpsMod') * (this.dimensions.energy - 50) / 50; },
    bubbleDurationMod() { return 1 + this.getMod('expressiveness', 'bubbleDuration') * (this.dimensions.expressiveness - 50) / 50; },
    angryThresholdMod() { return 1 + this.getMod('tolerance', 'angryThreshold') * (this.dimensions.tolerance - 50) / 50; },
    attachmentMod() { return 1 + this.getMod('attachment', 'separationSensitivity') * (this.dimensions.attachment - 50) / 50; },
    possessiveMod() { return 1 + this.getMod('possessiveness', 'jealousWeight') * (this.dimensions.possessiveness - 50) / 50; },
    libidoMod() { return 1 + this.getMod('libido', 'flirtyWeight') * (this.dimensions.libido - 50) / 50; },
    demandingMod() { return 1 + this.getMod('demandingness', 'proactiveMessage') * (this.dimensions.demandingness - 50) / 50; },
  },

  actions: {
    getMod(dim, key) {
      return this.modifiers[dim]?.[key] || 0;
    },

    setDimension(key, value) {
      this.dimensions[key] = Math.max(0, Math.min(100, value));
      this.save();
    },

    applyPreset(name) {
      const preset = this.presets[name];
      if (preset) {
        this.dimensions = { ...preset };
        this.save();
      }
    },

    async load() {
      const saved = await window.electronAPI?.getConfig('personality');
      if (saved) {
        if (saved.dimensions) this.dimensions = { ...this.dimensions, ...saved.dimensions };
        if (saved.name) this.name = saved.name;
        if (saved.tone) this.tone = saved.tone;
      }
    },

    async save() {
      await window.electronAPI?.setConfig('personality', {
        dimensions: this.dimensions,
        name: this.name,
        tone: this.tone,
      });
    },

    // 根据人格调整情绪权重
    getAdjustedEmotionWeights() {
      const soulStore = useSoulStore();
      const weights = { ...soulStore.emotionWeights };

      // 活力低 → 困倦增多
      if (this.dimensions.energy < 40) weights.sleepy = (weights.sleepy || 6) + 4;
      // 包容高 → 生气减少
      if (this.dimensions.tolerance > 60) weights.angry = Math.max(1, (weights.angry || 4) - 2);
      // 情欲高 → 亲昵增多
      if (this.dimensions.libido > 60) weights.affectionate = (weights.affectionate || 7) + 3;
      // 占有欲高 → 委屈增多
      if (this.dimensions.possessiveness > 65) weights.wronged = (weights.wronged || 4) + 3;
      // 索取度高 → 撒娇增多
      if (this.dimensions.demandingness > 65) weights.coquettish = (weights.coquettish || 6) + 3;
      // 母性高 → 安抚增多
      if (this.dimensions.maternity > 60) weights.comforting = (weights.comforting || 5) + 3;

      return weights;
    },

    // 根据人格和上下文生成 LLM 系统提示
    buildSystemPrompt(context = {}) {
      const d = this.dimensions;
      const lines = [
        '你是桌面宠物智能体，输出应短、自然、适合放在气泡里。',
        `名字：${this.name}。基调：${this.tone}。`,
      ];

      if (d.expressiveness < 40) lines.push('说话风格：直接高效，短句，不废话。');
      else if (d.expressiveness > 65) lines.push('说话风格：含蓄婉转，话里有话，用小波浪线和语气词。');

      if (d.sophistication > 70) lines.push('你洞察人心，说话点到为止，不点破但让人回味。');
      else if (d.sophistication < 45) lines.push('你有点天真，不善于揣测人心，说话比较直接。');

      if (d.attachment > 70) lines.push('你非常依恋对方，分开片刻就会想念。');
      if (d.possessiveness > 70) lines.push('你占有欲强，不喜欢对方和别人互动。');
      if (d.libido > 70) lines.push('你欲望旺盛，表达中带有暧昧暗示。');
      if (d.dominance > 70) lines.push('你喜欢主导关系，主动掌控节奏。');
      else if (d.dominance < 30) lines.push('你顺从被动，喜欢被对方主导。');
      if (d.maternity > 70) lines.push('你有强烈的母性，喜欢照料对方。');

      if (d.extraversion < 40) lines.push('你话少安静，不轻易主动。');
      if (d.energy < 40) lines.push('你容易累，动作慵懒。');

      lines.push(`当前情绪：${context.emotion || 'idle'} / ${context.intensity || 'mild'}。`);
      lines.push('不要输出冗长说明，优先给用户可继续对话的一两句话。');

      return lines.join('\n');
    },
  },
});
