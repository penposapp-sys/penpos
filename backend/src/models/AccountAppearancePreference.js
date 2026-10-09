import mongoose from 'mongoose'

const accountAppearancePreferenceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    themeKey: { type: String, enum: ['white'], default: 'white' },
    darkMode: { type: Boolean, default: false },
    fontSize: { type: Number, min: 8, max: 24, default: null }
  },
  { timestamps: true }
)

export default mongoose.model('AccountAppearancePreference', accountAppearancePreferenceSchema)
