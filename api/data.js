/**
 * API endpoint that returns current synced data
 * Used by frontend to check if data has changed
 */

import fs from 'fs'
import path from 'path'

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const dataDir = path.join(process.cwd(), 'src', 'data')
    
    // Read the data files
    const sampleDataPath = path.join(dataDir, 'sampleData.js')
    const txnFtePath = path.join(dataDir, 'transactionFteData.js')
    
    let sampleData = { revenue: [], cost: [] }
    let transactionFteData = { transactions: [], fte: [] }

    // Try to read and parse data files
    if (fs.existsSync(sampleDataPath)) {
      const content = fs.readFileSync(sampleDataPath, 'utf8')
      // Extract JSON from: export const sampleData = {...}
      const jsonMatch = content.match(/export const sampleData = ({[\s\S]*});/)
      if (jsonMatch) {
        sampleData = JSON.parse(jsonMatch[1])
      }
    }

    if (fs.existsSync(txnFtePath)) {
      const content = fs.readFileSync(txnFtePath, 'utf8')
      // Extract JSON from: export const transactionFteData = {...}
      const jsonMatch = content.match(/export const transactionFteData = ({[\s\S]*});/)
      if (jsonMatch) {
        transactionFteData = JSON.parse(jsonMatch[1])
      }
    }

    // Return data
    res.status(200).json({
      sampleData,
      transactionFteData,
      timestamp: fs.existsSync(sampleDataPath) 
        ? fs.statSync(sampleDataPath).mtime.toISOString() 
        : null
    })
  } catch (error) {
    console.error('Error reading data:', error)
    res.status(500).json({ error: error.message })
  }
}
