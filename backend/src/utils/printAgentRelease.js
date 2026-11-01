import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const RELEASE_FILE_NAME = 'PenPOS_PrintAgent_Release.json'
const MODULE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url))
const RELEASE_PATH = path.resolve(
  MODULE_DIRECTORY,
  '../../../backend/public/downloads/print-agent/windows',
  RELEASE_FILE_NAME
)
const PACKAGE_PATH = path.resolve(MODULE_DIRECTORY, '../../../print-agent/package.json')

export const readPrintAgentRelease = (agentFilePath = '') => {
  const metadataPaths = agentFilePath
    ? [path.join(path.dirname(agentFilePath), RELEASE_FILE_NAME)]
    : [RELEASE_PATH]
  for (const metadataPath of metadataPaths) {
    try {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'))
      if (metadata && typeof metadata === 'object') return metadata
    } catch {
    }
  }
  return {}
}

export const getPrintAgentVersion = (agentFilePath = '') => {
  const release = readPrintAgentRelease(agentFilePath)
  const metadataVersion = String(release.agentVersion || '').trim()
  if (/^\d+(?:\.\d+){1,3}$/.test(metadataVersion)) return metadataVersion

  try {
    const packageJson = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8'))
    const packageVersion = String(packageJson?.version || '').trim()
    return /^\d+(?:\.\d+){1,3}$/.test(packageVersion) ? packageVersion : ''
  } catch {
    return ''
  }
}
