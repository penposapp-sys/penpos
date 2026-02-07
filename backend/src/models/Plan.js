import mongoose from 'mongoose'

const planSchema = new mongoose.Schema(
  {
    systemType: { type: String, enum: ['kermes', 'kantin'], default: 'kermes', required: true, index: true },
    name: { type: String, required: true, index: true },
    price: { type: Number, default: 0 },
    limits: {
      products: { type: Number, default: -1 },
      tables: { type: Number, default: -1 },
      staff: { type: Number, default: -1 }
    },
    features: {
      reports: { type: Boolean, default: false },
      kitchen: { type: Boolean, default: false }
    },
    trialDays: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
)

planSchema.index({ systemType: 1, name: 1 }, { unique: true })

export default mongoose.model('Plan', planSchema)
