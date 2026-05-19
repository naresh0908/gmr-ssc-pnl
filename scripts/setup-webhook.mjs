#!/usr/bin/env node
/**
 * Setup Microsoft Graph Webhook Subscription
 * 
 * This script creates a subscription that tells SharePoint to notify
 * our Vercel endpoint whenever the tracked file changes.
 * 
 * Usage:
 *   node scripts/setup-webhook.mjs
 * 
 * Important:
 *   - Must be run after deploying to Vercel
 *   - Your Vercel deployment URL must be publicly accessible
 *   - Subscription valid for ~3 days, then needs renewal
 */

import 'dotenv/config.js'
import { getAccessToken, makeGraphRequest } from './sharepoint-auth.mjs'
import fs from 'fs'
import path from 'path'

const repoRoot = process.cwd()
const webhookConfigFile = path.join(repoRoot, '.webhook-subscription.json')
const vercelUrl = process.env.VERCEL_URL || process.env.DEPLOYMENT_URL

if (!vercelUrl) {
  console.error('❌ Error: VERCEL_URL or DEPLOYMENT_URL not set in .env')
  console.error('   Add: VERCEL_URL=https://your-project.vercel.app')
  process.exit(1)
}

const notificationUrl = `${vercelUrl}/api/webhooks/sharepoint`

console.log(`\n📡 Setting up Microsoft Graph Webhook Subscription`)
console.log(`   Notification URL: ${notificationUrl}`)
console.log(`   Checking current subscriptions...\n`)

async function getExistingSubscription(accessToken) {
  try {
    const response = await makeGraphRequest(
      accessToken,
      `/subscriptions`
    )
    
    const subscriptions = response.value || []
    const existing = subscriptions.find(
      sub => sub.notificationUrl === notificationUrl
    )
    
    return existing
  } catch (error) {
    console.warn(`   ⚠️  Could not fetch existing subscriptions: ${error.message}`)
    return null
  }
}

async function createSubscription(accessToken, siteId, itemId) {
  try {
    // Microsoft Graph webhooks for SharePoint require subscribing to /drive/root
    // (can't subscribe to individual items directly)
    // We'll subscribe to drive root and filter on client side
    const payload = {
      changeType: 'updated',
      notificationUrl: notificationUrl,
      resource: `/sites/${siteId}/drive/root`,
      expirationDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days
      clientState: 'sharepoint-file-monitor',
    }

    console.log(`\n   Creating subscription to monitor drive for file changes`)
    console.log(`   (Subscribing to drive root, will detect changes to target file)`)
    console.log(`   Payload:`, JSON.stringify(payload, null, 2))

    const response = await makeGraphRequest(
      accessToken,
      `/subscriptions`,
      'POST',
      payload
    )

    if (response.id) {
      console.log(`\n✅ Subscription created!`)
      console.log(`   ID: ${response.id}`)
      console.log(`   Expires: ${response.expirationDateTime}`)

      // Save subscription details
      fs.writeFileSync(
        webhookConfigFile,
        JSON.stringify({
          subscriptionId: response.id,
          notificationUrl: notificationUrl,
          resource: payload.resource,
          expirationDateTime: response.expirationDateTime,
          createdAt: new Date().toISOString(),
        }, null, 2)
      )

      return response
    } else {
      throw new Error('No subscription ID in response')
    }
  } catch (error) {
    console.error(`❌ Failed to create subscription: ${error.message}`)
    if (error.response?.body) {
      console.error('   Details:', error.response.body)
    }
    throw error
  }
}

async function main() {
  try {
    const accessToken = await getAccessToken()
    const siteName = process.env.SHAREPOINT_SITE_NAME || 'HARTSFellowship-2025'
    const domain = process.env.SHAREPOINT_DOMAIN || 'gobalharts.sharepoint.com'

    // Get site info
    console.log(`\n   Connecting to: ${siteName}...`)
    const siteResponse = await makeGraphRequest(
      accessToken,
      `/sites/${domain}:/sites/${siteName}:`
    )
    
    const siteId = siteResponse.id
    console.log(`   ✓ Site ID: ${siteId}`)

    // Get drive info
    console.log(`\n   Getting drive information...`)
    const driveResponse = await makeGraphRequest(
      accessToken,
      `/sites/${siteId}/drive`
    )
    
    const driveId = driveResponse.id
    console.log(`   ✓ Drive ID: ${driveId}`)

    // Navigate to folder and find file
    console.log(`\n   Navigating to: General/2026_May_HARTS_GMR_PNL_Dashboard...`)
    
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
      (item) => item.name.includes('2026_May_HARTS_GMR_SSC_Financial_Model_v2.xlsx')
    )
    
    if (!excelFile) {
      throw new Error('Excel file not found')
    }

    console.log(`   ✓ File found: ${excelFile.name}`)
    console.log(`   ✓ File ID: ${excelFile.id}`)

    // Check for existing subscription
    const existing = await getExistingSubscription(accessToken)
    
    if (existing) {
      console.log(`\n   ✓ Existing subscription found`)
      console.log(`     ID: ${existing.id}`)
      console.log(`     Expires: ${existing.expirationDateTime}`)
      console.log(`\n   ℹ️  Using existing subscription (you can delete it to create a new one)`)
      
      fs.writeFileSync(
        webhookConfigFile,
        JSON.stringify({
          subscriptionId: existing.id,
          notificationUrl: notificationUrl,
          resource: existing.resource,
          expirationDateTime: existing.expirationDateTime,
          createdAt: new Date().toISOString(),
        }, null, 2)
      )
    } else {
      // Create new subscription
      await createSubscription(accessToken, siteId, excelFile.id)
    }

    console.log(`\n✅ Webhook setup complete!`)
    console.log(`\n   Next steps:`)
    console.log(`   1. Deploy to Vercel: git push`)
    console.log(`   2. Verify deployment is live at: ${vercelUrl}`)
    console.log(`   3. Test: Change the Excel file in SharePoint`)
    console.log(`   4. Dashboard should auto-update within ~10 seconds`)
    console.log(`\n   📄 Subscription saved to: ${webhookConfigFile}`)

  } catch (error) {
    console.error(`\n❌ Setup failed: ${error.message}`)
    process.exit(1)
  }
}

main()
