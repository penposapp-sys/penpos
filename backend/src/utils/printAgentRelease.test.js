import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { getPrintAgentVersion, readPrintAgentRelease } from './printAgentRelease.js'

const agentVersion = JSON.parse(fs.readFileSync(new URL('../../../print-agent/package.json', import.meta.url), 'utf8')).version

test('release metadata independently reports Agent and Setup versions', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'penpos-agent-release-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const binaryPath = path.join(directory, 'PenPOS_PrintAgent.exe')
  fs.writeFileSync(binaryPath, '')
  fs.writeFileSync(path.join(directory, 'PenPOS_PrintAgent_Release.json'), JSON.stringify({
    agentVersion,
    setupVersion: agentVersion,
    setupFileName: `PenPOS_PrintAgent_Setup_${agentVersion}.exe`,
    setupSha256: 'a'.repeat(64)
  }))

  assert.equal(getPrintAgentVersion(binaryPath), agentVersion)
  assert.deepEqual(readPrintAgentRelease(binaryPath), {
    agentVersion,
    setupVersion: agentVersion,
    setupFileName: `PenPOS_PrintAgent_Setup_${agentVersion}.exe`,
    setupSha256: 'a'.repeat(64)
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
  assert.equal(getPrintAgentVersion(path.join(directory, 'PenPOS_PrintAgent.exe')), agentVersion)
})
