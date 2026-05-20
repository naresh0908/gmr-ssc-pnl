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

const lastSyncTimeFile = path.join(process.cwd(), '.webhook-last-sync.json')

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
    
    // Handle Power Automate requests
    if (body.changeType || body.fileName || body.timestamp) {
      console.log('[Webhook] 📢 File change detected via Power Automate!')
      if (body.fileName) console.log(`        File: ${body.fileName}`)
      if (body.changeType) console.log(`        Change Type: ${body.changeType}`)
    }

    // Trigger sync
    const syncResult = await runSync()
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
