import { DeviceCodeCredential } from '@azure/identity'
import 'dotenv/config.js'
import https from 'https'

const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID
const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID

if (!AZURE_TENANT_ID || !AZURE_CLIENT_ID) {
  throw new Error('Missing AZURE_TENANT_ID or AZURE_CLIENT_ID in .env file')
}

export async function getAccessToken() {
  try {
    const credential = new DeviceCodeCredential({
      tenantId: AZURE_TENANT_ID,
      clientId: AZURE_CLIENT_ID,
      userPromptCallback: (info) => {
        console.log('\n' + '='.repeat(70))
        console.log('🔐 AZURE DEVICE CODE AUTHENTICATION')
        console.log('='.repeat(70))
        console.log(`\n📱 To sign in, open this URL in your browser:\n`)
        console.log(`   ${info.verificationUri}`)
        console.log(`\n⌨️  Enter this short code when prompted:\n`)
        // Use userCode for display - it's the short friendly code for users
        console.log(`   ${info.userCode}`)
        console.log(`\n⏱️  You have 15 minutes to complete sign-in.\n`)
        console.log('='.repeat(70) + '\n')
      },
    })

    console.log('⏳ Waiting for authentication...')
    const tokenResponse = await credential.getToken('https://graph.microsoft.com/.default')
    console.log('✅ Authentication successful!\n')
    return tokenResponse.token
  } catch (error) {
    console.error('\n❌ Authentication failed:', error.message)
    throw error
  }
}

export async function makeGraphRequest(accessToken, endpoint, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://graph.microsoft.com/v1.0${endpoint}`)
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'GMR-Dashboard/1.0',
      },
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => {
        data += chunk
      })
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(data))
          } else {
            reject(new Error(`Graph API error: ${res.statusCode} ${data}`))
          }
        } catch (e) {
          reject(e)
        }
      })
    })

    req.on('error', reject)
    if (body) {
      req.write(JSON.stringify(body))
    }
    req.end()
  })
}
