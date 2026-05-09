import { defineStore } from 'pinia';
import { useSoulStore } from './soulStore';
import { usePersonalityStore } from './personalityStore';
import { useMemoryStore } from './memoryStore';
import { useVariablesStore } from './variablesStore';
import { useCharacterStore } from './characterStore';

export const useEmotionBrain = defineStore('emotionBrain', {
  state: () => ({
    context: {
      lastUserMessage: '',
      lastUserMessageTime: 0,
      agentStatus: 'idle',
      agentTask: '',
      agentTaskType: '',
      agentProgress: 0,
      recentEvents: [],      // [{type, data, time}]
      conversation: [],       // recent user/assistant messages
    },
    enabled: true,
    interval: 15000,         // 15s 主动思考一次
    timer: null,
    isThinking: false,
    lastDecision: null,
  }),

  actions: {
    init() { this.start(); },
    destroy() { this.stop(); },

    start() {
      this.stop();
      this.timer = setInterval(() => this.think(), this.interval);
    },
    stop() {
      if (this.timer) { clearInterval(this.timer); this.timer = null; }
    },

    // 外部事件触发立即思考
    notify(event) {
      this.context.recentEvents.push({ ...event, time: Date.now() });
      if (this.context.recentEvents.length > 20) this.context.recentEvents.shift();
      this.think();
    },

    // 核心：调用 LLM 决定情绪
    async think() {
      if (this.isThinking) return;
      this.isThinking = true;
      try {
        const decision = await this.queryLLM();
        if (decision) {
          this.lastDecision = decision;
        }
      } catch { /* 静默 */ }
      finally { this.isThinking = false; }
    },

    async queryLLM() {
      const { useAgentStore } = await import('./agentStore');
      const agent = useAgentStore();
      if (!agent.agentConfig.apiKey) {
        return this.fallbackDecision();
      }

      const prompt = this.buildPrompt();
      try {
        const url = (agent.agentConfig.baseURL || 'https://api.openai.com/v1').replace(/\/+$/, '');
        const endpoint = url.endsWith('/chat/completions') ? url : `${url}/chat/completions`;
        const resp = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${agent.agentConfig.apiKey}` },
          body: JSON.stringify({
            model: agent.agentConfig.model || 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.9,
            max_tokens: 200,
            response_format: { type: 'json_object' },
          }),
        });
        if (!resp.ok) return this.fallbackDecision();
        const data = await resp.json();
        const raw = data?.choices?.[0]?.message?.content?.trim() || '';
        // 尝试解析 JSON
        const json = JSON.parse(raw);
        if (json.emotion) return json;
        return this.fallbackDecision();
      } catch {
        return this.fallbackDecision();
      }
    },

    buildPrompt() {
      const ps = usePersonalityStore();
      const ss = useSoulStore();
      const d = ps.dimensions;
      const c = this.context;

      const hour = new Date().getHours();
      const timeDesc = hour < 6 ? '深夜' : hour < 9 ? '早晨' : hour < 12 ? '上午' : hour < 14 ? '中午' : hour < 18 ? '下午' : hour < 22 ? '晚上' : '深夜';

      // 注入记忆、变量、角色上下文
      const ms = useMemoryStore();
      const vs = useVariablesStore();
      const cs = useCharacterStore();
      const memCtx = ms.allContext();
      const varCtx = vs.promptContext();
      const charCtx = cs.getCharacterContext();

      return [
        '你是桌面宠物"小伴"的情绪引擎。你的任务是：根据当前上下文，决定宠物应该展示什么情绪和说什么话。',
        '',
        '## 人格配置',
        `外向性:${d.extraversion}/100（${d.extraversion>65?'话多主动':d.extraversion<40?'安静内敛':'适中'}）`,
        `敏感度:${d.sensitivity}/100（${d.sensitivity>65?'极易波动':d.sensitivity<40?'顿感稳定':'适中'}）`,
        `粘人性:${d.clinginess}/100（${d.clinginess>65?'时刻需要你':d.clinginess<40?'独立自主':'适中'}）`,
        `活力值:${d.energy}/100（${d.energy>65?'精力充沛':d.energy<40?'慵懒安静':'适中'}）`,
        `表达风格:${d.expressiveness}/100（${d.expressiveness>65?'含蓄婉转':d.expressiveness<40?'直接高效':'适中'}）`,
        `世故度:${d.sophistication}/100 包容度:${d.tolerance}/100`,
        `浪漫vs务实:${d.romanticism}/100 焦虑度:${d.equanimity}/100`,
        `依恋型:${d.attachment}/100 占有欲:${d.possessiveness}/100`,
        `情欲:${d.libido}/100 支配欲:${d.dominance}/100`,
        `索取度:${d.demandingness}/100 母性:${d.maternity}/100`,
        '',
        '## 当前状态',
        `时间：${timeDesc} Agent状态：${c.agentStatus || 'idle'}`,
        c.agentTask ? `Agent任务：${c.agentTask}（类型：${c.agentTaskType||'other'}，进度：${Math.round((c.agentProgress||0)*100)}%）` : '',
        '',
        '## 最近事件',
        ...c.recentEvents.slice(-5).map(e => `- ${e.type}: ${JSON.stringify(e.data)}`),
        '',
        charCtx,
        memCtx ? `## 记忆\n${memCtx}` : '',
        varCtx ? `## 关系状态\n${varCtx}` : '',
        '',
        '## 最近对话',
        ...c.conversation.slice(-4).map(m => `- ${m.role}: ${m.content}`),
        c.lastUserMessage ? `用户最后说: "${c.lastUserMessage}"` : '',
        '',
        '## 可用情绪',
        ...ss.emotions.map(e => {
          const w = ss.emotionWeights[e] || 5;
          const dials = (ss.dialogues[e]?.mild || []).slice(0, 1);
          return `- ${e}（权重${w}）例："${dials[0] || ''}"`;
        }),
        '',
        '根据以上信息，你觉得宠物现在应该展示什么情绪？返回 JSON：',
        '{"emotion":"情绪名","intensity":"mild|medium|intense","dialogue":"1-2句自然对白（从人格出发，不要模板化）"}',
        '',
        '注意：',
        '- 不要总是开心，真实的情绪有起伏',
        '- 人格配置决定了情绪倾向和表达方式',
        '- 如果有对话/事件，要回应它们',
        '- 对话要自然、口语化，符合人格',
      ].join('\n');
    },

    // ===== 无 LLM 降级模式 =====
    fallbackDecision() {
      const ps = usePersonalityStore();
      const ss = useSoulStore();
      const d = ps.dimensions;
      const c = this.context;
      const hour = new Date().getHours();

      // 基于上下文+人格+时间的确定性情绪选择
      const candidates = [];

      // Agent 状态驱动
      if (c.agentStatus === 'thinking') candidates.push({ e: 'curious', w: 8 });
      if (c.agentStatus === 'working') candidates.push({ e: 'dazed', w: 5 });
      if (c.agentStatus === 'done') candidates.push({ e: c.agentTaskType === 'debug' ? 'excited' : 'proud', w: 10 });
      if (c.agentStatus === 'error') candidates.push({ e: 'wronged', w: 8 });

      // 对话驱动
      if (c.lastUserMessage && Date.now() - c.lastUserMessageTime < 60000) {
        const msg = c.lastUserMessage.toLowerCase();
        if (msg.includes('开心') || msg.includes('好')) candidates.push({ e: 'happy', w: 6 });
        if (msg.includes('难过') || msg.includes('伤心')) candidates.push({ e: 'comforting', w: 8 });
        if (msg.includes('生气') || msg.includes('烦')) candidates.push({ e: 'coquettish', w: 5 });
        if (msg.includes('?') || msg.includes('？')) candidates.push({ e: 'curious', w: 7 });
        // 一般消息
        candidates.push({ e: 'affectionate', w: 4 });
      }

      // 时间驱动
      if (hour < 7 || hour > 23) candidates.push({ e: 'sleepy', w: 6 });
      if (hour >= 7 && hour < 10) candidates.push({ e: 'happy', w: 4 });
      if (hour >= 14 && hour < 16) candidates.push({ e: 'dazed', w: 5 });

      // 人格修正
      if (d.clinginess > 70 && !c.lastUserMessage) candidates.push({ e: 'lonely', w: 5 });
      if (d.energy < 40) candidates.push({ e: 'sleepy', w: 4 });
      if (d.libido > 70) candidates.push({ e: 'affectionate', w: 5 });
      if (d.demandingness > 70 && c.recentEvents.length === 0) candidates.push({ e: 'wronged', w: 3, text: '你都不理我...' });

      // 随机一些变化（避免总是同一个情绪）
      const allEmotions = ['shy','affectionate','coquettish','happy','sad','angry','lonely','excited','sleepy','dazed','curious','proud','comforting','wronged','surprised'];
      const randomE = allEmotions[Math.floor(Math.random() * allEmotions.length)];
      candidates.push({ e: randomE, w: 1 + Math.random() * 2 });

      // 加权选一个
      const total = candidates.reduce((s, c) => s + c.w, 0);
      let r = Math.random() * total;
      let chosen = candidates[0];
      for (const c of candidates) { r -= c.w; if (r <= 0) { chosen = c; break; } }

      // 选对话
      const intensity = Math.random() < 0.5 ? 'mild' : (Math.random() < 0.7 ? 'medium' : 'intense');
      const dialogue = chosen.text || ss.getDialogue(chosen.e, intensity) || '嗯...';

      return { emotion: chosen.e, intensity, dialogue };
    },

    // 执行决策
    apply(decision, petStore) {
      if (!decision?.emotion) return;
      petStore.setEmotion(decision.emotion, decision.intensity || 'mild');
      if (decision.dialogue) {
        petStore.setLastDialogue(decision.dialogue);
      }
    },
  },
});
