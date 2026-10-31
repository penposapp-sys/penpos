import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

export const SIMULATOR_DEVICE_ID = 'SIMULATOR-TEST-001'
export const SIMULATOR_REMOTE_ID = 'TEST-001'

export const SIMULATOR_BUTTONS = Object.freeze({
  BTN_1: 'Garson Çağır',
  BTN_2: 'Su İste',
  BTN_3: 'İptal'
})

const isStoredEvent = (event) => (
  event &&
  typeof event.eventId === 'string' &&
  typeof event.deviceId === 'string' &&
  typeof event.remoteId === 'string' &&
  typeof event.buttonCode === 'string' &&
  typeof event.action === 'string' &&
  typeof event.timestamp === 'string' &&
  event.source === 'simulator'
)

const getBackupPath = (filePath) => `${filePath}.previous`

const readEventsFromDisk = async (filePath) => {
  let contents
  try {
    contents = await readFile(filePath, 'utf8')
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw new Error(`Sanal kumanda geçmişi okunamadı: ${error.message}`)
    }

    try {
      await rename(getBackupPath(filePath), filePath)
      contents = await readFile(filePath, 'utf8')
    } catch (recoveryError) {
      if (recoveryError.code === 'ENOENT') return []
      throw new Error(`Sanal kumanda geçmişi kurtarılamadı: ${recoveryError.message}`)
    }
  }

  try {
    await rm(getBackupPath(filePath), { force: true })
  } catch (error) {
    throw new Error(`Sanal kumanda geçmişi yedeği temizlenemedi: ${error.message}`)
  }

  let events
  try {
    events = JSON.parse(contents)
  } catch {
    throw new Error('Sanal kumanda geçmişi bozuk olduğu için okunamadı.')
  }

  if (!Array.isArray(events) || !events.every(isStoredEvent)) {
    throw new Error('Sanal kumanda geçmişi geçersiz kayıt içeriyor.')
  }
  return events
}

const removeTemporaryFile = async (temporaryPath, originalError) => {
  try {
    await rm(temporaryPath, { force: true })
  } catch (cleanupError) {
    throw new AggregateError(
      [originalError, cleanupError],
      `Geçici sanal kumanda dosyası temizlenemedi: ${cleanupError.message}`
    )
  }
}

const restoreBackup = async (filePath, originalError) => {
  try {
    await rename(getBackupPath(filePath), filePath)
  } catch (recoveryError) {
    throw new AggregateError(
      [originalError, recoveryError],
      `Sanal kumanda geçmişi güncellenemedi ve önceki kayıt kurtarılamadı: ${recoveryError.message}`
    )
  }
}

const writeEventsToDisk = async (filePath, events) => {
  const directory = path.dirname(filePath)
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`
  const backupPath = getBackupPath(filePath)
  await mkdir(directory, { recursive: true })
  await writeFile(temporaryPath, `${JSON.stringify(events, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx'
  }).catch(async (error) => {
    await removeTemporaryFile(temporaryPath, error)
    throw new Error(`Sanal kumanda geçmişi kaydedilemedi: ${error.message}`)
  })

  let hasBackup = false
  try {
    await rename(filePath, backupPath)
    hasBackup = true
  } catch (error) {
    if (error.code !== 'ENOENT') {
      await removeTemporaryFile(temporaryPath, error)
      throw new Error(`Sanal kumanda geçmişi güncellenemedi: ${error.message}`)
    }
  }

  try {
    await rename(temporaryPath, filePath)
  } catch (error) {
    if (hasBackup) await restoreBackup(filePath, error)
    await removeTemporaryFile(temporaryPath, error)
    throw new Error(`Sanal kumanda geçmişi kaydedilemedi: ${error.message}`)
  }

  if (hasBackup) {
    try {
      await rm(backupPath, { force: true })
    } catch (error) {
      throw new Error(`Sanal kumanda olayı kaydedildi ancak önceki yedek temizlenemedi: ${error.message}`)
    }
  }
}

export const createSimulatorStore = (filePath) => {
  let queue = Promise.resolve()

  const serialize = (operation) => {
    const result = queue.then(operation)
    queue = result.then(() => undefined, () => undefined)
    return result
  }

  return {
    list: () => serialize(() => readEventsFromDisk(filePath)),
    create: (buttonCode) => serialize(async () => {
      const action = SIMULATOR_BUTTONS[buttonCode]
      if (!action) throw new Error('Geçersiz sanal kumanda tuşu.')

      const events = await readEventsFromDisk(filePath)
      const event = {
        eventId: randomUUID(),
        deviceId: SIMULATOR_DEVICE_ID,
        remoteId: SIMULATOR_REMOTE_ID,
        buttonCode,
        action,
        timestamp: new Date().toISOString(),
        source: 'simulator'
      }

      await writeEventsToDisk(filePath, [event, ...events])
      return event
    })
  }
}
