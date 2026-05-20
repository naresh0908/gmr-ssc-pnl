# Power Automate Flow Quick Reference

## 🚀 Quick Setup (5 minutes)

### 1. Create Flow
- Go to https://make.powerautomate.com
- Click **+ Create** → **Automated cloud flow**
- Trigger: **SharePoint - When a file is created or modified**

### 2. Configuration
| Field | Value |
|-------|-------|
| **Trigger Site** | Your SharePoint Site URL |
| **Trigger Library** | Document library containing your Excel file |
| **Action** | HTTP - POST |
| **URL** | `https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint` |
| **Method** | POST |
| **Content-Type** | application/json |

### 3. HTTP Body
```json
{
  "fileName": "@{triggerBody()?['properties']?['displayName']}",
  "changeType": "updated",
  "timestamp": "@{utcNow()}"
}
```

### 4. Save & Test
- Name: "GMR Dashboard - Live Sync"
- Click **Save**
- Edit Excel file in SharePoint to test

---

## 🔍 Validate Webhook Endpoint

**Test if your webhook is reachable**:

```bash
curl -X GET https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint

# Expected response:
# {
#   "status": "webhook-active",
#   "endpoint": "/api/webhooks/sharepoint",
#   "lastSync": "2026-05-20T10:30:45.123Z",
#   "timestamp": "2026-05-20T10:35:12.456Z"
# }
```

---

## 📊 Power Automate Flow Diagram

```
┌─────────────────────────────────┐
│ SharePoint File Modified        │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ Delay 5 seconds (anti-bounce)   │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ HTTP POST to /api/webhooks/...  │
│ with file name & timestamp      │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ Webhook Triggers npm sync-data  │
│ (runs SharePoint-Excel sync)    │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ Data Files Updated in Memory    │
│ (sampleData.js, etc)            │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ Dashboard Detects New Data      │
│ (polling every 5 sec)           │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ Charts & KPIs Auto-Refresh ✅   │
│ (20-30 sec total latency)       │
└─────────────────────────────────┘
```

---

## 📋 Step-by-Step Power Automate Actions

### Action 1: Trigger
```
Action: SharePoint - When a file is created or modified
├─ Site: [Your SharePoint Site]
└─ Library: [Your Document Library]
```

### Action 2: Delay (optional but recommended)
```
Action: Delay
├─ Count: 5
└─ Unit: Seconds
```

### Action 3: HTTP Request
```
Action: HTTP
├─ Method: POST
├─ URI: https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint
├─ Headers:
│  └─ Content-Type: application/json
└─ Body:
   {
     "fileName": "@triggerBody()?['properties']?['displayName']",
     "changeType": "updated",
     "timestamp": "@utcNow()",
     "source": "power-automate"
   }
```

### Action 4: Compose Response (optional)
```
Action: Compose
├─ Inputs:
   {
     "status": "@outputs('HTTP')['statusCode']",
     "body": "@outputs('HTTP')['body']",
     "time": "@utcNow()"
   }
└─ Used for logging/debugging
```

### Action 5: Send Email on Failure (optional)
```
Action: Condition
├─ If: statusCode != 200
└─ Then: Send email notification
   ├─ To: admin@company.com
   ├─ Subject: "Dashboard Sync Failed"
   └─ Body: 
      Status: @{outputs('HTTP')['statusCode']}
      Error: @{outputs('HTTP')['body']}
      Time: @{utcNow()}
```

---

## 🧪 Test Your Flow

### Manual Test
1. In Power Automate, click **Test**
2. Select **Manually** 
3. Click **Test**
4. Go to SharePoint and edit your Excel file
5. Watch the flow execute in Power Automate
6. Check dashboard - should update in 20-30 seconds

### Check Execution Logs
1. Open your flow
2. Click **Run history**
3. Look for recent executions
4. Click any run to see details

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Flow doesn't trigger | ✅ Verify file is in correct library |
| | ✅ Check trigger site is set correctly |
| | ✅ Try manual test first |
| HTTP 404 error | ✅ Verify URL: `https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint` |
| | ✅ Check Vercel deployment is active |
| HTTP 500 error | ✅ Check Vercel function logs |
| | ✅ Ensure Node.js sync script works locally: `npm run sync-data` |
| Dashboard not updating | ✅ Check browser console for errors (F12) |
| | ✅ Verify webhook actually triggered (check Power Automate logs) |
| | ✅ Hard refresh dashboard (Ctrl+Shift+R) |

---

## 📊 Monitoring Dashboard

### Real-Time Status in Dashboard
Your dashboard now shows:
- ✅ Last sync time
- ✅ Sync status (success/failure)
- ✅ Data refresh timestamp
- ✅ Webhook connection status

### Power Automate Monitoring
- Check run history: https://make.powerautomate.com
- Monitor success rate of syncs
- Set up alerts for failures

---

## 🎯 Expected Behavior

After setting up Power Automate:

1. **Edit Excel in SharePoint**
   - Add a row, update a cell, etc.

2. **Power Automate Flow Triggers**
   - Within 30-60 seconds

3. **Webhook Receives Notification**
   - Immediately sends sync command

4. **Data Syncs**
   - Takes 5-15 seconds

5. **Dashboard Updates**
   - Displays new data on next poll (5 sec)

**Total latency: 20-30 seconds from Excel change to dashboard update**

---

## 🔒 Security

- ✅ Webhook validates requests
- ✅ Vercel functions are serverless (no persistent server)
- ✅ Data stored in Git (version controlled)
- ✅ Add authentication header if needed:
  ```
  Authorization: Bearer <your-token>
  ```

---

## 📞 Need Help?

1. Check Power Automate run history for detailed error messages
2. Check Vercel logs: https://vercel.com/dashboard
3. Run manual sync: `npm run sync-data`
4. Review webhook handler: `api/webhooks/sharepoint.js`
