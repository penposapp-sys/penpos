import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const BACKEND_ROOT_DIR = path.resolve(__dirname, '..', '..')
export const REPO_ROOT_DIR = path.resolve(BACKEND_ROOT_DIR, '..')
export const CANONICAL_UPLOADS_DIR = path.join(REPO_ROOT_DIR, 'uploads')
export const LEGACY_BACKEND_UPLOADS_DIR = path.join(BACKEND_ROOT_DIR, 'uploads')
export const UPLOADS_STATIC_DIRS = Array.from(new Set([
  CANONICAL_UPLOADS_DIR,
  LEGACY_BACKEND_UPLOADS_DIR
]))

export const resolveUploadDir = (...segments) => path.join(CANONICAL_UPLOADS_DIR, ...segments)

export const resolveUploadDirCandidates = (...segments) => (
  UPLOADS_STATIC_DIRS.map((baseDir) => path.join(baseDir, ...segments))
)
