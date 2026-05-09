import { ref } from 'vue';

export function useDrag(movementStore) {
  const DRAG_THRESHOLD = 8;
  const isDragging = ref(false);
  const hasMoved = ref(false);
  const startCursor = ref({ x: 0, y: 0 });
  const startWindow = ref({ x: 0, y: 0 });

  async function start(e) {
    if (e.button !== 0) return;
    if (e.target.closest('.bubble-container') || e.target.closest('input') || e.target.closest('button')) return;
    startCursor.value = { x: e.screenX, y: e.screenY };
    const pos = await window.electronAPI?.getWindowPosition();
    startWindow.value = pos || { x: 0, y: 0 };
    hasMoved.value = false;
    isDragging.value = true;
    movementStore?.setManualOverride(true);
    document.addEventListener('mouseup', stop);
    document.addEventListener('mousemove', move);
  }

  function move(e) {
    if (!isDragging.value) return;
    const dx = e.screenX - startCursor.value.x;
    const dy = e.screenY - startCursor.value.y;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) hasMoved.value = true;
    if (hasMoved.value) {
      window.electronAPI?.moveWindow(startWindow.value.x + dx, startWindow.value.y + dy);
    }
  }

  function stop() {
    isDragging.value = false;
    movementStore?.setManualOverride(false);
    document.removeEventListener('mouseup', stop);
    document.removeEventListener('mousemove', move);
    setTimeout(() => { hasMoved.value = false; }, 100);
  }

  return { isDragging, hasMoved, start, stop };
}
