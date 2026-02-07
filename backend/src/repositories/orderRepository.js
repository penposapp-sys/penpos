import Order from '../models/Order.js'

export const createOrder = (data) => Order.create(data)
export const findByIdAndTenant = (id, tenantId) => Order.findOne({ _id: id, tenantId })
export const updateById = (id, update) => Order.findByIdAndUpdate(id, update, { new: true })
