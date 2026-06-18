import dotenv from 'dotenv'
import mongoose from 'mongoose'
import * as logger from '../utils/logger.js'
import User from '../models/User.js'

dotenv.config()

let transactionsSupported = false

const syncUserIndexes = async () => {
  try {
    const collection = mongoose.connection.db.collection('users')
    const indexes = await collection.indexes()
    const legacyEmailUnique = indexes.find((idx) => idx.unique && idx.key && idx.key.email === 1 && Object.keys(idx.key).length === 1)
    if (legacyEmailUnique) {
      await collection.dropIndex(legacyEmailUnique.name)
      logger.info(`Dropped legacy users index: ${legacyEmailUnique.name}`)
    }
    await User.syncIndexes()
  } catch (err) {
    logger.warn('User index sync failed', err?.message || String(err))
  }
}

export const connectDB = async () => {
  const uri = (process.env.MONGODB_URI || process.env.MONGO_URI || '').trim()
  try {
    if (!uri) {
      throw new Error('MONGODB_URI is not configured')
    }
    await mongoose.connect(uri)
    logger.info('MongoDB connected', {
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host || null,
      name: mongoose.connection.name || null,
      port: mongoose.connection.port || null,
      nodeEnv: process.env.NODE_ENV || null
    })
    await syncUserIndexes()
    try {
      const admin = mongoose.connection.db.admin()
      let info
      try {
        info = await admin.command({ hello: 1 })
      } catch {
        info = await admin.command({ isMaster: 1 })
      }
      const isReplicaSet = !!info.setName
      transactionsSupported = isReplicaSet
      logger.info(`MongoDB transactionsSupported=${transactionsSupported}`)
    } catch (e) {
      logger.warn('MongoDB replica set detection failed', e.message)
      transactionsSupported = false
    }
  } catch (err) {
    logger.error('MongoDB connection failed', err.message)
    throw err
  }
}

export const isMongoTransactionsSupported = () => transactionsSupported
