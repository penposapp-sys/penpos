import assert from 'node:assert/strict'
import { mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import {
  createSimulatorStore,
  SIMULATOR_BUTTONS,
  SIMULATOR_DEVICE_ID,
  SIMULATOR_REMOTE_ID
} from '../electron/simulatorStore.js'

const testDirectory = path.dirname(fileURLToPath(import.meta.url))

const withTemporaryStore = async (run) => {
  const directory = await mkdtemp(path.join(testDirectory, '.simulator-test-'))
  try {
    await run(path.join(directory, 'simulator-events.json'))
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

test('üç sanal tuş, ayrı ve simulator kaynaklı olaylar üretir', async () => {
  await withTemporaryStore(async (filePath) => {
    const store = createSimulatorStore(filePath)
    const events = []
    for (const buttonCode of Object.keys(SIMULATOR_BUTTONS)) {
      events.push(await store.create(buttonCode))
    }

    assert.deepEqual(events.map((event) => event.buttonCode), ['BTN_1', 'BTN_2', 'BTN_3'])
    assert.deepEqual(events.map((event) => event.action), ['Garson Çağır', 'Su İste', 'İptal'])
    assert.ok(events.every((event) => event.source === 'simulator'))
    assert.ok(events.every((event) => event.deviceId === SIMULATOR_DEVICE_ID))
    assert.ok(events.every((event) => event.remoteId === SIMULATOR_REMOTE_ID))
    assert.equal(new Set(events.map((event) => event.eventId)).size, 3)
    assert.ok(events.every((event) => Number.isFinite(Date.parse(event.timestamp))))
  })
})

test('aynı tuşa tekrar basılması farklı kayıtlar oluşturur ve eşzamanlı kayıtlar korunur', async () => {
  await withTemporaryStore(async (filePath) => {
    const store = createSimulatorStore(filePath)
    const events = await Promise.all([
      store.create('BTN_1'),
      store.create('BTN_1'),
      store.create('BTN_1')
    ])
    const history = await store.list()

    assert.equal(new Set(events.map((event) => event.eventId)).size, 3)
    assert.equal(history.length, 3)
    assert.deepEqual(history.map((event) => event.eventId), events.map((event) => event.eventId).reverse())
  })
})

test('olay geçmişi uygulama yeniden açıldığında okunabilir', async () => {
  await withTemporaryStore(async (filePath) => {
    const firstRun = createSimulatorStore(filePath)
    const savedEvent = await firstRun.create('BTN_2')

    const restartedApp = createSimulatorStore(filePath)
    assert.deepEqual(await restartedApp.list(), [savedEvent])
  })
})

test('uygulama yarıda kapanmışsa yedek olay geçmişi kurtarılır', async () => {
  await withTemporaryStore(async (filePath) => {
    const firstRun = createSimulatorStore(filePath)
    const savedEvent = await firstRun.create('BTN_3')
    await rename(filePath, `${filePath}.previous`)

    const restartedApp = createSimulatorStore(filePath)
    assert.deepEqual(await restartedApp.list(), [savedEvent])
    assert.deepEqual(JSON.parse(await readFile(filePath, 'utf8')), [savedEvent])
  })
})

test('bilinmeyen tuş kodu olay oluşturmadan reddedilir', async () => {
  await withTemporaryStore(async (filePath) => {
    const store = createSimulatorStore(filePath)

    await assert.rejects(store.create('REAL_DEVICE_SIGNAL'), /Geçersiz sanal kumanda tuşu/)
    assert.deepEqual(await store.list(), [])
  })
})

test('bozuk geçmiş başarı şeklinde gizlenmez', async () => {
  await withTemporaryStore(async (filePath) => {
    await writeFile(filePath, '{invalid json', 'utf8')
    const store = createSimulatorStore(filePath)

    await assert.rejects(store.list(), /geçmişi bozuk olduğu için okunamadı/)
  })
})
