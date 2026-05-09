import { watch, onMounted, onUnmounted } from 'vue';
import { usePetStore } from '../stores/petStore';
import { usePersonalityStore } from '../stores/personalityStore';

export function useAgentState(bubble) {
  const petStore = usePetStore();
  const ps = usePersonalityStore();

  function handle(state) {
    if (!state) return;
    const d = ps.dimensions;
    let emotion = 'idle', intensity = 'mild', text = '';

    switch (state.status) {
      case 'thinking':
        emotion = 'curious'; intensity = 'mild';
        text = state.task ? `在想${state.task}...` : '嗯...在想事情...';
        break;
      case 'working': {
        const pct = state.progress ? Math.round(state.progress * 100) : 0;
        if (state.taskType === 'debug') { emotion = 'angry'; intensity = 'mild'; text = '这个 Bug 有点难搞...'; }
        else if (state.taskType === 'refactor') { emotion = 'dazed'; text = '重构中...一团乱麻会变整洁的！'; }
        else if (state.taskType === 'review') { emotion = 'curious'; text = '让我仔细看看...'; }
        else if (state.taskType === 'deploy') { emotion = 'excited'; intensity = 'medium'; text = '部署中，心跳加速...'; }
        else if (pct > 80) { emotion = 'excited'; text = `快了！已经 ${pct}% 了~`; }
        else if (pct > 40) { emotion = 'happy'; text = `进展不错，${pct}% ~`; }
        else { emotion = 'curious'; text = state.task ? `正在${state.task}...` : '工作中...'; }
        break;
      }
      case 'done':
        emotion = 'proud'; intensity = 'medium';
        text = state.taskType === 'debug' ? 'Bug 搞定！我厉害吧~'
          : state.taskType === 'refactor' ? '重构完成，代码清爽多了！'
          : state.taskType === 'deploy' ? '部署成功！一切正常~'
          : state.taskType === 'review' ? '看完了，没什么问题~'
          : state.task ? `${state.task} 搞定！` : '完成啦！';
        break;
      case 'error':
        emotion = 'wronged'; intensity = d.sensitivity > 60 ? 'intense' : 'medium';
        text = '出错了...没关系，再来一次？';
        break;
      case 'waiting':
        emotion = 'lonely'; intensity = 'mild';
        text = '还在等你呢...';
        break;
      default:
        break;
    }
    if (emotion !== 'idle') {
      petStore.triggerEmotion(emotion, intensity);
      if (text) bubble.show(text, false);
    }
  }

  onMounted(() => { window.electronAPI?.onAgentState?.(handle); });
  onUnmounted(() => { window.electronAPI?.removeAgentStateListener?.(handle); });

  return { handle };
}
