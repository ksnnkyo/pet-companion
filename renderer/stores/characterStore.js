import { defineStore } from 'pinia';
import { useMemoryStore } from './memoryStore';
import { useVariablesStore } from './variablesStore';

const DEFAULT_CHAR = {
  name: '未命名', archetype: '', appearance: {}, personality: { core: '', traits: {}, speaking_style: '' },
  emotional_anchors: {}, intimacy: {}, history: {}, daily_life: {},
  first_mes: '你好...',
};

export const useCharacterStore = defineStore('character', {
  state: () => ({
    companions: [],           // 所有伴侣列表
    activeId: null,           // 当前激活的伴侣 ID
    interactionLog: [],
    milestones: [],
  }),

  getters: {
    active() {
      return this.companions.find(c => c.id === this.activeId) || null;
    },
    current() {
      return this.active || { ...DEFAULT_CHAR, id: '__default__', name: '小伴' };
    },
  },

  actions: {
    async load() {
      const saved = await window.electronAPI?.getConfig('characterState');
      if (saved) {
        if (saved.companions) this.companions = saved.companions;
        if (saved.activeId) this.activeId = saved.activeId;
        if (saved.interactionLog) this.interactionLog = saved.interactionLog.slice(-500);
        if (saved.milestones) this.milestones = saved.milestones;
      }
      // 如果没有伴侣，创建默认的
      if (this.companions.length === 0) {
        const id = Date.now().toString(36);
        this.companions.push({
          id, ...DEFAULT_CHAR,
          name: '小伴',
          archetype: '温柔人妻型',
          personality: {
            core: '温柔、细腻、会主动关心人',
            traits: {
              extraversion:45,sensitivity:70,clinginess:50,energy:50,expressiveness:65,
              sophistication:70,sapiosexuality:55,tolerance:75,romanticism:45,equanimity:60,
              attachment:45,possessiveness:55,libido:50,dominance:20,demandingness:40,maternity:75
            },
          },
          appearance: { style: '针织衫+长裙' },
          palette: { dress:'#7eb8a6', dressDark:'#5a9a86', skirt:'#6aaa96', skirtDark:'#4d8a75', accent:'#e8c86e', shoe:'#4a3a30', sole:'#2a1a10' },
        });
        this.activeId = id;
      }
      if (!this.activeId && this.companions.length > 0) {
        this.activeId = this.companions[0].id;
      }
      await this._save();
    },

    async _save() {
      await window.electronAPI?.setConfig('characterState', {
        companions: this.companions,
        activeId: this.activeId,
        interactionLog: this.interactionLog.slice(-500),
        milestones: this.milestones,
      });
    },

    // ===== 伴侣管理 =====
    add(companion) {
      const id = Date.now().toString(36);
      this.companions.push({ id, ...DEFAULT_CHAR, ...companion });
      this._save();
      return id;
    },

    remove(id) {
      if (this.companions.length <= 1) return;
      this.companions = this.companions.filter(c => c.id !== id);
      if (this.activeId === id) this.activeId = this.companions[0]?.id || null;
      this._save();
    },

    update(id, updates) {
      const idx = this.companions.findIndex(c => c.id === id);
      if (idx >= 0) {
        this.companions[idx] = { ...this.companions[idx], ...updates };
        this._save();
      }
    },

    // 激活伴侣：保存当前、加载新的
    async activate(id) {
      // 1. 保存当前伴侣的状态快照
      if (this.activeId) {
        await this._snapshotCurrent();
      }

      const companion = this.companions.find(c => c.id === id);
      if (!companion) return;
      this.activeId = id;

      // 2. 加载新伴侣的人格
      if (companion.personality?.traits) {
        const { usePersonalityStore } = await import('./personalityStore');
        const ps = usePersonalityStore();
        Object.assign(ps.dimensions, companion.personality.traits);
        ps.name = companion.name;
        ps.tone = companion.personality.archetype || companion.archetype || '';
        ps.save();
      }

      // 3. 加载新伴侣的记忆（替换）
      if (companion._memories) {
        const ms = useMemoryStore();
        ms.entries = companion._memories;
        ms.save();
      }
      // 4. 加载新伴侣的变量
      if (companion._variables) {
        const vs = useVariablesStore();
        vs.values = { ...vs.values, ...companion._variables };
        vs.save();
      }

      await this._save();
      return companion;
    },

    // 把当前伴侣的状态存入它的快照
    async _snapshotCurrent() {
      if (!this.activeId) return;
      const idx = this.companions.findIndex(c => c.id === this.activeId);
      if (idx < 0) return;

      const { usePersonalityStore } = await import('./personalityStore');
      const ps = usePersonalityStore();
      const ms = useMemoryStore();
      const vs = useVariablesStore();

      this.companions[idx] = {
        ...this.companions[idx],
        personality: {
          ...this.companions[idx].personality,
          traits: { ...ps.dimensions },
        },
        _memories: [...ms.entries],
        _variables: { ...vs.values },
      };
    },

    // 导入角色卡（JSON 字符串或对象）
    async importCard(cardJson) {
      const card = typeof cardJson === 'string' ? JSON.parse(cardJson) : cardJson;
      const id = this.add({
        ...DEFAULT_CHAR,
        ...card,
        personality: { ...DEFAULT_CHAR.personality, ...(card.personality || {}) },
      });
      await this.activate(id);
      return id;
    },

    // 导出当前伴侣为角色卡 JSON
    exportCard(id) {
      const c = this.companions.find(x => x.id === (id || this.activeId));
      if (!c) return null;
      const { ...card } = c;
      return JSON.stringify(card, null, 2);
    },

    // ===== 交互记录 =====
    logInteraction(type, content, emotion = null, context = {}) {
      this.interactionLog.push({ time: Date.now(), type, content, emotion, context });
      if (this.interactionLog.length > 500) this.interactionLog = this.interactionLog.slice(-300);
      if (this.interactionLog.length % 10 === 0) this._save();
    },

    addMilestone(title, desc = '') {
      this.milestones.push({ time: Date.now(), title, description: desc });
      this._save();
    },

    getRecentInteractions(count = 10) {
      return this.interactionLog.slice(-count)
        .map(e => `[${new Date(e.time).toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit'})}] ${e.type}: ${e.content}`).join('\n');
    },

    getRelationshipSummary() {
      const parts = [];
      if (this.milestones.length > 0) {
        parts.push('重要时刻：' + this.milestones.slice(-10).map(m => {
          const d = new Date(m.time);
          return `${d.getMonth()+1}/${d.getDate()} ${m.title}`;
        }).join('、'));
      }
      const total = this.interactionLog.length;
      if (total > 0) {
        const chat = this.interactionLog.filter(e => e.type === 'chat').length;
        const touch = this.interactionLog.filter(e => e.type === 'click' || e.type === 'pet').length;
        parts.push(`互动：共${total}次，聊天${chat}次，肢体${touch}次`);
      }
      return parts.join('\n');
    },

    getCharacterContext() {
      const c = this.current;
      if (!c) return '';
      const parts = [];
      parts.push(`[角色信息]\n名字：${c.name}\n原型：${c.personality?.archetype || c.archetype || ''}`);
      if (c.personality?.core) parts.push(`性格核心：${c.personality.core}`);
      if (c.personality?.speaking_style) parts.push(`说话风格：${c.personality.speaking_style}`);
      if (c.appearance?.style) parts.push(`穿着：${c.appearance.style}`);
      if (c.emotional_anchors) {
        parts.push(`开心：${(c.emotional_anchors.makes_happy || []).slice(0,3).join('、')}`);
        parts.push(`难过：${(c.emotional_anchors.makes_sad || []).slice(0,3).join('、')}`);
        parts.push(`吃醋：${(c.emotional_anchors.makes_jealous || []).slice(0,3).join('、')}`);
      }
      if (c.intimacy?.romance_style) parts.push(`恋爱风格：${c.intimacy.romance_style}`);
      if (c.daily_life?.hobbies) parts.push(`爱好：${c.daily_life.hobbies.join('、')}`);
      const hist = this.getRelationshipSummary();
      if (hist) parts.push(`\n[交往记录]\n${hist}`);
      const recent = this.getRecentInteractions(5);
      if (recent) parts.push(`\n[最近互动]\n${recent}`);
      return parts.join('\n');
    },
  },
});
