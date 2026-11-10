export const registerCallAgentIpc = ({ ipcMain, getMainWindow, getClient }) => {
  const assertMainWindowSender = (event) => {
    const mainWindow = getMainWindow()
    if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) {
      throw new Error('Bu işlem için uygulama penceresi gerekli.')
    }
  }

  ipcMain.handle('call-agent:status', (event) => {
    assertMainWindowSender(event)
    return getClient().getStatus()
  })

  ipcMain.handle('call-agent:begin-pairing', async (event, backendUrl) => {
    assertMainWindowSender(event)
    return getClient().beginPairing(backendUrl)
  })

  ipcMain.handle('call-agent:heartbeat', async (event) => {
    assertMainWindowSender(event)
    return getClient().heartbeat()
  })

  ipcMain.handle('call-agent:rf-tables', async (event) => {
    assertMainWindowSender(event)
    return getClient().listRfTables()
  })

  ipcMain.handle('call-agent:set-rf-tables', async (event, tableIds) => {
    assertMainWindowSender(event)
    return getClient().setRfTableIds(tableIds)
  })

  ipcMain.handle('call-agent:rf-learn', async (event, target) => {
    assertMainWindowSender(event)
    return getClient().startRfButtonLearning(target?.tableId, target?.label, target?.tableName)
  })

  ipcMain.handle('call-agent:rf-learn-cancel', (event) => {
    assertMainWindowSender(event)
    return getClient().cancelRfButtonLearning()
  })

  ipcMain.handle('call-agent:rf-profile-delete', async (event, target) => {
    assertMainWindowSender(event)
    return getClient().deleteRfButtonProfile(target?.tableId, target?.label)
  })

  ipcMain.handle('call-agent:stop-pairing', (event) => {
    assertMainWindowSender(event)
    return getClient().stopPairing()
  })

  ipcMain.on('call-agent:subscribe', (event) => {
    assertMainWindowSender(event)
    event.sender.send('call-agent:state', getClient().getStatus())
  })
}
