<template>
  <aside class="output-sidebar">
    <div class="section-label">OBS</div>

    <!-- 방송 상태 -->
    <div class="obs-panel">
      <div class="section-label">방송 상태</div>
      <div class="status-display">
        <h2 :class="streamRunning ? 'on-air-text' : 'standby-text'">
          {{ streamRunning ? 'ON AIR' : 'OFF AIR' }}<span v-if="streamRunning" class="blink-dot"></span>
        </h2>
        <div class="timer-text">{{ formatTime(streamSeconds) }}</div>
      </div>
      <div class="subsection">
        <div class="section-label">방송 제어</div>
        <div class="obs-actions">
          <button class="btn-obs start" :class="{ 'btn-active': streamRunning }" @click="$emit('start-stream')">방송 시작</button>
          <button class="btn-obs stop" @click="$emit('stop-stream')">방송 종료</button>
        </div>
      </div>
    </div>

    <!-- 녹화 상태 -->
    <div class="obs-panel">
      <div class="section-label">녹화 상태</div>
      <div class="status-display">
        <h2 :class="recordRunning ? 'rec-live-text' : 'rec-stop-text'">
          {{ recordRunning ? 'REC' : 'STOP' }}<span v-if="recordRunning" class="blink-dot"></span>
        </h2>
        <div class="timer-text">{{ formatTime(recordSeconds) }}</div>
      </div>
      <div class="subsection">
        <div class="section-label">녹화 제어</div>
        <div class="obs-actions">
          <button class="btn-obs start" :class="{ 'btn-active': recordRunning }" @click="$emit('start-record')">녹화 시작</button>
          <button class="btn-obs stop" @click="$emit('stop-record')">녹화 종료</button>
        </div>
      </div>
    </div>

    <!-- 미디어 소스 -->
    <div class="obs-panel">
      <div class="section-label">미디어 소스 선택</div>
      <div v-if="mediaSources.length" class="obs-source-grid">
        <button
          v-for="src in mediaSources"
          :key="'media-' + src.name"
          class="btn-obs"
          :class="{ 'active-media': src.active }"
          @click="$emit('toggle-media', src)"
        >{{ src.name }}</button>
      </div>
      <div v-else class="empty-hint">장면/비디오 소스 목록을 확인해주세요</div>
    </div>

    <!-- OBS 화면전환 -->
    <button class="btn-obs-transition" @click="$emit('obs-transition')">
      OBS 화면전환
    </button>

    <!-- 오디오 소스 -->
    <div class="obs-panel">
      <div class="section-label">오디오 소스 선택</div>
      <div v-if="audioSources.length" class="obs-source-grid">
        <button
          v-for="src in audioSources"
          :key="'audio-' + src.name"
          class="btn-obs"
          :class="{ 'active-audio': src.active }"
          @click="$emit('toggle-audio', src)"
        >{{ src.name }}</button>
      </div>
      <div v-else class="empty-hint">장면/비디오 소스 목록을 확인해주세요</div>
    </div>

    <!-- 설정 정보 -->
    <div class="setting-group">
      <div class="setting-row">
        <span>플랫폼</span>
        <span class="setting-value-strong">OBS → YouTube RTMP</span>
      </div>
      <div class="setting-row">
        <span>미디어</span>
        <span class="setting-value-strong">{{ currentMedia }}</span>
      </div>
      <div class="setting-row">
        <span>오디오</span>
        <span class="setting-value-strong">{{ currentAudio }}</span>
      </div>
    </div>
  </aside>
</template>

<script setup>
defineProps({
  streamRunning: Boolean,
  streamSeconds: Number,
  recordRunning: Boolean,
  recordSeconds: Number,
  mediaSources: Array,
  audioSources: Array,
  currentMedia: String,
  currentAudio: String,
});
defineEmits([
  'start-stream', 'stop-stream',
  'start-record', 'stop-record',
  'toggle-media', 'toggle-audio', 'obs-transition',
]);

function formatTime(s) {
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${h}:${m}:${sec}`;
}
</script>

<style scoped>
.output-sidebar {
  width: 450px;
  background: var(--panel-bg);
  border-left: 2px solid #111;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
}

.obs-panel {
  background: var(--soft-panel-bg);
  border: 1px solid var(--soft-panel-border);
  border-radius: 12px;
  padding: 18px 18px 20px;
}

.status-display {
  background: #000;
  border: 1px solid #444;
  padding: 24px;
  text-align: center;
  border-radius: 6px;
}
.status-display h2 { margin: 0; font-size: 34px; letter-spacing: 2px; }

.on-air-text { color: var(--active-red); }
.standby-text { color: #666; }
.rec-live-text { color: var(--active-red); }
.rec-stop-text { color: #777; }

.timer-text {
  font-family: monospace;
  font-size: 24px;
  color: #ccc;
  margin-top: 10px;
}

.obs-actions {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.obs-source-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}

.btn-obs {
  min-height: 72px;
  padding: 16px 18px;
  background: #3f3f3f;
  border: none;
  color: white;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  font-size: 16px;
  transition: background-color 0.12s ease, transform 0.08s ease;
}
.btn-obs:hover { filter: brightness(1.2); }
.btn-obs:active { transform: scale(0.98); }
.btn-obs.start { background: #2c5a3d; }
.btn-obs.stop { background: #5a2e2e; }
.btn-obs.btn-active { background: #22c55e; color: #000; font-weight: 700; box-shadow: 0 0 14px rgba(34, 197, 94, 0.45); }

.blink-dot {
  display: inline-block;
  width: 14px;
  height: 14px;
  background: var(--active-red);
  border-radius: 50%;
  margin-left: 10px;
  vertical-align: middle;
  animation: blink 1s step-start infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.active-media { background-color: var(--active-cyan) !important; color: white; }
.active-audio { background-color: var(--active-purple) !important; color: white; }

.setting-group { background: #2a2a2a; padding: 15px; border-radius: 6px; }
.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  margin-bottom: 8px;
  color: #aaa;
  gap: 12px;
}
.setting-row:last-child { margin-bottom: 0; }
.setting-value-strong { color: white; font-weight: 600; }
.subsection { margin-top: 18px; }

.btn-obs-transition {
  width: 100%;
  min-height: 56px;
  background: var(--active-cyan);
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: filter 0.12s ease, transform 0.08s ease;
}
.btn-obs-transition:hover { filter: brightness(1.2); }
.btn-obs-transition:active { transform: scale(0.98); }

.empty-hint {
  color: #666;
  font-size: 13px;
  padding: 20px 0;
  text-align: center;
}
</style>
