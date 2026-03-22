const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  obs: {
    startStream:    ()       => ipcRenderer.invoke('obs:startStream'),
    stopStream:     ()       => ipcRenderer.invoke('obs:stopStream'),
    startRecord:    ()       => ipcRenderer.invoke('obs:startRecord'),
    stopRecord:     ()       => ipcRenderer.invoke('obs:stopRecord'),
    triggerTransition: ()    => ipcRenderer.invoke('obs:triggerTransition'),
    toggleSource:   (name)          => ipcRenderer.invoke('obs:toggleSource',   name),
    setInputMute:   (name, muted)   => ipcRenderer.invoke('obs:setInputMute',   name, muted),
    onStreamStatus: (cb) => ipcRenderer.on('obs:streamStatus',  (_, d) => cb(d)),
    onRecordStatus: (cb) => ipcRenderer.on('obs:recordStatus',  (_, d) => cb(d)),
    onConnected:      (cb) => ipcRenderer.on('obs:connected',      ()     => cb()),
    onDisconnected:   (cb) => ipcRenderer.on('obs:disconnected',   ()     => cb()),
    onSourcesLoaded:       (cb) => ipcRenderer.on('obs:sourcesLoaded',        (_, d) => cb(d)),
    onSceneItemStateChanged: (cb) => ipcRenderer.on('obs:sceneItemStateChanged', (_, d) => cb(d)),
    onInputMuteChanged:    (cb) => ipcRenderer.on('obs:inputMuteChanged',     (_, d) => cb(d)),
  },
  atem: {
    setProgram:     (label) => ipcRenderer.invoke('atem:setProgram',    label),
    setPreview:     (label) => ipcRenderer.invoke('atem:setPreview',    label),
    cut:            ()      => ipcRenderer.invoke('atem:cut'),
    auto:           ()      => ipcRenderer.invoke('atem:auto'),
    setTransition:  (type)  => ipcRenderer.invoke('atem:setTransition', type),
    setAux:         (label) => ipcRenderer.invoke('atem:setAux',        label),
    onStateChanged: (cb) => ipcRenderer.on('atem:stateChanged', (_, d) => cb(d)),
    onConnected:    (cb) => ipcRenderer.on('atem:connected',    ()     => cb()),
    onDisconnected: (cb) => ipcRenderer.on('atem:disconnected', ()     => cb()),
  },
  config: {
    get:       ()    => ipcRenderer.invoke('config:get'),
    onUpdated: (cb)  => ipcRenderer.on('config:updated', (_, d) => cb(d)),
    openWindow: ()   => ipcRenderer.invoke('config:openWindow'),
  },
  system: {
    getStats: () => ipcRenderer.invoke('system:getStats'),
  },
  window: {
    onMaximize:   (cb) => ipcRenderer.on('window:maximize',   () => cb()),
    onUnmaximize: (cb) => ipcRenderer.on('window:unmaximize', () => cb()),
  },
});
