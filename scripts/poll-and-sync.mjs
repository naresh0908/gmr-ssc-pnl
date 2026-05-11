#!/usr/bin/env node
/**
 * Polling service: Monitors SharePoint file for changes
 * and syncs data automatically at configurable intervals.
 * 
 * Run: node scripts/poll-and-sync.mjs
 * 
 * Configuration via .env:
 *   SYNC_POLL_INTERVAL=300000   (5 minutes, in milliseconds)
 *   SYNC_ON_STARTUP=true        (sync immediately on start)
 */

import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import 'dotenv/config.js'

const POLL_INTERVAL = parseInt(process.env.SYNC_POLL_INTERVAL || '300000', 10) // 5 min default
const SYNC_ON_STARTUP = process.env.SYNC_ON_STARTUP !== 'false'
const repoRoot = process.cwd()
const lastModifiedFile = path.join(repoRoot, '.last-sync-check.json')

let isRunning = false
let lastSyncTime = null

function getLastSyncTime() {
  try {
    if (fs.existsSync(lastModifiedFile)) {
      const data = JSON.parse(fs.readFileSync(lastModifiedFile, 'utf8'))
      return new Date(data.syncedAt)
    }
  } catch (e) {
    // ignore
  }
  return null
}

async function runSync() {
  if (isRunning) {
    console.log(`⏳ Sync already running, skipping...`)
    return
  }

  isRunning = true
  const now = new Date()
  console.log(`\n🔄 [${now.toLocaleTimeString()}] Running sync check...`)

  return new Promise((resolve) => {
    const proc = spawn('npm', ['run', 'sync-data'], {
      cwd: repoRoot,
      stdio: 'inherit',
    })

    proc.on('exit', (code) => {
      isRunning = false
      if (code === 0) {
        lastSyncTime = getLastSyncTime()
        console.log(`✅ Sync completed`)
      } else {
        console.error(`❌ Sync failed with code ${code}`)
      }
      resolve(code)
    })

    proc.on('error', (err) => {
      isRunning = false
      console.error(`❌ Sync error: ${err.message}`)
      resolve(1)
    })
  })
}

async function startPolling() {
  console.log(`\n📡 SharePoint Polling Service Started`)
  console.log(`   Interval: ${POLL_INTERVAL / 1000}s (${POLL_INTERVAL / 60000} min)`)
  console.log(`   Config: SYNC_POLL_INTERVAL=${POLL_INTERVAL}`)
  console.log(`   Initial sync: ${SYNC_ON_STARTUP ? 'enabled' : 'disabled'}`)
  console.log(`\n   Press Ctrl+C to stop\n`)

  // Optional: sync immediately on startup
  if (SYNC_ON_STARTUP) {
    await runSync()
  }

  // Set up recurring polling
  setInterval(() => {
    runSync()
  }, POLL_INTERVAL)
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(`\n\n👋 Polling service stopped`)
  process.exit(0)
})

startPolling().catch((err) => {
  console.error(`Fatal error: ${err.message}`)
  process.exit(1)
})
