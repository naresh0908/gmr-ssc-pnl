/**
 * API endpoint that returns current synced data
 * Used by frontend to check if data has changed
 * 
 * Dashboard polls this every 5 seconds to detect real-time updates
 * When webhook writes new data to /tmp cache, this endpoint reads it
 * and returns timestamp → dashboard detects change → updates automatically
 */

import fs from 'fs'
import path from 'path'
import os from 'os'

// Paths for cache (webhook writes here)
const tmpDir = os.tmpdir()
const sampleDataCache = path.join(tmpDir, 'sampleData.json')
const txnFteCache = path.join(tmpDir, 'transactionFteData.json')
const metadataCache = path.join(tmpDir, 'sync-metadata.json')

// Fallback: paths for original data files (for first load)
const repoRoot = process.cwd()
const sampleDataPath = path.join(repoRoot, 'src', 'data', 'sampleData.js')
const txnFtePath = path.join(repoRoot, 'src', 'data', 'transactionFteData.js')

function extractJsonFromModule(content, exportName) {
  try {
    // Match: export const exportName = {...} (with or without semicolon)
    const regex = new RegExp(`export\\s+const\\s+${exportName}\\s*=\\s*({[\\s\\S]*?});?\\s*$`, 'ms')
    const match = content.match(regex)
    
    if (!match) {
      console.warn(`Could not extract ${exportName} from module`)
      return null
    }

    const jsonStr = match[1].trim()
    return JSON.parse(jsonStr)
  } catch (e) {
    console.error(`Error parsing ${exportName}:`, e.message)
    return null
  }
}

function readJsonCache(cachePath, fallbackPath, exportName) {
  // Try cache first (written by webhook)
  if (fs.existsSync(cachePath)) {
    try {
      const content = fs.readFileSync(cachePath, 'utf8')
      const parsed = JSON.parse(content)
      console.log(`✅ Loaded from cache: ${path.basename(cachePath)}`)
      return parsed
    } catch (e) {
      console.warn(`⚠️  Cache parse error for ${path.basename(cachePath)}: ${e.message}`)
      // Continue to fallback
    }
  }

  // Fall back to original data files
  if (fs.existsSync(fallbackPath)) {
    try {
      const content = fs.readFileSync(fallbackPath, 'utf8')
      const parsed = extractJsonFromModule(content, exportName)
      if (parsed) {
        console.log(`✅ Loaded from fallback: ${path.basename(fallbackPath)}`)
        return parsed
      }
    } catch (e) {
      console.warn(`⚠️  Fallback parse error for ${path.basename(fallbackPath)}: ${e.message}`)
    }
  }

  return null
}

function getTimestamp() {
  // Prefer metadata file timestamp (most accurate)
  if (fs.existsSync(metadataCache)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metadataCache, 'utf8'))
      return meta.timestamp || meta.syncedAt
    } catch (e) {
      // ignore
    }
  }

  // Fallback: use cache file modification time if it exists
  if (fs.existsSync(sampleDataCache)) {
    try {
      const stat = fs.statSync(sampleDataCache)
      return stat.mtimeMs.toString()
    } catch (e) {
      // ignore
    }
  }

  // Last resort: use original file modification time
  if (fs.existsSync(sampleDataPath)) {
    try {
      const stat = fs.statSync(sampleDataPath)
      return stat.mtimeMs.toString()
    } catch (e) {
      // ignore
    }
  }

  return Date.now().toString()
}

export default function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  res.setHeader('Pragma', 'no-cache')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('[/api/data] Fetching dashboard data...')

    // Read sample data (from cache or fallback)
    const sampleData = readJsonCache(sampleDataCache, sampleDataPath, 'sampleData') || { revenue: [], cost: [] }

    // Read transaction/FTE data (from cache or fallback)
    const transactionFteData = readJsonCache(txnFteCache, txnFtePath, 'transactionFteData') || { transactions: [], fte: [] }

    // Get timestamp for change detection
    const timestamp = getTimestamp()

    console.log('[/api/data] ✅ Data served - Revenue:', sampleData.revenue?.length || 0, 'rows, Timestamp:', timestamp)

    // Return data with timestamp for change detection
    return res.status(200).json({
      sampleData,
      transactionFteData,
      timestamp,
      source: fs.existsSync(sampleDataCache) ? 'webhook-cache' : 'original-files',
    })
  } catch (error) {
    console.error('[/api/data] Error:', error.message)
    return res.status(500).json({
      error: 'Failed to load data',
      message: error.message,
    })
  }
}
