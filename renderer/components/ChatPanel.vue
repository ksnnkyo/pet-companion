<template>
  <div class="chat-panel">
    <div class="chat-header">
      <span class="chat-title">对话</span>
      <div class="chat-actions">
        <button class="icon-btn" @click="settingsVisible = !settingsVisible" title="模型与人格设置">&#9881;</button>
        <button class="close-btn" @click="$emit('close')">&times;</button>
      </div>
    </div>

    <div v-if="settingsVisible" class="settings-panel">
      <label>
        <span>Base URL</span>
        <input v-model="agentStore.agentConfig.baseURL" @change="agentStore.saveSettings()" />
      </label>
      <label>
        <span>Model</span>
        <input v-model="agentStore.agentConfig.model" @change="agentStore.saveSettings()" />
      </label>
      <label>
        <span>API Key</span>
        <input v-model="agentStore.agentConfig.apiKey" type="password" placeholder="留空则本地模拟" @change="agentStore.saveSettings()" />
      </label>
      <label>
        <span>形象</span>
        <textarea v-model="agentStore.petProfile.appearance" rows="2" @change="agentStore.saveSettings()" />
      </label>
      <label>
        <span>人格</span>
        <textarea v-model="agentStore.petProfile.personality" rows="2" @change="agentStore.saveSettings()" />
      </label>
      <div class="settings-row">
        <label class="toggle-label">
          <span>音效</span>
          <input type="checkbox" :checked="audioEnabled" @change="toggleAudio" />
        </label>
      </div>
      <label>
        <span>定时提醒（分钟，0=关闭）</span>
        <input v-model.number="reminderMinutes" type="number" min="0" max="240" @change="saveReminder" />
      </label>
    </div>

    <div class="chat-messages" ref="messagesRef">
      <div
        v-for="(msg, index) in messages"
        :key="index"
        :class="['message', msg.role]"
      >
        <div class="message-content">
          {{ msg.content }}
        </div>
      </div>
      <div v-if="isTyping" class="message assistant typing">
        <div class="message-content">...</div>
      </div>
    </div>

    <div class="chat-input-area">
      <input
        v-model="inputText"
        class="chat-input"
        placeholder="输入消息..."
        @keydown.enter="sendMessage"
        :disabled="isTyping"
      />
      <button class="send-btn" @click="sendMessage" :disabled="isTyping || !inputText.trim()">
        发送
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, watch, onMounted } from 'vue';
import { useAgentStore } from '../stores/agentStore';
import { useAudioStore } from '../stores/audioStore';

const emit = defineEmits(['close', 'assistant-reply']);

const agentStore = useAgentStore();
const audioStore = useAudioStore();
const messagesRef = ref(null);
const inputText = ref('');
const settingsVisible = ref(false);
const audioEnabled = ref(true);
const reminderMinutes = ref(0);
const messages = ref([
  { role: 'assistant', content: '你好呀~ 有什么想和我聊的吗？' },
]);
const isTyping = ref(false);

onMounted(async () => {
  audioEnabled.value = audioStore.enabled;
  const saved = await window.electronAPI?.getConfig('reminderMinutes');
  if (saved) reminderMinutes.value = saved;
});

watch(messages, async () => {
  await nextTick();
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight;
  }
}, { deep: true });

async function toggleAudio() {
  await audioStore.toggle();
  audioEnabled.value = audioStore.enabled;
}

async function saveReminder() {
  window.electronAPI?.setConfig('reminderMinutes', reminderMinutes.value);
}

async function sendMessage() {
  const text = inputText.value.trim();
  if (!text || isTyping.value) return;

  messages.value.push({ role: 'user', content: text });
  inputText.value = '';
  isTyping.value = true;

  try {
    const response = await agentStore.sendMessage(text);
    messages.value.push({ role: 'assistant', content: response });
    emit('assistant-reply', response);
  } catch (error) {
    messages.value.push({ role: 'assistant', content: '抱歉，我遇到了一些问题...' });
  } finally {
    isTyping.value = false;
  }
}
</script>

<style scoped>
.chat-panel {
  position: absolute;
  bottom: 260px;
  right: 0;
  width: 248px;
  height: 350px;
  background: rgba(255, 255, 255, 0.98);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  -webkit-app-region: no-drag;
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #2f6f7e;
  color: white;
  -webkit-app-region: drag;
}

.chat-title {
  font-size: 14px;
  font-weight: 600;
}

.chat-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-btn,
.close-btn {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  padding: 0 4px;
  -webkit-app-region: no-drag;
}

.icon-btn {
  font-size: 14px;
}

.close-btn {
  font-size: 20px;
}

.close-btn:hover {
  opacity: 0.8;
}

.settings-panel {
  display: grid;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid #e9edf0;
  background: #f6f8f7;
  -webkit-app-region: no-drag;
}

.settings-panel label {
  display: grid;
  gap: 4px;
  font-size: 11px;
  color: #52606a;
}

.settings-panel input,
.settings-panel textarea {
  width: 100%;
  border: 1px solid #cfd7dc;
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 12px;
  color: #27323a;
  background: white;
  outline: none;
  user-select: text;
  resize: vertical;
}

.settings-panel input:focus,
.settings-panel textarea:focus {
  border-color: #2f6f7e;
}

.settings-row {
  display: flex;
  align-items: center;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 11px;
  color: #52606a;
}

.toggle-label input[type="checkbox"] {
  width: auto;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.message {
  max-width: 85%;
  padding: 8px 12px;
  border-radius: 12px;
  font-size: 13px;
  line-height: 1.4;
}

.message.user {
  align-self: flex-end;
  background: #2f6f7e;
  color: white;
  border-bottom-right-radius: 4px;
}

.message.assistant {
  align-self: flex-start;
  background: #f0f0f5;
  color: #333;
  border-bottom-left-radius: 4px;
}

.message.typing .message-content {
  animation: typing-dots 1s infinite;
}

@keyframes typing-dots {
  0%, 20% { content: '.'; }
  40% { content: '..'; }
  60%, 100% { content: '...'; }
}

.chat-input-area {
  display: flex;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid #eee;
  -webkit-app-region: no-drag;
}

.chat-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 20px;
  font-size: 13px;
  outline: none;
}

.chat-input:focus {
  border-color: #2f6f7e;
}

.send-btn {
  padding: 8px 16px;
  background: #2f6f7e;
  color: white;
  border: none;
  border-radius: 20px;
  font-size: 13px;
  cursor: pointer;
}

.send-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.send-btn:hover:not(:disabled) {
  background: #245b67;
}
</style>
