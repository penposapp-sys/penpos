import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url))

export const syncReleaseVersions = async ({
  agentProjectPath = moduleDirectory,
  setupProjectPath = path.resolve(agentProjectPath, '..', '..', 'PenPos YAZICI exe')
} = {}) => {
  const agentPackagePath = path.join(agentProjectPath, 'package.json')
  const agentLockPath = path.join(agentProjectPath, 'package-lock.json')
  const setupPackagePath = path.join(setupProjectPath, 'package.json')
  const setupLockPath = path.join(setupProjectPath, 'package-lock.json')
  const indexPath = path.join(agentProjectPath, 'index.js')
  const agentPackage = JSON.parse(await fs.readFile(agentPackagePath, 'utf8'))
  const version = String(agentPackage.version || '').trim()
  if (!/^\d+(?:\.\d+){1,3}$/.test(version)) {
    throw new Error(`Invalid canonical Print Agent version: ${version || '(empty)'}`)
  }

  const agentLock = JSON.parse(await fs.readFile(agentLockPath, 'utf8'))
  const setupPackage = JSON.parse(await fs.readFile(setupPackagePath, 'utf8'))
  if (!agentLock.packages || !agentLock.packages['']) {
    throw new Error('Print Agent package-lock is missing its root package entry.')
  }
  const setupLock = JSON.parse(await fs.readFile(setupLockPath, 'utf8'))
  if (!setupLock.packages || !setupLock.packages['']) {
    throw new Error('Electron Setup package-lock is missing its root package entry.')
  }
  const indexSource = await fs.readFile(indexPath, 'utf8')
  const versionDeclaration = /^const AGENT_VERSION = '[^']+'\s*$/m
  if (!versionDeclaration.test(indexSource)) {
    throw new Error('Print Agent version declaration was not found.')
  }

  agentLock.version = version
  agentLock.packages[''].version = version
  setupPackage.version = version
  setupLock.version = version
  setupLock.packages[''].version = version
  const nextIndexSource = indexSource.replace(versionDeclaration, `const AGENT_VERSION = '${version}'`)
  await fs.writeFile(agentLockPath, `${JSON.stringify(agentLock, null, 2)}\n`, 'utf8')
  await fs.writeFile(setupPackagePath, `${JSON.stringify(setupPackage, null, 2)}\n`, 'utf8')
  await fs.writeFile(setupLockPath, `${JSON.stringify(setupLock, null, 2)}\n`, 'utf8')
  await fs.writeFile(indexPath, nextIndexSource, 'utf8')
  return version
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const version = await syncReleaseVersions()
  process.stdout.write(`Agent and Electron Setup versions synchronized: ${version}\n`)
}
