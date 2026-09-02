import { sendError } from '../../../utils/errors.js'
import * as service from '../services/canteenCatalogService.js'

export const listCategories = async (req, res) => {
  try {
    const categories = await service.listCategories(req.user.tenantId, req.canteenBranchId)
    res.json({ success: true, categories })
  } catch (err) {
    sendError(res, err)
  }
}

export const createCategory = async (req, res) => {
  try {
    const category = await service.createCategory(req.user.tenantId, req.canteenBranchId, req.body || {})
    res.json({ success: true, category })
  } catch (err) {
    sendError(res, err)
  }
}

export const updateCategory = async (req, res) => {
  try {
    const category = await service.updateCategory(req.user.tenantId, req.canteenBranchId, req.params.id, req.body || {})
    res.json({ success: true, category })
  } catch (err) {
    sendError(res, err)
  }
}

export const removeCategory = async (req, res) => {
  try {
    const result = await service.removeCategory(req.user.tenantId, req.canteenBranchId, req.params.id)
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}

export const uploadCategoryImage = async (req, res) => {
  try {
    const category = await service.uploadCategoryImage(req.user.tenantId, req.canteenBranchId, req.params.id, req.file)
    res.json({ success: true, category })
  } catch (err) {
    sendError(res, err)
  }
}

export const removeCategoryImage = async (req, res) => {
  try {
    const category = await service.removeCategoryImage(req.user.tenantId, req.canteenBranchId, req.params.id)
    res.json({ success: true, category })
  } catch (err) {
    sendError(res, err)
  }
}

export const listProducts = async (req, res) => {
  try {
    const products = await service.listProducts(req.user.tenantId, req.canteenBranchIds || [])
    res.json({ success: true, products })
  } catch (err) {
    sendError(res, err)
  }
}

export const createProduct = async (req, res) => {
  try {
    const product = await service.createProduct(req.user.tenantId, req.canteenBranchId, req.body || {})
    res.json({ success: true, product })
  } catch (err) {
    sendError(res, err)
  }
}

export const updateProduct = async (req, res) => {
  try {
    const product = await service.updateProduct(req.user.tenantId, req.canteenBranchId, req.params.id, req.body || {}, req.user?.id || req.user?._id || null)
    res.json({ success: true, product })
  } catch (err) {
    sendError(res, err)
  }
}

export const removeProduct = async (req, res) => {
  try {
    const result = await service.removeProduct(req.user.tenantId, req.canteenBranchId, req.params.id)
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}

export const uploadProductImage = async (req, res) => {
  try {
    const product = await service.uploadProductImage(req.user.tenantId, req.canteenBranchId, req.params.id, req.file)
    res.json({ success: true, product })
  } catch (err) {
    sendError(res, err)
  }
}

export const removeProductImage = async (req, res) => {
  try {
    const product = await service.removeProductImage(req.user.tenantId, req.canteenBranchId, req.params.id)
    res.json({ success: true, product })
  } catch (err) {
    sendError(res, err)
  }
}

export const getProductByBarcode = async (req, res) => {
  try {
    const product = await service.getProductByBarcode(req.user.tenantId, req.canteenBranchId, req.params.barcode)
    res.json({ success: true, product })
  } catch (err) {
    sendError(res, err)
  }
}

export const searchProducts = async (req, res) => {
  try {
    const items = await service.searchProducts(req.user.tenantId, req.canteenBranchId, req.query || {})
    res.json({ success: true, items })
  } catch (err) {
    sendError(res, err)
  }
}


export const addGalleryImage = async (req, res) => {
  try {
    const result = await service.addGalleryImage(req.user.tenantId, req.canteenBranchId, req.params.id, req.file)
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}

export const removeGalleryImage = async (req, res) => {
  try {
    const result = await service.removeGalleryImage(req.user.tenantId, req.canteenBranchId, req.params.id, req.query.imageUrl || '')
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}
