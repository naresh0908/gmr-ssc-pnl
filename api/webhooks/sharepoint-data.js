/**
 * Vercel API Endpoint: Power Automate Direct Data Webhook
 * Receives Excel data directly from Power Automate and stores it in:
 * 1. In-memory store (for warm Lambda instances)
 * 2. /tmp files (for persistence across cold starts)
 */

import fs from 'fs'
import path from 'path'
import os from 'os'
import { store } from '../_store.js'

const tmpDir = os.tmpdir()
const sampleDataCache = path.join(tmpDir, 'sampleData.json')
const txnFteCache = path.join(tmpDir, 'transactionFteData.json')
const metadataCache = path.join(tmpDir, 'sync-metadata.json')

function sanitizeData(obj) {
  if (Array.isArray(obj)) return obj.map(sanitizeData)
  if (obj !== null && typeof obj === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(obj)) out[k] = sanitizeData(v)
    return out
  }
  if (typeof obj === 'number') return isFinite(obj) ? obj : null
  if (typeof obj === 'string') return obj.trim()
  return obj
}

function writeCache(filePath, data) {
  try {
    const sanitized = sanitizeData(data)
    const json = JSON.stringify(sanitized, null, 2)
    fs.writeFileSync(filePath, json, 'utf8')
    console.log(`✅ Cached to /tmp: ${path.basename(filePath)}`)
    return true
  } catch (e) {
    console.error(`❌ Error writing cache: ${e.message}`)
    return false
  }
}

function validateData(body) {
  const errors = []
  
  // Check if we have arrays
  if (!body.revenue) {
    errors.push('Missing: revenue')
  } else if (!Array.isArray(body.revenue)) {
    console.warn('[Webhook] Revenue is not an array:', typeof body.revenue, Object.keys(body.revenue || {}).slice(0, 5))
    errors.push('Invalid: revenue (not an array)')
  }
  
  if (!body.cost) {
    errors.push('Missing: cost')
  } else if (!Array.isArray(body.cost)) {
    console.warn('[Webhook] Cost is not an array:', typeof body.cost, Object.keys(body.cost || {}).slice(0, 5))
    errors.push('Invalid: cost (not an array)')
  }
  
  if (!body.transactions) {
    errors.push('Missing: transactions')
  } else if (!Array.isArray(body.transactions)) {
    console.warn('[Webhook] Transactions is not an array:', typeof body.transactions)
    errors.push('Invalid: transactions (not an array)')
  }
  
  if (!body.fte) {
    errors.push('Missing: fte')
  } else if (!Array.isArray(body.fte)) {
    console.warn('[Webhook] FTE is not an array:', typeof body.fte)
    errors.push('Invalid: fte (not an array)')
  }
  
  return { valid: errors.length === 0, errors }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'ok',
      message: 'Power Automate data webhook ready',
      hasData: !!store.sampleData,
      lastSync: store.timestamp,
    })
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    console.log('[Webhook] 📥 Data received from Power Automate')
    
    const body = req.body || {}
    
    // DEBUG: Log the entire body structure
    console.log('[Webhook] ============ RAW BODY ============')
    console.log('[Webhook] Body:', JSON.stringify(body, null, 2).substring(0, 500))
    console.log('[Webhook] Body keys:', Object.keys(body))
    console.log('[Webhook] ===================================')
    
    // Debug: log what we received
    console.log('[Webhook] Body revenue type:', typeof body.revenue, 'Is array?', Array.isArray(body.revenue))
    console.log('[Webhook] Body cost type:', typeof body.cost, 'Is array?', Array.isArray(body.cost))
    console.log('[Webhook] Body transactions type:', typeof body.transactions, 'Is array?', Array.isArray(body.transactions))
    console.log('[Webhook] Body fte type:', typeof body.fte, 'Is array?', Array.isArray(body.fte))
    
    if (body.revenue) {
      console.log('[Webhook] Revenue first item:', JSON.stringify(body.revenue[0]).substring(0, 200))
    }
    if (body.cost) {
      console.log('[Webhook] Cost first item:', JSON.stringify(body.cost[0]).substring(0, 200))
    }
    
    const validation = validateData(body)
    if (!validation.valid) {
      console.error('[Webhook] ❌ Validation FAILED!')
      console.error('[Webhook] Validation errors:', validation.errors)
      console.error('[Webhook] Returning 400 error')
      return res.status(400).json({ error: 'Invalid data structure', details: validation.errors })
    }
    
    console.log('[Webhook] ✅ Validation PASSED')

    // Sanitize data
    const sampleData = sanitizeData({ revenue: body.revenue, cost: body.cost })
    const transactionFteData = sanitizeData({ transactions: body.transactions, fte: body.fte })
    const timestamp = Date.now().toString()

    // 1. Store in /tmp for persistence across Lambda instances
    console.log('[Webhook] Writing to /tmp cache...')
    const sampleOk = writeCache(sampleDataCache, sampleData)
    const txnOk = writeCache(txnFteCache, transactionFteData)
    const metaOk = writeCache(metadataCache, { syncedAt: new Date().toISOString(), timestamp, source: 'power-automate' })

    console.log('[Webhook] /tmp write results:', { sampleOk, txnOk, metaOk })

    // 2. Also store in memory for fast access on warm instances
    console.log('[Webhook] Storing in memory...')
    store.sampleData = sampleData
    store.transactionFteData = transactionFteData
    store.timestamp = timestamp
    store.source = 'power-automate'
    
    console.log('[Webhook] Memory store updated:', {
      hasSampleData: !!store.sampleData,
      hasTransactionFteData: !!store.transactionFteData,
      timestamp: store.timestamp,
    })

    if (!sampleOk || !txnOk || !metaOk) {
      console.warn('[Webhook] ⚠️  Some writes failed, but data is in memory')
    }

    console.log('[Webhook] ✅ Data stored (memory + /tmp cache)')
    console.log(`   Revenue: ${body.revenue.length} rows`)
    console.log(`   Cost: ${body.cost.length} rows`)
    console.log(`   Transactions: ${body.transactions.length} rows`)
    console.log(`   FTE: ${body.fte.length} rows`)

    return res.status(200).json({
      success: true,
      message: 'Data received and ready for dashboard',
      rows: {
        revenue: body.revenue.length,
        cost: body.cost.length,
        transactions: body.transactions.length,
        fte: body.fte.length,
      },
    })
  } catch (error) {
    console.error('[Webhook] ❌ Error:', error.message)
    return res.status(500).json({ error: 'Internal server error', message: error.message })
  }
}
