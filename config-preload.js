const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('configAPI', {
  get:            ()    => ipcRenderer.invoke('config:get'),
  save:           (cfg) => ipcRenderer.invoke('config:save', cfg),
  close:          ()    => ipcRenderer.invoke('config:close'),
  getScenes:      ()    => ipcRenderer.invoke('obs:getScenes'),
  getAudioInputs: ()    => ipcRenderer.invoke('obs:getAudioInputs'),
});
