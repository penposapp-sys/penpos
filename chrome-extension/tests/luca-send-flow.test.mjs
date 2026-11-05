import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const source = await readFile(new URL('../content.js', import.meta.url), 'utf8')

test('Luca send clicks the staging Gönder button without confirming a separate dialog', () => {
  const start = source.indexOf('async function clickLucaSend(')
  const end = source.indexOf('// Tek bir taslağı Luca', start)
  assert.notEqual(start, -1)
  assert.notEqual(end, -1)

  const sendButtonFlow = source.slice(start, end)
  assert.match(sendButtonFlow, /findLucaStagingButton\('Gönder'\)/)
  assert.match(sendButtonFlow, /previousResult\.state === 'success'/)
  assert.match(sendButtonFlow, /previousResult\.state !== 'none'/)
  assert.doesNotMatch(sendButtonFlow, /confirmLucaSwal|Onayla/)
})

test('each Luca invoice is sent and reported independently, skipping already reported items', () => {
  const start = source.indexOf('async function runSendTask(task)')
  const end = source.indexOf('async function startTask(task)', start)
  assert.notEqual(start, -1)
  assert.notEqual(end, -1)

  const sendTaskFlow = source.slice(start, end)
  assert.match(sendTaskFlow, /reportedKeys\.has\(String\(item\.sourceKey/)
  assert.match(sendTaskFlow, /for \(const item of pending\)/)
  assert.match(sendTaskFlow, /await sendSingleLucaStagingInvoice\(item/)
  assert.match(sendTaskFlow, /results: \[result\]/)
  assert.match(sendTaskFlow, /if \(!response\?\.ok\)/)
  assert.match(sendTaskFlow, /status: 'sending'/)
  assert.match(sendTaskFlow, /writeLucaSendReported\(task\.jobId, reported\)/)
  assert.match(sendTaskFlow, /interrupted.*status: 'failed'/s)
  assert.ok(
    sendTaskFlow.indexOf("status: 'sending'") <
      sendTaskFlow.indexOf('await sendSingleLucaStagingInvoice(item')
  )
  assert.doesNotMatch(sendTaskFlow, /sendLucaStagingBatch/)
  assert.doesNotMatch(sendTaskFlow, /LUCA_DRAFT_MISSING_STATUS|lucaDraftMissing/)
  assert.match(source, /Gönderim tekrarlanmadı ve PenPOS kaydı korundu/)
})
