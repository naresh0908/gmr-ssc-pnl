import fs from 'fs'
import path from 'path'
import XLSX from 'xlsx'
import 'dotenv/config.js'
import { getAccessToken, makeGraphRequest } from './sharepoint-auth.mjs'

const repoRoot = process.cwd()
const sampleDataOut = path.join(repoRoot, 'src', 'data', 'sampleData.js')
const txnFteOut = path.join(repoRoot, 'src', 'data', 'transactionFteData.js')
const localWorkbookPath = path.join(repoRoot, process.env.LOCAL_WORKBOOK_PATH || 'data/real-data-workbook.xlsx')
const syncMethod = process.env.SYNC_METHOD || 'sharepoint'

function writeModule(filePath, exportName, data, sourceLabel) {
  const content = `// Auto-generated from ${sourceLabel}. Do not edit by hand.\nexport const ${exportName} = ${JSON.stringify(data, null, 2)};\n`
  fs.writeFileSync(filePath, content, 'utf8')
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

async function findExcelFileInDrive(accessToken, driveId) {
  try {
    console.log(`🔍 Searching for Excel files...`)
    
    const response = await makeGraphRequest(
      accessToken,
      `/drives/${driveId}/root/children?$filter=name endswith '.xlsx' or name endswith '.xls'`
    )

    const excelFiles = response.value || []

    if (excelFiles.length === 0) {
      throw new Error('No Excel files found in the SharePoint site')
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

async function downloadAndParseExcel(accessToken, fileId, fileName) {
  try {
    console.log(`📥 Downloading: ${fileName}`)
    
    // Get download URL
    const fileInfo = await makeGraphRequest(accessToken, `/me/drive/items/${fileId}`)
    const downloadUrl = fileInfo['@microsoft.graph.downloadUrl']

    if (!downloadUrl) {
      throw new Error('Could not get download URL for file')
    }

    // Download the file
    const response = await fetch(downloadUrl)
    const buffer = await response.arrayBuffer()

    // Parse Excel
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    return workbook
  } catch (error) {
    console.error(`Error downloading file: ${error.message}`)
    throw error
  }
}

async function syncFromSharePoint() {
  console.log('☁️  Syncing from SharePoint...')
  
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
    const driveId = siteResponse.drive?.id || siteResponse.parentReference?.driveId

    if (!driveId) {
      throw new Error('Could not get SharePoint drive ID')
    }

    console.log(`✅ Connected to site: ${siteName}`)

    // Find and download Excel file
    const excelFile = await findExcelFileInDrive(accessToken, driveId)
    const workbook = await downloadAndParseExcel(accessToken, excelFile.id, excelFile.name)

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
  } catch (error) {
    console.error(`❌ SharePoint sync failed: ${error.message}`)
    console.log(`\n⚠️  Falling back to local workbook...`)
    await syncFromLocal()
  }
}

async function main() {
  try {
    if (syncMethod === 'sharepoint') {
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
