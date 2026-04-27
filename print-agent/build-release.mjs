import fs from 'fs/promises'
import path from 'path'

const rootDir = path.resolve(process.cwd(), '..')
const sourceExe = path.join(process.cwd(), 'dist', 'PenPOS_PrintAgent.exe')
const targetDir = path.join(rootDir, 'backend', 'public', 'downloads', 'print-agent', 'windows')
const targetExe = path.join(targetDir, 'PenPOS_PrintAgent.exe')

await fs.mkdir(targetDir, { recursive: true })
await fs.copyFile(sourceExe, targetExe)

console.log(`print-agent backend release hazir: ${targetExe}`)
