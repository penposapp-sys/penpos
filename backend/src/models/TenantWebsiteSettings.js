import mongoose from 'mongoose'

const sectionSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: { type: String, required: true },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  content: { type: String, default: '' },
  visible: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
  settings: {
    type: new mongoose.Schema({}, { _id: false, strict: false }),
    default: () => ({})
  }
}, { _id: false })

const schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, unique: true, index: true },
  slug: { type: String, required: true, unique: true, index: true },
  enabled: { type: Boolean, default: true },
  published: { type: Boolean, default: false },
  theme: {
    type: new mongoose.Schema({}, { _id: false, strict: false }),
    default: () => ({})
  },
  layout: {
    type: new mongoose.Schema({}, { _id: false, strict: false }),
    default: () => ({})
  },
  hero: {
    type: new mongoose.Schema({}, { _id: false, strict: false }),
    default: () => ({})
  },
  sections: { type: [sectionSchema], default: [] },
  contact: {
    type: new mongoose.Schema({}, { _id: false, strict: false }),
    default: () => ({})
  },
  integrations: {
    type: new mongoose.Schema({}, { _id: false, strict: false }),
    default: () => ({})
  },
  seo: {
    type: new mongoose.Schema({}, { _id: false, strict: false }),
    default: () => ({})
  },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  publishedAt: { type: Date, default: null }
}, { collection: 'tenant_website_settings', timestamps: true })

export default mongoose.model('TenantWebsiteSettings', schema)
