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
await fs.writeFile(targetRelease, `${JSON.stringify({ agentVersion: packageJson.version }, null, 2)}\n`, 'utf8')

console.log(`print-agent backend release hazir: ${targetExe}`)
