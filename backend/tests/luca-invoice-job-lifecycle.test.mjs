import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  LUCA_CLAIMED_JOB_STALE_MS,
  LUCA_UNCLAIMED_JOB_STALE_MS,
  expireLucaInvoiceJob,
  getLucaInvoiceRetryableSourceKeys,
  isLucaInvoiceJobStale,
  shouldSkipLucaInvoiceCreation
} from '../src/utils/lucaInvoiceJobLifecycle.js'

const now = 1_800_000_000_000

test('unclaimed Luca create/send jobs expire after the extension wait timeout', () => {
  const job = {
    kind: 'send',
    status: 'running',
    phase: 'waiting_extension',
    startedAt: now - LUCA_UNCLAIMED_JOB_STALE_MS - 1
  }

  assert.equal(isLucaInvoiceJobStale(job, now), true)
})

test('a claimed job with no results expires after its activity timeout', () => {
  const job = {
    kind: 'create',
    status: 'running',
    phase: 'extension_claimed',
    claimedAt: now - LUCA_CLAIMED_JOB_STALE_MS - 1
  }

  assert.equal(isLucaInvoiceJobStale(job, now), true)
})

test('legacy partial jobs without activityAt use claimedAt for stale recovery', () => {
  const job = {
    kind: 'send',
    status: 'running',
    phase: 'extension_claimed',
    claimedAt: now - LUCA_CLAIMED_JOB_STALE_MS - 1,
    results: [{ sourceKey: 'sent-before-upgrade', status: 'sent' }]
  }

  assert.equal(isLucaInvoiceJobStale(job, now), true)
})

test('legacy check jobs are never expired by invoice create/send recovery', () => {
  const job = {
    kind: 'check',
    status: 'running',
    phase: 'extension_claimed',
    claimedAt: now - LUCA_CLAIMED_JOB_STALE_MS * 10,
    results: [{ sourceKey: 'existing-check', status: 'verified' }]
  }

  assert.equal(isLucaInvoiceJobStale(job, now), false)
})

test('partial results do not expire while a recent extension heartbeat is present', () => {
  const job = {
    kind: 'create',
    status: 'running',
    phase: 'extension_claimed',
    claimedAt: now - LUCA_CLAIMED_JOB_STALE_MS * 3,
    activityAt: now - 30_000,
    results: [{ sourceKey: 'completed', status: 'draft_created' }]
  }

  assert.equal(isLucaInvoiceJobStale(job, now), false)
})

test('partially completed Luca jobs expire when extension activity stops', () => {
  const job = {
    kind: 'send',
    status: 'running',
    phase: 'extension_claimed',
    claimedAt: now - LUCA_CLAIMED_JOB_STALE_MS * 3,
    activityAt: now - LUCA_CLAIMED_JOB_STALE_MS - 1,
    results: [{ sourceKey: 'sent-invoice', status: 'sent' }]
  }

  assert.equal(isLucaInvoiceJobStale(job, now), true)
})

test('stale recovery keeps successful results and invalidates extension credentials', () => {
  const results = [
    { sourceKey: 'draft-invoice', status: 'draft_created', invoiceNo: 'D-1' },
    { sourceKey: 'sent-invoice', status: 'sent', invoiceNo: 'S-1' }
  ]
  const job = expireLucaInvoiceJob({
    kind: 'send',
    status: 'running',
    phase: 'extension_claimed',
    results,
    resultTokenHash: 'secret-hash',
    extensionTokenHash: 'claim-hash'
  }, now)

  assert.equal(job.status, 'error')
  assert.equal(job.phase, 'completed')
  assert.deepEqual(job.results, results)
  assert.equal(job.resultTokenHash, undefined)
  assert.equal(job.extensionTokenHash, undefined)
  assert.deepEqual(job.retryableSourceKeys, [])
})

test('stale recovery marks only unreported or failed invoices retryable', () => {
  const job = {
    items: [
      { sourceKey: 'draft' },
      { sourceKey: 'sent' },
      { sourceKey: 'failed' },
      { sourceKey: 'not-reported' }
    ],
    results: [
      { sourceKey: 'draft', status: 'draft_created' },
      { sourceKey: 'sent', status: 'sent' },
      { sourceKey: 'failed', status: 'failed' }
    ]
  }

  assert.deepEqual(getLucaInvoiceRetryableSourceKeys(job), ['failed', 'not-reported'])
})

test('a valid existing invoice cannot be created a second time, but a failed create can retry', () => {
  assert.equal(shouldSkipLucaInvoiceCreation('create', { no: 'INV-1' }, false), true)
  assert.equal(shouldSkipLucaInvoiceCreation('create', { no: '' }, true), false)
  assert.equal(shouldSkipLucaInvoiceCreation('create', null, false), false)
  assert.equal(shouldSkipLucaInvoiceCreation('send', { no: 'INV-1' }, false), false)
})
