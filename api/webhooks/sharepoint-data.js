/**
 * Vercel API Endpoint: Power Automate Direct Data Webhook
 * 
 * Receives Excel data directly from Power Automate (no auth needed).
 * Stores data in /tmp (Vercel's temporary storage) for dashboard retrieval.
 * 
 * Note: Vercel's filesystem is READ-ONLY for src/dist. We use /tmp instead.
 */

import fs from 'fs'
import path from 'path'
import os from 'os'

// Use /tmp directory (writable on Vercel)
const tmpDir = os.tmpdir()
const sampleDataCache = path.join(tmpDir, 'sampleData.json')
const txnFteCache = path.join(tmpDir, 'transactionFteData.json')
const metadataCache = path.join(tmpDir, 'sync-metadata.json')

/**
 * Sanitize data for JSON serialization
 * Removes problematic values like undefined, NaN, Infinity
 */
function sanitizeData(obj) {
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeData(item))
  }
  if (obj !== null && typeof obj === 'object') {
    const cleaned = {}
    for (const [key, value] of Object.entries(obj)) {
      cleaned[key] = sanitizeData(value)
    }
    return cleaned
  }
  // Handle primitive values
  if (typeof obj === 'number') {
    if (!isFinite(obj)) return null  // NaN, Infinity → null
    return obj
  }
  if (typeof obj === 'string') {
    // Ensure string doesn't have problematic characters
    return String(obj).trim()
  }
  return obj
}

/**
 * Write data to temp cache
 */
function writeCache(filePath, data) {
  try {
    // Sanitize before writing
    const sanitized = sanitizeData(data)
    const json = JSON.stringify(sanitized, null, 2)
    fs.writeFileSync(filePath, json, 'utf8')
    console.log(`✅ Cached: ${path.basename(filePath)} (${json.length} bytes)`)
    return true
  } catch (e) {
    console.error(`❌ Error caching to ${filePath}:`, e.message)
    return false
  }
}

/**
 * Validate data structure
 */
function validateData(body) {
  const errors = []

  if (!body.revenue || !Array.isArray(body.revenue)) {
    errors.push('Missing or invalid: revenue (should be array)')
  }

  if (!body.cost || !Array.isArray(body.cost)) {
    errors.push('Missing or invalid: cost (should be array)')
  }

  if (!body.transactions || !Array.isArray(body.transactions)) {
    errors.push('Missing or invalid: transactions (should be array)')
  }

  if (!body.fte || !Array.isArray(body.fte)) {
    errors.push('Missing or invalid: fte (should be array)')
  }

  return { valid: errors.length === 0, errors }
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // Health check
  if (req.method === 'GET') {
    console.log('[Webhook] Health check')
    return res.status(200).json({ status: 'ok', message: 'Power Automate data webhook ready' })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('[Webhook] 📥 Data received from Power Automate')

    const body = req.body || {}

    // Validate structure
    const validation = validateData(body)
    if (!validation.valid) {
      console.error('[Webhook] ❌ Validation errors:', validation.errors)
      return res.status(400).json({
        error: 'Invalid data structure',
        details: validation.errors,
      })
    }

    // Cache in /tmp (Vercel writable directory)
    console.log('[Webhook] Sanitizing and caching data...')
    
    const sampleOk = writeCache(
      sampleDataCache,
      {
        revenue: body.revenue,
        cost: body.cost,
      }
    )

    const txnFteOk = writeCache(
      txnFteCache,
      {
        transactions: body.transactions,
        fte: body.fte,
      }
    )

    // Write metadata with timestamp
    const metaOk = writeCache(
      metadataCache,
      {
        syncedAt: new Date().toISOString(),
        timestamp: Date.now().toString(),
        source: 'power-automate',
        rows: {
          revenue: body.revenue.length,
          cost: body.cost.length,
          transactions: body.transactions.length,
          fte: body.fte.length,
        },
      }
    )

    if (!sampleOk || !txnFteOk || !metaOk) {
      console.error('[Webhook] ❌ Failed to cache all data')
      return res.status(500).json({ error: 'Failed to cache data' })
    }

    console.log('[Webhook] ✅ Data cached successfully (in /tmp)')
    console.log(`   Revenue: ${body.revenue.length} rows`)
    console.log(`   Cost: ${body.cost.length} rows`)
    console.log(`   Transactions: ${body.transactions.length} rows`)
    console.log(`   FTE: ${body.fte.length} rows`)

    // Return 200 to Power Automate immediately
    return res.status(200).json({
      success: true,
      message: 'Data synced',
      cacheLocation: '/tmp (Vercel temp storage)',
      rows: {
        revenue: body.revenue.length,
        cost: body.cost.length,
        transactions: body.transactions.length,
        fte: body.fte.length,
      },
    })
  } catch (error) {
    console.error('[Webhook] ❌ Error:', error.message)
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    })
  }
}
