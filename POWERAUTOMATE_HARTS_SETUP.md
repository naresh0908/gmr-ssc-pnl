# Power Automate Live Data Sync - Customized Setup for Your File

## 📋 Your File Information (Extracted from URL)

From your SharePoint URL, I've identified:

```
Tenant: gobalharts.sharepoint.com
Site: HARTSFellowship-2025
Document: Doc2.aspx (Excel file)
Document ID: 0ca6c96d-326d-4cd4-8f93-5f2dbf2ca22a
```

**Full URL:**
```
https://gobalharts.sharepoint.com/:x:/r/sites/HARTSFellowship-2025/...
```

---

## 🚀 STEP-BY-STEP SETUP FOR YOUR FILE

### Step 1: Identify Your Document Library

Since you have the file URL, let's find the exact library:

1. **Open the file in SharePoint**
   ```
   https://gobalharts.sharepoint.com/sites/HARTSFellowship-2025/
   ```

2. **Navigate to document location**
   - Click the file link
   - In the file details, look for "Library name"
   - Common names: "Shared Documents", "Documents", "Finance Data", etc.

3. **Note the library name**
   ```
   Your Library: ________________________
   ```

4. **Get the site URL**
   ```
   https://gobalharts.sharepoint.com/sites/HARTSFellowship-2025
   ```

5. **Get the filename**
   - Exact filename: ___________________________
   - (From URL or file properties)

### Step 2: Prepare Your Information

**Fill in your details:**

```
Tenant Domain: gobalharts.sharepoint.com
Site Name: HARTSFellowship-2025
Site URL: https://gobalharts.sharepoint.com/sites/HARTSFellowship-2025
Library Name: [Find this - see Step 1]
File Name: Doc2 (or actual filename)
Your Vercel Dashboard URL: https://gmr-ssc-pnl.vercel.app
Webhook Endpoint: https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint
```

---

## 🔧 POWER AUTOMATE CONFIGURATION (STEP-BY-STEP)

### Step 3: Create Power Automate Flow

**Detailed instructions:**

1. **Open Power Automate**
   ```
   https://make.powerautomate.com
   ```

2. **Sign in**
   - Use your Microsoft 365 account (same as SharePoint)
   - Make sure you're in the right tenant

3. **Create New Flow**
   - Click **+ Create** (top left)
   - Select **Automated cloud flow**
   - In dialog:
     ```
     Flow name: "HARTS Scholarship - Live Data Sync"
     Choose a trigger: [Search box]
     Type: SharePoint
     Select: "When a file is created or modified"
     ```

4. **Click Create**
   - New flow editor opens

### Step 4: Configure SharePoint Trigger (CRITICAL)

This is where you connect to your specific file:

```
┌─────────────────────────────────────────────┐
│ WHEN A FILE IS CREATED OR MODIFIED          │
├─────────────────────────────────────────────┤
│                                             │
│ Site Address *  [Dropdown]                  │
│ → Click dropdown                            │
│ → Search: "HARTSFellowship-2025"           │
│ → Select the full URL:                      │
│   https://gobalharts.sharepoint.com/sites/  │
│   HARTSFellowship-2025                      │
│                                             │
│ Library Name *  [Dropdown]                  │
│ → Click (after Site is selected)            │
│ → You'll see list of libraries              │
│ → Select where your file is located         │
│   (e.g., "Shared Documents")                │
│                                             │
│ Folder  [Optional]                          │
│ → Leave blank (unless file in subfolder)    │
│                                             │
└─────────────────────────────────────────────┘
```

**IMPORTANT:** The dropdown will show your site because you're logged in with your Microsoft 365 account.

### Step 5: Add Delay (Anti-bounce)

1. **Click "+ New Step"**

2. **Search: "Delay"**
   - Select **Delay** from Control category

3. **Configure:**
   ```
   Count: 5
   Unit: Seconds
   ```

### Step 6: Add HTTP Request to Webhook

1. **Click "+ New Step"**

2. **Search: "HTTP"**
   - Select **HTTP** action (not HTTP Webhook)

3. **Configure HTTP Action:**

   **Method:**
   ```
   POST
   ```

   **URI:**
   ```
   https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint
   ```

   **Headers:**
   ```
   Content-Type: application/json
   ```

   **Body:**
   ```json
   {
     "fileName": "@triggerBody()?['properties']?['displayName']",
     "siteUrl": "https://gobalharts.sharepoint.com/sites/HARTSFellowship-2025",
     "changeType": "updated",
     "timestamp": "@utcNow()",
     "source": "power-automate-harts"
   }
   ```

4. **Important Notes:**
   - Replace the siteUrl with your exact URL
   - Keep the @ symbols (they're dynamic content markers)
   - The JSON must be valid (no typos)

### Step 7: Save the Flow

1. **Click "Save"** (top right)
2. Wait for "Flow saved" message
3. Note the flow URL for future reference

---

## 🧪 TESTING YOUR SETUP

### Test 1: Verify Configuration

1. **In Power Automate:**
   - Click the trigger
   - Verify Site shows: `HARTSFellowship-2025`
   - Verify Library shows: `[Your Library]`

2. **In HTTP action:**
   - Verify URI: `https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint`
   - Verify Headers: `Content-Type: application/json`
   - Verify Body has dynamic content

### Test 2: Manual Trigger Test

1. **Click "Test"** in Power Automate
   - Select "Manually"
   - Click "Test"

2. **In SharePoint (new tab):**
   - Navigate to your file: 
     ```
     https://gobalharts.sharepoint.com/sites/HARTSFellowship-2025/
     ```
   - Open your Excel file (Doc2)
   - Make a change:
     - Edit a cell
     - Add a row
     - Change a value
   - Save (Ctrl+S)

3. **Watch Power Automate:**
   - You should see flow execute
   - Green checkmarks on each step:
     ✓ SharePoint trigger
     ✓ Delay
     ✓ HTTP request

4. **Check HTTP Response:**
   - Expand HTTP action
   - Look for: `"statusCode": 200`
   - Or similar success code

### Test 3: Dashboard Update

1. **Open Dashboard:**
   ```
   https://gmr-ssc-pnl.vercel.app
   ```

2. **Note current values** in KPI cards

3. **Make another file change** in SharePoint

4. **Wait 20-30 seconds**

5. **Refresh dashboard** (F5)
   - Should show updated values
   - Proves data synced successfully

---

## 📊 FLOW SUMMARY

What happens when someone edits your file:

```
File: Doc2.xlsx (HARTSFellowship-2025 site)
         ↓ (Edited in Excel or web)
SharePoint notifies Power Automate
         ↓ (< 5 sec)
Flow trigger fires
         ↓
Delay 5 seconds (prevent duplicate triggers)
         ↓
HTTP POST to webhook
         ↓ (< 2 sec)
Webhook receives at: 
  https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint
         ↓
Triggers: npm run sync-data
         ↓ (< 10 sec)
Data syncs from SharePoint to local
         ↓
Dashboard detects new data
         ↓ (next poll cycle, max 5 sec)
Charts & KPIs refresh
         ↓
Team sees live data ✓

TOTAL LATENCY: 20-30 seconds
```

---

## 🔍 TROUBLESHOOTING FOR YOUR SETUP

### Issue 1: Can't find site in dropdown

**Problem:** Site "HARTSFellowship-2025" doesn't appear

**Solutions:**
1. **Make sure logged into correct Microsoft account**
   - Power Automate account = SharePoint account
   - Same email used for both

2. **Clear browser cache**
   - Ctrl+Shift+Delete
   - Clear all

3. **Try typing site URL manually**
   - Some dropdowns accept manual entry
   - Type: `https://gobalharts.sharepoint.com/sites/HARTSFellowship-2025`

4. **Try different browser**
   - Sometimes Firefox/Chrome/Safari have issues

### Issue 2: Can't find library in dropdown

**Problem:** Library dropdown empty or doesn't show your library

**Solutions:**
1. **Verify site is selected first**
   - Site Address must be selected before Library dropdown appears

2. **Check file location**
   - Open your file in SharePoint
   - Look at breadcrumb or "Current location"
   - Note exact library name

3. **If still not showing:**
   - You might not have permissions
   - Ask SharePoint admin to verify access

### Issue 3: HTTP returns 404

**Problem:** Webhook endpoint not found

**Solutions:**
```
1. Verify exact URL (no typos):
   https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint

2. Test in browser:
   Paste URL in address bar
   Should see JSON response (not 404)

3. Check Vercel deployment:
   https://vercel.com/dashboard
   gmr-ssc-pnl project should show "Ready"

4. If still 404:
   - Deploy the function:
     git push (redeploys to Vercel)
```

### Issue 4: Flow runs but dashboard doesn't update

**Checklist:**
```
□ Power Automate run history shows success?
□ HTTP status: 200?
□ Waited 30 seconds?
□ Hard refresh dashboard: Ctrl+Shift+R?
□ Check browser console (F12) for errors?
□ Verify data files exist: src/data/sampleData.js?
```

---

## ✅ SUCCESS CHECKLIST

Before considering setup complete:

```
POWER AUTOMATE SETUP:
☐ Flow created: "HARTS Scholarship - Live Data Sync"
☐ Trigger configured with YOUR site
☐ Trigger configured with YOUR library
☐ Delay added: 5 seconds
☐ HTTP action added
☐ HTTP method: POST
☐ HTTP URI: correct Vercel URL
☐ Headers: Content-Type: application/json
☐ Body: includes your file info
☐ Flow saved

TESTING:
☐ Manual test: flow runs without errors
☐ Manual test: HTTP returns 200
☐ File change made: edit, save
☐ Power Automate triggered
☐ All actions completed successfully

VERIFICATION:
☐ Power Automate run history shows runs
☐ Dashboard loads: https://gmr-ssc-pnl.vercel.app
☐ Dashboard updated after file change
☐ Latency: 20-30 seconds acceptable
☐ Multiple test runs successful
☐ Success rate: > 95%
```

---

## 📝 YOUR SPECIFIC CONFIGURATION

**For easy reference, save these values:**

```
MY POWER AUTOMATE SETUP:
=======================
Flow Name: HARTS Scholarship - Live Data Sync
Trigger Site: HARTSFellowship-2025
Trigger Library: [Enter your library name]
File Name: Doc2 (or actual name)

HTTP Configuration:
Method: POST
URL: https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint
Content-Type: application/json

Expected Latency: 20-30 seconds from file edit to dashboard update
```

---

## 🎯 NEXT STEPS

1. **Gather your info** (Site, Library, File name)
2. **Create Power Automate flow** (Follow Step 3-4 above)
3. **Add actions** (Delay + HTTP) (Step 5-6 above)
4. **Save** (Step 7 above)
5. **Test** (Follow Testing section above)
6. **Monitor** (Check run history weekly)

---

## 🚀 WHEN IT'S WORKING

You'll know setup is successful when:

✅ **Edit Excel in SharePoint**
   - Change a cell value
   - Add a row
   - Click save

✅ **Power Automate triggers** (automatic)
   - You see flow run in Power Automate
   - Completes in 15-20 seconds

✅ **Dashboard updates** (automatic)
   - Refresh page (F5)
   - New data appears
   - Changed values are visible

✅ **No manual steps**
   - Just edit and save
   - Everything else automatic

---

## 🆘 SUPPORT

If you get stuck:

1. **Check Power Automate Run History**
   - https://make.powerautomate.com
   - Your flow → Run history
   - Click failed run to see error

2. **Check Vercel Logs**
   - https://vercel.com/dashboard
   - gmr-ssc-pnl → Functions → sharepoint
   - View logs for errors

3. **Test Webhook Locally**
   ```bash
   # In terminal:
   curl https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint
   
   # Should return JSON (not 404)
   ```

4. **Test Sync Locally**
   ```bash
   npm run sync-data
   # Should complete successfully
   ```

5. **Review Docs**
   - POWERAUTOMATE_DETAILED_STEPS.md (comprehensive)
   - POWERAUTOMATE_TROUBLESHOOTING.md (common issues)

---

## 📚 Related Documentation

- **Quick Card:** POWERAUTOMATE_QUICKCARD.md
- **Detailed Steps:** POWERAUTOMATE_DETAILED_STEPS.md
- **Visual Guide:** POWERAUTOMATE_VISUAL_GUIDE.md
- **Checklist:** POWERAUTOMATE_CHECKLIST.md
- **Setup Guide:** POWERAUTOMATE_SETUP.md

---

## 🎉 You're Ready!

Follow the steps above and your dashboard will get **live data from your SharePoint file!**

**From now on:**
- No manual syncs
- No stale data
- Just automatic updates
- 20-30 second latency

**Questions?** See troubleshooting section or reference docs above.

Good luck! 🚀
