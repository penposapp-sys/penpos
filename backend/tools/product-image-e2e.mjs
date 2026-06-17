import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import sharp from 'sharp'

const API_BASE = 'http://127.0.0.1:4000'
const UPLOAD_DIR_CANDIDATES = [
  path.resolve(process.cwd(), 'uploads', 'products'),
  path.resolve(process.cwd(), 'backend', 'uploads', 'products')
]
const TMP_DIR = path.resolve(process.cwd(), '.tmp-product-image-e2e')

const results = {
  restaurant: {
    screens: [],
    successes: [],
    failures: []
  },
  canteen: {
    screens: [],
    successes: [],
    failures: []
  },
  shared: {
    successes: [],
    failures: []
  },
  manualChecks: []
}

const nowKey = Date.now()

const restaurantIdentity = {
  businessName: 'Image E2E Restaurant',
  ownerName: 'Image Restaurant Owner',
  email: 'image.e2e.restaurant@local',
  phone: '5551112233',
  password: 'ImgTest123!',
  systemType: 'restaurant'
}

const canteenIdentity = {
  businessName: 'Image E2E Canteen',
  ownerName: 'Image Canteen Owner',
  email: 'image.e2e.canteen@local',
  phone: '5551112244',
  password: 'ImgTest123!',
  systemType: 'canteen'
}

const pretty = (value) => JSON.stringify(value, null, 2)

const assert = (condition, message, details) => {
  if (!condition) {
    const err = new Error(message)
    err.details = details
    throw err
  }
}

const pushSuccess = (bucket, message) => {
  results[bucket].successes.push(message)
}

const pushFailure = (bucket, message) => {
  results[bucket].failures.push(message)
}

const api = async (pathname, { method = 'GET', token = '', headers = {}, body, raw = false } = {}) => {
  const mergedHeaders = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers
  }

  const response = await fetch(`${API_BASE}${pathname}`, {
    method,
    headers: mergedHeaders,
    body
  })

  if (raw) return response

  const payload = await response.json().catch(() => ({}))
  return { response, payload }
}

const ensureAuth = async (identity) => {
  const registerBody = JSON.stringify(identity)
  const register = await api('/api/public/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: registerBody
  })

  if (register.response.ok && register.payload?.token) {
    return {
      token: register.payload.token,
      user: register.payload.user,
      portal: register.payload.portal
    }
  }

  const login = await api('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: identity.email,
      password: identity.password,
      portal: identity.systemType === 'canteen' ? 'canteen' : 'restaurant'
    })
  })

  assert(login.response.ok, `Login failed for ${identity.email}`, login.payload)
  return {
    token: login.payload.token,
    user: login.payload.user,
    portal: identity.systemType === 'canteen' ? 'canteen' : 'kermes'
  }
}

const ensureTempFiles = async () => {
  await fs.mkdir(TMP_DIR, { recursive: true })

  const jpgPath = path.join(TMP_DIR, 'sample.jpg')
  const pngPath = path.join(TMP_DIR, 'sample.png')
  const webpPath = path.join(TMP_DIR, 'sample.webp')
  const txtPath = path.join(TMP_DIR, 'sample.txt')
  const largePngPath = path.join(TMP_DIR, 'too-large.png')

  await sharp({
    create: {
      width: 800,
      height: 600,
      channels: 3,
      background: { r: 226, g: 120, b: 36 }
    }
  }).jpeg({ quality: 90 }).toFile(jpgPath)

  await sharp({
    create: {
      width: 820,
      height: 620,
      channels: 4,
      background: { r: 30, g: 136, b: 229, alpha: 1 }
    }
  }).png().toFile(pngPath)

  await sharp({
    create: {
      width: 780,
      height: 580,
      channels: 4,
      background: { r: 56, g: 142, b: 60, alpha: 1 }
    }
  }).webp({ quality: 88 }).toFile(webpPath)

  await fs.writeFile(txtPath, 'not-an-image', 'utf8')

  const noise = crypto.randomBytes(1800 * 1800 * 3)
  await sharp(noise, { raw: { width: 1800, height: 1800, channels: 3 } }).png().toFile(largePngPath)

  const largeStats = await fs.stat(largePngPath)
  assert(largeStats.size > 1024 * 1024, 'large PNG must exceed 1 MB', { size: largeStats.size })

  return { jpgPath, pngPath, webpPath, txtPath, largePngPath }
}

const buildFileForm = async (filePath, mimeType) => {
  const form = new FormData()
  const buffer = await fs.readFile(filePath)
  form.append('file', new Blob([buffer], { type: mimeType }), path.basename(filePath))
  return form
}

const expectWebpFile = async (publicPath) => {
  assert(publicPath.startsWith('/uploads/products/'), 'image path must use /uploads/products/', { publicPath })
  assert(publicPath.endsWith('.webp'), 'image path must end with .webp', { publicPath })
  const fileName = path.basename(publicPath)
  let absolutePath = ''
  for (const candidateDir of UPLOAD_DIR_CANDIDATES) {
    const candidatePath = path.join(candidateDir, fileName)
    if (await exists(candidatePath)) {
      absolutePath = candidatePath
      break
    }
  }
  assert(absolutePath, 'saved file not found in expected upload directories', { publicPath, candidates: UPLOAD_DIR_CANDIDATES })
  const fileBuffer = await fs.readFile(absolutePath)
  assert(fileBuffer.subarray(0, 4).toString() === 'RIFF', 'saved image must start with RIFF', { publicPath })
  assert(fileBuffer.subarray(8, 12).toString() === 'WEBP', 'saved image must be WEBP', { publicPath })
  return absolutePath
}

const exists = async (targetPath) => {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

const createRestaurantCategory = async (token) => {
  const categoryName = `Img E2E Cat ${nowKey}`
  const { response, payload } = await api('/api/tenant/categories', {
    method: 'POST',
    token,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: categoryName, sortOrder: 1 })
  })
  assert(response.ok, 'restaurant category create failed', payload)
  return payload.category
}

const createRestaurantItem = async (token, categoryId, name, imageUrl = '') => {
  const { response, payload } = await api('/api/tenant/menu-items', {
    method: 'POST',
    token,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      categoryId,
      name,
      price: 99.9,
      description: 'image e2e',
      imageUrl,
      sortOrder: 1,
      isActive: true
    })
  })
  assert(response.ok, `restaurant item create failed: ${name}`, payload)
  return payload.item
}

const uploadRestaurantImage = async (token, itemId, filePath, mimeType, expectedStatus = 200) => {
  const form = await buildFileForm(filePath, mimeType)
  const response = await api(`/api/tenant/menu-items/${itemId}/image`, {
    method: 'POST',
    token,
    body: form,
    raw: true
  })
  const payload = await response.json().catch(() => ({}))
  assert(response.status === expectedStatus, `restaurant upload status mismatch ${filePath}`, { status: response.status, payload })
  return { response, payload }
}

const createCanteenCategory = async (token, branchId) => {
  const { response, payload } = await api(`/api/canteen/categories?branchId=${encodeURIComponent(branchId)}`, {
    method: 'POST',
    token,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `Img E2E Cat ${nowKey}`, description: '', sortOrder: 1 })
  })
  assert(response.ok, 'canteen category create failed', payload)
  return payload.category
}

const createCanteenProduct = async (token, branchId, categoryId, name, imageUrl = '') => {
  const { response, payload } = await api(`/api/canteen/products?branchId=${encodeURIComponent(branchId)}`, {
    method: 'POST',
    token,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      barcode: `BC-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      price: 42.5,
      costPrice: 10,
      imageUrl,
      categoryId: categoryId || null,
      stockTrackingEnabled: true,
      stockQty: 5
    })
  })
  assert(response.ok, `canteen product create failed: ${name}`, payload)
  return payload.product
}

const uploadCanteenImage = async (token, branchId, productId, filePath, mimeType, expectedStatus = 200) => {
  const form = await buildFileForm(filePath, mimeType)
  const response = await api(`/api/canteen/products/${productId}/image?branchId=${encodeURIComponent(branchId)}`, {
    method: 'POST',
    token,
    body: form,
    raw: true
  })
  const payload = await response.json().catch(() => ({}))
  assert(response.status === expectedStatus, `canteen upload status mismatch ${filePath}`, { status: response.status, payload })
  return { response, payload }
}

const fetchRestaurantPublicMenu = async (tenantSlug) => {
  const { response, payload } = await api(`/api/public/menu?tenantSlug=${encodeURIComponent(tenantSlug)}`)
  assert(response.ok, 'restaurant public menu request failed', payload)
  return payload
}

const fetchCanteenPublicQr = async (tenantSlug) => {
  const { response, payload } = await api(`/api/public/qr?slug=${encodeURIComponent(tenantSlug)}`)
  assert(response.ok, 'canteen public qr request failed', payload)
  return payload
}

const main = async () => {
  const files = await ensureTempFiles()

  const restaurantAuth = await ensureAuth(restaurantIdentity)
  const canteenAuth = await ensureAuth(canteenIdentity)

  const restaurantContext = await api('/api/tenant/context', { token: restaurantAuth.token })
  assert(restaurantContext.response.ok, 'restaurant context failed', restaurantContext.payload)
  const restaurantSlug = restaurantContext.payload?.tenant?.slug
  const restaurantBranchId = String((restaurantContext.payload?.tenant?.allowedBranchIds || [])[0] || '')
  assert(restaurantSlug, 'restaurant slug missing', restaurantContext.payload)
  assert(restaurantBranchId, 'restaurant branch missing', restaurantContext.payload)

  const canteenProfile = await api('/api/tenant/profile', { token: canteenAuth.token })
  assert(canteenProfile.response.ok, 'canteen profile failed', canteenProfile.payload)
  const canteenSlug = canteenProfile.payload?.tenant?.slug
  const canteenBranches = await api('/api/canteen/branches', { token: canteenAuth.token })
  assert(canteenBranches.response.ok, 'canteen branches failed', canteenBranches.payload)
  const canteenBranchId = String(canteenBranches.payload?.branches?.[0]?.id || '')
  assert(canteenBranchId, 'canteen branch id missing', canteenBranches.payload)

  results.restaurant.screens.push(
    'Restoran ürün ekleme',
    'Restoran ürün düzenleme',
    'Restoran ürün silme',
    'QR Menü restoran ürün görselleri',
    'Masalar POS ürün kartları',
    'Masasız Satış ürün kartları',
    'Paket Servis ürün kartları'
  )
  results.canteen.screens.push(
    'Kantin ürün ekleme',
    'Kantin ürün düzenleme',
    'Kantin ürün silme',
    'Kantin kasa ürün kartları',
    'Kantin QR önizleme / public görünüm'
  )

  try {
    const restaurantCategory = await createRestaurantCategory(restaurantAuth.token)
    const restaurantItem = await createRestaurantItem(restaurantAuth.token, restaurantCategory.id, `Restaurant Img ${nowKey}`)
    pushSuccess('restaurant', 'Restoran ürün ekleme API akışı çalıştı.')

    const restaurantJpg = await uploadRestaurantImage(restaurantAuth.token, restaurantItem.id, files.jpgPath, 'image/jpeg')
    const restaurantPath1 = restaurantJpg.payload?.item?.imageUrl
    const restaurantAbs1 = await expectWebpFile(restaurantPath1)
    pushSuccess('shared', 'JPG yükleme kabul edildi ve WEBP olarak kaydedildi.')

    const restaurantPng = await uploadRestaurantImage(restaurantAuth.token, restaurantItem.id, files.pngPath, 'image/png')
    const restaurantPath2 = restaurantPng.payload?.item?.imageUrl
    const restaurantAbs2 = await expectWebpFile(restaurantPath2)
    assert(!(await exists(restaurantAbs1)), 'old restaurant file must be deleted after update', { old: restaurantAbs1 })
    pushSuccess('restaurant', 'Restoran ürün düzenlemede eski görsel silinip yeni PNG -> WEBP kaydedildi.')

    const restaurantWebp = await uploadRestaurantImage(restaurantAuth.token, restaurantItem.id, files.webpPath, 'image/webp')
    const restaurantPath3 = restaurantWebp.payload?.item?.imageUrl
    const restaurantAbs3 = await expectWebpFile(restaurantPath3)
    assert(!(await exists(restaurantAbs2)), 'previous restaurant file must be deleted after second update', { old: restaurantAbs2 })
    pushSuccess('shared', 'WEBP yükleme kabul edildi.')
    pushSuccess('shared', 'PNG yükleme kabul edildi.')

    const tooLargeRestaurant = await uploadRestaurantImage(restaurantAuth.token, restaurantItem.id, files.largePngPath, 'image/png', 400)
    assert(String(tooLargeRestaurant.payload?.message || '').includes('1 MB'), 'restaurant large file error mismatch', tooLargeRestaurant.payload)
    pushSuccess('shared', '1 MB üzeri dosya backend tarafından reddedildi.')

    const invalidRestaurant = await uploadRestaurantImage(restaurantAuth.token, restaurantItem.id, files.txtPath, 'text/plain', 400)
    assert(String(invalidRestaurant.payload?.message || '').includes('JPG, PNG veya WEBP'), 'restaurant invalid format message mismatch', invalidRestaurant.payload)
    pushSuccess('shared', 'Yanlış format backend tarafından reddedildi.')

    const rawRestaurantFile = await api(restaurantPath3.replace(API_BASE, ''), { raw: true })
    assert(rawRestaurantFile.status === 200, 'uploaded restaurant file not reachable', { status: rawRestaurantFile.status })
    assert(String(rawRestaurantFile.headers.get('cache-control') || '') === 'public, max-age=31536000', 'cache header mismatch', {
      cacheControl: rawRestaurantFile.headers.get('cache-control')
    })
    pushSuccess('shared', 'Cache-Control header doğru dönüyor.')

    const legacyRestaurant = await createRestaurantItem(
      restaurantAuth.token,
      restaurantCategory.id,
      `Restaurant Legacy ${nowKey}`,
      'https://example.com/legacy-image.jpg'
    )
    const brokenRestaurant = await createRestaurantItem(
      restaurantAuth.token,
      restaurantCategory.id,
      `Restaurant Broken ${nowKey}`,
      '/uploads/products/broken-image.webp'
    )
    const restaurantPublicMenu = await fetchRestaurantPublicMenu(restaurantSlug)
    const restaurantLegacyPublic = (restaurantPublicMenu.items || []).find((item) => item.id === legacyRestaurant.id)
    const restaurantBrokenPublic = (restaurantPublicMenu.items || []).find((item) => item.id === brokenRestaurant.id)
    assert(restaurantLegacyPublic?.imageUrl === 'https://example.com/legacy-image.jpg', 'legacy restaurant URL missing in public menu', restaurantLegacyPublic)
    assert(restaurantBrokenPublic?.imageUrl === '/uploads/products/broken-image.webp', 'broken restaurant path missing in public menu', restaurantBrokenPublic)
    pushSuccess('restaurant', 'Restoran QR Menü verisi eski http/https görselleri koruyor.')

    const restaurantDelete = await api(`/api/tenant/menu-items/${restaurantItem.id}`, {
      method: 'DELETE',
      token: restaurantAuth.token
    })
    assert(restaurantDelete.response.ok, 'restaurant item delete failed', restaurantDelete.payload)
    assert(!(await exists(restaurantAbs3)), 'restaurant file must be deleted with item delete', { file: restaurantAbs3 })
    pushSuccess('restaurant', 'Restoran ürün silmede bağlı görsel dosyası da silindi.')
  } catch (err) {
    pushFailure('restaurant', `${err.message}${err.details ? ` -> ${pretty(err.details)}` : ''}`)
  }

  try {
    const canteenCategory = await createCanteenCategory(canteenAuth.token, canteenBranchId)
    const canteenProduct = await createCanteenProduct(canteenAuth.token, canteenBranchId, canteenCategory.id, `Canteen Img ${nowKey}`)
    pushSuccess('canteen', 'Kantin ürün ekleme API akışı çalıştı.')

    const canteenJpg = await uploadCanteenImage(canteenAuth.token, canteenBranchId, canteenProduct.id, files.jpgPath, 'image/jpeg')
    const canteenPath1 = canteenJpg.payload?.product?.imageUrl
    const canteenAbs1 = await expectWebpFile(canteenPath1)
    pushSuccess('canteen', 'Kantin JPG yükleme WEBP olarak kaydedildi.')

    const canteenPng = await uploadCanteenImage(canteenAuth.token, canteenBranchId, canteenProduct.id, files.pngPath, 'image/png')
    const canteenPath2 = canteenPng.payload?.product?.imageUrl
    const canteenAbs2 = await expectWebpFile(canteenPath2)
    assert(!(await exists(canteenAbs1)), 'old canteen file must be deleted after update', { old: canteenAbs1 })
    pushSuccess('canteen', 'Kantin ürün düzenlemede eski dosya silinip yeni görsel kaydedildi.')

    const canteenWebp = await uploadCanteenImage(canteenAuth.token, canteenBranchId, canteenProduct.id, files.webpPath, 'image/webp')
    const canteenPath3 = canteenWebp.payload?.product?.imageUrl
    const canteenAbs3 = await expectWebpFile(canteenPath3)
    assert(!(await exists(canteenAbs2)), 'previous canteen file must be deleted after second update', { old: canteenAbs2 })
    pushSuccess('canteen', 'Kantin WEBP yükleme kabul edildi.')

    const tooLargeCanteen = await uploadCanteenImage(canteenAuth.token, canteenBranchId, canteenProduct.id, files.largePngPath, 'image/png', 400)
    assert(String(tooLargeCanteen.payload?.message || '').includes('1 MB'), 'canteen large file error mismatch', tooLargeCanteen.payload)
    pushSuccess('canteen', 'Kantin tarafında 1 MB üstü dosya reddedildi.')

    const invalidCanteen = await uploadCanteenImage(canteenAuth.token, canteenBranchId, canteenProduct.id, files.txtPath, 'text/plain', 400)
    assert(String(invalidCanteen.payload?.message || '').includes('JPG, PNG veya WEBP'), 'canteen invalid format message mismatch', invalidCanteen.payload)
    pushSuccess('canteen', 'Kantin tarafında yanlış format reddedildi.')

    const legacyCanteen = await createCanteenProduct(
      canteenAuth.token,
      canteenBranchId,
      canteenCategory.id,
      `Canteen Legacy ${nowKey}`,
      'https://example.com/canteen-legacy.webp'
    )
    const brokenCanteen = await createCanteenProduct(
      canteenAuth.token,
      canteenBranchId,
      canteenCategory.id,
      `Canteen Broken ${nowKey}`,
      '/uploads/products/canteen-broken.webp'
    )
    const canteenPublicQr = await fetchCanteenPublicQr(canteenSlug)
    const canteenLegacyPublic = (canteenPublicQr.products || []).find((item) => item.id === legacyCanteen.id)
    const canteenBrokenPublic = (canteenPublicQr.products || []).find((item) => item.id === brokenCanteen.id)
    assert(canteenLegacyPublic?.imageUrl === 'https://example.com/canteen-legacy.webp', 'legacy canteen URL missing in public qr', canteenLegacyPublic)
    assert(canteenBrokenPublic?.imageUrl === '/uploads/products/canteen-broken.webp', 'broken canteen path missing in public qr', canteenBrokenPublic)
    pushSuccess('canteen', 'Kantin public QR verisi eski http/https görselleri koruyor.')

    const canteenDelete = await api(`/api/canteen/products/${canteenProduct.id}?branchId=${encodeURIComponent(canteenBranchId)}`, {
      method: 'DELETE',
      token: canteenAuth.token
    })
    assert(canteenDelete.response.ok, 'canteen product delete failed', canteenDelete.payload)
    assert(!(await exists(canteenAbs3)), 'canteen file must be deleted with product delete', { file: canteenAbs3 })
    pushSuccess('canteen', 'Kantin ürün silmede bağlı görsel dosyası da silindi.')
  } catch (err) {
    pushFailure('canteen', `${err.message}${err.details ? ` -> ${pretty(err.details)}` : ''}`)
  }

  results.manualChecks.push(
    'Tarayıcı in-app browser runtime bu oturumda doğrudan çağrılabilir değildi; restoran POS, masasız satış, paket servis ve kantin kasa ekranlarının gerçek DOM/screenshot doğrulaması manuel browser kontrolü gerektiriyor.',
    'Bozuk local path ve görselsiz ürünlerde placeholder davranışı UI seviyesinde ProductImage onError ile korunuyor; ancak gerçek tarayıcı render doğrulaması bu oturumda otomatik koşturulamadı.',
    'Mobil görünüm kırılma kontrolü için gerçek viewport screenshot testi manuel browser oturumunda tekrar bakılmalı.'
  )

  console.log(JSON.stringify(results, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
