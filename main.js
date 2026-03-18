const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const fs   = require('fs');

const OBSWebSocket = require('obs-websocket-js').default;
const { Atem }     = require('atem-connection');

// ─────────────────────────────────────────────
//  설정 파일 경로
//  개발: 프로젝트 루트의 config.json
//  패키지: userData 폴더 (쓰기 가능)
// ─────────────────────────────────────────────
function getConfigPath() {
  if (app.isPackaged) {
    return path.join(app.getPath('userData'), 'config.json');
  }
  return path.join(__dirname, 'config.json');
}

function loadConfig() {
  const configPath = getConfigPath();

  // 패키지 앱 최초 실행: extraResources의 기본값을 userData로 복사
  if (app.isPackaged && !fs.existsSync(configPath)) {
    const defaultPath = path.join(process.resourcesPath, 'config.json');
    if (fs.existsSync(defaultPath)) {
      fs.copyFileSync(defaultPath, configPath);
    }
  }

  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

function saveConfig(data) {
  fs.writeFileSync(getConfigPath(), JSON.stringify(data, null, 2), 'utf-8');
}

let config = {}; // app.whenReady() 이후 loadConfig()로 채워짐

// ─────────────────────────────────────────────
//  동적 소스 맵 (config.channels / auxSources 기반)
// ─────────────────────────────────────────────
function buildSourceMap() {
  const map = {};
  for (const ch of config.channels ?? []) map[ch.label] = ch.atemId;
  return map;
}

function buildAuxMap() {
  const map = {};
  for (const src of config.auxSources ?? []) map[src.label] = src.atemId;
  return map;
}

// MIX=0, DIP=1, WIPE=2, DVE=3, STING=4  (고정)
const TRANS_MAP = { MIX: 0, DIP: 1, WIPE: 2, DVE: 3, STING: 4 };

// ─────────────────────────────────────────────
//  창 관리
// ─────────────────────────────────────────────
const isDebug = process.argv.includes('--devtools');

let mainWindow   = null;
let configWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 2000, height: 1080,
    minWidth: 2000, minHeight: 1080,
    title: 'Advanced Video Switcher Interface',
    backgroundColor: '#1a1a1a',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));

  if (isDebug) {
    mainWindow.webContents.openDevTools();
  }

  // 창 로드 완료 후 OBS 소스가 이미 있으면 다시 전송
  mainWindow.webContents.on('did-finish-load', () => {
    if (obsVideoSources.length || obsAudioSources.length) {
      resendObsSources();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

function openConfigWindow() {
  if (configWindow && !configWindow.isDestroyed()) {
    configWindow.focus();
    return;
  }

  configWindow = new BrowserWindow({
    width: 620, height: 680,
    minWidth: 560, minHeight: 500,
    title: '설정',
    backgroundColor: '#1a1a1a',
    parent: mainWindow ?? undefined,
    modal: false,
    resizable: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'config-preload.js'),
    },
  });

  configWindow.setMenu(null);
  configWindow.loadFile('config.html');
  configWindow.on('closed', () => { configWindow = null; });
}

// ─────────────────────────────────────────────
//  앱 메뉴 (Cmd+, / Ctrl+, 로도 열림)
// ─────────────────────────────────────────────
function buildMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { label: '설정...', accelerator: 'Cmd+,', click: openConfigWindow },
        { type: 'separator' },
        { role: 'quit', label: '종료' },
      ],
    }] : []),
    {
      label: '보기',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    ...(!isMac ? [{
      label: '설정',
      submenu: [
        { label: '설정 열기', accelerator: 'Ctrl+,', click: openConfigWindow },
      ],
    }] : []),
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ─────────────────────────────────────────────
//  OBS WebSocket
// ─────────────────────────────────────────────
const obs = new OBSWebSocket();
let obsRetryTimer = null;
let obsVideoSources = [];   // 이미지, 캡처장치, 미디어 등 비디오 계열
let obsAudioSources = [];   // 마이크, 데스크탑 오디오 등 오디오 전용

// OBS 오디오 전용 input kind 목록
const AUDIO_KINDS = new Set([
  'wasapi_input_capture', 'wasapi_output_capture',
  'coreaudio_input_capture', 'coreaudio_output_capture',
  'pulse_input_capture', 'pulse_output_capture',
  'alsa_input_capture', 'jack_output_capture',
]);

async function resendObsSources() {
  try {
    const { currentProgramSceneName } = await obs.call('GetCurrentProgramScene');
    const { sceneItems } = await obs.call('GetSceneItemList', { sceneName: currentProgramSceneName });
    const visibilityMap = {};
    for (const item of sceneItems) visibilityMap[item.sourceName] = item.sceneItemEnabled;

    const muteResults = await Promise.all(
      obsAudioSources.map((name) =>
        obs.call('GetInputMute', { inputName: name }).catch(() => ({ inputMuted: false }))
      )
    );
    const muteMap = {};
    obsAudioSources.forEach((name, i) => { muteMap[name] = muteResults[i].inputMuted; });

    mainWindow?.webContents.send('obs:sourcesLoaded', {
      sources: obsVideoSources,
      audioSources: obsAudioSources,
      visibilityMap,
      muteMap,
    });
    console.log('[OBS] 소스 목록 재전송 완료');
  } catch (e) {
    console.log('[OBS] 소스 재전송 실패 (아직 미연결):', e.message);
  }
}

async function connectOBS() {
  clearTimeout(obsRetryTimer);
  const url = `ws://${config.obs.host}:${config.obs.port}`;
  console.log(`[OBS] 연결 시도: ${url}`);
  try {
    await obs.connect(url, config.obs.password || undefined);
    console.log('[OBS] 연결됨');
    mainWindow?.webContents.send('obs:connected');

    const [stream, record, inputData, sceneInfo] = await Promise.all([
      obs.call('GetStreamStatus'),
      obs.call('GetRecordStatus'),
      obs.call('GetInputList'),
      obs.call('GetCurrentProgramScene'),
    ]);
    mainWindow?.webContents.send('obs:streamStatus', { active: stream.outputActive });
    mainWindow?.webContents.send('obs:recordStatus', { active: record.outputActive });

    // 비디오 / 오디오 소스 분류
    obsVideoSources = inputData.inputs
      .filter((i) => !AUDIO_KINDS.has(i.inputKind))
      .map((i) => i.inputName);
    obsAudioSources = inputData.inputs
      .filter((i) => AUDIO_KINDS.has(i.inputKind))
      .map((i) => i.inputName);

    // 현재 씬의 소스 visibility 상태
    const { sceneItems } = await obs.call('GetSceneItemList', { sceneName: sceneInfo.currentProgramSceneName });
    const visibilityMap = {};
    for (const item of sceneItems) visibilityMap[item.sourceName] = item.sceneItemEnabled;

    // 오디오 소스 뮤트 초기 상태
    const muteResults = await Promise.all(
      obsAudioSources.map((name) =>
        obs.call('GetInputMute', { inputName: name }).catch(() => ({ inputMuted: false }))
      )
    );
    const muteMap = {};
    obsAudioSources.forEach((name, i) => { muteMap[name] = muteResults[i].inputMuted; });

    console.log(`[OBS] 비디오소스 ${obsVideoSources.length}개, 오디오소스 ${obsAudioSources.length}개 로드됨`);
    mainWindow?.webContents.send('obs:sourcesLoaded', {
      sources:      obsVideoSources,
      audioSources: obsAudioSources,
      visibilityMap,
      muteMap,
    });
  } catch (err) {
    const hint =
      err.code === 4011 ? '→ 비밀번호가 틀렸거나 인증이 필요합니다.' :
      err.code === 4009 ? '→ OBS WebSocket 버전이 맞지 않습니다.' :
      err.code === 1006 ? '→ OBS가 실행 중이 아니거나 WebSocket 서버가 비활성화되어 있습니다.' :
      '';
    console.error(`[OBS] 연결 실패 (code: ${err.code ?? 'N/A'}): ${err.message}  ${hint}`);
    // ConnectionClosed 이벤트가 뒤이어 오므로 여기서는 타이머를 잡지 않음
  }
}

obs.on('StreamStateChanged', (d) =>
  mainWindow?.webContents.send('obs:streamStatus', { active: d.outputActive }));

obs.on('RecordStateChanged', (d) =>
  mainWindow?.webContents.send('obs:recordStatus', { active: d.outputActive }));

// OBS에서 직접 소스 visibility 바꾸면 버튼도 동기화
obs.on('SceneItemEnableStateChanged', (d) =>
  mainWindow?.webContents.send('obs:sceneItemStateChanged', {
    sourceName:       d.sourceName,
    sceneItemEnabled: d.sceneItemEnabled,
  }));

// OBS에서 직접 뮤트 바꾸면 버튼도 동기화
obs.on('InputMuteStateChanged', (d) =>
  mainWindow?.webContents.send('obs:inputMuteChanged', {
    inputName:   d.inputName,
    inputMuted:  d.inputMuted,
  }));

obs.on('ConnectionClosed', (data) => {
  console.log(`[OBS] 연결 끊김 (code: ${data?.code ?? 'N/A'}) — 5초 후 재시도`);
  mainWindow?.webContents.send('obs:disconnected');
  clearTimeout(obsRetryTimer);
  obsRetryTimer = setTimeout(connectOBS, 5000);
});

ipcMain.handle('obs:startStream',    () => safeCall(() => obs.call('StartStream')));
ipcMain.handle('obs:stopStream',     () => safeCall(() => obs.call('StopStream')));
ipcMain.handle('obs:startRecord',    () => safeCall(() => obs.call('StartRecord')));
ipcMain.handle('obs:stopRecord',     () => safeCall(() => obs.call('StopRecord')));

// 현재 프로그램 씬에서 소스 visibility 토글
ipcMain.handle('obs:toggleSource', async (_, sourceName) => {
  try {
    const { currentProgramSceneName } = await obs.call('GetCurrentProgramScene');
    const { sceneItemId } = await obs.call('GetSceneItemId', {
      sceneName: currentProgramSceneName,
      sourceName,
      searchOffset: 0,
    });
    const { sceneItemEnabled } = await obs.call('GetSceneItemEnabled', {
      sceneName: currentProgramSceneName,
      sceneItemId,
    });
    await obs.call('SetSceneItemEnabled', {
      sceneName: currentProgramSceneName,
      sceneItemId,
      sceneItemEnabled: !sceneItemEnabled,
    });
    return !sceneItemEnabled;
  } catch (e) {
    console.error(`[OBS] toggleSource 실패 (${sourceName}):`, e.message);
    return null;
  }
});

ipcMain.handle('obs:setAudioSource', async (_, selected) => {
  for (const inputName of obsInputs) {
    await safeCall(() =>
      obs.call('SetInputMute', { inputName, inputMuted: inputName !== selected }));
  }
});

ipcMain.handle('obs:setInputMute', (_, inputName, muted) => {
  return safeCall(() => obs.call('SetInputMute', { inputName, inputMuted: muted }));
});

// ─────────────────────────────────────────────
//  ATEM
// ─────────────────────────────────────────────
const atem = new Atem();
let atemRetryTimer = null;

function connectATEM() {
  clearTimeout(atemRetryTimer);
  console.log(`[ATEM] ${config.atem.ip} 연결 시도...`);
  atem.connect(config.atem.ip);
}

atem.on('connected', () => {
  console.log('[ATEM] 연결됨');
  mainWindow?.webContents.send('atem:connected');
  const me0 = atem.state?.video?.mixEffects?.[0];
  if (me0) mainWindow?.webContents.send('atem:stateChanged', {
    programInput: me0.programInput,
    previewInput:  me0.previewInput,
  });
});

atem.on('stateChanged', (state) => {
  const me0 = state?.video?.mixEffects?.[0];
  if (!me0 || !mainWindow) return;
  mainWindow.webContents.send('atem:stateChanged', {
    programInput: me0.programInput,
    previewInput:  me0.previewInput,
  });
});

atem.on('disconnected', () => {
  console.log('[ATEM] 연결 끊김 — 5초 후 재시도');
  mainWindow?.webContents.send('atem:disconnected');
  atemRetryTimer = setTimeout(connectATEM, 5000);
});

ipcMain.handle('atem:setProgram', (_, label) => {
  const map = buildSourceMap();
  const id = map[label];
  console.log(`[ATEM] setProgram label="${label}" id=${id} map=`, Object.keys(map));
  if (id !== undefined) return safeCall(() => atem.changeProgramInput(id, 0));
});

ipcMain.handle('atem:setPreview', (_, label) => {
  const map = buildSourceMap();
  const id = map[label];
  console.log(`[ATEM] setPreview label="${label}" id=${id} map=`, Object.keys(map));
  if (id !== undefined) return safeCall(() => atem.changePreviewInput(id, 0));
});

ipcMain.handle('atem:cut',  () => safeCall(() => atem.cut(0)));
ipcMain.handle('atem:auto', () => safeCall(() => atem.autoTransition(0)));

ipcMain.handle('atem:setTransition', (_, type) => {
  const style = TRANS_MAP[type];
  if (style !== undefined)
    return safeCall(() => atem.setTransitionStyle({ mixEffect: 0, style }));
});

ipcMain.handle('atem:setAux', (_, label) => {
  const id = buildAuxMap()[label];
  if (id !== undefined) return safeCall(() => atem.setAuxSource(0, id));
});

// ─────────────────────────────────────────────
//  설정 IPC
// ─────────────────────────────────────────────
ipcMain.handle('config:get',        () => config);
ipcMain.handle('config:openWindow', () => openConfigWindow());
ipcMain.handle('config:close',      () => configWindow?.close());

ipcMain.handle('obs:getScenes', async () => {
  if (obsVideoSources.length) return obsVideoSources;
  try {
    const { inputs } = await obs.call('GetInputList');
    obsVideoSources = inputs.filter((i) => !AUDIO_KINDS.has(i.inputKind)).map((i) => i.inputName);
    return obsVideoSources;
  } catch (e) {
    console.error('[OBS] getScenes 실패:', e.message);
    return null;
  }
});

ipcMain.handle('obs:getAudioInputs', async () => {
  if (obsAudioSources.length) return obsAudioSources;
  try {
    const { inputs } = await obs.call('GetInputList');
    obsAudioSources = inputs.filter((i) => AUDIO_KINDS.has(i.inputKind)).map((i) => i.inputName);
    return obsAudioSources;
  } catch (e) {
    console.error('[OBS] getAudioInputs 실패:', e.message);
    return null;
  }
});

ipcMain.handle('config:save', (_, newConfig) => {
  const prevObs  = { ...config.obs };
  const prevAtem = { ...config.atem };

  // 저장
  config = newConfig;
  saveConfig(config);

  // 메인 창에 변경 알림 (버튼 이름 즉시 반영)
  mainWindow?.webContents.send('config:updated', config);

  // 연결 설정이 바뀌었으면 재연결
  if (prevObs.host !== config.obs.host ||
      prevObs.port !== config.obs.port ||
      prevObs.password !== config.obs.password) {
    clearTimeout(obsRetryTimer);
    safeCall(() => obs.disconnect()).finally(connectOBS);
  }

  if (prevAtem.ip !== config.atem.ip) {
    clearTimeout(atemRetryTimer);
    safeCall(() => atem.disconnect()).finally(() => {
      atemRetryTimer = setTimeout(connectATEM, 500);
    });
  }

  configWindow?.close();
  console.log('[config] 설정 저장 완료');
});

// ─────────────────────────────────────────────
//  공통 유틸
// ─────────────────────────────────────────────
async function safeCall(fn) {
  try { return await fn(); }
  catch (err) { console.error('[safeCall]', err.message); }
}

// ─────────────────────────────────────────────
//  앱 생명주기
// ─────────────────────────────────────────────
app.whenReady().then(() => {
  config = loadConfig();
  buildMenu();
  createWindow();
  connectOBS();
  connectATEM();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
