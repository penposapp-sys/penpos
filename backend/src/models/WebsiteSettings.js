import mongoose from 'mongoose'

const featureSchema = new mongoose.Schema({
  id: { type: String, required: true },
  icon: { type: String, default: '' },
  title: { type: String, default: '' },
  text: { type: String, default: '' },
  sortOrder: { type: Number, default: 0 },
  active: { type: Boolean, default: true }
}, { _id: false })

const systemCardSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: { type: String, enum: ['restaurant', 'market'], required: true },
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  bullets: { type: [String], default: [] },
  active: { type: Boolean, default: true }
}, { _id: false })

const pricingPlanSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, default: '' },
  price: { type: String, default: '' },
  period: { type: String, default: '' },
  description: { type: String, default: '' },
  items: { type: [String], default: [] },
  popular: { type: Boolean, default: false },
  buttonText: { type: String, default: '' },
  buttonUrl: { type: String, default: '' },
  active: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 }
}, { _id: false })

const trainingVideoSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  youtubeUrl: { type: String, default: '' },
  category: { type: String, enum: ['general', 'restaurant', 'market'], default: 'general' },
  active: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 }
}, { _id: false })

const integrationSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, default: '' },
  description: { type: String, default: '' },
  active: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 }
}, { _id: false })

const schema = new mongoose.Schema({
  key: { type: String, default: 'primary', unique: true, index: true },
  siteTitle: { type: String, default: '' },
  siteDescription: { type: String, default: '' },
  brandSubtitle: { type: String, default: '' },
  headerSystemsLabel: { type: String, default: '' },
  headerFeaturesLabel: { type: String, default: '' },
  headerPricingLabel: { type: String, default: '' },
  headerTrainingLabel: { type: String, default: '' },
  heroTitle: { type: String, default: '' },
  heroSubtitle: { type: String, default: '' },
  heroDescription: { type: String, default: '' },
  heroPointOne: { type: String, default: '' },
  heroPointTwo: { type: String, default: '' },
  heroPointThree: { type: String, default: '' },
  trialDays: { type: Number, default: 7 },
  primaryCtaText: { type: String, default: '' },
  primaryCtaUrl: { type: String, default: '' },
  secondaryCtaText: { type: String, default: '' },
  secondaryCtaUrl: { type: String, default: '' },
  restaurantLoginText: { type: String, default: '' },
  restaurantLoginUrl: { type: String, default: '/login/restoran' },
  canteenLoginText: { type: String, default: '' },
  canteenLoginUrl: { type: String, default: '/canteen/login' },
  platformLoginText: { type: String, default: '' },
  platformLoginUrl: { type: String, default: '/platform/login' },
  marketLoginUrl: { type: String, default: '/canteen/login' },
  registerUrl: { type: String, default: '/register' },
  whatsappUrl: { type: String, default: '' },
  phone: { type: String, default: '' },
  email: { type: String, default: '' },
  address: { type: String, default: '' },
  androidButtonText: { type: String, default: '' },
  androidApkUrl: { type: String, default: '' },
  androidButtonActive: { type: Boolean, default: false },
  systemsSectionEyebrow: { type: String, default: '' },
  systemsSectionTitle: { type: String, default: '' },
  systemsSectionText: { type: String, default: '' },
  operationsSectionEyebrow: { type: String, default: '' },
  operationsSectionTitle: { type: String, default: '' },
  operationsSectionText: { type: String, default: '' },
  pricingSectionEyebrow: { type: String, default: '' },
  pricingSectionTitle: { type: String, default: '' },
  pricingSectionText: { type: String, default: '' },
  trainingSectionEyebrow: { type: String, default: '' },
  trainingSectionTitle: { type: String, default: '' },
  trainingSectionText: { type: String, default: '' },
  contactSectionTitle: { type: String, default: '' },
  whatsappLabel: { type: String, default: '' },
  whatsappStatusText: { type: String, default: '' },
  footerText: { type: String, default: '' },
  themeBackgroundStart: { type: String, default: '' },
  themeBackgroundEnd: { type: String, default: '' },
  themeHeaderBackground: { type: String, default: '' },
  themeSurfaceColor: { type: String, default: '' },
  themeAccentColor: { type: String, default: '' },
  themeAccentTextColor: { type: String, default: '' },
  themeTextColor: { type: String, default: '' },
  themeMutedTextColor: { type: String, default: '' },
  themeBorderColor: { type: String, default: '' },
  themeFooterBackground: { type: String, default: '' },
  socialInstagramUrl: { type: String, default: '' },
  socialFacebookUrl: { type: String, default: '' },
  socialXUrl: { type: String, default: '' },
  socialYoutubeUrl: { type: String, default: '' },
  socialLinkedinUrl: { type: String, default: '' },
  features: { type: [featureSchema], default: [] },
  systemCards: { type: [systemCardSchema], default: [] },
  pricingPlans: { type: [pricingPlanSchema], default: [] },
  trainingVideos: { type: [trainingVideoSchema], default: [] },
  integrations: { type: [integrationSchema], default: [] },
  seoTitle: { type: String, default: '' },
  seoDescription: { type: String, default: '' },
  seoKeywords: { type: String, default: '' },
  isPublished: { type: Boolean, default: true }
}, { collection: 'website_settings', timestamps: true })

export default mongoose.model('WebsiteSettings', schema)
