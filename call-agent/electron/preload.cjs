const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('callAgent', {
  listSerialPorts: () => ipcRenderer.invoke('serial:list'),
  connectSerialPort: (portPath) => ipcRenderer.invoke('serial:connect', portPath),
  disconnectSerialPort: () => ipcRenderer.invoke('serial:disconnect'),
  listSimulatorEvents: () => ipcRenderer.invoke('simulator:list'),
  pressSimulatorButton: (buttonCode) => ipcRenderer.invoke('simulator:press', buttonCode),
  getConnectionStatus: () => ipcRenderer.invoke('call-agent:status'),
  beginPairing: (backendUrl) => ipcRenderer.invoke('call-agent:begin-pairing', backendUrl),
  sendHeartbeat: () => ipcRenderer.invoke('call-agent:heartbeat'),
  stopPairing: () => ipcRenderer.invoke('call-agent:stop-pairing'),
  onConnectionState: (callback) => {
    if (typeof callback !== 'function') return () => {}
    const listener = (_event, state) => callback(state)
    ipcRenderer.on('call-agent:state', listener)
    ipcRenderer.send('call-agent:subscribe')
    return () => ipcRenderer.removeListener('call-agent:state', listener)
  },
  onSerialState: (callback) => {
    if (typeof callback !== 'function') return () => {}
    const listener = (_event, state) => callback(state)
    ipcRenderer.on('serial:state', listener)
    return () => ipcRenderer.removeListener('serial:state', listener)
  }
})
