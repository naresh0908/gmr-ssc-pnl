/**
 * Vercel API Endpoint: Power Automate Direct Data Webhook
 * 
 * Receives Excel data directly from Power Automate (no auth needed).
 * Writes data to src/data files for immediate dashboard refresh.
 */

import fs from 'fs'
import path from 'path'

const repoRoot = process.cwd()
const sampleDataOut = path.join(repoRoot, 'src', 'data', 'sampleData.js')
const txnFteOut = path.join(repoRoot, 'src', 'data', 'transactionFteData.js')

/**
 * Write data to module file
 */
function writeModule(filePath, exportName, data, source) {
  try {
    const timestamp = new Date().toISOString()
    const content = `// Auto-generated from ${source} at ${timestamp}. Do not edit by hand.\nexport const ${exportName} = ${JSON.stringify(data, null, 2)};\n`
    fs.writeFileSync(filePath, content, 'utf8')
    console.log(`✅ Written: ${filePath}`)
    return true
  } catch (e) {
    console.error(`❌ Error writing ${filePath}:`, e.message)
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

/**
 * Parse JSON if string, return data otherwise
 */
function parseData(str) {
  if (typeof str === 'string') {
    try {
      return JSON.parse(str)
    } catch (e) {
      throw new Error(`Invalid JSON: ${e.message}`)
    }
  }
  return str
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

    // Write revenue & cost
    const sampleOk = writeModule(
      sampleDataOut,
      'sampleData',
      {
        revenue: body.revenue,
        cost: body.cost,
      },
      'Power Automate'
    )

    // Write transactions & FTE
    const txnFteOk = writeModule(
      txnFteOut,
      'transactionFteData',
      {
        transactions: body.transactions,
        fte: body.fte,
      },
      'Power Automate'
    )

    if (!sampleOk || !txnFteOk) {
      console.error('[Webhook] ❌ Failed to write all files')
      return res.status(500).json({ error: 'Failed to write data files' })
    }

    console.log('[Webhook] ✅ Data synced successfully')
    console.log(`   Revenue: ${body.revenue.length} rows`)
    console.log(`   Cost: ${body.cost.length} rows`)
    console.log(`   Transactions: ${body.transactions.length} rows`)
    console.log(`   FTE: ${body.fte.length} rows`)

    // Return 200 to Power Automate immediately
    return res.status(200).json({
      success: true,
      message: 'Data synced',
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
