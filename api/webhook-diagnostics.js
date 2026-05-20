/**
 * Diagnostic endpoint: Shows the last webhook call from Power Automate
 * This helps debug what data Power Automate is actually sending
 */

import { getLastWebhookCall } from './_last-webhook-call.js'

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Content-Type', 'application/json')

  const lastCall = getLastWebhookCall()

  if (!lastCall.timestamp) {
    return res.status(200).json({
      status: 'no-webhook-calls-yet',
      message: 'No webhook calls have been received yet',
      instructions: [
        '1. Edit the HARTS Excel file in SharePoint',
        '2. Save it',
        '3. Wait 10 seconds for Power Automate to trigger',
        '4. Refresh this page',
        '5. You should then see the webhook data here',
      ],
    })
  }

  return res.status(200).json({
    status: 'webhook-received',
    lastCall,
    analysis: {
      hasRevenueArray: Array.isArray(lastCall.body?.revenue),
      hasCostArray: Array.isArray(lastCall.body?.cost),
      hasTransactionArray: Array.isArray(lastCall.body?.transactions),
      hasFteArray: Array.isArray(lastCall.body?.fte),
      
      revenueRows: lastCall.body?.revenue?.length || 0,
      costRows: lastCall.body?.cost?.length || 0,
      transactionRows: lastCall.body?.transactions?.length || 0,
      fteRows: lastCall.body?.fte?.length || 0,
    },
    recommendations: [
      lastCall.bodyKeys.length === 0 ? '⚠️  Body is empty!' : '✓ Body has data',
      !lastCall.body?.revenue ? '⚠️  No "revenue" field in body' : '✓ Has revenue field',
      !Array.isArray(lastCall.body?.revenue) ? `⚠️  Revenue is ${typeof lastCall.body?.revenue}, not array` : '✓ Revenue is array',
      
      // Sample first rows
      lastCall.body?.revenue?.[0] ? `📊 Revenue first row keys: ${Object.keys(lastCall.body.revenue[0]).join(', ')}` : null,
      lastCall.body?.cost?.[0] ? `📊 Cost first row keys: ${Object.keys(lastCall.body.cost[0]).join(', ')}` : null,
    ].filter(Boolean),
  })
}
