import test from 'node:test'
import assert from 'node:assert/strict'
import { buildStationAgentLeaseFilter, stationAgentOwnerChanged, STATION_AGENT_LEASE_MS } from '../src/services/stationAgentLease.js'

test('station agent lease allows an unowned station or its current owner', () => {
  const now = new Date('2026-10-27T10:00:00Z')
  const filter = buildStationAgentLeaseFilter({ stationId: 'station', agentId: 'agent-a', now })
  assert.equal(filter._id, 'station')
  assert.deepEqual(filter.$or.slice(0, 3), [
    { agentOwnerId: '' },
    { agentOwnerId: 'agent-a' },
    { agentLeaseAt: null }
  ])
  assert.deepEqual(filter.$or[3], { agentLeaseAt: { $lt: new Date(now.getTime() - STATION_AGENT_LEASE_MS) } })
})

test('station inventory is reset only when a different agent takes ownership', () => {
  assert.equal(stationAgentOwnerChanged('agent-a', 'agent-a'), false)
  assert.equal(stationAgentOwnerChanged('agent-a', 'agent-b'), true)
})
