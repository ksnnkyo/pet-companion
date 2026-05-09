import { defineStore } from 'pinia';

/**
 * 关系变量追踪系统
 * 每次互动微调数值，注入 LLM prompt 影响对话风格
 */
export const useVariablesStore = defineStore('variables', {
  state: () => ({
    values: {
      affection: 50,    // 好感度 0-100
      trust: 50,        // 信任度 0-100
      familiarity: 30,  // 熟悉度 0-100
      energy: 70,       // 当前精力 0-100
      mood: 60,         // 当前心情 0-100
    },
    history: [],        // [{time, var, delta, reason}]
  }),

  actions: {
    async load() {
      const saved = await window.electronAPI?.getConfig('variables');
      if (saved?.values) this.values = { ...this.values, ...saved.values };
      if (saved?.history) this.history = saved.history.slice(-100);
    },

    async save() {
      await window.electronAPI?.setConfig('variables', {
        values: this.values,
        history: this.history.slice(-100),
      });
    },

    adjust(variable, delta, reason = '') {
      if (this.values[variable] === undefined) return;
      const old = this.values[variable];
      this.values[variable] = Math.max(0, Math.min(100, old + delta));
      this.history.push({
        time: Date.now(),
        var: variable,
        delta,
        reason,
      });
      if (this.history.length > 200) this.history = this.history.slice(-100);
      this.save();
    },

    // 事件驱动的自动调整
    onUserMessage()     { this.adjust('familiarity', 1, '对话'); },
    onUserClick()       { this.adjust('affection', 2, '互动'); },
    onAgentDone()       { this.adjust('affection', 1, 'Agent完成任务'); },
    onAgentError()      { this.adjust('mood', -3, 'Agent出错'); },
    onIdleReminder()    { this.adjust('energy', -2, '时间流逝'); },

    // 生成注入 LLM 的变量文本
    promptContext() {
      const v = this.values;
      const parts = [];
      if (v.affection > 70) parts.push(`好感度：${v.affection}（很喜欢你）`);
      else if (v.affection < 30) parts.push(`好感度：${v.affection}（还不太熟）`);
      if (v.trust > 70) parts.push(`信任度：${v.trust}（非常信任）`);
      if (v.familiarity < 40) parts.push(`熟悉度：${v.familiarity}（正在了解你）`);
      else if (v.familiarity > 70) parts.push(`熟悉度：${v.familiarity}（很了解你）`);
      if (v.energy < 30) parts.push(`精力：${v.energy}（有点累）`);
      if (v.mood < 30) parts.push(`心情：${v.mood}（不太好）`);
      return parts.length ? `[关系状态]\n${parts.join('\n')}` : '';
    },
  },
});
