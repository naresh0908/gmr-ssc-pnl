# Real-Time SharePoint Data Sync

This guide shows how to enable real-time automatic data updates in your dashboard whenever the SharePoint Excel file changes.

## Three Approaches (Increasing Complexity)

### ✅ Approach 1: Manual Sync (Simplest - Recommended for most users)

Just run before each dev session:
```bash
npm run sync-data && npm run dev
```

The data refreshes each time you start the dev server.

---

### 🔄 Approach 2: Periodic Sync (Automatic - No Backend Needed)

The dashboard automatically syncs data every 5 minutes without requiring manual action.

#### Setup

1. **Update `package.json` to auto-sync on dev start:**
   ```json
   "scripts": {
     "dev": "npm run sync-data && vite",
   }
   ```

2. **Run dev:**
   ```bash
   npm run dev
   ```

Data automatically refreshes at startup. Re-run when you need fresh data.

---

### 🚀 Approach 3: Real-Time Updates (Advanced - Requires Backend)

Dashboard updates **automatically** every 5 minutes without restarting.

#### Architecture
```
SharePoint Excel File
         ↓
   API Backend (/api/sync-sharepoint-data)
         ↓
   React App (polling every 5 min)
         ↓
   Dashboard Updates Automatically
```

#### Backend Setup (Express.js Example)

**Option A: Add to existing Express backend**

```javascript
// server.js (or your backend file)
import express from 'express'
import { exec } from 'child_process'
import path from 'path'

const app = express()
app.use(express.json())

// Endpoint: Trigger SharePoint sync
app.post('/api/sync-sharepoint-data', async (req, res) => {
  try {
    // Run the sync script
    exec('npm run sync-data', (error, stdout, stderr) => {
      if (error) {
        console.error('Sync error:', error)
        return res.status(500).json({ error: error.message })
      }

      // Load the freshly synced data
      const { sampleData } = await import('./src/data/sampleData.js')
      const { transactionFteData } = await import('./src/data/transactionFteData.js')

      res.json({
        success: true,
        timestamp: new Date(),
        data: {
          revenue: sampleData.revenue,
          cost: sampleData.cost,
          transactions: transactionFteData.transactions,
          fte: transactionFteData.fte,
        },
      })
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.listen(3001, () => console.log('API server on :3001'))
```

**Option B: Separate Sync Service (Node.js)**

Create `server/sync-api.mjs`:
```javascript
import express from 'express'
import cors from 'cors'
import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()

app.use(cors())
app.use(express.json())

// Cache to avoid hammering SharePoint
let lastSyncTime = null
const CACHE_DURATION = 60 * 1000 // 1 minute

app.post('/api/sync-sharepoint-data', (req, res) => {
  // Simple rate limiting
  if (lastSyncTime && Date.now() - lastSyncTime < CACHE_DURATION) {
    return res.json({
      success: true,
      cached: true,
      message: 'Using cached data (synced within last 1 min)',
    })
  }

  // Run sync script as subprocess
  const syncProcess = spawn('node', [
    path.join(__dirname, '../scripts/sharepoint-sync.mjs'),
  ])

  let stdout = ''
  let stderr = ''

  syncProcess.stdout.on('data', (data) => {
    stdout += data.toString()
  })

  syncProcess.stderr.on('data', (data) => {
    stderr += data.toString()
  })

  syncProcess.on('close', async (code) => {
    if (code !== 0) {
      return res.status(500).json({
        success: false,
        error: stderr,
      })
    }

    try {
      // Import freshly synced data
      const dataPath = path.join(__dirname, '../src/data/sampleData.js')
      const txnFtePath = path.join(__dirname, '../src/data/transactionFteData.js')

      // Clear require cache to get fresh data
      delete require.cache[require.resolve(dataPath)]
      delete require.cache[require.resolve(txnFtePath)]

      const { sampleData } = await import(`file://${dataPath}`)
      const { transactionFteData } = await import(`file://${txnFtePath}`)

      lastSyncTime = Date.now()

      res.json({
        success: true,
        syncedAt: new Date(),
        data: {
          revenue: sampleData.revenue,
          cost: sampleData.cost,
          transactions: transactionFteData.transactions,
          fte: transactionFteData.fte,
        },
      })
    } catch (error) {
      res.status(500).json({ success: false, error: error.message })
    }
  })
})

app.listen(3001, () => {
  console.log('📡 Sync API running on http://localhost:3001')
  console.log('POST /api/sync-sharepoint-data - Trigger data sync')
})
```

Run it:
```bash
node server/sync-api.mjs
```

#### Frontend Setup

1. **Update your store** (`src/store/useDashStore.js`) to include an update method:
   ```javascript
   updateDashboardData: (newData) => set((state) => ({
     revenue: newData.revenue,
     cost: newData.cost,
     transactions: newData.transactions,
     fte: newData.fte,
   })),
   ```

2. **Add real-time sync to your App** (`src/App.jsx`):
   ```javascript
   import { useRealtimeDataSync } from './utils/realtimeSharepointSync'

   function App() {
     // Sync every 5 minutes
     useRealtimeDataSync({
       interval: 5 * 60 * 1000,
       onDataUpdate: (data) => console.log('Dashboard data updated!'),
       onError: (error) => console.error('Sync failed:', error),
     })

     return <Dashboard />
   }
   ```

3. **Start both services:**
   ```bash
   # Terminal 1: Sync API
   node server/sync-api.mjs

   # Terminal 2: Dev server
   npm run dev
   ```

Now your dashboard **automatically updates every 5 minutes** without any manual action! 🎉

---

## Comparison Table

| Feature | Approach 1 | Approach 2 | Approach 3 |
|---------|-----------|-----------|-----------|
| Setup time | < 1 min | < 1 min | 5-10 min |
| Manual action | Yes | 1x per session | None |
| Auto-updates | No | Per session | Yes, every 5 min |
| Requires backend | No | No | Yes |
| Best for | Testing | Development | Production |
| Cost | Free | Free | Minimal (small server) |

---

## Polling Intervals

Adjust sync frequency in real-time hook:
```javascript
// Every 1 minute
useRealtimeDataSync({ interval: 1 * 60 * 1000 })

// Every 5 minutes (default)
useRealtimeDataSync({ interval: 5 * 60 * 1000 })

// Every 15 minutes
useRealtimeDataSync({ interval: 15 * 60 * 1000 })

// Every hour
useRealtimeDataSync({ interval: 60 * 60 * 1000 })
```

---

## Production Deployment

For production, use a hosted backend:

### Option A: Vercel/Netlify Serverless
Create `api/sync.js`:
```javascript
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed')

  try {
    // Your sync logic here
    const data = await fetchSharePointData()
    res.json({ success: true, data })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
```

### Option B: Cloud Run / App Engine
Deploy the sync-api.mjs server to Google Cloud, AWS, or similar.

### Option C: Cron Job + CI/CD
Use GitHub Actions to sync on schedule:
```yaml
schedule:
  - cron: '*/5 * * * *'  # Every 5 minutes
```

---

## Troubleshooting

**Q: Dashboard doesn't update automatically**
- A: Check browser console for errors
- A: Verify API endpoint is running on localhost:3001
- A: Check CORS is enabled if API on different domain

**Q: "Too many sync requests"**
- A: Increase `CACHE_DURATION` in sync-api.mjs
- A: Increase poll `interval` in React hook

**Q: Dashboard freezes during sync**
- A: Normal - sync happens briefly. Shows in console
- A: If blocking, implement debouncing in store update

---

## Next Steps
- ✅ Start with **Approach 1** (manual sync)
- 📈 Move to **Approach 2** when you want startup automation
- 🚀 Use **Approach 3** for production real-time dashboard
