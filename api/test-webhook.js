/**
 * Test endpoint: Echo webhook data for debugging
 * Shows exactly what format Power Automate sends
 */

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Content-Type', 'application/json')

  if (req.method === 'POST') {
    const body = req.body || {}
    
    return res.status(200).json({
      received: true,
      timestamp: new Date().toISOString(),
      bodyType: typeof body,
      isArray: Array.isArray(body),
      keys: Object.keys(body),
      
      // Check each expected field
      revenue: {
        exists: !!body.revenue,
        type: typeof body.revenue,
        isArray: Array.isArray(body.revenue),
        length: Array.isArray(body.revenue) ? body.revenue.length : 'N/A',
        sample: Array.isArray(body.revenue) ? body.revenue[0] : body.revenue,
      },
      cost: {
        exists: !!body.cost,
        type: typeof body.cost,
        isArray: Array.isArray(body.cost),
        length: Array.isArray(body.cost) ? body.cost.length : 'N/A',
      },
      transactions: {
        exists: !!body.transactions,
        type: typeof body.transactions,
        isArray: Array.isArray(body.transactions),
        length: Array.isArray(body.transactions) ? body.transactions.length : 'N/A',
      },
      fte: {
        exists: !!body.fte,
        type: typeof body.fte,
        isArray: Array.isArray(body.fte),
        length: Array.isArray(body.fte) ? body.fte.length : 'N/A',
      },
      
      // Show raw body (first 200 chars)
      rawBody: JSON.stringify(body).substring(0, 200),
    })
  }

  return res.status(200).json({
    message: 'POST test data to this endpoint to see what Power Automate sends',
  })
}
