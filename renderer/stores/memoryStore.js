import { defineStore } from 'pinia';

/**
 * World Info 词条记忆系统
 * LLM 自动提取 → 关键词匹配 → 注入 prompt
 */
export const useMemoryStore = defineStore('memory', {
  state: () => ({
    entries: [],         // [{id, keys:[], content, createdAt, updatedAt, source}]
    autoExtract: true,   // LLM 自动提取记忆
  }),

  actions: {
    async load() {
      const saved = await window.electronAPI?.getConfig('memories');
      if (saved?.entries) this.entries = saved.entries;
      if (saved?.autoExtract !== undefined) this.autoExtract = saved.autoExtract;
    },

    async save() {
      await window.electronAPI?.setConfig('memories', {
        entries: this.entries,
        autoExtract: this.autoExtract,
      });
    },

    add(keys, content, source = 'llm') {
      const id = Date.now().toString(36);
      this.entries.push({
        id,
        keys: Array.isArray(keys) ? keys : [keys],
        content,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        source,
      });
      this.save();
      return id;
    },

    remove(id) {
      this.entries = this.entries.filter(e => e.id !== id);
      this.save();
    },

    update(id, updates) {
      const entry = this.entries.find(e => e.id === id);
      if (entry) {
        Object.assign(entry, updates, { updatedAt: Date.now() });
        this.save();
      }
    },

    // 匹配：扫描文本中是否命中任何词条的 key
    match(text) {
      const matched = [];
      const lower = (text || '').toLowerCase();
      for (const entry of this.entries) {
        const hit = entry.keys.some(k => lower.includes(k.toLowerCase()));
        if (hit) matched.push(entry);
      }
      return matched;
    },

    // 生成注入 LLM 的上下文文本
    injectContext(text) {
      const matched = this.match(text);
      if (matched.length === 0) return '';
      return '[相关记忆]\n' + matched.map(e => `- ${e.content}`).join('\n');
    },

    // 所有词条摘要（注入 system prompt）
    allContext() {
      if (this.entries.length === 0) return '';
      return '[用户相关记忆]\n' + this.entries.map(e => `- ${e.content}`).join('\n');
    },
  },
});
