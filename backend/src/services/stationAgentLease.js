export const STATION_AGENT_LEASE_MS = 60_000

export const buildStationAgentLeaseFilter = ({ stationId, agentId, now = new Date(), leaseMs = STATION_AGENT_LEASE_MS }) => ({
  _id: stationId,
  $or: [
    { agentOwnerId: '' },
    { agentOwnerId: agentId },
    { agentLeaseAt: null },
    { agentLeaseAt: { $lt: new Date(now.getTime() - leaseMs) } }
  ]
})

export const stationAgentOwnerChanged = (currentOwnerId, requestedAgentId) => String(currentOwnerId || '') !== String(requestedAgentId || '')
