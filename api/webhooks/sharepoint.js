/**
 * Vercel API Endpoint: Microsoft Graph Webhook Handler
 * 
 * Receives real-time notifications from SharePoint when the tracked file changes.
 */

import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

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

  if (req.method === 'POST') {
    // Check for validation token in query parameters (Microsoft Graph sends it there)
    if (req.query?.validationToken) {
      console.log('[Webhook] 🔐 Validating subscription with token from query param')
      // Echo back the validation token as plain text (REQUIRED by Microsoft Graph)
      res.setHeader('Content-Type', 'text/plain')
      return res.status(200).send(req.query.validationToken)
    }

    const body = req.body || {}
    
    // Also check body in case validation token is there
    if (body.validationToken) {
      console.log('[Webhook] 🔐 Validating subscription with token from body')
      res.setHeader('Content-Type', 'text/plain')
      return res.status(200).send(body.validationToken)
    }

    // Handle file change notifications
    if (body.value && Array.isArray(body.value)) {
      for (const notification of body.value) {
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
    }

    // Return 202 for any other POST
    return res.status(202).json({ status: 'received' })
  }

  // GET for health check
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'webhook endpoint active' })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
