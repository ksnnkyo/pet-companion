import { ref } from 'vue';
import { useSoulStore } from '../stores/soulStore';

export function useBubble() {
  const soulStore = useSoulStore();
  const visible = ref(false);
  const loading = ref(false);
  const text = ref('');
  const x = ref(30);
  const y = ref(165);
  let timer = null;

  function show(t, chatVisible) {
    if (chatVisible) return;
    if (timer) { clearTimeout(timer); timer = null; }
    visible.value = true;
    loading.value = false;
    text.value = t;
    x.value = 30;
    y.value = 165;
    const ms = soulStore.bubbleDurationMsPerChar || 80;
    timer = setTimeout(() => { visible.value = false; }, Math.min(Math.max(t.length * ms, 3000), 8000));
  }

  function setLoading(msg = '...') {
    if (timer) { clearTimeout(timer); timer = null; }
    visible.value = true;
    loading.value = true;
    text.value = msg;
  }

  function hide() {
    if (timer) { clearTimeout(timer); timer = null; }
    visible.value = false;
  }

  function stopTimer() {
    if (timer) { clearTimeout(timer); timer = null; }
  }

  return { visible, loading, text, x, y, show, setLoading, hide, stopTimer };
}
