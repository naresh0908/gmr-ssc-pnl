/**
 * Diagnostic endpoint: Shows the last webhook call from Power Automate
 * This helps debug what data Power Automate is actually sending
 */

import fs from 'fs'
import path from 'path'
import os from 'os'

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Content-Type', 'application/json')

  const tmpDir = os.tmpdir()
  const webhookDiagnosticsFile = path.join(tmpDir, 'webhook-call-diagnostics.json')

  try {
    if (!fs.existsSync(webhookDiagnosticsFile)) {
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

    const diag = JSON.parse(fs.readFileSync(webhookDiagnosticsFile, 'utf8'))
    
    return res.status(200).json({
      status: 'webhook-received',
      lastCall: diag,
    })
  } catch (e) {
    return res.status(200).json({
      status: 'error-reading-diagnostics',
      error: e.message,
    })
  }
}
