const roundMoney = value => Math.round((Number(value) || 0) * 100) / 100
const toCents = value => Math.round((Number(value) || 0) * 100)

function getLegacySkipDeduction(skip, installmentAmount) {
  const deduction = Number(skip?.deductedAmount)
  if (Number.isFinite(deduction)) return Math.max(0, deduction)
  return (skip?.period || 'full') === 'full' ? installmentAmount : roundMoney(installmentAmount / 2)
}

export function getPlanGrossTotal(plan = {}) {
  const total = roundMoney(plan.total)
  const count = Math.max(1, Number(plan.installments) || 1)
  const evenAmount = roundMoney(total / count)
  const legacyDeductions = (Array.isArray(plan.skippedInstallments) ? plan.skippedInstallments : [])
    .filter(skip => skip?.deductionOnly !== true)
    .reduce((sum, skip) => {
      const originalAmount = Number(skip?.originalAmount) > 0 ? Number(skip.originalAmount) : evenAmount
      return sum + Math.min(originalAmount, getLegacySkipDeduction(skip, originalAmount))
    }, 0)
  return roundMoney(total + legacyDeductions)
}

export function getPlanInstallmentGrossAmount(plan = {}, installmentNo) {
  const count = Math.max(1, Number(plan.installments) || 1)
  const schedule = Array.isArray(plan.installmentSchedule) ? plan.installmentSchedule : []
  const installment = schedule.length === count
    ? schedule.find(row => Number(row?.no) === Number(installmentNo))
    : null
  if (installment) return roundMoney(installment.amount)

  const grossTotal = getPlanGrossTotal(plan)
  const evenAmount = roundMoney(grossTotal / count)
  const assignedBefore = roundMoney(evenAmount * (count - 1))
  return Number(installmentNo) === count
    ? roundMoney(grossTotal - assignedBefore)
    : evenAmount
}

export function getPlanInstallmentAmount(plan = {}, installmentNo) {
  const installmentAmount = getPlanInstallmentGrossAmount(plan, installmentNo)
  const skip = (Array.isArray(plan.skippedInstallments) ? plan.skippedInstallments : [])
    .find(row => Number(row?.no) === Number(installmentNo))
  if (!skip) return installmentAmount
  const deduction = skip?.deductionOnly === true
    ? Math.max(0, Number(skip.deductedAmount) || 0)
    : getLegacySkipDeduction(skip, installmentAmount)
  return roundMoney(Math.max(0, installmentAmount - Math.min(installmentAmount, deduction)))
}

export function validateAnaokuluPlanSchedules(students = []) {
  students.forEach(student => {
    ;(student.items || []).forEach(plan => {
      const count = Number(plan.installments)
      if (!Number.isInteger(count) || count < 1) {
        throw new Error(`${plan.name || 'Ücret planı'} için taksit sayısı en az 1 olmalıdır.`)
      }

      const total = Number(plan.total)
      if (!Number.isFinite(total) || total < 0 || Math.abs(total * 100 - Math.round(total * 100)) > 0.000001) {
        throw new Error(`${plan.name || 'Ücret planı'} için net ücret geçersiz.`)
      }

      const schedule = plan.installmentSchedule
      if (!Array.isArray(schedule) || schedule.length === 0) return
      if (schedule.length !== count) {
        throw new Error(`${plan.name || 'Ücret planı'} için taksit satırı sayısı taksit sayısıyla eşleşmelidir.`)
      }

      let sumCents = 0
      schedule.forEach((installment, index) => {
        if (Number(installment.no) !== index + 1) {
          throw new Error(`${plan.name || 'Ücret planı'} taksit sırası geçersiz.`)
        }
        const dueDate = String(installment.dueDate || '')
        const parsedDueDate = /^\d{4}-\d{2}-\d{2}$/.test(dueDate)
          ? new Date(`${dueDate}T00:00:00.000Z`)
          : null
        if (!parsedDueDate || Number.isNaN(parsedDueDate.getTime()) || parsedDueDate.toISOString().slice(0, 10) !== dueDate) {
          throw new Error(`${plan.name || 'Ücret planı'} ${index + 1}. taksit vade tarihi geçersiz.`)
        }
        const amount = Number(installment.amount)
        if (!Number.isFinite(amount) || amount < 0 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001) {
          throw new Error(`${plan.name || 'Ücret planı'} ${index + 1}. taksit tutarı geçersiz.`)
        }
        sumCents += toCents(amount)
      })

      const expectedCents = toCents(getPlanGrossTotal(plan))
      if (sumCents !== expectedCents) {
        const difference = (expectedCents - sumCents) / 100
        const formattedDifference = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(difference)
        throw new Error(`${plan.name || 'Ücret planı'} taksit toplamı net ücretle kuruşu kuruşuna eşleşmelidir. Fark: ${formattedDifference}.`)
      }
    })
  })
}
