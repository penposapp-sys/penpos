import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { getPrintAgentVersion, readPrintAgentRelease } from './printAgentRelease.js'

test('release metadata independently reports Agent and Setup versions', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'penpos-agent-release-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const binaryPath = path.join(directory, 'PenPOS_PrintAgent.exe')
  fs.writeFileSync(binaryPath, '')
  fs.writeFileSync(path.join(directory, 'PenPOS_PrintAgent_Release.json'), JSON.stringify({
    agentVersion: '0.1.9',
    setupVersion: '0.2.0',
    setupFileName: 'PenPOS_PrintAgent_Setup_0.2.0.exe'
  }))

  assert.equal(getPrintAgentVersion(binaryPath), '0.1.9')
  assert.deepEqual(readPrintAgentRelease(binaryPath), {
    agentVersion: '0.1.9',
    setupVersion: '0.2.0',
    setupFileName: 'PenPOS_PrintAgent_Setup_0.2.0.exe'
  })
})

test('Agent package version is independent of working directory and stale env overrides', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'penpos-agent-cwd-'))
  const originalCwd = process.cwd()
  const originalVersionOverride = process.env.PRINT_AGENT_WINDOWS_VERSION
  t.after(() => {
    process.chdir(originalCwd)
    if (originalVersionOverride === undefined) {
      delete process.env.PRINT_AGENT_WINDOWS_VERSION
    } else {
      process.env.PRINT_AGENT_WINDOWS_VERSION = originalVersionOverride
    }
    fs.rmSync(directory, { recursive: true, force: true })
  })

  process.chdir(directory)
  process.env.PRINT_AGENT_WINDOWS_VERSION = '0.1.1'
  assert.equal(getPrintAgentVersion(path.join(directory, 'PenPOS_PrintAgent.exe')), '0.1.9')
})
