export const normalizeCollectionName = (name) => String(name || '').replace(/[^a-z0-9]/gi, '').toLowerCase()
