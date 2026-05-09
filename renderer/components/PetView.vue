<template>
  <div class="pet-container" ref="containerRef">
    <canvas ref="canvasRef" :width="canvasWidth" :height="canvasHeight" />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { usePetStore } from '../stores/petStore';
import { useSoulStore } from '../stores/soulStore';
import { useAgentStore } from '../stores/agentStore';
import { useEmotionBrain } from '../stores/emotionBrain';
import { useCharacterStore } from '../stores/characterStore';

const petStore = usePetStore();
const soulStore = useSoulStore();
const agentStore = useAgentStore();

const containerRef = ref(null);
const canvasRef = ref(null);
const canvasWidth = ref(200);
const canvasHeight = ref(240);

// 精灵图模式
const spriteImage = ref(null);
const spritesheetConfig = ref(null);
const emotionColumnMap = { idle:0, affectionate:1, shy:2, happy:3, sad:4, angry:5, lonely:6, excited:7, sleepy:8, dazed:9, curious:10, proud:11, comforting:12, wronged:13, surprised:14 };
const intensityRowMap = { mild:0, medium:1, intense:2 };

let animationTimer = null;
let frameIndex = 0;
let facing = 'right';

const P = {
  idle: { top: '#7eb8a6', topD: '#5a9a86', skirt: '#6aaa96', skirtD: '#4d8a75', ac: '#e8c86e', shoe: '#4a3a30', sole: '#2a1a10' },
  shy: { top: '#e894a8', topD: '#c87088', skirt: '#e08098', skirtD: '#b86078', ac: '#f2b8c8', shoe: '#6a3a40', sole: '#3a1a20' },
  affectionate: { top: '#e88098', topD: '#c06078', skirt: '#e07088', skirtD: '#b05068', ac: '#f2b0c0', shoe: '#6a3a40', sole: '#3a1a20' },
  coquettish: { top: '#e080a0', topD: '#b86080', skirt: '#d87090', skirtD: '#a85070', ac: '#f7c06f', shoe: '#5a3040', sole: '#2a1020' },
  happy: { top: '#f0b860', topD: '#d09840', skirt: '#e8b050', skirtD: '#c08838', ac: '#ffe08a', shoe: '#6a4830', sole: '#3a2810' },
  sad: { top: '#8a9ec8', topD: '#6878a0', skirt: '#7a8eb8', skirtD: '#586890', ac: '#b8c8e0', shoe: '#4a4860', sole: '#2a2840' },
  angry: { top: '#d87060', topD: '#a84838', skirt: '#c86050', skirtD: '#984030', ac: '#ff9a83', shoe: '#5a2830', sole: '#2a0810' },
  lonely: { top: '#9a8eb0', topD: '#786888', skirt: '#8a7ea0', skirtD: '#685878', ac: '#c0b8d0', shoe: '#4a4060', sole: '#2a2040' },
  excited: { top: '#f0a058', topD: '#d08038', skirt: '#e89048', skirtD: '#c07028', ac: '#ffd36d', shoe: '#6a4030', sole: '#3a2010' },
  sleepy: { top: '#8890c0', topD: '#6870a0', skirt: '#7880b0', skirtD: '#586090', ac: '#c0c4e8', shoe: '#404060', sole: '#202040' },
  dazed: { top: '#a0acb8', topD: '#808898', skirt: '#909ca8', skirtD: '#707888', ac: '#d0d4dc', shoe: '#505058', sole: '#303038' },
  curious: { top: '#7ab898', topD: '#5a9878', skirt: '#6aa888', skirtD: '#4a8868', ac: '#d6bd75', shoe: '#4a5040', sole: '#2a3020' },
  proud: { top: '#d09070', topD: '#a87050', skirt: '#c08060', skirtD: '#986040', ac: '#f0b981', shoe: '#5a4030', sole: '#3a2010' },
  comforting: { top: '#7ab898', topD: '#5a9878', skirt: '#6aa888', skirtD: '#4a8868', ac: '#acd9c0', shoe: '#4a5040', sole: '#2a3020' },
  wronged: { top: '#b890a0', topD: '#906878', skirt: '#a88090', skirtD: '#806070', ac: '#e0c0d0', shoe: '#584050', sole: '#382030' },
  surprised: { top: '#e8a068', topD: '#c08048', skirt: '#d89058', skirtD: '#b07038', ac: '#ffd0a0', shoe: '#5a4030', sole: '#3a2010' },
};

function drawCharacter(ctx, ox, oy, emotion, p) {
  const bob = Math.sin(frameIndex / 6) * 2.5;
  const hCY = oy - 155 + bob;

  // === 头发后层 ===
  ctx.fillStyle = '#3a1a08';
  ctx.beginPath(); ctx.ellipse(ox - 14, hCY + 22, 46, 72, -0.12, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(ox + 14, hCY + 22, 46, 72, 0.12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#5c3820';
  ctx.fillRect(ox - 36, hCY - 10, 72, 14);

  // === 颈部 ===
  ctx.fillStyle = '#f0d4bc';
  ctx.beginPath(); ctx.ellipse(ox, hCY + 56, 14, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fbe8d8';
  ctx.fillRect(ox - 14, hCY + 46, 28, 28);

  // === 上衣 ===
  const tY = hCY + 68;
  ctx.fillStyle = p.top;
  rrect(ctx, ox - 40, tY, 80, 64, 14); ctx.fill();
  ctx.fillStyle = p.topD;
  ctx.fillRect(ox + 8, tY + 4, 28, 58);
  // 领口
  ctx.fillStyle = '#fbe8d8';
  ctx.beginPath(); ctx.moveTo(ox - 10, tY + 2); ctx.lineTo(ox + 10, tY + 2); ctx.lineTo(ox, tY + 18); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = p.ac; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(ox - 12, tY); ctx.lineTo(ox, tY + 18); ctx.lineTo(ox + 12, tY); ctx.stroke();
  // 衣领
  ctx.fillStyle = p.topD;
  rrect(ctx, ox - 32, tY - 4, 18, 12, 4); ctx.fill();
  rrect(ctx, ox + 14, tY - 4, 18, 12, 4); ctx.fill();
  // 衣领内衬
  ctx.fillStyle = '#fafafa';
  rrect(ctx, ox - 30, tY - 2, 14, 8, 3); ctx.fill();
  rrect(ctx, ox + 16, tY - 2, 14, 8, 3); ctx.fill();
  // 纽扣
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = '#fafafa';
    ctx.beginPath(); ctx.arc(ox, tY + 22 + i * 16, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d0d0d0';
    ctx.beginPath(); ctx.arc(ox, tY + 22 + i * 16, 1.5, 0, Math.PI * 2); ctx.fill();
  }
  // 口袋
  ctx.strokeStyle = p.topD; ctx.lineWidth = 1.5;
  rrect(ctx, ox + 16, tY + 40, 18, 16, 3); ctx.stroke();
  ctx.fillStyle = p.ac;
  ctx.fillRect(ox + 23, tY + 46, 4, 2);

  // === 裙子 ===
  const sY = tY + 64;
  ctx.fillStyle = p.skirt;
  ctx.beginPath();
  ctx.moveTo(ox - 36, sY);
  ctx.lineTo(ox + 36, sY);
  ctx.lineTo(ox + 48, sY + 72);
  ctx.lineTo(ox - 48, sY + 72);
  ctx.closePath();
  ctx.fill();
  // 裙褶
  ctx.strokeStyle = p.skirtD; ctx.lineWidth = 1.5;
  for (let i = 0; i < 5; i++) {
    const sx = ox - 24 + i * 12;
    ctx.beginPath(); ctx.moveTo(sx, sY + 4); ctx.lineTo(sx - 4 + (i % 2) * 6, sY + 70); ctx.stroke();
  }
  // 腰带
  ctx.fillStyle = p.ac;
  ctx.fillRect(ox - 38, sY - 2, 76, 8);
  // 蝴蝶结
  ctx.fillStyle = p.ac;
  ctx.beginPath(); ctx.ellipse(ox - 48, sY + 2, 14, 9, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(ox + 48, sY + 2, 14, 9, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(ox, sY + 2, 7, 0, Math.PI * 2); ctx.fill();
  // 蝴蝶结中间褶
  ctx.fillStyle = p.skirtD;
  ctx.fillRect(ox - 3, sY, 6, 6);

  // === 手臂 ===
  const armUp = ['excited', 'surprised', 'greet'].includes(emotion);
  const proud = emotion === 'proud';
  const shyE = ['shy', 'coquettish'].includes(emotion);

  if (proud) {
    ctx.fillStyle = '#fbe8d8';
    drawArm(ctx, ox - 52, tY + 10, -0.5, 16, 52);
    drawArm(ctx, ox + 36, tY + 10, 0.5, 16, 52);
    ctx.fillStyle = '#f0d4bc';
    ctx.beginPath(); ctx.arc(ox - 54, tY + 62, 10, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ox + 54, tY + 62, 10, 0, Math.PI * 2); ctx.fill();
  } else if (armUp) {
    ctx.fillStyle = '#fbe8d8';
    drawArm(ctx, ox - 54, hCY - 4, -1.0, 14, 52);
    drawArm(ctx, ox + 40, hCY - 4, 1.0, 14, 52);
    ctx.fillStyle = '#f0d4bc';
    ctx.beginPath(); ctx.arc(ox - 58, hCY - 60, 9, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ox + 58, hCY - 60, 9, 0, Math.PI * 2); ctx.fill();
    // 手指
    ctx.fillStyle = '#fbe8d8';
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(ox - 64 + i * 7, hCY - 68, 5, 8);
      ctx.fillRect(ox + 44 + i * 7, hCY - 68, 5, 8);
    }
  } else if (shyE) {
    ctx.fillStyle = '#fbe8d8';
    ctx.fillRect(ox - 36, tY + 16, 14, 44);
    ctx.fillRect(ox + 22, tY + 16, 14, 44);
    ctx.fillStyle = '#f0d4bc';
    rrect(ctx, ox - 40, tY + 58, 20, 10, 4); ctx.fill();
    rrect(ctx, ox + 20, tY + 58, 20, 10, 4); ctx.fill();
  } else {
    ctx.fillStyle = '#fbe8d8';
    ctx.fillRect(ox - 50, tY + 14, 14, 56);
    ctx.fillRect(ox + 36, tY + 14, 14, 56);
    ctx.fillStyle = '#f0d4bc';
    rrect(ctx, ox - 54, tY + 66, 20, 12, 5); ctx.fill();
    rrect(ctx, ox + 34, tY + 66, 20, 12, 5); ctx.fill();
  }

  // === 腿 ===
  const legY = sY + 70;
  ctx.fillStyle = '#fbe8d8';
  ctx.fillRect(ox - 20, legY, 18, 62);
  ctx.fillRect(ox + 4, legY, 18, 62);
  // 膝盖高光
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath(); ctx.arc(ox - 11, legY + 28, 7, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(ox + 13, legY + 28, 7, 0, Math.PI * 2); ctx.fill();

  // === 袜子 ===
  ctx.fillStyle = '#fafafa';
  ctx.fillRect(ox - 22, legY + 46, 20, 26);
  ctx.fillRect(ox + 4, legY + 46, 20, 26);
  // 袜口
  ctx.fillStyle = p.ac;
  ctx.fillRect(ox - 22, legY + 46, 20, 3);
  ctx.fillRect(ox + 4, legY + 46, 20, 3);
  ctx.fillRect(ox - 22, legY + 52, 20, 2);
  ctx.fillRect(ox + 4, legY + 52, 20, 2);

  // === 鞋子 ===
  ctx.fillStyle = p.shoe;
  rrect(ctx, ox - 28, legY + 64, 30, 16, 8, 8, 4, 4); ctx.fill();
  rrect(ctx, ox + 2, legY + 64, 30, 16, 8, 8, 4, 4); ctx.fill();
  // 鞋底
  ctx.fillStyle = p.sole;
  ctx.fillRect(ox - 25, legY + 76, 24, 5);
  ctx.fillRect(ox + 5, legY + 76, 24, 5);
  // 鞋面缝线
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(ox - 22, legY + 68); ctx.lineTo(ox - 4, legY + 70); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ox + 8, legY + 68); ctx.lineTo(ox + 28, legY + 70); ctx.stroke();
  // 鞋带
  ctx.fillStyle = p.ac;
  ctx.beginPath(); ctx.arc(ox - 13, legY + 71, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(ox + 17, legY + 71, 3.5, 0, Math.PI * 2); ctx.fill();

  // === 脸部 ===
  const fg = ctx.createRadialGradient(ox - 3, hCY - 6, 4, ox, hCY, 46);
  fg.addColorStop(0, '#fff8f2');
  fg.addColorStop(0.6, '#fbe8d8');
  fg.addColorStop(1, '#f0d4bc');
  ctx.fillStyle = fg;
  ctx.beginPath(); ctx.ellipse(ox, hCY, 40, 46, 0, 0, Math.PI * 2); ctx.fill();

  // === 眼睛 ===
  const eY = hCY - 10;
  const blink = emotion === 'sleepy' || (frameIndex % 44 === 0);
  const surp = emotion === 'surprised';
  const angryE = emotion === 'angry';
  const sadE = ['sad', 'lonely', 'wronged'].includes(emotion);
  const happyE = emotion === 'happy';

  if (blink) {
    ctx.strokeStyle = '#1a1018'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(ox - 24, eY + 2); ctx.lineTo(ox - 9, eY + 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox + 9, eY + 2); ctx.lineTo(ox + 24, eY + 2); ctx.stroke();
  } else {
    // 上睫毛阴影
    ctx.fillStyle = 'rgba(90, 60, 40, 0.2)';
    ctx.beginPath(); ctx.ellipse(ox - 17, eY - 5, 13, 7, -0.08, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(ox + 17, eY - 5, 13, 7, 0.08, 0, Math.PI * 2); ctx.fill();
    // 眼睛
    drawEye(ctx, ox - 17, eY, 11, surp ? 13 : (happyE ? 6 : 10), surp);
    drawEye(ctx, ox + 17, eY, 11, surp ? 13 : (happyE ? 6 : 10), surp);
    if (happyE) {
      ctx.fillStyle = '#fbe8d8';
      ctx.fillRect(ox - 27, eY + 5, 22, 7);
      ctx.fillRect(ox + 5, eY + 5, 22, 7);
    }
  }

  // 眉毛
  ctx.strokeStyle = '#3a1a08'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  if (angryE) {
    ctx.beginPath(); ctx.moveTo(ox - 30, eY - 7); ctx.lineTo(ox - 8, eY - 15); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox + 8, eY - 15); ctx.lineTo(ox + 30, eY - 7); ctx.stroke();
  } else if (sadE) {
    ctx.beginPath(); ctx.moveTo(ox - 26, eY - 13); ctx.lineTo(ox - 10, eY - 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox + 10, eY - 7); ctx.lineTo(ox + 26, eY - 13); ctx.stroke();
  } else if (surp) {
    ctx.lineWidth = 2.8;
    ctx.beginPath(); ctx.moveTo(ox - 30, eY - 17); ctx.quadraticCurveTo(ox - 17, eY - 22, ox - 5, eY - 13); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox + 5, eY - 13); ctx.quadraticCurveTo(ox + 17, eY - 22, ox + 30, eY - 17); ctx.stroke();
  } else {
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(ox - 26, eY - 13); ctx.quadraticCurveTo(ox - 17, eY - 17, ox - 8, eY - 13); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox + 8, eY - 13); ctx.quadraticCurveTo(ox + 17, eY - 17, ox + 26, eY - 13); ctx.stroke();
  }

  // 睫毛
  if (!blink) {
    ctx.strokeStyle = '#1a1018'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    const lh = surp ? 12 : 6;
    ctx.beginPath(); ctx.moveTo(ox - 27, eY - lh); ctx.lineTo(ox - 6, eY - lh - 4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox + 6, eY - lh - 4); ctx.lineTo(ox + 27, eY - lh); ctx.stroke();
  }

  // 下眼睑
  if (sadE) {
    ctx.fillStyle = 'rgba(210, 150, 150, 0.35)';
    ctx.beginPath(); ctx.ellipse(ox - 17, eY + 6, 10, 3, 0, 0, Math.PI); ctx.fill();
    ctx.beginPath(); ctx.ellipse(ox + 17, eY + 6, 10, 3, 0, 0, Math.PI); ctx.fill();
  }

  // 脸红
  if (['shy', 'affectionate', 'coquettish', 'happy'].includes(emotion)) {
    ctx.fillStyle = 'rgba(242, 140, 150, 0.32)';
    ctx.beginPath(); ctx.ellipse(ox - 26, eY + 10, 14, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(ox + 26, eY + 10, 14, 7, 0, 0, Math.PI * 2); ctx.fill();
  }

  // 眼泪
  if (['sad', 'lonely', 'wronged'].includes(emotion) && frameIndex % 8 > 4) {
    ctx.fillStyle = 'rgba(140, 195, 235, 0.65)';
    ctx.beginPath(); ctx.ellipse(ox - 25, eY + 8, 5, 9, 0.15, 0, Math.PI * 2); ctx.fill();
  }

  // === 鼻子 ===
  ctx.fillStyle = '#f0d4bc';
  ctx.beginPath(); ctx.arc(ox, hCY + 4, 4.5, 0, Math.PI * 2); ctx.fill();

  // === 嘴巴 ===
  const mY = hCY + 18;
  if (surp || emotion === 'excited') {
    ctx.fillStyle = '#c85058';
    ctx.beginPath(); ctx.ellipse(ox, mY + 2, 11, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e86070';
    ctx.beginPath(); ctx.ellipse(ox, mY, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
  } else if (happyE) {
    ctx.strokeStyle = '#c85058'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(ox, mY - 2, 12, 0.15, Math.PI - 0.15); ctx.stroke();
  } else if (sadE || angryE) {
    ctx.strokeStyle = '#b85060'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(ox, mY + 18, 11, Math.PI + 0.18, -0.18); ctx.stroke();
  } else {
    ctx.strokeStyle = '#d87078'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(ox - 6, mY); ctx.quadraticCurveTo(ox, mY + 3, ox + 6, mY); ctx.stroke();
  }

  // === 头发（前层） ===
  // 头顶弧
  ctx.fillStyle = '#7a4a30';
  ctx.beginPath(); ctx.arc(ox, hCY - 36, 42, Math.PI * 0.88, Math.PI * 0.12); ctx.fill();
  // 刘海主体
  ctx.fillStyle = '#5c3820';
  ctx.beginPath(); ctx.ellipse(ox, hCY - 26, 42, 22, 0, Math.PI, 0); ctx.fill();
  // 刘海分片
  ctx.fillStyle = '#7a4a30';
  for (let i = -1; i <= 1; i++) {
    const cx = ox + i * 12;
    ctx.beginPath();
    ctx.moveTo(cx - 14, hCY - 30);
    ctx.quadraticCurveTo(cx - 6, hCY - 8, cx, hCY - 14);
    ctx.quadraticCurveTo(cx + 6, hCY - 8, cx + 14, hCY - 30);
    ctx.closePath();
    ctx.fill();
  }
  // 侧发
  ctx.fillStyle = '#3a1a08';
  ctx.beginPath();
  ctx.moveTo(ox - 38, hCY - 8);
  ctx.quadraticCurveTo(ox - 48, hCY + 20, ox - 36, hCY + 40);
  ctx.quadraticCurveTo(ox - 32, hCY + 20, ox - 36, hCY - 2);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(ox + 38, hCY - 8);
  ctx.quadraticCurveTo(ox + 48, hCY + 20, ox + 36, hCY + 40);
  ctx.quadraticCurveTo(ox + 32, hCY + 20, ox + 36, hCY - 2);
  ctx.closePath();
  ctx.fill();
  // 刘海高光
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.beginPath(); ctx.ellipse(ox - 13, hCY - 28, 14, 5, -0.3, Math.PI, 0); ctx.fill();
  ctx.beginPath(); ctx.ellipse(ox + 13, hCY - 28, 14, 5, 0.3, Math.PI, 0); ctx.fill();

  // === 特效 ===
  if (emotion === 'sleepy') {
    ctx.fillStyle = 'rgba(180,190,220,0.5)';
    ctx.font = 'bold 28px sans-serif'; ctx.fillText('z', ox + 42, hCY - 46);
    ctx.font = 'bold 20px sans-serif'; ctx.fillText('z', ox + 56, hCY - 66);
    ctx.font = 'bold 16px sans-serif'; ctx.fillText('Z', ox + 64, hCY - 84);
  }
  if (emotion === 'curious') {
    ctx.fillStyle = p.ac; ctx.font = 'bold 32px sans-serif';
    ctx.fillText('?', ox + 34, hCY - 36);
  }
  if (emotion === 'excited' || emotion === 'happy') {
    ctx.fillStyle = 'rgba(255,220,130,0.45)';
    ctx.beginPath(); ctx.arc(ox - 52, hCY - 36, 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ox + 56, hCY - 50, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ox + 50, hCY - 28, 7, 0, Math.PI * 2); ctx.fill();
  }
}

function drawArm(ctx, x, y, angle, w, h) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawEye(ctx, ex, ey, ew, eh, wide) {
  // 眼白
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.ellipse(ex, ey, ew + 2, eh, 0, 0, Math.PI * 2); ctx.fill();
  // 虹膜
  const ig = ctx.createRadialGradient(ex, ey + 1, 0, ex, ey, ew * 0.7);
  ig.addColorStop(0, '#4a6888');
  ig.addColorStop(0.5, '#3a4868');
  ig.addColorStop(1, '#1a1018');
  ctx.fillStyle = ig;
  ctx.beginPath(); ctx.ellipse(ex, ey + 1, ew * 0.7, eh * 0.8, 0, 0, Math.PI * 2); ctx.fill();
  // 瞳孔
  ctx.fillStyle = '#1a1018';
  ctx.beginPath(); ctx.arc(ex, ey + 1, ew * 0.32, 0, Math.PI * 2); ctx.fill();
  // 主高光
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(ex + ew * 0.25, ey - eh * 0.25, ew * 0.22, 0, Math.PI * 2); ctx.fill();
  // 副高光
  ctx.beginPath(); ctx.arc(ex - ew * 0.12, ey - eh * 0.4, ew * 0.10, 0, Math.PI * 2); ctx.fill();
}

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

onMounted(() => startLoop());
onUnmounted(() => stopLoop());

function startLoop() {
  stopLoop();
  animationTimer = setInterval(() => { frameIndex = (frameIndex + 1) % 48; drawFrame(); }, 1000 / 6);
  drawFrame();
}
function stopLoop() { if (animationTimer) { clearInterval(animationTimer); animationTimer = null; } }

function drawFrame() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvasWidth.value, canvasHeight.value);

  const emotion = petStore.currentEmotion || 'idle';
  const intensity = petStore.currentIntensity || 'mild';

  // ===== 精灵图模式 =====
  const config = spritesheetConfig.value;
  if (config && spriteImage.value) {
    const col = (config.mapping?.[emotion] !== undefined) ? config.mapping[emotion] : emotionColumnMap[emotion];
    const row = intensityRowMap[intensity] || 0;
    const cw = config.cellWidth || 192;
    const ch = config.cellHeight || 192;
    const sx = (col !== undefined ? col : 0) * cw;
    const sy = (row !== undefined ? row : 0) * ch;
    const dx = Math.round((canvasWidth.value - cw) / 2);
    const dy = Math.round((canvasHeight.value - ch) / 2);

    if (facing === 'left') {
      ctx.save(); ctx.translate(canvasWidth.value, 0); ctx.scale(-1, 1);
      ctx.drawImage(spriteImage.value, sx, sy, cw, ch, canvasWidth.value - dx - cw, dy, cw, ch);
      ctx.restore();
    } else {
      ctx.drawImage(spriteImage.value, sx, sy, cw, ch, dx, dy, cw, ch);
    }
    return;
  }

  // ===== 程序化绘制模式 =====
  const baseP = P[emotion] || P.idle;
  const cs = useCharacterStore();
  const charPalette = cs.current?.palette || {};
  const p = { ...baseP, ...charPalette };
  if (facing === 'left') { ctx.save(); ctx.translate(canvasWidth.value, 0); ctx.scale(-1, 1); }
  // 以 512×640 坐标系绘制，缩放适配画布，顶部留 40px 给气泡
  const s = canvasWidth.value / 512;
  ctx.save();
  ctx.translate(0, 10); // 给气泡留空间
  ctx.scale(s, s);
  drawCharacter(ctx, 256, 320, emotion, p);
  ctx.restore();
  if (facing === 'left') { ctx.restore(); }

  // ===== Agent 进度可视化 =====
  const brain = useEmotionBrain();
  const c = brain?.context;
  if (c) {
    const barY = canvasHeight.value - 8;
    if (c.agentStatus === 'working' && c.agentProgress > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(10, barY, canvasWidth.value - 20, 4);
      ctx.fillStyle = '#7eb8a6';
      ctx.fillRect(10, barY, (canvasWidth.value - 20) * Math.min(1, c.agentProgress), 4);
      if (c.agentTask) {
        ctx.font = '10px "PingFang SC", sans-serif';
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.textAlign = 'center';
        ctx.fillText(c.agentTask, canvasWidth.value / 2, barY - 4);
      }
    } else if (c.agentStatus === 'thinking') {
      if (frameIndex % 30 < 15) {
        ctx.font = 'bold 16px sans-serif';
        ctx.fillStyle = 'rgba(100,100,200,0.5)';
        ctx.textAlign = 'right';
        ctx.fillText('?', canvasWidth.value - 8, 16);
      }
    } else if (c.agentStatus === 'done' && frameIndex % 60 < 30) {
      ctx.font = 'bold 14px sans-serif';
      ctx.fillStyle = '#5a9a86';
      ctx.textAlign = 'right';
      ctx.fillText('✓', canvasWidth.value - 8, 16);
    } else if (c.agentStatus === 'error' && frameIndex % 40 < 20) {
      ctx.font = 'bold 14px sans-serif';
      ctx.fillStyle = '#c44';
      ctx.textAlign = 'right';
      ctx.fillText('!', canvasWidth.value - 8, 16);
    }
  }
}

watch(() => petStore.currentEmotion, () => { frameIndex = 0; startLoop(); });
function setFacing(dir) { facing = dir; }
function getBounds() { return containerRef.value?.getBoundingClientRect() || null; }
function loadSpritesheet(config) {
  if (!config?.file) { spritesheetConfig.value = null; spriteImage.value = null; return; }
  spritesheetConfig.value = config;
  const img = new Image();
  img.onload = () => { spriteImage.value = img; };
  img.src = config.file;
}
defineExpose({ getBounds, setFacing, startLoop, stopLoop, loadSpritesheet });
</script>

<style scoped>
.pet-container {
  position: absolute;
  left: 0;
  top: 0;
  width: 200px;
  height: 240px;
  cursor: grab;
  -webkit-app-region: no-drag;
}
canvas {
  display: block;
  width: 200px;
  height: 240px;
}
</style>
