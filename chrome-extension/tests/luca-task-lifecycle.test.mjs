import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import vm from 'node:vm'

const source = await readFile(new URL('../lucaTaskLifecycle.js', import.meta.url), 'utf8')
const context = { globalThis: {} }
vm.runInNewContext(source, context)

test('a Luca task lock can only be released for its exact non-empty job id', () => {
  const { lucaTaskLockMatches } = context.globalThis
  const current = { jobId: 'job-1' }

  assert.equal(lucaTaskLockMatches(current, 'job-1'), true)
  assert.equal(lucaTaskLockMatches(current, 'job-2'), false)
  assert.equal(lucaTaskLockMatches(current, ''), false)
  assert.equal(lucaTaskLockMatches(current, undefined), false)
})

test('claim failure releases only an owned create/send task, never another Luca flow', () => {
  const { shouldReleaseLucaTaskLockAfterClaimFailure } = context.globalThis

  assert.equal(shouldReleaseLucaTaskLockAfterClaimFailure({ kind: 'create' }, true), true)
  assert.equal(shouldReleaseLucaTaskLockAfterClaimFailure({ kind: 'send' }, true), true)
  assert.equal(shouldReleaseLucaTaskLockAfterClaimFailure({ kind: 'check' }, true), false)
  assert.equal(shouldReleaseLucaTaskLockAfterClaimFailure({ kind: 'send' }, false), false)
  assert.equal(shouldReleaseLucaTaskLockAfterClaimFailure(null, true), false)
})

test('create/send task periods fall back to their invoice items without changing check tasks', () => {
  const { getLucaInvoiceTaskPeriod } = context.globalThis

  assert.equal(
    getLucaInvoiceTaskPeriod({ items: [{ period: '2026-10' }] }, 'create'),
    '2026-10'
  )
  assert.equal(
    getLucaInvoiceTaskPeriod({ items: [{ period: '' }, { period: '2026-09' }] }, 'send'),
    '2026-09'
  )
  assert.equal(
    getLucaInvoiceTaskPeriod({ items: [{ period: '2026-10' }] }, 'check'),
    ''
  )
  assert.equal(
    getLucaInvoiceTaskPeriod({ period: '2026-11', items: [{ period: '2026-10' }] }, 'send'),
    '2026-11'
  )
})
