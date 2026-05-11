/**
 * Vercel API Endpoint: Microsoft Graph Webhook Handler
 * 
 * Receives real-time notifications from SharePoint when the tracked file changes.
 * 
 * Usage:
 *   POST /api/webhooks/sharepoint
 * 
 * Setup:
 *   node scripts/setup-webhook.mjs
 */

import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

// Store last sync time to avoid duplicate syncs
const lastSyncTimeFile = path.join(process.cwd(), '.webhook-last-sync.json')

function recordSync() {
  const data = {
    lastSyncTime: new Date().toISOString(),
    nextAllowedSync: new Date(Date.now() + 30000).toISOString(), // 30 sec cooldown
  }
  try {
    fs.writeFileSync(lastSyncTimeFile, JSON.stringify(data))
  } catch (e) {
    // ignore
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
    return
  }

  return new Promise((resolve) => {
    console.log('[Webhook] Triggering SharePoint sync...')
    const proc = spawn('npm', ['run', 'sync-data'], {
      cwd: process.cwd(),
      stdio: 'pipe',
    })

    let output = ''
    proc.stdout?.on('data', (data) => {
      output += data.toString()
    })
    proc.stderr?.on('data', (data) => {
      output += data.toString()
    })

    proc.on('exit', (code) => {
      recordSync()
      if (code === 0) {
        console.log('[Webhook] ✅ Sync completed')
      } else {
        console.error('[Webhook] ❌ Sync failed')
      }
      resolve(code)
    })
  })
}

export default async function handler(req, res) {
  console.log(`[Webhook] ${req.method} request received`)

  // Microsoft Graph sends a POST with validationToken during subscription setup
  if (req.method === 'POST') {
    const { value, validationToken } = req.body

    // Handle subscription validation (initial handshake)
    if (validationToken) {
      console.log('[Webhook] Validating subscription...')
      // Echo back the validation token as plain text
      return res.status(200).set('Content-Type', 'text/plain').send(validationToken)
    }

    // Handle file change notifications
    if (Array.isArray(value) && value.length > 0) {
      const notification = value[0]

      if (notification.resourceData) {
        console.log('[Webhook] 📢 File change detected!')
        console.log(`        Resource: ${notification.resource}`)
        console.log(`        Type: ${notification.changeType}`)

        // Run sync asynchronously (don't wait for it)
        runSync().catch(err => console.error('Sync error:', err))

        // Return 202 Accepted immediately
        return res.status(202).json({ status: 'accepted' })
      }
    }

    // Return success for other POST requests
    return res.status(202).json({ status: 'notification received' })
  }

  // GET for health check
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'webhook endpoint active' })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
