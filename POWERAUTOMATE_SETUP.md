# Power Automate Real-Time Data Sync Setup

This guide enables **Power Automate** to monitor your SharePoint Excel file and trigger live data updates to your dashboard.

---

## Architecture

```
SharePoint Excel File
         ↓
   Power Automate Flow (triggered on file change)
         ↓
   HTTP POST to Vercel Webhook
         ↓
   Dashboard Auto-Syncs & Updates
         ↓
Users see live data (10-30 seconds latency)
```

---

## Prerequisites

✅ SharePoint file access  
✅ Power Automate license (Free tier included with Microsoft 365)  
✅ Vercel deployment: `https://gmr-ssc-pnl.vercel.app`  
✅ Webhook endpoint already configured: `/api/webhooks/sharepoint`

---

## Step 1: Create Power Automate Flow

### Option A: Cloud Flow (Recommended)

1. **Go to Power Automate**
   - Navigate to https://make.powerautomate.com
   - Sign in with your Microsoft account
   - Click **+ Create** → **Cloud Flow** → **Automated cloud flow**

2. **Configure Trigger**
   - Choose trigger: **SharePoint - When a file is created or modified**
   - **Site Address**: Select your SharePoint site (e.g., `https://contoso.sharepoint.com/sites/GMRTeam`)
   - **Library**: Select the library containing your Excel file (e.g., `Finance Documents`)
   - Leave folder blank (monitors whole library)

3. **Add Action: HTTP Request**
   - Click **+ New Step**
   - Search for **HTTP**
   - Select **HTTP** action

4. **Configure HTTP Request**
   ```
   Method: POST
   URI: https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint
   
   Headers:
   Content-Type: application/json
   Authorization: Bearer <your-auth-token>  (optional, if needed)
   
   Body:
   {
     "resource": "@triggerOutputs()['body']['_DisplayString']",
     "changeType": "updated",
     "timestamp": "@utcNow()"
   }
   ```

5. **Save the flow**
   - Give it a name: "GMR Dashboard - Real-Time Data Sync"
   - Click **Save**

---

## Step 2: Add Error Handling (Optional but Recommended)

1. **Click "+ New Step"** after HTTP action
2. **Search for "Condition"** and add it
3. **Set up condition**:
   - Left field: `@outputs('HTTP')['statusCode']`
   - Operator: `is equal to`
   - Right field: `200`
4. **In "If no" branch**, add **Send email notification** to alert on failure

---

## Step 3: Add File Filter (Optional - Only Monitor Specific Files)

To monitor **only** your Excel file:

1. **Add Condition after trigger**
2. **Expression**:
   ```
   @and(
     contains(triggerBody()?['properties']?['displayName'], 'Financial'),
     endsWith(triggerBody()?['properties']?['displayName'], '.xlsx')
   )
   ```
   (Adjust to match your file name)

---

## Step 4: Add Throttling (Prevent Duplicate Triggers)

Power Automate may trigger multiple times for one file change. Add **Delay** action:

1. **Click "+ New Step"** before HTTP request
2. **Search for "Delay"**
3. **Set duration**: 5 seconds
4. This prevents multiple syncs within 5 seconds

---

## Step 5: Test the Flow

1. **Click "Test"** → **Manually**
2. **Edit your Excel file** in SharePoint (add a row or change a cell)
3. Watch the Power Automate flow execute in real-time
4. Check your dashboard - it should refresh automatically within 10-30 seconds

---

## Alternative: Scheduled Flow (More Control)

If you want **scheduled syncs instead of event-based**:

1. **Create new flow**: **Cloud flow** → **Scheduled cloud flow**
2. **Configure**:
   - Repeat: Every **5 minutes** (or desired interval)
   - Add the same HTTP action to call webhook
3. **Benefits**: 
   - More predictable
   - No risk of too many triggers
   - Consistent refresh rate

---

## Troubleshooting

### Flow not triggering?
- ✅ Verify file is in the correct SharePoint library
- ✅ Check that file path matches trigger condition
- ✅ Run manual test first
- ✅ Check Power Automate run history for errors

### Webhook not responding?
- ✅ Verify Vercel URL is correct: `https://gmr-ssc-pnl.vercel.app`
- ✅ Check `/api/webhooks/sharepoint.js` is deployed
- ✅ Look at Vercel function logs for errors

### Dashboard not updating?
- ✅ Open browser console (F12)
- ✅ Check for webhook sync completion message
- ✅ Verify data files were updated (`src/data/sampleData.js`)

---

## Monitoring & Logging

### View Power Automate Logs
1. Go to https://make.powerautomate.com
2. Select your flow
3. Click **Run history** to see all executions

### View Vercel Webhook Logs
1. Go to https://vercel.com/dashboard
2. Select your project
3. Go to **Deployments** → **Functions** → **sharepoint**
4. View logs for each execution

---

## Advanced: Add Data Transformation (Optional)

If you need to transform data before sending:

1. **Add "Compose" action** after HTTP trigger
2. **Inputs**: 
   ```json
   {
     "fileName": "@triggerBody()?['properties']?['displayName']",
     "changedTime": "@triggerBody()?['properties']?['modified']",
     "changedBy": "@triggerBody()?['properties']?['author']?['displayName']"
   }
   ```
3. **Send composed data in HTTP request body**

---

## Real-Time Dashboard Updates Flow

```
1. User edits Excel in SharePoint
            ↓ (instant)
2. Power Automate detects change
            ↓ (< 5 sec)
3. Calls /api/webhooks/sharepoint
            ↓ (< 2 sec)
4. Webhook triggers npm run sync-data
            ↓ (< 10 sec)
5. Data files updated in memory
            ↓ (< 2 sec)
6. Dashboard polls and detects new data
            ↓ (< 5 sec)
7. Charts & KPIs refresh automatically
            ↓
Users see live updates (Total: 20-30 seconds)
```

---

## Next Steps

✅ Set up Power Automate flow above  
✅ Test with manual file edit  
✅ Monitor run history for successful executions  
✅ Optional: Add email notifications on failures  
✅ Optional: Set up dashboard alerts for data sync status  

---

## Related Files

- **Webhook Handler**: [`api/webhooks/sharepoint.js`](api/webhooks/sharepoint.js)
- **Real-Time Sync Util**: [`src/utils/useRealtimeWebhookSync.js`](src/utils/useRealtimeWebhookSync.js)
- **Sync Script**: [`scripts/sharepoint-sync.mjs`](scripts/sharepoint-sync.mjs)
