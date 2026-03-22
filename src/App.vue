<template>
  <div class="top-header">
    <span class="header-title">Broadcast Software Control</span>
    <span class="header-venue">나눔교회</span>
  </div>

  <div class="main-body">
    <div
      class="workspace-area"
      ref="workspaceArea"
    >
      <div
        class="workspace-inner"
        ref="workspaceInner"
      >
        <ProgramBus
          class="program-pos"
          label="프로그램"
          :channels="channels"
          :activeIndex="activeProgram"
          activeClass="active-pgm"
          @select="setProgram"
        />

        <ProgramBus
          class="preview-pos"
          label="프리뷰"
          :channels="channels"
          :activeIndex="activePreview"
          activeClass="active-pvw"
          @select="setPreview"
        />

        <div class="right-stack">
          <TransitionPanel
            :transitions="transitions"
            :active="activeTransition"
            @select="setTransition"
          />
          <AuxPanel
            :sources="auxSources"
            :activeIndex="activeAux"
            @select="setAux"
          />
          <ExecutePanel
            @cut="execCut"
            @auto="execAuto"
          />
        </div>
      </div>
    </div>

    <ObsSidebar
      :streamRunning="streamRunning"
      :streamSeconds="streamSeconds"
      :recordRunning="recordRunning"
      :recordSeconds="recordSeconds"
      :mediaSources="mediaSources"
      :audioSources="audioSources"
      :currentMedia="currentMedia"
      :currentAudio="currentAudio"
      @start-stream="startStream"
      @stop-stream="stopStream"
      @start-record="startRecord"
      @stop-record="stopRecord"
      @toggle-media="toggleMedia"
      @toggle-audio="toggleAudio"
      @obs-transition="execObsTransition"
    />
  </div>

  <div class="bottom-footer">
    <button
      class="btn-settings"
      @click="openSettings"
    >
      &#9881;
    </button>
    <div class="footer-stats">
      <span class="stat-item">&#9881; CPU {{ cpuUsage }}%</span>
      <span class="stat-item">&#9670; GPU {{ gpuUsage }}%</span>
      <span class="stat-item">&#9654; FPS {{ obsFps }}</span>
      <span class="stat-item">&#8597; {{ obsBitrate }} kbps</span>
      <span
        class="stat-item"
        :class="{ 'stat-warn': diskFree < 30e9 }"
        >&#9776; {{ formatDisk(diskFree) }} free</span
      >
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import ProgramBus from './components/ProgramBus.vue';
import TransitionPanel from './components/TransitionPanel.vue';
import AuxPanel from './components/AuxPanel.vue';
import ExecutePanel from './components/ExecutePanel.vue';
import ObsSidebar from './components/ObsSidebar.vue';

const api = window.electronAPI;
console.log('[Vue] electronAPI:', api ? 'loaded' : 'NOT FOUND');

// ── 자동 스케일 ──
const BODY_W = 2000;
const BODY_H = 1000;
const workspaceArea = ref(null);
const workspaceInner = ref(null);

function updateScale() {
  if (!workspaceArea.value || !workspaceInner.value) return;
  const areaW = workspaceArea.value.clientWidth;
  const areaH = workspaceArea.value.clientHeight;
  const s = Math.min(areaW / BODY_W, areaH / BODY_H, 1);
  workspaceInner.value.style.transform = `translate(-50%, -50%) scale(${s})`;
}

// ── ATEM 상태 ──
const channels = ref([
  { label: 'Cam 1' },
  { label: 'Cam 2' },
  { label: 'Cam 3' },
  { label: 'Cam 4' },
  { label: 'BLK' },
  { label: 'COL 1' },
  { label: 'MP 1' },
  { label: 'SRC 8' },
  { label: 'SRC 9' },
  { label: 'SRC 10' },
]);
const auxSources = ref([
  { label: 'PGM' },
  { label: 'PVW' },
  { label: 'MVW' },
  { label: 'Cam 1' },
  { label: 'Cam 2' },
  { label: 'Cam 3' },
  { label: 'Cam 4' },
  { label: 'BLK' },
  { label: 'MP 1' },
]);
const transitions = ['MIX', 'DIP', 'WIPE', 'DVE'];

const activeProgram = ref(0);
const activePreview = ref(1);
const activeTransition = ref('MIX');
const activeAux = ref(0);

let atemIdReverse = {};

// ── OBS 상태 ──
const streamRunning = ref(false);
const streamSeconds = ref(0);
const recordRunning = ref(false);
const recordSeconds = ref(0);

const mediaSources = ref([]);
const audioSources = ref([]);
const currentMedia = ref('-');
const currentAudio = ref('-');

// ── ATEM 액션 ──
function setProgram(i) {
  activeProgram.value = i;
  const label = channels.value[i].label;
  console.log('[Vue] setProgram:', label);
  api?.atem.setProgram(label);
}
function setPreview(i) {
  activePreview.value = i;
  const label = channels.value[i].label;
  console.log('[Vue] setPreview:', label);
  api?.atem.setPreview(label);
}
function setTransition(t) {
  activeTransition.value = t;
  api?.atem.setTransition(t);
}
function setAux(i) {
  activeAux.value = i;
  api?.atem.setAux(auxSources.value[i].label);
}
function execCut() {
  api?.atem.cut();
}
function execAuto() {
  api?.atem.auto();
}
function execObsTransition() {
  api?.obs.triggerTransition();
}
function openSettings() {
  api?.config.openWindow();
}

// ── 시스템 통계 ──
const cpuUsage = ref(0);
const gpuUsage = ref(0);
const diskFree = ref(0);
const obsFps = ref(0);
const obsBitrate = ref(0);

function formatDisk(bytes) {
  if (bytes >= 1e12) return (bytes / 1e12).toFixed(1) + ' TB';
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + ' GB';
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(0) + ' MB';
  return '0 MB';
}

async function pollStats() {
  if (!api?.system) return;
  try {
    const s = await api.system.getStats();
    cpuUsage.value = s.cpu;
    gpuUsage.value = s.gpu;
    diskFree.value = s.diskFree;
    obsFps.value = s.obsFps;
    obsBitrate.value = s.obsBitrate;
  } catch {}
}

// ── OBS 액션 ──
function startStream() {
  streamRunning.value = true;
  api?.obs.startStream();
}
function stopStream() {
  streamRunning.value = false;
  streamSeconds.value = 0;
  api?.obs.stopStream();
}
function startRecord() {
  recordRunning.value = true;
  api?.obs.startRecord();
}
function stopRecord() {
  recordRunning.value = false;
  recordSeconds.value = 0;
  api?.obs.stopRecord();
}

async function toggleMedia(src) {
  if (!api) {
    src.active = !src.active;
    if (src.active) currentMedia.value = src.name;
    return;
  }
  const newState = await api.obs.toggleSource(src.name);
  if (newState !== null) {
    src.active = newState;
    if (newState) currentMedia.value = src.name;
  }
}
function toggleAudio(src) {
  src.active = !src.active;
  if (src.active) currentAudio.value = src.name;
  api?.obs.setInputMute(src.name, !src.active);
}

// ── 설정 적용 ──
function applyConfig(cfg) {
  channels.value = (cfg.channels ?? []).map((ch) => ({ label: ch.label }));
  auxSources.value = (cfg.auxSources ?? []).map((src) => ({
    label: src.label,
  }));
  atemIdReverse = {};
  (cfg.channels ?? []).forEach((ch) => {
    atemIdReverse[ch.atemId] = ch.label;
  });
}

// ── 타이머 ──
const timer = setInterval(() => {
  if (streamRunning.value) streamSeconds.value++;
  if (recordRunning.value) recordSeconds.value++;
}, 1000);

const statsTimer = setInterval(pollStats, 2000);

// ── IPC 리스너 ──
function onKeydown(e) {
  if ((e.metaKey || e.ctrlKey) && e.key === ',') {
    e.preventDefault();
    api?.config.openWindow();
  }
}

onMounted(() => {
  updateScale();
  window.addEventListener('resize', updateScale);
  document.addEventListener('keydown', onKeydown);
  pollStats();
  if (!api) return;

  api.config.get().then(applyConfig);
  api.config.onUpdated(applyConfig);

  api.atem.onStateChanged((state) => {
    if (state.programInput !== undefined) {
      const label = atemIdReverse[state.programInput];
      const idx = channels.value.findIndex((ch) => ch.label === label);
      if (idx !== -1) activeProgram.value = idx;
    }
    if (state.previewInput !== undefined) {
      const label = atemIdReverse[state.previewInput];
      const idx = channels.value.findIndex((ch) => ch.label === label);
      if (idx !== -1) activePreview.value = idx;
    }
  });

  api.obs.onStreamStatus((s) => {
    streamRunning.value = s.active;
  });
  api.obs.onRecordStatus((s) => {
    recordRunning.value = s.active;
  });

  api.obs.onSourcesLoaded(
    ({ sources, audioSources: audioList, visibilityMap, muteMap }) => {
      mediaSources.value = sources.map((name) => ({
        name,
        active: visibilityMap?.[name] ?? false,
      }));
      audioSources.value = audioList.map((name) => ({
        name,
        active: !(muteMap?.[name] ?? false),
      }));
      const am = mediaSources.value.find((s) => s.active);
      if (am) currentMedia.value = am.name;
      const aa = audioSources.value.find((s) => s.active);
      if (aa) currentAudio.value = aa.name;
    },
  );

  api.obs.onSceneItemStateChanged(({ sourceName, sceneItemEnabled }) => {
    const src = mediaSources.value.find((s) => s.name === sourceName);
    if (src) src.active = sceneItemEnabled;
  });
  api.obs.onInputMuteChanged(({ inputName, inputMuted }) => {
    const src = audioSources.value.find((s) => s.name === inputName);
    if (src) src.active = !inputMuted;
  });
});

onUnmounted(() => {
  clearInterval(timer);
  clearInterval(statsTimer);
  window.removeEventListener('resize', updateScale);
  document.removeEventListener('keydown', onKeydown);
});
</script>

<style>
:root {
  --bg-dark: #1a1a1a;
  --panel-bg: #252525;
  --btn-gray: #3a3a3a;
  --active-red: #ff3b30;
  --active-lime: #d4ff00;
  --active-yellow: #ffcc00;
  --active-cyan: #00b7ff;
  --active-purple: #9a7cff;
  --text-gray: #888;
  --soft-panel-bg: rgba(0, 0, 0, 0.14);
  --soft-panel-border: rgba(255, 255, 255, 0.05);
}

* {
  box-sizing: border-box;
}

body {
  background-color: var(--bg-dark);
  color: white;
  font-family: 'Segoe UI', sans-serif;
  margin: 0;
  display: flex;
  height: 100vh;
  overflow: hidden;
}

#app {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.top-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 34px 24px;
  background: #111;
  border-bottom: 1px solid #333;
  flex-shrink: 0;
}

.header-title {
  font-size: 24px;
  font-weight: 300;
  letter-spacing: 1.5px;
  color: #ccc;
}

.header-venue {
  font-size: 22px;
  font-weight: 300;
  color: var(--text-gray);
}

.main-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.workspace-area {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.workspace-inner {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 2000px;
  height: 1000px;
  display: grid;
  grid-template-columns: 1090px 600px;
  grid-template-rows: auto 1fr;
  column-gap: 250px;
  row-gap: 60px;
  padding: 400px 40px 30px;
  transform-origin: center center;
}

.section-label {
  font-size: 12px;
  color: var(--text-gray);
  margin-bottom: 15px;
  font-weight: bold;
  letter-spacing: 0.5px;
}

.panel-block {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

/* 그리드 배치 */
.program-pos {
  grid-column: 1;
  grid-row: 1;
  align-self: end;
  justify-self: start;
}
.preview-pos {
  grid-column: 1;
  grid-row: 2;
  align-self: start;
  justify-self: start;
}
.right-stack {
  grid-column: 2;
  grid-row: 1 / 3;
  display: flex;
  flex-direction: column;
  gap: 40px;
  justify-content: end;
}

.bottom-footer {
  display: flex;
  align-items: center;
  padding: 8px 10px;
  background: #111;
  border-top: 1px solid #333;
  flex-shrink: 0;
}

.btn-settings {
  background: none;
  border: none;
  color: var(--text-gray);
  font-size: 22px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: color 0.15s;
}
.btn-settings:hover {
  color: #ccc;
}

.footer-stats {
  margin-left: auto;
  display: flex;
  gap: 24px;
}

.stat-item {
  font-size: 13px;
  color: var(--text-gray);
  font-family: 'Segoe UI', sans-serif;
  font-weight: 600;
}

.stat-warn {
  color: var(--active-red);
  animation: blink-stat 1s step-start infinite;
}

@keyframes blink-stat {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}
</style>
