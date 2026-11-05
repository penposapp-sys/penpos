import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import vm from 'node:vm'

const source = await readFile(new URL('../lucaExtensionMessaging.js', import.meta.url), 'utf8')

function createMessagingContext(chrome) {
  const context = { globalThis: { chrome } }
  vm.runInNewContext(source, context)
  return context.globalThis
}

test('message helper uses only a currently available extension runtime', async () => {
  const sent = []
  const helpers = createMessagingContext({
    runtime: {
      id: 'extension-id',
      sendMessage: async message => {
        sent.push(message)
        return { ok: true }
      }
    }
  })

  assert.equal(helpers.isLucaExtensionRuntimeAvailable(), true)
  assert.deepEqual(
    await helpers.sendLucaExtensionMessage({ type: 'PENPOS_LUCA_ACTIVITY' }),
    { ok: true }
  )
  assert.deepEqual(sent, [{ type: 'PENPOS_LUCA_ACTIVITY' }])
})

test('message helper converts an invalidated extension context into a safe restart error', async () => {
  const helpers = createMessagingContext({
    runtime: {
      id: 'extension-id',
      sendMessage: () => {
        throw new Error('Extension context invalidated.')
      }
    }
  })

  await assert.rejects(
    helpers.sendLucaExtensionMessage({ type: 'PENPOS_LUCA_SEND_START' }),
    /Extension yeniden yüklendi/
  )
})

test('message helper does not reuse an absent or unrelated runtime failure', async () => {
  const absent = createMessagingContext(undefined)
  assert.equal(absent.isLucaExtensionRuntimeAvailable(), false)
  await assert.rejects(
    absent.sendLucaExtensionMessage({ type: 'PENPOS_LUCA_READY' }),
    /bağlantısı artık etkin değil/
  )

  const originalError = new Error('Unexpected transport failure')
  const failing = createMessagingContext({
    runtime: {
      id: 'extension-id',
      sendMessage: async () => {
        throw originalError
      }
    }
  })
  await assert.rejects(
    failing.sendLucaExtensionMessage({ type: 'PENPOS_LUCA_READY' }),
    error => error === originalError
  )
})
