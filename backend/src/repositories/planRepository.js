import Plan from '../models/Plan.js'

export const createPlan = (data) => Plan.create(data)
export const listPlans = () => Plan.find({}).sort({ createdAt: -1 })
export const findPlanById = (id) => Plan.findById(id)
export const updatePlanById = (id, update) =>
  Plan.findByIdAndUpdate(id, update, { new: true })
export const deletePlanById = (id) => Plan.findByIdAndDelete(id)
