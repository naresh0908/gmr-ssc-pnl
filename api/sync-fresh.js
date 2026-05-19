/**
 * API endpoint: Fetch fresh data directly from SharePoint
 * Used when webhook is triggered or for manual sync
 * 
 * This bypasses file persistence issues by fetching and serving
 * data directly without relying on filesystem changes.
 */

import { getAccessToken, makeGraphRequest } from '../scripts/sharepoint-auth.mjs'
import XLSX from 'xlsx'

function readRows(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) {
    const available = workbook.SheetNames.join(', ')
    throw new Error(`Missing sheet "${sheetName}". Available sheets: ${available}`)
  }
  return XLSX.utils.sheet_to_json(sheet, { defval: '' })
}

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('[Sync API] Fetching fresh data from SharePoint...')
    
    const accessToken = await getAccessToken()
    const siteName = process.env.SHAREPOINT_SITE_NAME || 'HARTSFellowship-2025'
    const domain = process.env.SHAREPOINT_DOMAIN || 'gobalharts.sharepoint.com'

    // Get site info
    const siteResponse = await makeGraphRequest(
      accessToken,
      `/sites/${domain}:/sites/${siteName}:`
    )
    const siteId = siteResponse.id
    console.log('[Sync API] ✓ Connected to site')

    // Get drive info
    const driveResponse = await makeGraphRequest(
      accessToken,
      `/sites/${siteId}/drive`
    )
    const driveId = driveResponse.id

    // Navigate to folder
    const rootResponse = await makeGraphRequest(
      accessToken,
      `/sites/${siteId}/drive/root/children`
    )
    
    const generalFolder = (rootResponse.value || []).find(
      (item) => item.folder && item.name === 'General'
    )
    
    if (!generalFolder) {
      throw new Error('General folder not found')
    }

    const generalChildren = await makeGraphRequest(
      accessToken,
      `/sites/${siteId}/drive/items/${generalFolder.id}/children`
    )
    
    const targetFolder = (generalChildren.value || []).find(
      (item) => item.folder && item.name.includes('2026_May_HARTS_GMR_PNL_Dashboard')
    )
    
    if (!targetFolder) {
      throw new Error('Target folder not found')
    }

    const folderChildren = await makeGraphRequest(
      accessToken,
      `/sites/${siteId}/drive/items/${targetFolder.id}/children`
    )
    
    const excelFile = (folderChildren.value || []).find(
      (item) => item.name.includes('2026_May_HARTS_GMR_SSC_Financial_Model_v3.xlsx')
    )
    
    if (!excelFile) {
      throw new Error('Excel file not found')
    }

    console.log(`[Sync API] ✓ Found: ${excelFile.name}`)

    // Download and parse
    const fileInfo = await makeGraphRequest(accessToken, `/sites/${siteId}/drive/items/${excelFile.id}`)
    const downloadUrl = fileInfo['@microsoft.graph.downloadUrl']

    if (!downloadUrl) {
      throw new Error('Could not get download URL')
    }

    console.log('[Sync API] 📥 Downloading Excel...')
    const response = await fetch(downloadUrl)
    const buffer = await response.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    
    console.log('[Sync API] 📊 Parsing sheets...')
    const revenueRows = readRows(workbook, 'Revenue')
    const costRows = readRows(workbook, 'Cost')
    const transactions = readRows(workbook, 'Transactions')
    const fte = readRows(workbook, 'FTE')

    console.log('[Sync API] ✅ Data fetched successfully')
    
    return res.status(200).json({
      sampleData: {
        revenue: revenueRows,
        cost: costRows
      },
      transactionFteData: {
        transactions,
        fte
      },
      timestamp: new Date().toISOString(),
      source: 'sharepoint-live'
    })

  } catch (error) {
    console.error('[Sync API] ❌ Error:', error.message)
    return res.status(500).json({ 
      error: error.message,
      details: error.message
    })
  }
}
