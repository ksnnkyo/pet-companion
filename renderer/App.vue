<template>
  <div class="app-container" @mousedown="drag.start" @contextmenu.prevent="onContextMenu">
    <PetView ref="petView" :class="{ 'pet-area': true, 'dragging': drag.isDragging.value }" @click="onPetClick" />
    <BubbleView :visible="bubble.visible.value" :text="bubble.text.value" :x="bubble.x.value" :y="bubble.y.value" :loading="bubble.loading.value" @submit="sendBubbleMessage" />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import PetView from './components/PetView.vue';
import BubbleView from './components/BubbleView.vue';
import { useSoulStore } from './stores/soulStore';
import { usePetStore } from './stores/petStore';
import { useAgentStore } from './stores/agentStore';
import { useMovementStore } from './stores/movementStore';
import { useAudioStore } from './stores/audioStore';
import { usePersonalityStore } from './stores/personalityStore';
import { useEmotionBrain } from './stores/emotionBrain';
import { useMemoryStore } from './stores/memoryStore';
import { useVariablesStore } from './stores/variablesStore';
import { useCharacterStore } from './stores/characterStore';
import { useBubble } from './composables/useBubble';
import { useDrag } from './composables/useDrag';

const soulStore = useSoulStore();
const petStore = usePetStore();
const agentStore = useAgentStore();
const movementStore = useMovementStore();
const audioStore = useAudioStore();
const personalityStore = usePersonalityStore();
const memoryStore = useMemoryStore();
const variablesStore = useVariablesStore();
const characterStore = useCharacterStore();
const brain = useEmotionBrain();

const petView = ref(null);
const bubble = useBubble();
const drag = useDrag(movementStore);

onMounted(async () => {
  window.electronAPI?.onPetAction((d) => { handlePetAction(d); brain.notify({ type: 'pet_action', data: d }); });
  window.electronAPI?.onTriggerEmotion(({ name, intensity }) => petStore.triggerEmotion(name, intensity || 'mild'));
  window.electronAPI?.onShowBubble(({ text }) => bubble.show(text, false));
  window.electronAPI?.onRequestStatus(() => {
    window.electronAPI?.reportStatus({ emotion: petStore.currentEmotion, intensity: petStore.currentIntensity, behavior: petStore.currentBehavior });
  });
  // Agent 状态 → 更新 emotionBrain 上下文
  window.electronAPI?.onAgentState?.((s) => {
    Object.assign(brain.context, {
      agentStatus: s.status || 'idle',
      agentTask: s.task || '',
      agentTaskType: s.taskType || '',
      agentProgress: s.progress || 0,
    });
    brain.notify({ type: 'agent_state', data: s });
    if (s.status === 'done') variablesStore.onAgentDone();
    if (s.status === 'error') variablesStore.onAgentError();
  });

  await agentStore.loadSettings();
  await personalityStore.load();
  await memoryStore.load();
  await variablesStore.load();
  await characterStore.load();
  // 默认激活第一个伴侣（同步人格等全局状态）
  if (characterStore.activeId) await characterStore.activate(characterStore.activeId);
  await audioStore.init();
  soulStore.loadSoul();
  brain.init();
  await movementStore.init();

  // emotionBrain 决策 → petStore 执行
  watch(() => brain.lastDecision, (d) => {
    if (d) brain.apply(d, petStore);
  });

  watch(() => movementStore.facing, (dir) => petView.value?.setFacing(dir));
  watch(() => movementStore.isMoving, (m) => petStore.setBehavior(m ? 'walk' : 'idle'));
  watch(() => petStore.currentEmotion, (e) => {
    if (e && e !== 'idle') audioStore.playEffect(soulStore.getSoundEffect(e));
    window.electronAPI?.send('pet-event', { type: 'emotion-changed', data: { emotion: e, intensity: petStore.currentIntensity } });
  });
});

onUnmounted(() => {
  window.electronAPI?.removePetActionListener(() => {});
  window.electronAPI?.removeTriggerEmotionListener(() => {});
  window.electronAPI?.removeShowBubbleListener(() => {});
  window.electronAPI?.removeRequestStatusListener(() => {});
  window.electronAPI?.removeAgentStateListener(() => {});
  brain.destroy();
  movementStore.destroy();
});

function onContextMenu() { window.electronAPI?.showContextMenu(); }

function handlePetAction(data) {
  let emotion = 'happy', intensity = 'mild', text = '';
  switch (data.action) {
    case 'pet': emotion = data.zone === 'head' ? 'shy' : 'happy'; intensity = 'medium'; text = soulStore.getDialogue(emotion, intensity) || ''; break;
    case 'feed': emotion = 'happy'; text = '好吃好吃~ 谢谢投喂！'; break;
    case 'play': emotion = 'excited'; intensity = 'medium'; text = '来玩呀！来玩呀！'; break;
  }
  petStore.triggerEmotion(emotion, intensity);
  if (text) bubble.show(text, false);
  window.electronAPI?.send('pet-event', { type: 'clicked', data: { action: data.action, zone: data.zone } });
  variablesStore.onUserClick();
  characterStore.logInteraction(data.action, `${data.action} ${data.zone || ''}`, emotion);
}

function onPetClick(event) {
  if (drag.hasMoved.value) return;
  const rect = event.target.closest('.pet-container')?.getBoundingClientRect();
  const zone = rect && event.clientY - rect.top < 80 ? 'head' : 'body';
  petStore.triggerEmotion(zone === 'head' ? 'affectionate' : 'happy', 'mild');
  bubble.show(petStore.getRandomDialogue() || '', false);
  characterStore.logInteraction('click', `摸了${zone === 'head' ? '头' : '身体'}`, 'affectionate');
}

async function sendBubbleMessage(text) {
  if (!text || bubble.loading.value) return;
  bubble.stopTimer();
  bubble.setLoading('...');
  // 通知 emotionBrain 用户发言
  brain.context.lastUserMessage = text;
  brain.context.lastUserMessageTime = Date.now();
  brain.context.conversation.push({ role: 'user', content: text });
  if (brain.context.conversation.length > 20) brain.context.conversation.shift();
  brain.notify({ type: 'user_message', data: { text } });
  variablesStore.onUserMessage();

  try {
    const reply = await agentStore.sendMessage(text, { emotion: petStore.currentEmotion, intensity: petStore.currentIntensity });
    brain.context.conversation.push({ role: 'assistant', content: reply });
    characterStore.logInteraction('chat', text, petStore.currentEmotion, { reply: reply?.slice(0, 50) });
    if (brain.context.conversation.length > 20) brain.context.conversation.shift();
    bubble.show(reply, false);
  } catch {
    bubble.show('刚刚没接住这句话，再试一次好吗？', false);
  }
}

petStore.$subscribe((_m, state) => {
  if (state.lastDialogue && !bubble.loading.value) bubble.show(state.lastDialogue, false);
});
</script>

<style scoped>
.app-container { width: 100%; height: 100%; position: relative; -webkit-app-region: drag; }
.pet-area { -webkit-app-region: no-drag; cursor: move; }
.pet-area.dragging { cursor: grabbing; }
</style>
