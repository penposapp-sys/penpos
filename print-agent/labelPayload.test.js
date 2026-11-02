import assert from 'node:assert/strict'
import test from 'node:test'
import { getTsplLabelText } from './labelPayload.js'

test('quick-sale TSPL label places the order note beneath its header', () => {
  assert.deepEqual(getTsplLabelText(
    'HIZLI SATIŞ\nIzgara Tavuk\n2 ADET\nAz acılı',
    'AİLE SALONU 2'
  ), {
    top: 'HIZLI SATIŞ',
    subtitle: 'MASA: AİLE SALONU 2',
    product: 'Izgara Tavuk',
    amount: '2 ADET',
    note: 'Az acılı'
  })
})

test('regular TSPL labels and quick sales without an order note keep the current layout', () => {
  assert.deepEqual(getTsplLabelText('MASA 4\nAyran\n1 ADET\n'), {
    top: 'MASA 4',
    subtitle: '',
    product: 'Ayran',
    amount: '1 ADET',
    note: ''
  })
  assert.equal(getTsplLabelText('HIZLI SATIŞ\nAyran\n1 ADET\n', '  ').subtitle, '')
})
