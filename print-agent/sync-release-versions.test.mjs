import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { syncReleaseVersions } from './sync-release-versions.mjs'

test('syncs Setup manifests and Agent runtime from the single Agent package version', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'penpos-release-version-'))
  const agentProjectPath = path.join(root, 'print-agent')
  const setupProjectPath = path.join(root, 'PenPos YAZICI exe')
  await fs.mkdir(agentProjectPath)
  await fs.mkdir(setupProjectPath)
  await fs.writeFile(path.join(agentProjectPath, 'package.json'), JSON.stringify({ version: '0.1.11' }))
  await fs.writeFile(path.join(agentProjectPath, 'index.js'), "const AGENT_VERSION = '0.1.10'\n")
  await fs.writeFile(path.join(agentProjectPath, 'package-lock.json'), JSON.stringify({
    version: '0.1.10',
    packages: { '': { name: 'agent', version: '0.1.10' } }
  }))
  await fs.writeFile(path.join(setupProjectPath, 'package.json'), JSON.stringify({ version: '0.1.9', name: 'setup' }))
  await fs.writeFile(path.join(setupProjectPath, 'package-lock.json'), JSON.stringify({
    version: '0.1.9',
    packages: { '': { name: 'setup', version: '0.1.9' }, dependency: { version: '1.0.0' } }
  }))
  t.after(() => fs.rm(root, { recursive: true, force: true }))

  assert.equal(await syncReleaseVersions({ agentProjectPath, setupProjectPath }), '0.1.11')
  const agentLock = JSON.parse(await fs.readFile(path.join(agentProjectPath, 'package-lock.json'), 'utf8'))
  const setupPackage = JSON.parse(await fs.readFile(path.join(setupProjectPath, 'package.json'), 'utf8'))
  const setupLock = JSON.parse(await fs.readFile(path.join(setupProjectPath, 'package-lock.json'), 'utf8'))
  const agentSource = await fs.readFile(path.join(agentProjectPath, 'index.js'), 'utf8')
  assert.equal(agentLock.version, '0.1.11')
  assert.equal(agentLock.packages[''].version, '0.1.11')
  assert.equal(setupPackage.version, '0.1.11')
  assert.equal(setupLock.version, '0.1.11')
  assert.equal(setupLock.packages[''].version, '0.1.11')
  assert.equal(setupLock.packages.dependency.version, '1.0.0')
  assert.match(agentSource, /const AGENT_VERSION = '0\.1\.11'/)
})
