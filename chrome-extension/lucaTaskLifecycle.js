globalThis.lucaTaskLockMatches = (current, jobId) => {
  const expectedJobId = String(jobId || '').trim()
  return Boolean(current && expectedJobId && String(current.jobId || '') === expectedJobId)
}

globalThis.shouldReleaseLucaTaskLockAfterClaimFailure = (task, taskTabMatches) => (
  Boolean(taskTabMatches && task && ['create', 'send'].includes(task.kind))
)

globalThis.getLucaInvoiceTaskPeriod = (result, kind) => {
  const taskPeriod = String(result?.period || '').trim()
  if (taskPeriod) return taskPeriod
  if (!['create', 'send'].includes(String(kind || ''))) return ''

  const items = Array.isArray(result?.items) ? result.items : []
  const periodItem = items.find(item => String(item?.period || '').trim())
  return String(periodItem?.period || '').trim()
}
