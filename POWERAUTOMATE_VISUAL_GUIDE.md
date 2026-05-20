# Power Automate Visual Setup Guide

## 📱 Complete Step-by-Step Setup

### Prerequisites ✅
- Microsoft 365 account (with SharePoint access)
- Power Automate access (comes free with M365)
- Your SharePoint file URL
- Vercel deployment active: https://gmr-ssc-pnl.vercel.app

---

## Step 1️⃣: Access Power Automate

```
Browser → https://make.powerautomate.com
         ↓
    Sign in with Microsoft Account
         ↓
    Click "+ Create"
```

**Screenshot reference:**
- Top left: **+ Create** button
- Choose: **Automated cloud flow**
- Name your flow: "GMR Dashboard - Live Sync"

---

## Step 2️⃣: Set Up Trigger

```
Flow name: "GMR Dashboard - Live Sync"
         ↓
Choose a trigger: [Search box]
         ↓
Type: "SharePoint"
         ↓
Select: "When a file is created or modified"
```

**Configuration:**
```
Field: Site Address
Value: [Select your SharePoint site]
       Example: "https://contoso.sharepoint.com/sites/Finance"

Field: Library Name
Value: [Select library with Excel file]
       Example: "Shared Documents" or "Finance Data"

Field: Folder
Value: [Leave blank - monitors entire library]
```

---

## Step 3️⃣: Add Delay (Anti-Bounce)

```
Click: "+ New Step"
       ↓
Search: "Delay"
       ↓
Select: "Delay" action
```

**Configuration:**
```
Count: 5
Unit: Seconds
```

**Why?** Prevents multiple triggers from same edit

---

## Step 4️⃣: Add HTTP Request

```
Click: "+ New Step"
       ↓
Search: "HTTP"
       ↓
Select: "HTTP" action
```

**Fill in these fields:**

### Method
```
☑ POST
```

### URI
```
https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint
```

### Headers
```
Content-Type  →  application/json
```

### Body
```
{
  "fileName": "@triggerBody()?['properties']?['displayName']",
  "changeType": "updated",
  "timestamp": "@utcNow()",
  "source": "power-automate"
}
```

**How to add Body:**
1. Click in Body field
2. Delete default placeholder
3. Copy entire JSON above
4. Paste it
5. Click in the JSON to enable dynamic content insertion
6. Replace quoted values like `"@triggerBody()..."` with dynamic content from Power Automate

---

## Step 5️⃣: Test & Save

```
Click: "Save" (top right)
       ↓
Flow saved!
       ↓
Click: "Test"
       ↓
Select: "Manually"
       ↓
Click: "Test"
```

**Now trigger it:**
1. In another browser tab, open SharePoint
2. Find your Excel file
3. Edit it (add a cell, change a value)
4. Power Automate flow should run
5. Check dashboard - should update in 20-30 sec

---

## 🔍 Verify Setup

### Power Automate Logs
1. Open your flow
2. Click **Run history**
3. You should see recent executions
4. Click on one to see details

**Expected success response:**
```json
{
  "statusCode": 200,
  "body": {
    "success": true,
    "message": "Dashboard data updated",
    "timestamp": "2026-05-20T10:30:45.123Z"
  }
}
```

### Dashboard Behavior
1. When webhook triggers, dashboard automatically:
   - Calls `npm run sync-data`
   - Fetches fresh data from SharePoint
   - Updates data files in memory
   - Next poll cycle shows new data (within 5 sec)

2. You should see:
   - New values in KPI cards
   - Updated charts
   - Refreshed timestamps

---

## 🔧 Optional Enhancements

### Add File Filter (Only Monitor Specific File)

After Trigger, add a **Condition**:

```
Click: "+ New Step" (after trigger)
       ↓
Search: "Condition"
       ↓
Select: "Condition" control
```

**Set up:**
```
Left field:   @triggerBody()?['properties']?['displayName']
Operator:     contains
Right field:  Financial    [or your filename]
```

Then:
- In **If yes**, add the HTTP action
- In **If no**, do nothing

---

### Add Error Notifications

After HTTP action:

```
Click: "+ New Step"
       ↓
Search: "Condition"
       ↓
Add condition:
  Left:     @outputs('HTTP')['statusCode']
  Operator: is not equal to
  Right:    200

In "If yes" branch:
  Action: Send email
  To: your-email@company.com
  Subject: ⚠️ Dashboard Sync Failed
  Body: 
    Status: @{outputs('HTTP')['statusCode']}
    Error: @{outputs('HTTP')['body']}
    Time: @{utcNow()}
```

---

## 📊 Sample Flow JSON (Import Ready)

You can also import a pre-configured flow:

```json
{
  "definition": {
    "$schema": "https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#",
    "triggers": {
      "When_a_file_is_created_or_modified": {
        "type": "ApiConnection",
        "inputs": {
          "host": {
            "connection": {
              "name": "@parameters('$connections')['shared_sharepointonline']['connectionId']"
            }
          },
          "method": "get",
          "path": "/datasets/sites/@{encodeURIComponent(triggerBody()?['properties']?['parentReference']?['siteId'])}/lists/@{encodeURIComponent(triggerBody()?['properties']?['parentReference']?['listId'])}/onupdateditemsnotification",
          "queries": {
            "folderPath": "/"
          }
        },
        "recurrence": {
          "frequency": "Second",
          "interval": 3
        }
      }
    },
    "actions": {
      "Delay": {
        "type": "Wait",
        "inputs": {
          "interval": {
            "count": 5,
            "unit": "Second"
          }
        }
      },
      "HTTP": {
        "type": "Http",
        "inputs": {
          "method": "POST",
          "uri": "https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint",
          "headers": {
            "Content-Type": "application/json"
          },
          "body": {
            "fileName": "@triggerBody()?['properties']?['displayName']",
            "changeType": "updated",
            "timestamp": "@utcNow()",
            "source": "power-automate"
          }
        }
      }
    }
  }
}
```

---

## ✅ Checklist

Before running your flow:

- [ ] SharePoint file exists and is accessible
- [ ] Vercel deployment is live: `https://gmr-ssc-pnl.vercel.app`
- [ ] Webhook endpoint exists: `/api/webhooks/sharepoint`
- [ ] Flow trigger is set to correct site & library
- [ ] HTTP URL is exactly: `https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint`
- [ ] Headers include: `Content-Type: application/json`
- [ ] Body JSON is properly formatted
- [ ] Flow is saved
- [ ] Manual test passes

---

## 🎬 Expected Timeline

```
T+0s    User edits Excel in SharePoint
        ↓
T+2s    SharePoint notifies Power Automate
        ↓
T+5s    Delay completes
        ↓
T+7s    HTTP request sent to webhook
        ↓
T+9s    Webhook received, sync triggered
        ↓
T+15s   npm run sync-data completes
        ↓
T+20s   Data files updated
        ↓
T+25s   Dashboard detects new data
        ↓
T+30s   Charts refresh automatically ✅
```

**Total latency: ~30 seconds**

---

## 🆘 Common Issues & Fixes

| Problem | Solution |
|---------|----------|
| Flow doesn't run after file edit | 1. Check site/library selection<br>2. Try editing again<br>3. Check run history for errors |
| HTTP 404 error | 1. Verify Vercel URL<br>2. Check deployment is active<br>3. Verify `/api/webhooks/sharepoint` path |
| HTTP 500 error | 1. Check Vercel function logs<br>2. Verify `npm run sync-data` works locally<br>3. Check Azure credentials in `.env` |
| Dashboard doesn't update | 1. Force refresh (Ctrl+Shift+R)<br>2. Check browser console (F12)<br>3. Wait 30 seconds for sync cycle<br>4. Verify webhook actually ran in Power Automate logs |
| Too many syncs | Add longer Delay (increase to 30 seconds) |

---

## 📞 Support

1. **Check Power Automate Logs**: Run history → Details
2. **Check Vercel Logs**: Dashboard → Functions → sharepoint
3. **Verify Webhook**: GET https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint
4. **Test Sync Manually**: Run `npm run sync-data` locally

---

## 🎉 Next Steps

✅ Your dashboard now updates **automatically** when SharePoint file changes!

**What happens next:**
- Every time someone edits the Excel file
- Power Automate detects the change
- Webhook triggers automatic data sync
- Dashboard refreshes with latest data
- Team sees live P&L, KPIs, and insights

**No more manual refreshes needed!**
