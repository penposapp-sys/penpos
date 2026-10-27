import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveWindowsPrinterName } from './printerName.js'

test('uses the exact enumerated Windows printer name', () => {
  assert.equal(resolveWindowsPrinterName('Xprinter XP-470B', ['Xprinter XP-470B']), 'Xprinter XP-470B')
})

test('maps a redirected display suffix only to its unique enumerated base printer', () => {
  assert.equal(resolveWindowsPrinterName('Xprinter XP-470B (1 yönlendirildi)', ['Xprinter XP-470B']), 'Xprinter XP-470B')
})

test('does not strip or transliterate meaningful Turkish characters', () => {
  assert.throws(() => resolveWindowsPrinterName('İş Yazıcısı', ['Is Yazicisi']), /Printer not found/)
})

test('rejects ambiguous redirected printers', () => {
  assert.throws(() => resolveWindowsPrinterName('Printer (1 redirected)', ['Printer', 'printer']), /Ambiguous/)
})
