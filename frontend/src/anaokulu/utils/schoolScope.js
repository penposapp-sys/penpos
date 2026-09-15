export const mergeAnaokuluResponses = (results = []) => {
  const allStudents = []
  const allCollections = []
  const allInvoices = []
  const allChecks = []

  results.forEach(({ tenant, data }) => {
    if (!data) return
    const schoolId = String(tenant.id || tenant._id)
    const schoolName = tenant.name || 'İsimsiz Okul'
    ;(data.students || []).forEach((student) => {
      allStudents.push({ ...student, _schoolId: schoolId, _schoolName: schoolName })
    })
    ;(data.collections || []).forEach((collection) => {
      allCollections.push({ ...collection, _schoolId: schoolId, _schoolName: schoolName })
    })
    ;(data.invoices || []).forEach((invoice) => {
      allInvoices.push({ ...invoice, _schoolId: schoolId, _schoolName: schoolName })
    })
    ;(data.checks || []).forEach((check) => {
      allChecks.push({ ...check, _schoolId: schoolId, _schoolName: schoolName })
    })
  })

  return { students: allStudents, collections: allCollections, invoices: allInvoices, checks: allChecks }
}
