# Power Automate Setup - Detailed Step-by-Step Guide

## 📋 Complete Setup Instructions with Screenshots

---

## Phase 1: Prerequisites Verification (5 minutes)

### Step 1.1: Verify SharePoint Access

1. **Open SharePoint**
   - URL: `https://[your-tenant].sharepoint.com`
   - Sign in with your Microsoft 365 account

2. **Locate Your Document Library**
   - Navigate to your site (e.g., "Finance", "GMR Team")
   - Find the library containing your Excel file
   - Example path: `Sites > Finance > Shared Documents > Financial_2026.xlsx`

3. **Note Down These Details** (you'll need them later):
   ```
   Site URL: https://[your-tenant].sharepoint.com/sites/[site-name]
   Library Name: [exact name from URL]
   File Name: [your Excel filename]
   ```

### Step 1.2: Verify Vercel Deployment

1. **Open Vercel Dashboard**
   - URL: https://vercel.com/dashboard
   - Sign in with your GitHub account

2. **Find Your Project**
   - Look for "gmr-ssc-pnl"
   - Should show "Production" deployment
   - Status should be green (✓ Ready)

3. **Get Your Deployment URL**
   - Click on the project
   - Copy the production URL: `https://gmr-ssc-pnl.vercel.app`
   - **Save this URL** (needed in Step 3)

4. **Verify Webhook Endpoint**
   ```
   Open: https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint
   
   Expected response:
   {
     "status": "webhook-active",
     "endpoint": "/api/webhooks/sharepoint",
     "lastSync": "...",
     "timestamp": "..."
   }
   
   If 404: Webhook not deployed - deploy first
   If 500: Check Vercel function logs
   ```

### Step 1.3: Verify Power Automate Access

1. **Open Power Automate**
   - URL: https://make.powerautomate.com
   - Sign in with your Microsoft 365 account
   - Same account as SharePoint

2. **Check License**
   - You should see options to create flows
   - Free tier includes Cloud flows
   - If you see "Limited access", ask admin for access

3. **Note Your Environment**
   - Top right shows your environment (usually "Default")
   - **Save this** for reference

---

## Phase 2: Create Power Automate Flow (10 minutes)

### Step 2.1: Navigate to Create Flow

1. **Open Power Automate**
   - URL: https://make.powerautomate.com
   - Sign in

2. **Locate Create Button**
   - Top left corner: Click **+ Create**
   - See menu with options

3. **Select Automated Cloud Flow**
   ```
   + Create
   ├─ Automated cloud flow ← SELECT THIS
   ├─ Instant cloud flow
   ├─ Scheduled cloud flow
   └─ Desktop flow
   ```

### Step 2.2: Name Your Flow

When dialog opens:

```
Flow name field:
  Clear any default text
  Type: "GMR Dashboard - Live Sync"
  
Choose a cloud flow trigger:
  [Search box]
  Type: "SharePoint"
  
Select trigger:
  "When a file is created or modified" ← SELECT THIS
```

### Step 2.3: Configure SharePoint Trigger

After selecting trigger, you'll see a form:

```
┌─ SharePoint Trigger Configuration ─┐
│                                    │
│ Site Address *                     │
│ [Dropdown]                         │
│ Click → Select your site           │
│                                    │
│ Library Name *                     │
│ [Dropdown]                         │
│ Click → Select your library        │
│                                    │
│ Folder                             │
│ [Optional - leave blank]           │
│                                    │
└────────────────────────────────────┘
```

**Detailed steps:**

1. **Site Address field:**
   - Click the dropdown
   - Search for your site name (e.g., "Finance", "GMR")
   - Select it from list
   - URL appears: `https://[tenant].sharepoint.com/sites/[site]`

2. **Library Name field:**
   - Click the dropdown (appears after Site is selected)
   - Search for your library (e.g., "Shared Documents", "Finance Data")
   - Select it
   - Library name appears

3. **Folder field:**
   - Leave empty (monitors entire library)
   - If you have multiple files, leave blank for now

4. **Click "Create"**
   - Flow template created
   - You now see the flow designer

---

## Phase 3: Add Actions to Flow (15 minutes)

### Step 3.1: Trigger is Created

You should see:

```
┌─────────────────────────────────────┐
│ When a file is created or modified  │
│                                     │
│ Site Address: [...your site...]     │
│ Library Name: [...your library...]  │
└─────────────────────────────────────┘
        │
        │ (Flow continues below)
        ▼
    [Add next step]
```

### Step 3.2: Add Delay Action

1. **Click "+ New Step"** (below the trigger)
   - Blue button in the middle

2. **Search for Delay**
   - In the search box: type "delay"
   - Click on **Delay** action (from Control category)

3. **Configure Delay**
   ```
   Delay window appears:
   
   Count: [1]      ← Change to: 5
   Unit: [Seconds] ← Keep as Seconds (default)
   ```

   **After configuration:**
   ```
   ┌─────────────────────────────────────┐
   │ Delay                               │
   │                                     │
   │ Count: 5                            │
   │ Unit: Seconds                       │
   └─────────────────────────────────────┘
   ```

4. **Click elsewhere to save**

### Step 3.3: Add HTTP Action

1. **Click "+ New Step"** (below Delay)

2. **Search for HTTP**
   - In search box: type "http"
   - Look for **HTTP** action (not "HTTP Webhook")
   - Click it

3. **HTTP Action appears**
   ```
   ┌─────────────────────────────────────┐
   │ HTTP                                │
   │                                     │
   │ Method: [Get ▼]                     │
   │ URI: [empty]                        │
   │ Headers: [empty]                    │
   │ Body: [empty]                       │
   │ ...                                 │
   └─────────────────────────────────────┘
   ```

### Step 3.4: Configure HTTP - Method

1. **Method dropdown**
   - Click: [Get ▼]
   - Select: **POST**
   - Shows: [POST]

### Step 3.5: Configure HTTP - URI

1. **URI field**
   - Click in the empty URI field
   - Paste exactly:
     ```
     https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint
     ```
   - Do NOT include trailing slash
   - Verify no typos

### Step 3.6: Configure HTTP - Headers

1. **Headers field**
   - Click in Headers field
   - A JSON editor may appear, or header rows

   **If rows appear:**
   - Row 1:
     - Header name: `Content-Type`
     - Header value: `application/json`

   **If JSON editor appears:**
   ```json
   {
     "Content-Type": "application/json"
   }
   ```

### Step 3.7: Configure HTTP - Body

This is the most important part. The Body contains the data sent to webhook.

1. **Body field**
   - Click in Body field
   - Delete any default content

2. **Add Dynamic Content**
   - You'll see a panel appear on right: "Dynamic content"
   - OR you can type JSON and mix with dynamic values

3. **Compose the Body**

   **Option A: Manual Entry (Recommended for beginners)**
   
   Copy and paste this:
   ```json
   {
     "fileName": "",
     "changeType": "updated",
     "timestamp": "",
     "source": "power-automate"
   }
   ```

   Now replace empty strings with dynamic content:
   - `"fileName": ""` → click the field, see Dynamic content panel
   - Search for "displayName" → select it from trigger outputs
   - Result: `"fileName": "@triggerBody()?['properties']?['displayName']"`

   - `"timestamp": ""` → in Dynamic content panel
   - Search for "utcNow" or click Functions tab
   - Select utcNow() function
   - Result: `"timestamp": "@utcNow()"`

   **Final Body:**
   ```json
   {
     "fileName": "@triggerBody()?['properties']?['displayName']",
     "changeType": "updated",
     "timestamp": "@utcNow()",
     "source": "power-automate"
   }
   ```

   **Option B: Using Dynamic Content Panel (Advanced)**
   
   1. Body field is empty
   2. Right panel shows "Dynamic content"
   3. Click each output you want to include
   4. Power Automate auto-inserts the reference

---

## Phase 4: Save & Test (10 minutes)

### Step 4.1: Save the Flow

1. **Top right corner**
   - Click **Save** button (floppy disk icon)
   - You'll see "Saving..." then "Flow saved"

2. **Verify Save**
   - Flow name appears at top: "GMR Dashboard - Live Sync"
   - No errors shown

3. **Copy Flow URL**
   - The URL bar shows: `https://make.powerautomate.com/environments/[env]/flows/[flow-id]`
   - **Save this URL** for later reference

### Step 4.2: Test the Flow - Manual Test

1. **Click "Test"** (top right)
   - Button appears next to Save
   - Click it

2. **Select Test Option**
   ```
   Test flow window:
   ○ Manually ← SELECT THIS
   ○ Using a previous run
   ```

3. **Click "Test"**
   - Flow begins "waiting for trigger"

4. **Trigger the Flow**
   - In another browser tab, open SharePoint
   - Navigate to your file
   - Make a change:
     - Add text to a cell
     - Change a value
     - Add a new row
   - **Save the file** (Ctrl+S)

5. **Watch Power Automate**
   - Back in Power Automate tab
   - Watch the flow execute
   - You should see:
     ```
     ✓ When a file is created or modified [outputs shown]
     ✓ Delay [5 seconds passed]
     ✓ HTTP [statusCode: 200 or similar]
     ```

6. **Check Response**
   - Click on HTTP action
   - Expand "Outputs"
   - Should see:
     ```json
     {
       "statusCode": 200,
       "body": {
         "success": true,
         "message": "Dashboard data updated",
         "timestamp": "..."
       }
     }
     ```

### Step 4.3: Verify Dashboard Update

1. **Open Dashboard**
   - URL: https://gmr-ssc-pnl.vercel.app
   - In another tab

2. **Note Current Time**
   - Look at KPI cards
   - Note the last refresh time

3. **Make Another File Change**
   - Back in SharePoint
   - Edit your Excel file again

4. **Wait 20-30 Seconds**
   - Power Automate trigger: ~5 sec
   - Sync execution: ~10 sec
   - Dashboard poll: ~5 sec
   - Total: 20-30 sec

5. **Refresh Dashboard** (F5)
   - Watch KPI values
   - Should show updated data
   - Timestamp should change

### Step 4.4: Check Power Automate Logs

1. **In Power Automate**
   - Click your flow name
   - Click **Run history**
   - You should see recent runs

2. **Each run shows:**
   - ✓ or ✗ (success/failure)
   - Timestamp
   - Duration
   - Click run to see details

3. **Details view shows:**
   - Trigger inputs and outputs
   - Each action result
   - Any errors

---

## Phase 5: Optimization (Optional - 10 minutes)

### Step 5.1: Add File Filter (Only Monitor Specific File)

If you want to monitor ONLY one file (not entire library):

1. **After Trigger, add Condition**
   - Click "+ New Step"
   - Search: "Condition"
   - Select: "Condition"

2. **Set up condition**
   ```
   Condition logic:
   
   Choose a value: [Dropdown]
   ├─ Click dropdown
   ├─ Type: "displayName"
   ├─ Select: displayName (from trigger output)
   
   Choose an operator: [Dropdown]
   ├─ Select: "contains"
   
   Choose a value: [Text field]
   ├─ Type: "Financial" (or your filename part)
   ```

3. **Structure becomes:**
   ```
   ┌─ If                      ─┐
   │ displayName contains      │
   │ "Financial"               │
   │                          │
   │ [Then - add HTTP here]   │
   │                          │
   │ [Else - do nothing]      │
   └──────────────────────────┘
   ```

4. **Move HTTP action**
   - Remove HTTP from main flow
   - Add it inside "If yes" branch
   - Leave "If no" empty

### Step 5.2: Add Error Notification

Get notified if sync fails:

1. **After HTTP action, add Condition**
   - "+ New Step"
   - Search: "Condition"

2. **Set condition**
   ```
   Choose a value: @outputs('HTTP')['statusCode']
   Operator: is not equal to
   Choose a value: 200
   ```

3. **In "If yes" branch** (error occurred):
   - "+ Add an action"
   - Search: "Send email"
   - Select: "Office 365 Outlook - Send an email"
   - Fill in:
     ```
     To: your-email@company.com
     Subject: ⚠️ Dashboard Sync Failed
     Body:
     Status Code: @{outputs('HTTP')['statusCode']}
     Error: @{outputs('HTTP')['body']}
     Time: @{utcNow()}
     ```

4. **Save**

---

## Phase 6: Ongoing Monitoring (5 minutes weekly)

### Step 6.1: Check Success Rate

**Weekly check:**

1. Open Power Automate flow
2. Click "Run history"
3. Look at recent runs (past 7 days)
4. Calculate success rate:
   ```
   Success rate = (# successful runs) / (# total runs) × 100%
   Goal: >95% success
   ```

### Step 6.2: Monitor Webhook Endpoint

**Weekly:**

1. Test webhook health:
   ```
   GET https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint
   ```

2. Should return:
   ```json
   {
     "status": "webhook-active",
     "lastSync": "...",
     "timestamp": "..."
   }
   ```

### Step 6.3: Dashboard Status Page

Your dashboard shows (bottom):
- ✅ Last sync time
- ✅ Sync status
- ✅ Connection health

Monitor this section for issues.

---

## 🔍 Troubleshooting Reference

### Issue: Flow doesn't trigger

**Check 1: SharePoint trigger configuration**
```
In Power Automate flow:
1. Click the trigger
2. Verify Site Address is set
3. Verify Library Name is set
4. Edit and save if needed
```

**Check 2: File location**
```
In SharePoint:
1. Confirm file is in selected library
2. Try making change to a different file
3. Confirm flow triggers
```

**Check 3: Manual test**
```
In Power Automate:
1. Click "Test"
2. Select "Manually"
3. Edit file in SharePoint
4. Watch flow execute
```

### Issue: HTTP 404 error

**Problem: Webhook endpoint not found**

**Solution:**
```
1. Verify URL: https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint
2. Check no extra slashes or typos
3. Verify Vercel project deployed:
   https://vercel.com/dashboard → gmr-ssc-pnl → Status
4. Check function exists:
   GET https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint
   Should NOT return 404
```

### Issue: HTTP 500 error

**Problem: Webhook error**

**Debugging:**
```
1. Check Vercel logs:
   https://vercel.com/dashboard
   → gmr-ssc-pnl project
   → Functions tab
   → Click sharepoint
   → View logs
   
2. Common errors:
   - npm run sync-data failed
   - Azure credentials missing
   - File path incorrect
   
3. Test locally:
   npm run sync-data
   (should complete without errors)
```

### Issue: Dashboard doesn't update

**Checklist:**
```
□ Power Automate flow ran (check run history)
□ HTTP status 200 (not 404 or 500)
□ 20-30 seconds passed since webhook call
□ Hard refresh dashboard: Ctrl+Shift+R
□ Browser console (F12) shows no errors
□ Data files actually updated:
  ls src/data/sampleData.js (check timestamp)
```

---

## ✅ Verification Checklist

Before considering setup complete:

### Part 1: Power Automate
- [ ] Flow created with correct name
- [ ] SharePoint trigger configured
- [ ] Correct site selected
- [ ] Correct library selected
- [ ] Delay added (5 seconds)
- [ ] HTTP action added
- [ ] HTTP method: POST
- [ ] HTTP URI: correct Vercel URL
- [ ] Headers: Content-Type: application/json
- [ ] Body: includes fileName, changeType, timestamp
- [ ] Flow saved
- [ ] Test run: successful
- [ ] Run history shows recent executions

### Part 2: Webhook
- [ ] Vercel project deployed
- [ ] Webhook endpoint accessible: GET https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint
- [ ] Endpoint returns 200 status
- [ ] Response includes "webhook-active" status
- [ ] Sync script works locally: npm run sync-data

### Part 3: Dashboard
- [ ] Dashboard loads: https://gmr-ssc-pnl.vercel.app
- [ ] KPI cards display
- [ ] Dashboard data updated after file change
- [ ] Latency: 20-30 seconds
- [ ] Refresh occurs automatically (no manual refresh needed)

### Part 4: Monitoring
- [ ] Power Automate run history shows executions
- [ ] Success rate >95%
- [ ] No HTTP errors in Power Automate logs
- [ ] No errors in Vercel function logs
- [ ] Email notifications set up (if configured)

---

## 🎯 Expected Behavior

**Complete workflow:**

```
1. Team member opens Excel in SharePoint
2. Edits a value or adds a row
3. Saves the file (Ctrl+S)
   ↓ (5 seconds)
4. Power Automate trigger fires
5. Sends notification to webhook
   ↓ (2 seconds)
6. Webhook receives request
7. Triggers npm run sync-data
   ↓ (10 seconds)
8. Data syncs from SharePoint
9. Files updated in memory
   ↓ (3 seconds)
10. Dashboard polls for new data
11. Detects changes
    ↓ (5 seconds)
12. Charts and KPIs refresh
    ↓
13. Other team members see updated data

TOTAL TIME: 20-30 seconds from file edit to dashboard update
```

---

## 📞 Support Resources

**If you get stuck:**

1. **Check Power Automate Logs**
   - Flow name → Run history → Failed run
   - Click run to see error details

2. **Check Vercel Logs**
   - Dashboard → Project → Functions
   - Select "sharepoint" function
   - View real-time logs

3. **Test Webhook Locally**
   ```bash
   curl -X GET https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint
   ```

4. **Test Sync Locally**
   ```bash
   npm run sync-data
   ```

5. **Common Files**
   - Webhook handler: `api/webhooks/sharepoint.js`
   - Sync script: `scripts/sharepoint-sync.mjs`
   - Configuration: `.env` (check SHAREPOINT_SITE, SHAREPOINT_FILE_NAME)

---

## 🎉 Success!

Once everything works:
- ✅ Dashboard updates automatically
- ✅ No manual syncs needed
- ✅ Team sees live data
- ✅ 20-30 second latency
- ✅ Scalable to multiple users

**You now have a real-time dashboard!**
