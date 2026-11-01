import fs from 'fs/promises'
import path from 'path'

const rootDir = path.resolve(process.cwd(), '..')
const sourceExe = path.join(process.cwd(), 'dist', 'PenPOS_PrintAgent.exe')
const targetDir = path.join(rootDir, 'backend', 'public', 'downloads', 'print-agent', 'windows')
const targetExe = path.join(targetDir, 'PenPOS_PrintAgent.exe')
const targetRelease = path.join(targetDir, 'PenPOS_PrintAgent_Release.json')
const packageJson = JSON.parse(await fs.readFile(path.join(process.cwd(), 'package.json'), 'utf8'))

await fs.mkdir(targetDir, { recursive: true })
await fs.copyFile(sourceExe, targetExe)
let existingRelease = {}
try {
  const parsedRelease = JSON.parse(await fs.readFile(targetRelease, 'utf8'))
  if (parsedRelease && typeof parsedRelease === 'object' && !Array.isArray(parsedRelease)) {
    existingRelease = parsedRelease
  }
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}
await fs.writeFile(
  targetRelease,
  `${JSON.stringify({ ...existingRelease, agentVersion: packageJson.version }, null, 2)}\n`,
  'utf8'
)

console.log(`print-agent backend release hazir: ${targetExe}`)
