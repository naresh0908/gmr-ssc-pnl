/**
 * Debug endpoint - shows current state of all storage
 */
import fs from 'fs'
import path from 'path'
import os from 'os'
import { store } from './_store.js'

const tmpDir = os.tmpdir()
const sampleDataCache = path.join(tmpDir, 'sampleData.json')
const txnFteCache = path.join(tmpDir, 'transactionFteData.json')
const metadataCache = path.join(tmpDir, 'sync-metadata.json')

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Content-Type', 'application/json')

  try {
    const debug = {
      timestamp: new Date().toISOString(),
      
      // In-memory store
      memory: {
        hasSampleData: !!store.sampleData,
        hasTransactionFteData: !!store.transactionFteData,
        timestamp: store.timestamp,
        source: store.source,
        sampleDataRows: {
          revenue: store.sampleData?.revenue?.length || 0,
          cost: store.sampleData?.cost?.length || 0,
        },
        transactionFteDataRows: {
          transactions: store.transactionFteData?.transactions?.length || 0,
          fte: store.transactionFteData?.fte?.length || 0,
        },
      },

      // /tmp cache
      tmpCache: {
        sampleDataExists: fs.existsSync(sampleDataCache),
        txnFteDataExists: fs.existsSync(txnFteCache),
        metadataExists: fs.existsSync(metadataCache),
      },
    }

    // Try to read /tmp files
    if (fs.existsSync(sampleDataCache)) {
      try {
        const data = JSON.parse(fs.readFileSync(sampleDataCache, 'utf8'))
        debug.tmpCache.sampleData = {
          revenue: data.revenue?.length || 0,
          cost: data.cost?.length || 0,
        }
      } catch (e) {
        debug.tmpCache.sampleDataError = e.message
      }
    }

    if (fs.existsSync(txnFteCache)) {
      try {
        const data = JSON.parse(fs.readFileSync(txnFteCache, 'utf8'))
        debug.tmpCache.transactionFteData = {
          transactions: data.transactions?.length || 0,
          fte: data.fte?.length || 0,
        }
      } catch (e) {
        debug.tmpCache.txnFteDataError = e.message
      }
    }

    if (fs.existsSync(metadataCache)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metadataCache, 'utf8'))
        debug.tmpCache.metadata = meta
      } catch (e) {
        debug.tmpCache.metadataError = e.message
      }
    }

    return res.status(200).json(debug)
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
