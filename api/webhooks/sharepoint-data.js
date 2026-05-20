/**
 * Vercel API Endpoint: Power Automate Direct Data Webhook
 * Receives Excel data directly from Power Automate and stores it in the shared
 * in-memory store so /api/data can serve it immediately on the next poll.
 */

import { store } from '../_store.js'

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

function validateData(body) {
  const errors = []
  if (!body.revenue || !Array.isArray(body.revenue)) errors.push('Missing or invalid: revenue (should be array)')
  if (!body.cost || !Array.isArray(body.cost)) errors.push('Missing or invalid: cost (should be array)')
  if (!body.transactions || !Array.isArray(body.transactions)) errors.push('Missing or invalid: transactions (should be array)')
  if (!body.fte || !Array.isArray(body.fte)) errors.push('Missing or invalid: fte (should be array)')
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
    const validation = validateData(body)
    if (!validation.valid) {
      console.error('[Webhook] ❌ Validation errors:', validation.errors)
      return res.status(400).json({ error: 'Invalid data structure', details: validation.errors })
    }

    // Store directly in memory — no filesystem needed
    store.sampleData = sanitizeData({ revenue: body.revenue, cost: body.cost })
    store.transactionFteData = sanitizeData({ transactions: body.transactions, fte: body.fte })
    store.timestamp = Date.now().toString()
    store.source = 'power-automate'

    console.log('[Webhook] ✅ Data stored in memory')
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
