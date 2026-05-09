<template>
  <transition name="bubble">
    <div v-if="visible" class="bubble-container" :style="{ left: x + 'px', bottom: y + 'px' }">
      <div class="bubble" @click.stop="enterEdit">
        <form v-if="editing" class="bubble-form" @submit.prevent="submit">
          <input
            ref="inputRef"
            v-model="draft"
            class="bubble-input"
            placeholder="和我说一句..."
            :disabled="loading"
            @keydown.esc.prevent="cancelEdit"
          />
          <button class="bubble-send" type="submit" :disabled="loading || !draft.trim()">发送</button>
        </form>
        <span v-else class="bubble-text" :class="{ loading }">{{ text }}</span>
      </div>
      <div class="bubble-pointer"></div>
    </div>
  </transition>
</template>

<script setup>
import { nextTick, ref, watch } from 'vue';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  text: {
    type: String,
    default: '',
  },
  x: {
    type: Number,
    default: 200,
  },
  y: {
    type: Number,
    default: 108,
  },
  loading: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['submit']);
const editing = ref(false);
const draft = ref('');
const inputRef = ref(null);

watch(() => props.visible, (visible) => {
  if (!visible) {
    editing.value = false;
    draft.value = '';
  }
});

watch(() => props.loading, (loading) => {
  if (loading) {
    editing.value = false;
  }
});

async function enterEdit() {
  if (props.loading) return;
  editing.value = true;
  draft.value = '';
  await nextTick();
  inputRef.value?.focus();
}

function cancelEdit() {
  editing.value = false;
  draft.value = '';
}

function submit() {
  const text = draft.value.trim();
  if (!text || props.loading) return;
  emit('submit', text);
  cancelEdit();
}
</script>

<style scoped>
.bubble-container {
  position: absolute;
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: auto;
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.15));
  -webkit-app-region: no-drag;
}

.bubble {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 8px;
  padding: 6px 12px;
  max-width: 160px;
  min-width: 60px;
  border: 1px solid rgba(230, 230, 230, 0.8);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  cursor: text;
}

.bubble-text {
  font-size: 14px;
  color: #333;
  line-height: 1.5;
  text-align: center;
  display: block;
  word-break: break-word;
}

.bubble-text.loading {
  color: #6d5f39;
}

.bubble-form {
  display: flex;
  align-items: center;
  gap: 6px;
}

.bubble-input {
  width: 148px;
  border: 1px solid #cfd5dd;
  border-radius: 6px;
  padding: 7px 8px;
  outline: none;
  font-size: 13px;
  color: #28303a;
  background: #fff;
  user-select: text;
}

.bubble-input:focus {
  border-color: #6296a8;
}

.bubble-send {
  border: 0;
  border-radius: 6px;
  padding: 7px 9px;
  color: #fff;
  background: #2f6f7e;
  font-size: 12px;
  cursor: pointer;
}

.bubble-send:disabled {
  opacity: 0.45;
  cursor: default;
}

.bubble-pointer {
  width: 0;
  height: 0;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-top: 10px solid rgba(255, 255, 255, 0.97);
  margin-top: -1px;
}

/* 动画 */
.bubble-enter-active {
  animation: bubble-in 0.2s ease-out;
}

.bubble-leave-active {
  animation: bubble-out 0.3s ease-in;
}

@keyframes bubble-in {
  from {
    opacity: 0;
    transform: scale(0.8) translateY(10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes bubble-out {
  from {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
  to {
    opacity: 0;
    transform: scale(0.8) translateY(10px);
  }
}
</style>
