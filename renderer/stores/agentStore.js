import { defineStore } from 'pinia';
import { usePersonalityStore } from './personalityStore';

export const useAgentStore = defineStore('agent', {
  state: () => ({
    agentConfig: {
      baseURL: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      apiKey: '',
      temperature: 0.8,
      maxTokens: 200,
    },
    petProfile: {
      name: '小伴',
      appearance: '温柔知性女性形象，栗色短发，针织衫',
      personality: '细腻、会主动关心用户，偶尔撒娇',
    },
    messageHistory: [],
    isLoading: false,
    lastError: null,
  }),

  actions: {
    async loadSettings() {
      const c = await window.electronAPI?.getConfig('agentConfig');
      const p = await window.electronAPI?.getConfig('petProfile');
      if (c) this.agentConfig = { ...this.agentConfig, ...c };
      if (p) this.petProfile = { ...this.petProfile, ...p };
    },

    saveSettings() {
      window.electronAPI?.setConfig('agentConfig', this.agentConfig);
      window.electronAPI?.setConfig('petProfile', this.petProfile);
    },

    async sendMessage(userMessage, context = {}) {
      this.isLoading = true; this.lastError = null;
      try {
        this.messageHistory.push({ role: 'user', content: userMessage, timestamp: Date.now() });
        const reply = await this.callLLM(userMessage, context);
        this.messageHistory.push({ role: 'assistant', content: reply, timestamp: Date.now() });
        return reply;
      } catch (e) {
        this.lastError = e.message; throw e;
      } finally { this.isLoading = false; }
    },

    async callLLM(message, context) {
      // 直接用 renderer fetch，消除 IPC 往返
      const { baseURL, model, apiKey, temperature, maxTokens } = this.agentConfig;
      if (!apiKey) {
        return this.localReply(message);
      }
      const ps = usePersonalityStore();
      const url = (baseURL || 'https://api.openai.com/v1').replace(/\/+$/, '');
      const endpoint = url.endsWith('/chat/completions') ? url : `${url}/chat/completions`;

      const systemPrompt = ps.buildSystemPrompt(context);
      const history = this.messageHistory.slice(0, -1)
        .filter(h => h && ['user','assistant'].includes(h.role))
        .slice(-12)
        .map(h => ({ role: h.role, content: String(h.content).slice(0, 2000) }));

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model, messages: [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: String(message) }],
          temperature: Number(temperature) || 0.8,
          max_tokens: Number(maxTokens) || 200,
        }),
      });
      if (!resp.ok) throw new Error(`API ${resp.status}`);
      const data = await resp.json();
      return data?.choices?.[0]?.message?.content?.trim() || '我好像没组织好语言...';
    },

    localReply(msg) {
      const text = String(msg || '').toLowerCase();
      if (text.includes('你好') || text.includes('hi')) return '你好呀，我在呢~';
      if (text.includes('难过') || text.includes('累')) return '先停一下，我陪你把事情拆小一点。';
      if (text.includes('开心') || text.includes('好棒')) return '我也被你带开心了！';
      return '我听到了。现在没有配置 API Key，先用本地模式陪你~';
    },

    clearHistory() { this.messageHistory = []; },
  },
});
