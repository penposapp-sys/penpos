import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
  branchIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'Branch', default: [] },
  accessibleBranchIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'Branch', default: [] },
  systemType: { type: String, enum: ['kermes', 'kantin'], default: null },
  name: { type: String, required: true },
  username: {
    type: String,
    default: undefined,
    set: (v) => {
      const s = String(v ?? '').trim().toLowerCase()
      return s ? s : undefined
    },
    validate: {
      validator: (v) => {
        if (v === null || v === undefined || v === '') return true
        return /^[a-z0-9._-]{3,24}$/.test(String(v))
      },
      message: 'Invalid username'
    }
  },
  email: {
    type: String,
    required: true,
    index: true,
    set: (v) => String(v || '').trim().toLowerCase()
  },
  phone: { type: String, default: '' },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['superadmin', 'platform_admin', 'tenant_admin', 'staff'], required: true },
  active: { type: Boolean, default: true },
  isActive: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date, default: null },
  status: { type: String, default: 'active', index: true },
  permissions: { type: [String], default: [] },
  resetPasswordToken: { type: String, default: null, index: true },
  resetPasswordExpires: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
})

userSchema.index({ email: 1, systemType: 1 }, { unique: true })
userSchema.index({ tenantId: 1, email: 1 })
userSchema.index({ tenantId: 1, username: 1 }, { unique: true, sparse: true })
userSchema.index({ tenantId: 1, isActive: 1 })
userSchema.index({ tenantId: 1, isDeleted: 1, status: 1 })
userSchema.index({ tenantId: 1, branchId: 1 })
userSchema.index({ tenantId: 1, branchIds: 1 })
userSchema.index({ tenantId: 1, accessibleBranchIds: 1 })
userSchema.index({ tenantId: 1, role: 1 })

export default mongoose.model('User', userSchema)
