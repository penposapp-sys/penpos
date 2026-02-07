import mongoose from 'mongoose'

const kitchenScopeSchema = new mongoose.Schema(
  {
    hiddenMenuItemIds: { type: [mongoose.Schema.Types.ObjectId], default: [] }
  },
  { _id: false }
)

const userPreferencesSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    kitchenFilters: {
      kitchen_normal: { type: kitchenScopeSchema, default: () => ({}) },
      kitchen_bulk: { type: kitchenScopeSchema, default: () => ({}) }
    }
  },
  { timestamps: true }
)

userPreferencesSchema.index({ tenantId: 1, userId: 1 }, { unique: true })

export default mongoose.model('UserPreferences', userPreferencesSchema)

