import dotenv from 'dotenv'
import mongoose from 'mongoose'
import * as logger from '../utils/logger.js'

dotenv.config()

let transactionsSupported = false

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pos_saas'
  try {
    await mongoose.connect(uri)
    logger.info('MongoDB connected')
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
  }
}

export const isMongoTransactionsSupported = () => transactionsSupported
