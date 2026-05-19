import fs from 'fs'
import path from 'path'
import XLSX from 'xlsx'
import 'dotenv/config.js'
import { getAccessToken, makeGraphRequest } from './sharepoint-auth.mjs'

const repoRoot = process.cwd()
const sampleDataOut = path.join(repoRoot, 'src', 'data', 'sampleData.js')
const txnFteOut = path.join(repoRoot, 'src', 'data', 'transactionFteData.js')
const localWorkbookPath = path.join(repoRoot, process.env.LOCAL_WORKBOOK_PATH || 'data/real-data-workbook.xlsx')
const syncMethod = process.env.SYNC_METHOD || 'onedrive'
const lastModifiedFile = path.join(repoRoot, '.last-sync-check.json')

function writeModule(filePath, exportName, data, sourceLabel) {
  const content = `// Auto-generated from ${sourceLabel}. Do not edit by hand.\nexport const ${exportName} = ${JSON.stringify(data, null, 2)};\n`
  fs.writeFileSync(filePath, content, 'utf8')
}

function recordLastModified(fileId, lastModifiedDateTime) {
  const data = {
    fileId,
    lastModifiedDateTime,
    syncedAt: new Date().toISOString(),
  }
  fs.writeFileSync(lastModifiedFile, JSON.stringify(data, null, 2), 'utf8')
}

function getLastModifiedRecord() {
  try {
    if (fs.existsSync(lastModifiedFile)) {
      return JSON.parse(fs.readFileSync(lastModifiedFile, 'utf8'))
    }
  } catch (e) {
    return null
  }
  return null
}

function assertSheet(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) {
    const available = workbook.SheetNames.join(', ')
    throw new Error(`Missing sheet "${sheetName}". Available sheets: ${available}`)
  }
  return sheet
}

function readRows(workbook, sheetName) {
  const sheet = assertSheet(workbook, sheetName)
  return XLSX.utils.sheet_to_json(sheet, { defval: '' })
}

async function syncFromLocal() {
  console.log('📂 Syncing from local workbook...')
  
  if (!fs.existsSync(localWorkbookPath)) {
    throw new Error(`Workbook not found at ${localWorkbookPath}`)
  }

  const workbook = XLSX.readFile(localWorkbookPath)
  const revenueRows = readRows(workbook, 'Revenue')
  const costRows = readRows(workbook, 'Cost')
  const transactions = readRows(workbook, 'Transactions')
  const fte = readRows(workbook, 'FTE')

  writeModule(sampleDataOut, 'sampleData', { revenue: revenueRows, cost: costRows }, localWorkbookPath)
  writeModule(txnFteOut, 'transactionFteData', { transactions, fte }, localWorkbookPath)

  console.log(`✅ Local sync complete`)
  console.log(`   Revenue rows: ${revenueRows.length}`)
  console.log(`   Cost rows: ${costRows.length}`)
  console.log(`   Transaction rows: ${transactions.length}`)
  console.log(`   FTE rows: ${fte.length}`)
}

async function findFileInOneDrive(accessToken) {
  try {
    console.log(`🔍 Searching for Excel files in OneDrive...`)
    
    const response = await makeGraphRequest(
      accessToken,
      `/me/drive/root/children?$filter=name endswith '.xlsx' or name endswith '.xls'`
    )

    const excelFiles = response.value || []

    if (excelFiles.length === 0) {
      throw new Error('No Excel files found in OneDrive')
    }

    // Return the first Excel file
    const file = excelFiles[0]
    console.log(`📄 Found: ${file.name}`)
    return file
  } catch (error) {
    console.error(`Error finding Excel file: ${error.message}`)
    throw error
  }
}

async function checkForChanges(accessToken, fileId, fileName) {
  const lastRecord = getLastModifiedRecord()
  
  try {
    const fileInfo = await makeGraphRequest(accessToken, `/me/drive/items/${fileId}`)
    const currentModified = fileInfo.lastModifiedDateTime
    
    if (!lastRecord || lastRecord.fileId !== fileId) {
      console.log('📝 First sync or different file')
      return { hasChanged: true, fileInfo }
    }
    
    if (lastRecord.lastModifiedDateTime !== currentModified) {
      console.log(`📝 File updated since last sync`)
      console.log(`   Last sync: ${lastRecord.syncedAt}`)
      console.log(`   File modified: ${currentModified}`)
      return { hasChanged: true, fileInfo }
    }
    
    console.log(`✓ No changes since last sync (${lastRecord.syncedAt})`)
    return { hasChanged: false, fileInfo }
  } catch (error) {
    console.error(`Error checking for changes: ${error.message}`)
    return { hasChanged: true, fileInfo: null }
  }
}

async function downloadAndParseExcel(accessToken, fileId, fileName) {
  try {
    console.log(`📥 Downloading: ${fileName}`)
    
    const fileInfo = await makeGraphRequest(accessToken, `/me/drive/items/${fileId}`)
    const downloadUrl = fileInfo['@microsoft.graph.downloadUrl']

    if (!downloadUrl) {
      throw new Error('Could not get download URL for file')
    }

    const response = await fetch(downloadUrl)
    const buffer = await response.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    
    recordLastModified(fileId, fileInfo.lastModifiedDateTime)
    
    return workbook
  } catch (error) {
    console.error(`Error downloading file: ${error.message}`)
    throw error
  }
}

async function syncFromSharePoint() {
  console.log('☁️  Syncing from SharePoint site...')
  
  try {
    const accessToken = await getAccessToken()
    const siteName = process.env.SHAREPOINT_SITE_NAME || 'HARTSFellowship-2025'
    const domain = process.env.SHAREPOINT_DOMAIN || 'gobalharts.sharepoint.com'

    // Get site info
    console.log(`🔗 Connecting to site: ${siteName}...`)
    const siteResponse = await makeGraphRequest(
      accessToken,
      `/sites/${domain}:/sites/${siteName}:`
    )
    
    const siteId = siteResponse.id
    console.log(`✅ Connected to site: ${siteName}`)

    // Navigate to folder: General > 2026_May_HARTS_GMR_PNL_Dashboard
    console.log(`🔍 Navigating to General/2026_May_HARTS_GMR_PNL_Dashboard folder...`)
    
    // Get root children to find "General" folder
    const rootResponse = await makeGraphRequest(
      accessToken,
      `/sites/${siteId}/drive/root/children`
    )
    
    const generalFolder = (rootResponse.value || []).find(
      (item) => item.folder && item.name === 'General'
    )
    
    if (!generalFolder) {
      throw new Error('Could not find "General" folder in SharePoint root')
    }
    
    console.log(`✓ Found General folder`)
    
    // Get children of General folder
    const generalChildren = await makeGraphRequest(
      accessToken,
      `/sites/${siteId}/drive/items/${generalFolder.id}/children`
    )
    
    const targetFolder = (generalChildren.value || []).find(
      (item) => item.folder && item.name.includes('2026_May_HARTS_GMR_PNL_Dashboard')
    )
    
    if (!targetFolder) {
      console.log(`⚠️  Folder "2026_May_HARTS_GMR_PNL_Dashboard" not found in General`)
      const availableFolders = (generalChildren.value || [])
        .filter(item => item.folder)
        .map(f => f.name)
      console.log(`Available folders: ${availableFolders.join(', ')}`)
      throw new Error('Target folder not found')
    }
    
    console.log(`✓ Found 2026_May_HARTS_GMR_PNL_Dashboard folder`)
    
    // Get Excel files from target folder
    const targetFolderChildren = await makeGraphRequest(
      accessToken,
      `/sites/${siteId}/drive/items/${targetFolder.id}/children`
    )
    
    const excelFiles = (targetFolderChildren.value || []).filter(
      (item) => item.name.endsWith('.xlsx') || item.name.endsWith('.xls')
    )

    if (excelFiles.length === 0) {
      throw new Error('No Excel files found in target folder')
    }

    console.log(`Found ${excelFiles.length} Excel file(s):`)
    excelFiles.forEach(f => console.log(`   - ${f.name}`))

    const targetFileName = '2026_May_HARTS_GMR_SSC_Financial_Model_v2.xlsx'
    const excelFile = excelFiles.find(f => f.name === targetFileName) || excelFiles[0]
    if (excelFile.name !== targetFileName) {
      console.log(`⚠️  Target file "${targetFileName}" not found, falling back to: ${excelFile.name}`)
    }
    console.log(`📄 Using: ${excelFile.name}`)

    // Download and parse
    const fileInfo = await makeGraphRequest(accessToken, `/sites/${siteId}/drive/items/${excelFile.id}`)
    const downloadUrl = fileInfo['@microsoft.graph.downloadUrl']

    if (!downloadUrl) {
      throw new Error('Could not get download URL for file')
    }

    console.log(`📥 Downloading: ${excelFile.name}`)
    const response2 = await fetch(downloadUrl)
    const buffer = await response2.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'buffer' })

    // Read sheets
    const revenueRows = readRows(workbook, 'Revenue')
    const costRows = readRows(workbook, 'Cost')
    const transactions = readRows(workbook, 'Transactions')
    const fte = readRows(workbook, 'FTE')

    writeModule(sampleDataOut, 'sampleData', { revenue: revenueRows, cost: costRows }, `SharePoint: ${excelFile.name}`)
    writeModule(txnFteOut, 'transactionFteData', { transactions, fte }, `SharePoint: ${excelFile.name}`)

    console.log(`✅ SharePoint sync complete`)
    console.log(`   Source: ${excelFile.name}`)
    console.log(`   Revenue rows: ${revenueRows.length}`)
    console.log(`   Cost rows: ${costRows.length}`)
    console.log(`   Transaction rows: ${transactions.length}`)
    console.log(`   FTE rows: ${fte.length}`)
    
    return { synced: true }
  } catch (error) {
    console.error(`❌ SharePoint sync failed: ${error.message}`)
    console.log(`\n⚠️  Falling back to local workbook...`)
    await syncFromLocal()
    return { synced: false, reason: 'fallback_to_local' }
  }
}

async function main() {
  try {
    if (syncMethod === 'onedrive') {
      const result = await syncFromOneDrive()
      if (!result.synced && result.reason === 'no_changes') {
        process.exit(0)
      }
    } else if (syncMethod === 'sharepoint') {
      await syncFromSharePoint()
    } else {
      await syncFromLocal()
    }
  } catch (error) {
    console.error(`\n❌ Sync failed:`, error.message)
    process.exit(1)
  }
}

main()
