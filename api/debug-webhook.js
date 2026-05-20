/**
 * Webhook diagnostics - shows the last webhook call details
 */
import { store } from './_store.js'

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Content-Type', 'application/json')

  return res.status(200).json({
    timestamp: new Date().toISOString(),
    
    // In-memory store state
    memory: {
      hasSampleData: !!store.sampleData,
      hasTransactionFteData: !!store.transactionFteData,
      lastTimestamp: store.timestamp,
      source: store.source,
      
      // Sample row counts
      sampleDataRows: {
        revenue: store.sampleData?.revenue?.length || 0,
        cost: store.sampleData?.cost?.length || 0,
      },
      transactionFteDataRows: {
        transactions: store.transactionFteData?.transactions?.length || 0,
        fte: store.transactionFteData?.fte?.length || 0,
      },
      
      // First few rows as samples
      revenueSample: store.sampleData?.revenue?.[0] || null,
      costSample: store.sampleData?.cost?.[0] || null,
    },

    instructions: [
      '1. Edit your Excel file in SharePoint',
      '2. Save the file',
      '3. Check Power Automate flow run history - should show it ran',
      '4. Wait 5 seconds',
      '5. Visit https://gmr-ssc-pnl.vercel.app/api/debug-webhook again',
      '6. The memory section above should show updated data',
      '',
      'If memory still shows 0 rows or old data after step 5:',
      '→ The webhook is NOT receiving data from Power Automate',
      '→ Check Power Automate flow HTTP action - see the request body',
      '→ The body should have "revenue", "cost", "transactions", "fte" keys with arrays',
    ],
  })
}
