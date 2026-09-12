import mongoose from 'mongoose'

const lucaJobSchema = new mongoose.Schema({
  jobId: { type: String, required: true, unique: true, index: true },
  data: { type: mongoose.Schema.Types.Mixed, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } }
}, { timestamps: true })

export default mongoose.models.LucaJob || mongoose.model('LucaJob', lucaJobSchema)
