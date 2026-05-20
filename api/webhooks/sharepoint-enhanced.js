/**
 * Enhanced webhook handler with Power Automate support
 * 
 * This handler accepts requests from:
 * - Microsoft Graph webhooks
 * - Power Automate flows
 * - Any HTTP client
 */

import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { recordWebhookCall } from '../_last-webhook-call.js'

const lastSyncTimeFile = path.join(process.cwd(), '.webhook-last-sync.json')

// Cache files for Power Automate data
const tmpDir = os.tmpdir()
const sampleDataCache = path.join(tmpDir, 'sampleData.json')
const txnFteCache = path.join(tmpDir, 'transactionFteData.json')
const metadataCache = path.join(tmpDir, 'sync-metadata.json')

function recordSync(source = 'unknown') {
  const data = {
    lastSyncTime: new Date().toISOString(),
    source, // 'webhook', 'power-automate', 'manual'
    nextAllowedSync: new Date(Date.now() + 30000).toISOString(), // 30 sec cooldown
  }
  try {
    fs.writeFileSync(lastSyncTimeFile, JSON.stringify(data))
  } catch (e) {
    console.error('Failed to record sync time:', e)
  }
}

function canSync() {
  try {
    if (fs.existsSync(lastSyncTimeFile)) {
      const data = JSON.parse(fs.readFileSync(lastSyncTimeFile, 'utf8'))
      return new Date() > new Date(data.nextAllowedSync)
    }
  } catch (e) {
    // ignore
  }
  return true
}

async function runSync() {
  if (!canSync()) {
    console.log('[Webhook] Sync cooldown active, skipping')
    return { success: false, reason: 'cooldown' }
  }

  return new Promise((resolve) => {
    console.log('[Webhook] Triggering SharePoint sync...')
    const proc = spawn('npm', ['run', 'sync-data'], {
      cwd: process.cwd(),
      stdio: 'pipe',
      timeout: 120000, // 2 min timeout
    })

    let output = ''
    let errorOutput = ''
    
    proc.stdout?.on('data', (data) => {
      output += data.toString()
    })
    proc.stderr?.on('data', (data) => {
      errorOutput += data.toString()
    })

    proc.on('exit', (code) => {
      recordSync()
      if (code === 0) {
        console.log('[Webhook] ✅ Sync completed successfully')
        resolve({ 
          success: true, 
          message: 'Data synced successfully',
          timestamp: new Date().toISOString(),
          output: output.slice(-500) // Last 500 chars
        })
      } else {
        console.error('[Webhook] ❌ Sync failed with code:', code)
        resolve({ 
          success: false, 
          error: 'Sync command failed',
          code,
          timestamp: new Date().toISOString(),
          errorOutput: errorOutput.slice(-500)
        })
      }
    })

    proc.on('error', (err) => {
      recordSync()
      console.error('[Webhook] Process error:', err)
      resolve({ 
        success: false, 
        error: err.message,
        timestamp: new Date().toISOString()
      })
    })
  })
}

export default async function handler(req, res) {
  console.log(`[Webhook] ${req.method} request received from Power Automate or Graph`)

  // CORS headers for Power Automate
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method === 'POST') {
    // Record this call for diagnostics
    recordWebhookCall(req)
    
    // Microsoft Graph validation token
    if (req.query?.validationToken) {
      console.log('[Webhook] 🔐 Microsoft Graph validation request')
      res.setHeader('Content-Type', 'text/plain')
      return res.status(200).send(req.query.validationToken)
    }

    const body = req.body || {}
    
    // Also check body for validation token
    if (body.validationToken) {
      console.log('[Webhook] 🔐 Validation token in body')
      res.setHeader('Content-Type', 'text/plain')
      return res.status(200).send(body.validationToken)
    }

    // Detect request source
    let source = 'unknown'
    if (req.headers['x-power-automate-source']) {
      source = 'power-automate'
    } else if (body.value && Array.isArray(body.value)) {
      source = 'microsoft-graph'
    }

    console.log(`[Webhook] Source: ${source}`)

    // Handle Microsoft Graph notifications
    if (body.value && Array.isArray(body.value)) {
      for (const notification of body.value) {
        if (notification.resourceData) {
          console.log('[Webhook] 📢 File change detected via Graph!')
          console.log(`        Resource: ${notification.resource}`)
          console.log(`        Change Type: ${notification.changeType}`)
        }
      }
    }
    
    // Handle Power Automate direct data requests (NEW)
    // This handles both formats:
    // - Direct arrays: {revenue: [...], cost: [...]}
    // - Wrapped arrays: {revenue: {value: [...]}}
    if (body.revenue || body.cost || body.transactions || body.fte) {
      console.log('[Webhook] 📊 Power Automate sent Excel data!')
      
      // Helper to extract array from various formats
      const getArray = (val) => {
        if (Array.isArray(val)) return val
        if (val?.value && Array.isArray(val.value)) return val.value
        if (val?.data && Array.isArray(val.data)) return val.data
        return []
      }
      
      const revenue = getArray(body.revenue)
      const cost = getArray(body.cost)
      const transactions = getArray(body.transactions)
      const fte = getArray(body.fte)
      
      console.log(`        Revenue rows: ${revenue.length}`)
      console.log(`        Cost rows: ${cost.length}`)
      console.log(`        Transactions rows: ${transactions.length}`)
      console.log(`        FTE rows: ${fte.length}`)
      
      // Extract and store the data
      try {
        const { store: dataStore } = await import('../_store.js')
        
        // Sanitize
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
        
        const sampleData = sanitizeData({ revenue, cost })
        const transactionFteData = sanitizeData({ transactions, fte })
        const timestamp = Date.now().toString()
        
        // Store in memory
        dataStore.sampleData = sampleData
        dataStore.transactionFteData = transactionFteData
        dataStore.timestamp = timestamp
        dataStore.source = 'power-automate-direct'
        
        // Also write to /tmp for persistence
        try {
          fs.writeFileSync(sampleDataCache, JSON.stringify(sampleData, null, 2))
          fs.writeFileSync(txnFteCache, JSON.stringify(transactionFteData, null, 2))
          fs.writeFileSync(metadataCache, JSON.stringify({ 
            syncedAt: new Date().toISOString(), 
            timestamp, 
            source: 'power-automate-direct' 
          }, null, 2))
          console.log('[Webhook] ✅ Data cached to /tmp')
        } catch (cacheErr) {
          console.warn('[Webhook] ⚠️  Could not write /tmp cache:', cacheErr.message)
        }
        
        console.log('[Webhook] ✅ Data stored in memory and ready for dashboard')
      } catch (e) {
        console.warn('[Webhook] ⚠️  Could not store direct data:', e.message)
      }
    }
    
    // Handle Power Automate file change notifications
    if (body.changeType || body.fileName || body.timestamp) {
      console.log('[Webhook] 📢 File change detected via Power Automate!')
      if (body.fileName) console.log(`        File: ${body.fileName}`)
      if (body.changeType) console.log(`        Change Type: ${body.changeType}`)
    }

    // Trigger sync only if NOT receiving direct data
    let syncResult = { success: true, message: 'Data received (no sync needed)' }
    if (!body.revenue) {
      syncResult = await runSync()
    }
    recordSync(source)

    // Return result to Power Automate
    res.setHeader('Content-Type', 'application/json')
    return res.status(200).json({
      success: syncResult.success,
      message: syncResult.success ? 'Dashboard data updated' : 'Sync failed',
      ...syncResult,
      source,
    })
  }

  if (req.method === 'GET') {
    // Health check endpoint for Power Automate
    res.setHeader('Content-Type', 'application/json')
    return res.status(200).json({
      status: 'webhook-active',
      endpoint: '/api/webhooks/sharepoint',
      lastSync: fs.existsSync(lastSyncTimeFile) 
        ? JSON.parse(fs.readFileSync(lastSyncTimeFile, 'utf8')).lastSyncTime 
        : null,
      timestamp: new Date().toISOString()
    })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
