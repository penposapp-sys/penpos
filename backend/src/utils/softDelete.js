export const notDeletedFilter = (extra = {}) => ({
  ...extra,
  isDeleted: { $ne: true },
  status: { $ne: 'deleted' }
})

export const buildSoftDeleteUpdate = () => ({
  isDeleted: true,
  deletedAt: new Date(),
  active: false,
  isActive: false,
  status: 'deleted'
})

export const buildVisibilityFilter = (items = []) =>
  (Array.isArray(items) ? items : []).filter((item) => item?.isDeleted !== true && item?.status !== 'deleted')
