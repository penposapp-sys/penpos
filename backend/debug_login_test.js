import http from 'node:http'
function doPost(path, dataObj) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(dataObj)
    const req = http.request(
      { hostname: '127.0.0.1', port: 4000, path, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) } },
      (res) => {
        let body = ''
        res.on('data', (c) => { body += c })
        res.on('end', () => {
          try { resolve({ status: res.statusCode, data: JSON.parse(body) }) }
          catch (e) { resolve({ status: res.statusCode, data: { raw: String(body).slice(0, 800), parseErr: e.message } }) }
        })
      }
    )
    req.on('error', reject)
    req.write(postData)
    req.end()
  })
}
;(async () => {
  try {
    const tests = [
      ['TEST 1: portal=anaokulu (DOGRU)', { identifier: 'penpos_anaokulu_0906_okul1@test.com', password: 'OKUL12345678', portal: 'anaokulu' }],
      ['TEST 2: portal YOK (yanlis)', { identifier: 'penpos_anaokulu_0906_okul1@test.com', password: 'OKUL12345678' }],
      ['TEST 3: yanlis sifre', { identifier: 'penpos_anaokulu_0906_okul1@test.com', password: 'SIFREHATALI123', portal: 'anaokulu' }]
    ]
    for (const [name, data] of tests) {
      console.log('\n==========================================')
      console.log(name)
      console.log('Gonderilen:', JSON.stringify(data))
      const r = await doPost('/api/auth/login', data)
      console.log('HTTP Status:', r.status)
      const d = r.data || {}
      console.log('  success:', d.success, '| error:', d.error, '| code:', d.code)
      console.log('  message:', String(d.message || d.raw || '').slice(0, 200))
      if (d.token) {
        console.log('  \\u2705 TOKEN VAR (ilk 40):', String(d.token).slice(0, 40) + '...')
        console.log('  \\u2705 user.email:', d.user?.email)
        console.log('  \\u2705 user.systemType:', d.user?.systemType, '| role:', d.user?.role)
        console.log('  \\u2705 user.tenantId:', d.user?.tenantId ? String(d.user.tenantId).slice(0, 16) + '...' : 'YOK')
        const at = Array.isArray(d.user?.accessibleTenants) ? d.user.accessibleTenants : []
        console.log('  \\u2705 accessibleTenants:', at.length, at.map(x => ({ id: String(x.id||x._id||'').slice(0,8), name: x.name, st: x.systemType })))
      } else {
        console.log('  \\u274C TOKEN YOK')
      }
    }
    console.log('\n==========================================')
    console.log('TEST 4: GET region-admins (auth yokken 401 donmeli — endpoint aktif mi?):')
    const r4 = await doPost('/api/platform/anaokulu-region-admins', { name: 'test ra', email: 'bolge_test_xx454@test.com', password: 'BOLGE123456', accessibleTenantIds: ['6a9da690e8431a4f5e7f5f5f'] })
    console.log('HTTP Status:', r4.status)
    console.log('code:', r4.data?.code || r4.data?.error, 'message:', String(r4.data?.message || r4.data?.raw || '').slice(0, 200))
    process.exit(0)
  } catch (e) {
    console.error('GENEL HATA:', e.message, e.stack)
    process.exit(1)
  }
})()
