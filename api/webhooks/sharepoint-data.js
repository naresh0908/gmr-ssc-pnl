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
const webhookDiagnostics = path.join(tmpDir, 'webhook-call-diagnostics.json')

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
  
  // Helper to extract array from various formats
  const getArray = (val) => {
    if (Array.isArray(val)) return val
    if (val?.value && Array.isArray(val.value)) return val.value
    if (val?.data && Array.isArray(val.data)) return val.data
    return null
  }
  
  // Try to extract arrays - be VERY permissive
  const revenue = getArray(body.revenue)
  const cost = getArray(body.cost)
  const transactions = getArray(body.transactions)
  const fte = getArray(body.fte)
  
  if (!revenue) {
    errors.push('Could not find revenue array in: ' + JSON.stringify(body.revenue?.constructor?.name || typeof body.revenue))
  }
  if (!cost) {
    errors.push('Could not find cost array')
  }
  if (!transactions) {
    errors.push('Could not find transactions array')
  }
  if (!fte) {
    errors.push('Could not find fte array')
  }

  return { 
    valid: errors.length === 0, 
    errors,
    extracted: { revenue, cost, transactions, fte }
  }
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
    console.log('[Webhook] Body type:', typeof body)
    console.log('[Webhook] Is array?', Array.isArray(body))
    console.log('[Webhook] Body keys:', Object.keys(body))
    console.log('[Webhook] Full body JSON:')
    try {
      const bodyJson = JSON.stringify(body, null, 2)
      // Log in chunks if too large
      if (bodyJson.length > 2000) {
        console.log(bodyJson.substring(0, 2000))
        console.log(`... (truncated, total: ${bodyJson.length} chars)`)
      } else {
        console.log(bodyJson)
      }
    } catch (e) {
      console.log('[Webhook] Could not stringify body:', e.message)
    }
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
    
    console.log('[Webhook] Validation result:', {
      valid: validation.valid,
      errors: validation.errors,
      extractedArrays: {
        revenue: validation.extracted.revenue?.length || 0,
        cost: validation.extracted.cost?.length || 0,
        transactions: validation.extracted.transactions?.length || 0,
        fte: validation.extracted.fte?.length || 0,
      }
    })
    
    if (!validation.valid) {
      console.error('[Webhook] ❌ Validation FAILED!')
      console.error('[Webhook] Validation errors:', validation.errors)
      console.error('[Webhook] Returning 400 error')
      return res.status(400).json({ error: 'Invalid data structure', details: validation.errors })
    }
    
    console.log('[Webhook] ✅ Validation PASSED')

    // Record this webhook call to /tmp for diagnostics
    try {
      fs.writeFileSync(webhookDiagnostics, JSON.stringify({
        timestamp: new Date().toISOString(),
        success: true,
        bodyKeys: Object.keys(body),
        extractedArrayLengths: {
          revenue: validation.extracted.revenue.length,
          cost: validation.extracted.cost.length,
          transactions: validation.extracted.transactions.length,
          fte: validation.extracted.fte.length,
        }
      }, null, 2))
      console.log('[Webhook] 📝 Recorded call to /tmp diagnostics')
    } catch (diagErr) {
      console.warn('[Webhook] Could not write diagnostics:', diagErr.message)
    }

    // Use the EXTRACTED arrays (handles both direct and wrapped formats)
    const sampleData = sanitizeData({ 
      revenue: validation.extracted.revenue, 
      cost: validation.extracted.cost 
    })
    const transactionFteData = sanitizeData({ 
      transactions: validation.extracted.transactions, 
      fte: validation.extracted.fte 
    })
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
    console.log(`   Revenue: ${validation.extracted.revenue.length} rows`)
    console.log(`   Cost: ${validation.extracted.cost.length} rows`)
    console.log(`   Transactions: ${validation.extracted.transactions.length} rows`)
    console.log(`   FTE: ${validation.extracted.fte.length} rows`)

    return res.status(200).json({
      success: true,
      message: 'Data received and ready for dashboard',
      rows: {
        revenue: validation.extracted.revenue.length,
        cost: validation.extracted.cost.length,
        transactions: validation.extracted.transactions.length,
        fte: validation.extracted.fte.length,
      },
    })
  } catch (error) {
    console.error('[Webhook] ❌ Error:', error.message)
    return res.status(500).json({ error: 'Internal server error', message: error.message })
  }
}
