const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('callAgent', {
  listSerialPorts: () => ipcRenderer.invoke('serial:list'),
  getSerialState: () => ipcRenderer.invoke('serial:get-state'),
  connectSerialPort: (portPath) => ipcRenderer.invoke('serial:connect', portPath),
  sendSerialCommand: (command) => ipcRenderer.invoke('serial:command', command),
  disconnectSerialPort: () => ipcRenderer.invoke('serial:disconnect'),
  getConnectionStatus: () => ipcRenderer.invoke('call-agent:status'),
  beginPairing: (backendUrl) => ipcRenderer.invoke('call-agent:begin-pairing', backendUrl),
  sendHeartbeat: () => ipcRenderer.invoke('call-agent:heartbeat'),
  listRfTables: () => ipcRenderer.invoke('call-agent:rf-tables'),
  setRfTableIds: (tableIds) => ipcRenderer.invoke('call-agent:set-rf-tables', tableIds),
  startRfButtonLearning: (tableId, label, tableName) => ipcRenderer.invoke('call-agent:rf-learn', { tableId, label, tableName }),
  cancelRfButtonLearning: () => ipcRenderer.invoke('call-agent:rf-learn-cancel'),
  deleteRfButtonProfile: (tableId, label) => ipcRenderer.invoke('call-agent:rf-profile-delete', { tableId, label }),
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
  },
  onSerialEvent: (callback) => {
    if (typeof callback !== 'function') return () => {}
    const listener = (_event, event) => callback(event)
    ipcRenderer.on('serial:event', listener)
    return () => ipcRenderer.removeListener('serial:event', listener)
  }
})
