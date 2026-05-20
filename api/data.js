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
    const regex = new RegExp(`export\\s+const\\s+${exportName}\\s*=\\s*((?:\\{|\\[)[\\s\\S]*(?:\\}|\\]));?\\s*$`, 's')
    const match = content.match(regex)
    
    if (!match) {
      console.warn(`Could not extract ${exportName} from module`)
      return null
    }

    let jsonStr = match[1].trim()
    
    // Try to parse - if it fails, try to recover
    try {
      return JSON.parse(jsonStr)
    } catch (parseError) {
      console.warn(`Initial parse failed for ${exportName}, attempting recovery...`)
      
      // Try to extract just the array part
      const arrayMatch = jsonStr.match(/\[\s*([\s\S]*)\s*\]/)
      if (arrayMatch) {
        // Get the items
        const itemsStr = arrayMatch[1]
        const items = []
        
        // Split by { and try to parse each object individually
        const objMatches = itemsStr.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g)
        if (objMatches) {
          for (const objStr of objMatches) {
            try {
              items.push(JSON.parse(objStr))
            } catch (e) {
              // Skip corrupted items
              console.warn(`Skipped corrupted item in ${exportName}`)
            }
          }
          
          if (items.length > 0) {
            console.log(`✅ Recovered ${items.length} valid items from ${exportName}`)
            return items
          }
        }
      }
      
      console.error(`Could not recover ${exportName}:`, parseError.message)
      return null
    }
  } catch (e) {
    console.error(`Error extracting ${exportName}:`, e.message)
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
      // Delete corrupted cache file
      try {
        fs.unlinkSync(cachePath)
        console.log(`🗑️  Removed corrupted cache: ${path.basename(cachePath)}`)
      } catch (delErr) {
        // ignore
      }
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
        // Handle both object and array returns
        if (Array.isArray(parsed)) {
          // Recovery mode - convert back to expected structure
          if (exportName === 'sampleData') {
            return { revenue: parsed, cost: [] }
          } else if (exportName === 'transactionFteData') {
            return { transactions: parsed, fte: [] }
          }
          return parsed
        }
        return parsed
      }
    } catch (e) {
      console.warn(`⚠️  Fallback parse error for ${path.basename(fallbackPath)}: ${e.message}`)
    }
  }

  // Last resort - return empty structure
  if (exportName === 'sampleData') {
    return { revenue: [], cost: [] }
  } else if (exportName === 'transactionFteData') {
    return { transactions: [], fte: [] }
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
    let sampleData = readJsonCache(sampleDataCache, sampleDataPath, 'sampleData')
    if (!sampleData) {
      sampleData = { revenue: [], cost: [] }
    }

    // Read transaction/FTE data (from cache or fallback)
    let transactionFteData = readJsonCache(txnFteCache, txnFtePath, 'transactionFteData')
    if (!transactionFteData) {
      transactionFteData = { transactions: [], fte: [] }
    }

    // Get timestamp for change detection
    const timestamp = getTimestamp()

    console.log('[/api/data] ✅ Data served')
    console.log(`   Revenue: ${sampleData.revenue?.length || 0} rows`)
    console.log(`   Cost: ${sampleData.cost?.length || 0} rows`)
    console.log(`   Transactions: ${transactionFteData.transactions?.length || 0} rows`)
    console.log(`   FTE: ${transactionFteData.fte?.length || 0} rows`)
    console.log(`   Timestamp: ${timestamp}`)

    // Return data with timestamp for change detection
    return res.status(200).json({
      sampleData,
      transactionFteData,
      timestamp,
      source: fs.existsSync(sampleDataCache) ? 'webhook-cache' : 'original-files',
    })
  } catch (error) {
    console.error('[/api/data] ❌ Error:', error.message)
    
    // Fallback response - return empty data but valid structure
    return res.status(200).json({
      sampleData: { revenue: [], cost: [] },
      transactionFteData: { transactions: [], fte: [] },
      timestamp: Date.now().toString(),
      error: error.message,
      source: 'fallback-empty',
    })
  }
}
