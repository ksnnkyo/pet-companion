import { defineStore } from 'pinia';
import soulData from '../assets/soul.json';

export const useSoulStore = defineStore('soul', {
  state: () => ({
    emotions: soulData.emotions,
    behaviors: soulData.behaviors,
    emotionWeights: soulData.emotionWeights,
    dialogues: soulData.dialogues,
    animations: soulData.animations,
    emotionAnimationFrames: soulData.emotionAnimationFrames,
    movement: soulData.movement,
    soundEffects: soulData.soundEffects,
    bubbleDurationMsPerChar: soulData.bubbleDurationMsPerChar,
    bubbleDurationMinMs: soulData.bubbleDurationMinMs,
    bubbleDurationMaxMs: soulData.bubbleDurationMaxMs,
  }),

  actions: {
    getDialogue(emotion, intensity = 'mild') {
      const emotionDialogues = this.dialogues[emotion];
      if (!emotionDialogues) return null;
      const intensityDialogues = emotionDialogues[intensity] || emotionDialogues.mild;
      return intensityDialogues[Math.floor(Math.random() * intensityDialogues.length)];
    },

    getAllDialogues(emotion) {
      return this.dialogues[emotion] || {};
    },

    getAnimationConfig(behavior) {
      return this.animations[behavior] || this.animations.idle;
    },

    getEmotionFrameCount(emotion, intensity) {
      return this.emotionAnimationFrames[emotion]?.[intensity] || 2;
    },

    getSoundEffect(emotion) {
      return this.soundEffects[emotion] || null;
    },
  },
});
