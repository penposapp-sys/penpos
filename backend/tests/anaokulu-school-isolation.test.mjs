import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import dotenv from 'dotenv'

dotenv.config()

await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 })
try {
  const tenants = await mongoose.connection.db.collection('tenants').find({
    $or: [{ systemType: 'anaokulu' }, { vertical: 'anaokulu' }, { businessType: 'anaokulu' }]
  }).project({ _id: 1, name: 1 }).toArray()
  const schools = await mongoose.connection.db.collection('anaokuluschools').find({
    tenant: { $in: tenants.map((tenant) => tenant._id) }
  }).project({ tenant: 1, students: 1, collections: 1, invoices: 1 }).toArray()
  const schoolByTenant = new Map(schools.map((school) => [String(school.tenant), school]))

  const plannedForStudent = (student) => (student.items || []).reduce((sum, item) => sum + Number(item.total || 0), 0)

  assert.equal(schoolByTenant.size, schools.length)
  for (const tenant of tenants) {
    const school = schoolByTenant.get(String(tenant._id))
    if (school) {
      assert.ok(Array.isArray(school.students))
      assert.ok(Array.isArray(school.collections))
      assert.ok(Array.isArray(school.invoices))
    }
  }

  console.log(JSON.stringify({
    status: 'PASS',
    schools: tenants.map((tenant) => ({
      name: tenant.name,
      studentCount: schoolByTenant.get(String(tenant._id))?.students?.length || 0,
      collectionCount: schoolByTenant.get(String(tenant._id))?.collections?.length || 0,
      invoiceCount: schoolByTenant.get(String(tenant._id))?.invoices?.length || 0,
      planned: (schoolByTenant.get(String(tenant._id))?.students || []).reduce((sum, student) => sum + plannedForStudent(student), 0),
      paid: (schoolByTenant.get(String(tenant._id))?.collections || []).reduce((sum, collection) => sum + Number(collection.amount || 0), 0),
      remaining: (schoolByTenant.get(String(tenant._id))?.students || []).reduce((sum, student) => sum + plannedForStudent(student), 0) - (schoolByTenant.get(String(tenant._id))?.collections || []).reduce((sum, collection) => sum + Number(collection.amount || 0), 0),
      invoicedStudentCount: new Set((schoolByTenant.get(String(tenant._id))?.invoices || []).map((invoice) => String(invoice.studentId)).filter(Boolean)).size
    }))
  }, null, 2))
} finally {
  await mongoose.disconnect()
}
