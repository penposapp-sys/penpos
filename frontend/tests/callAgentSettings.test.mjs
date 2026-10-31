import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const sourceRoot = new URL('../src/', import.meta.url)
const readSource = (relativePath) => readFile(new URL(relativePath, sourceRoot), 'utf8')

test('PenPOS device settings use tenant-scoped branches and call-agent management endpoints', async () => {
  const page = await readSource('pages/CallAgentSettingsPage.jsx')
  const app = await readSource('App.jsx')
  const settings = await readSource('pages/SettingsPage.jsx')

  assert.match(page, /api\('\/api\/call-agents\/branches'/)
  assert.match(page, /api\('\/api\/call-agents\/devices'/)
  assert.match(page, /branchResponse\.branches \|\| \[\]\)\.filter\(\(branch\) => branch\.isActive !== false\)/)
  assert.match(page, /\/pairings\/\$\{encodeURIComponent\(pairingId\.trim\(\)\)\}\/approve/)
  assert.match(page, /\/devices\/\$\{encodeURIComponent\(device\.deviceId\)\}\/revoke/)
  assert.match(app, /path="call-agent"[\s\S]*?permissions=\{\['manage_settings'\]\}/)
  assert.match(settings, /label: 'Masa Çağrı Sistemi'/)
  assert.match(settings, /to: '\/restoran\/settings\/call-agent'/)
})
