export const LUCA_UNCLAIMED_JOB_STALE_MS = 90 * 1000
export const LUCA_CLAIMED_JOB_STALE_MS = 5 * 60 * 1000

export const isLucaInvoiceJobStale = (job, now = Date.now()) => {
  if (job?.status !== 'running' || !['create', 'send'].includes(job?.kind)) return false

  if (job.phase === 'waiting_extension') {
    return now - Number(job.startedAt || 0) > LUCA_UNCLAIMED_JOB_STALE_MS
  }

  if (job.phase === 'extension_claimed') {
    const lastActivityAt = Number(job.activityAt || job.claimedAt || job.startedAt || 0)
    return !lastActivityAt || now - lastActivityAt > LUCA_CLAIMED_JOB_STALE_MS
  }

  return false
}

export const expireLucaInvoiceJob = (job, now = Date.now()) => ({
  ...job,
  status: 'error',
  phase: 'completed',
  error: 'Luca görevi zaman aşımına uğradı. Tamamlanan faturalar korundu; kalan satırlar tekrar denenebilir.',
  retryableSourceKeys: getLucaInvoiceRetryableSourceKeys(job),
  finishedAt: now,
  extensionToken: undefined,
  extensionTokenHash: undefined,
  resultTokenHash: undefined
})

export const getLucaInvoiceRetryableSourceKeys = (job) => {
  const completedStatuses = new Set([
    'draft_created',
    'awaiting_approval',
    'sent',
    'verified',
    'checking'
  ])
  const results = new Map(
    (Array.isArray(job?.results) ? job.results : [])
      .map(result => [String(result?.sourceKey || ''), result])
  )
  return (Array.isArray(job?.items) ? job.items : [])
    .filter(item => {
      const result = results.get(String(item?.sourceKey || ''))
      return !result || !completedStatuses.has(result.status)
    })
    .map(item => String(item?.sourceKey || ''))
    .filter(Boolean)
}

export const shouldSkipLucaInvoiceCreation = (action, previous, previousHasNo) => (
  action === 'create' && Boolean(previous) && !previousHasNo
)
