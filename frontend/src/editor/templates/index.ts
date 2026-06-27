import { cafeTemplate } from './templates/cafe'
import { landingTemplate } from './templates/landing'
import { modaLineBasicTemplate } from './templates/modaLineBasic'
import { modaLineWebTemplate } from './templates/modaLineWeb'
import { novaEditorialTemplate } from './templates/novaEditorial'
import { novaFuturisticTemplate } from './templates/novaFuturistic'
import { novaMinimalTemplate } from './templates/novaMinimal'
import { portfolioTemplate } from './templates/portfolio'
import { restaurantTemplate } from './templates/restaurant'
import { servicesTemplate } from './templates/services'
import { storeTemplate } from './templates/store'
import type { Template, TemplateCategory } from './TemplateTypes'

export const allTemplates: Template[] = [
  restaurantTemplate,
  storeTemplate,
  portfolioTemplate,
  cafeTemplate,
  servicesTemplate,
  landingTemplate,
  novaFuturisticTemplate,
  modaLineWebTemplate,
  novaMinimalTemplate,
  novaEditorialTemplate,
  modaLineBasicTemplate,
]

export const templatesByCategory: TemplateCategory[] = [
  {
    id: 'restaurant',
    name: 'Restoran ve Kafe',
    icon: 'RST',
    templates: [restaurantTemplate, cafeTemplate],
  },
  {
    id: 'store',
    name: 'Magaza ve E-Ticaret',
    icon: 'STR',
    templates: [storeTemplate, novaFuturisticTemplate, modaLineWebTemplate, novaMinimalTemplate, novaEditorialTemplate, modaLineBasicTemplate],
  },
  {
    id: 'portfolio',
    name: 'Portfolio ve Kisisel',
    icon: 'PRT',
    templates: [portfolioTemplate],
  },
  {
    id: 'business',
    name: 'Is ve Hizmet',
    icon: 'BUS',
    templates: [servicesTemplate, landingTemplate],
  },
]

export * from './TemplateTypes'
export * from './templateLoader'
export * from './TemplateLibrary'
