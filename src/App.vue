<template>
  <div class="workspace">
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

    <div class="right-top-stack">
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
    </div>

    <ExecutePanel class="execute-pos" @cut="execCut" @auto="execAuto" />
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
  />
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

// ── ATEM 상태 ──
const channels = ref([
  { label: 'Cam 1' }, { label: 'Cam 2' }, { label: 'Cam 3' },
  { label: 'Cam 4' }, { label: 'BLK' },
  { label: 'COL 1' }, { label: 'MP 1' }, { label: 'SRC 8' },
  { label: 'SRC 9' }, { label: 'SRC 10' },
]);
const auxSources = ref([
  { label: 'PGM' }, { label: 'PVW' }, { label: 'MVW' },
  { label: 'Cam 1' }, { label: 'Cam 2' }, { label: 'Cam 3' },
  { label: 'Cam 4' }, { label: 'BLK' }, { label: 'MP 1' },
]);
const transitions = ['MIX', 'WIPE', 'DIP', 'DVE', 'STING'];

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
function execCut() { api?.atem.cut(); }
function execAuto() { api?.atem.auto(); }

// ── OBS 액션 ──
function startStream() { streamRunning.value = true; api?.obs.startStream(); }
function stopStream() { streamRunning.value = false; streamSeconds.value = 0; api?.obs.stopStream(); }
function startRecord() { recordRunning.value = true; api?.obs.startRecord(); }
function stopRecord() { recordRunning.value = false; recordSeconds.value = 0; api?.obs.stopRecord(); }

async function toggleMedia(src) {
  if (!api) { src.active = !src.active; if (src.active) currentMedia.value = src.name; return; }
  const newState = await api.obs.toggleSource(src.name);
  if (newState !== null) { src.active = newState; if (newState) currentMedia.value = src.name; }
}
function toggleAudio(src) {
  src.active = !src.active;
  if (src.active) currentAudio.value = src.name;
  api?.obs.setInputMute(src.name, !src.active);
}

// ── 설정 적용 ──
function applyConfig(cfg) {
  (cfg.channels ?? []).forEach((ch, i) => {
    if (channels.value[i]) channels.value[i].label = ch.label;
  });
  (cfg.auxSources ?? []).forEach((src, i) => {
    if (auxSources.value[i]) auxSources.value[i].label = src.label;
  });
  atemIdReverse = {};
  (cfg.channels ?? []).forEach(ch => { atemIdReverse[ch.atemId] = ch.label; });
}

// ── 타이머 ──
const timer = setInterval(() => {
  if (streamRunning.value) streamSeconds.value++;
  if (recordRunning.value) recordSeconds.value++;
}, 1000);

// ── IPC 리스너 ──
function onKeydown(e) {
  if ((e.metaKey || e.ctrlKey) && e.key === ',') {
    e.preventDefault();
    api?.config.openWindow();
  }
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown);
  if (!api) return;

  api.config.get().then(applyConfig);
  api.config.onUpdated(applyConfig);

  api.atem.onStateChanged((state) => {
    if (state.programInput !== undefined) {
      const label = atemIdReverse[state.programInput];
      const idx = channels.value.findIndex(ch => ch.label === label);
      if (idx !== -1) activeProgram.value = idx;
    }
    if (state.previewInput !== undefined) {
      const label = atemIdReverse[state.previewInput];
      const idx = channels.value.findIndex(ch => ch.label === label);
      if (idx !== -1) activePreview.value = idx;
    }
  });

  api.obs.onStreamStatus((s) => { streamRunning.value = s.active; });
  api.obs.onRecordStatus((s) => { recordRunning.value = s.active; });

  api.obs.onSourcesLoaded(({ sources, audioSources: audioList, visibilityMap, muteMap }) => {
    mediaSources.value = sources.map(name => ({ name, active: visibilityMap?.[name] ?? false }));
    audioSources.value = audioList.map(name => ({ name, active: !(muteMap?.[name] ?? false) }));
    const am = mediaSources.value.find(s => s.active);
    if (am) currentMedia.value = am.name;
    const aa = audioSources.value.find(s => s.active);
    if (aa) currentAudio.value = aa.name;
  });

  api.obs.onSceneItemStateChanged(({ sourceName, sceneItemEnabled }) => {
    const src = mediaSources.value.find(s => s.name === sourceName);
    if (src) src.active = sceneItemEnabled;
  });
  api.obs.onInputMuteChanged(({ inputName, inputMuted }) => {
    const src = audioSources.value.find(s => s.name === inputName);
    if (src) src.active = !inputMuted;
  });
});

onUnmounted(() => {
  clearInterval(timer);
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

* { box-sizing: border-box; }

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
  display: flex;
  width: 100%;
  height: 100%;
}

.workspace {
  flex: 1;
  padding: 30px;
  display: grid;
  grid-template-columns: 990px 600px;
  grid-template-rows: auto auto;
  column-gap: 100px;
  row-gap: 100px;
  align-content: center;
  justify-content: center;
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
.program-pos { grid-column: 1; grid-row: 1; align-self: end; }
.preview-pos { grid-column: 1; grid-row: 2; align-self: start; }
.right-top-stack { grid-column: 2; grid-row: 1; display: flex; flex-direction: column; gap: 56px; align-self: end; }
.execute-pos { grid-column: 2; grid-row: 2; align-self: start; }
</style>
