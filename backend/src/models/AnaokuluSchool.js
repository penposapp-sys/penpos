import mongoose from 'mongoose'

const anaokuluFeeCategorySchema = new mongoose.Schema(
  {
    id: { type: String, default: '' },
    name: { type: String, required: true },
    defaultPrice: { type: Number, default: 0 },
    invoiced: { type: Boolean, default: true }
  },
  { _id: false, strict: false }
)

const anaokuluDiscountSchema = new mongoose.Schema(
  {
    id: { type: String, default: '' },
    name: { type: String, required: true },
    type: { type: String, default: 'percent' }, // 'percent' | 'fixed'
    value: { type: Number, default: 0 }
  },
  { _id: false, strict: false }
)

const anaokuluLucaSchema = new mongoose.Schema(
  {
    tckn: { type: String, default: '' },
    customerNo: { type: String, default: '' },
    username: { type: String, default: '' },
    password: { type: String, default: '' },
    url: { type: String, default: 'https://turmobefatura.luca.com.tr' },
    autoSync: { type: Boolean, default: true }
  },
  { _id: false, strict: false }
)

const anaokuluSettingSchema = new mongoose.Schema(
  {
    school: { type: String, default: 'Anaokulu' },
    vat: { type: Number, default: 10 },
    yearStart: { type: String, default: '' },
    matchBy: { type: String, default: 'tax' },
    feeCategories: { type: [anaokuluFeeCategorySchema], default: [] },
    discounts: { type: [anaokuluDiscountSchema], default: [] },
    luca: { type: anaokuluLucaSchema, default: () => ({}) }
  },
  { _id: false, strict: false }
)

const anaokuluStudentSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true },
    name: { type: String, required: true },
    class: { type: String, default: '' },
    parent: { type: String, default: '' },
    phone: { type: String, default: '' },
    tax: { type: String, default: '' },
    regDate: { type: String, default: '' },
    address: { type: String, default: '' },
    note: { type: String, default: '' },
    active: { type: Boolean, default: true },
    invoiced: { type: Boolean, default: true },
    items: {
      type: [
        new mongoose.Schema(
          {
            name: { type: String, default: '' },
            total: { type: Number, default: 0 },
            basePrice: { type: Number, default: 0 },
            discountId: { type: String, default: '' },
            discountName: { type: String, default: '' },
            discountLabel: { type: String, default: '' },
            invoiced: { type: Boolean, default: true },
            discounts: {
              type: [
                new mongoose.Schema(
                  {
                    id: { type: String, default: '' },
                    name: { type: String, default: '' },
                    type: { type: String, default: 'percent' },
                    value: { type: Number, default: 0 },
                    amount: { type: Number, default: 0 }
                  },
                  { _id: false, strict: false }
                )
              ],
              default: []
            },
            installments: { type: Number, default: 1 },
            start: { type: String, default: '' },
            skippedInstallments: { type: Array, default: [] }
          },
          { _id: false, strict: false }
        )
      ],
      default: []
    }
  },
  { _id: false, id: false, strict: false }
)

const anaokuluCollectionSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true },
    studentId: { type: Number, required: true },
    date: { type: String, default: '' },
    item: { type: String, default: '' },
    amount: { type: Number, default: 0 },
    vatRate: { type: Number, default: 0 },
    vat: { type: Number, default: 0 },
    payment: { type: String, default: '' },
    invoiceNo: { type: String, default: '' },
    installmentNo: { type: Number, default: 0 },
    note: { type: String, default: '' }
  },
  { _id: false, id: false, strict: false }
)

const anaokuluInvoiceSchema = new mongoose.Schema(
  {
    uuid: { type: String, default: '' },
    no: { type: String, default: '' },
    date: { type: String, default: '' },
    period: { type: String, default: '' },
    taxId: { type: String, default: '' },
    buyer: { type: String, default: '' },
    base: { type: Number, default: 0 },
    vat: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    type: { type: String, default: 'e-Arşiv' },
    status: { type: String, default: 'Kesildi' },
    pdf: { type: Boolean, default: false },
    xml: { type: Boolean, default: false },
    studentId: { type: Number },
    installmentNo: { type: Number },
    planName: { type: String, default: '' },
    diff: { type: Boolean, default: false },
    matchBy: { type: String, default: '' }
  },
  { _id: false, id: false, strict: false }
)

const anaokuluCheckSchema = new mongoose.Schema(
  {
    period: { type: String, default: '' },
    at: { type: Number, default: Date.now },
    found: { type: Number, default: 0 },
    matched: { type: Number, default: 0 }
  },
  { _id: false, id: false, strict: false }
)

const AnaokuluSchoolSchema = new mongoose.Schema(
  {
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    settings: { type: anaokuluSettingSchema, default: () => ({ school: 'Anaokulu', vat: 10 }) },
    students: { type: [anaokuluStudentSchema], default: [] },
    collections: { type: [anaokuluCollectionSchema], default: [] },
    invoices: { type: [anaokuluInvoiceSchema], default: [] },
    checks: { type: [anaokuluCheckSchema], default: [] }
  },
  { timestamps: true }
)

export const AnaokuluSchool = mongoose.model('AnaokuluSchool', AnaokuluSchoolSchema)
