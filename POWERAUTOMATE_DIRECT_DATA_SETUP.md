# Power Automate - Direct Data Sync Setup

**For: HARTS Scholarship Live Dashboard**

This is the SIMPLIFIED approach where Power Automate reads your Excel file and sends data directly to the dashboard (no Azure auth needed on Vercel).

---

## 🎯 How It Works

```
Power Automate detects file change
     ↓
Reads Excel sheets (Revenue, Cost, Transactions, FTE)
     ↓
Converts to JSON arrays
     ↓
POSTs data to webhook
     ↓
Dashboard files update instantly
     ↓
Dashboard auto-refreshes ✅
```

**Result:** Live data with no extra authentication or complexity!

---

## 📋 Prerequisites

✅ Power Automate account (Microsoft 365)
✅ Access to HARTSFellowship-2025 SharePoint site
✅ Your HARTS Excel file (Doc2.xlsx)

---

## 🚀 Setup Steps

### Step 1: Open Power Automate

```
https://make.powerautomate.com
→ Sign in with your Microsoft 365 account
→ Create → Automated cloud flow
→ Name: "HARTS Dashboard - Live Data"
→ Trigger: "When a file is created or modified"
```

### Step 2: Configure Trigger

```
Site Address: 
https://gobalharts.sharepoint.com/sites/HARTSFellowship-2025

Library Name: 
[Select from dropdown - your file location]

Folder: [Leave blank]

Click: Create
```

### Step 3: Add Delay (5 seconds)

```
New Step
→ Search: "Delay"
→ Count: 5, Unit: Seconds
```

### Step 4: Add "Get file content" Action

```
New Step
→ Search: "SharePoint" 
→ Select: "Get file content"

Site Address:
https://gobalharts.sharepoint.com/sites/HARTSFellowship-2025

Library Name: [Select same as trigger]

File: [Select your Excel file]
```

### Step 5: Add "Parse JSON" for Excel Data

This is tricky because Power Automate needs to parse the Excel file. We'll use a workaround:

```
New Step
→ Search: "HTTP"
→ Select: HTTP action

Method: GET
URI: https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint-data?method=get-template

This gets the data structure template
```

Actually, **simpler approach** - we'll manually add the actions to read each sheet:

### Step 5 (REVISED): Add Actions to Read Excel Sheets

For each Excel sheet, add these actions:

#### 5a. List rows in Excel online

```
New Step
→ Search: "Excel Online"
→ Select: "List rows present in a table"

Location: Your SharePoint site
Document Library: Your library
File: Doc2 (or your file)
Table: Revenue
```

Click "Edit in advanced mode" to see the data structure.

Repeat for:
- Cost table
- Transactions table  
- FTE table

#### 5b. Create JSON Output

The response from each Excel action is an object. You need to extract just the array of rows.

Let's say the Excel action outputs: `@body('List_rows_present_in_a_table')?['value']`

### Step 6: Add HTTP POST Action (Send to Webhook)

```
New Step
→ Search: "HTTP"
→ Select: HTTP action

Method: POST

URI:
https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint-data

Headers:
Content-Type: application/json

Body:
{
  "revenue": @{body('List_rows_from_Revenue_table')?['value']},
  "cost": @{body('List_rows_from_Cost_table')?['value']},
  "transactions": @{body('List_rows_from_Transactions_table')?['value']},
  "fte": @{body('List_rows_from_FTE_table')?['value']}
}
```

Where:
- `List_rows_from_Revenue_table` = name of your Revenue Excel action
- `List_rows_from_Cost_table` = name of your Cost Excel action
- etc.

### Step 7: Save & Test

```
Click: Save
Click: Test
Select: Manually trigger
Click: Test Flow
```

Then in SharePoint:
1. Edit your Excel file (change a cell)
2. Save
3. Watch Power Automate run
4. Check HTTP response (should be 200)

---

## 📊 Expected Response

When successful, you'll see:

```json
{
  "success": true,
  "message": "Data synced",
  "rows": {
    "revenue": 48,
    "cost": 156,
    "transactions": 2340,
    "fte": 420
  }
}
```

---

## 🔄 What Happens After

1. **Data files update** (src/data/*.js)
2. **Dashboard detects change** (polling or Zustand store)
3. **Charts refresh** automatically
4. **No page refresh needed** ✅

---

## ✅ Success Checklist

- [ ] Power Automate flow created
- [ ] SharePoint trigger configured
- [ ] All 4 Excel actions added (Revenue, Cost, Transactions, FTE)
- [ ] HTTP POST action configured
- [ ] Headers set to Content-Type: application/json
- [ ] Body has correct JSON structure
- [ ] Flow saved
- [ ] Test run successful (HTTP 200)
- [ ] Dashboard updated automatically
- [ ] File edit triggered sync (manual test)

---

## 🐛 Troubleshooting

### Issue: "Cannot find 'List_rows...' in body"

**Problem:** Excel action has different name
**Fix:** Check the exact name of each Excel action step, use that in the Body

### Issue: HTTP 400 "Invalid data structure"

**Problem:** One of the arrays is missing or empty
**Fix:** Check that all 4 Excel actions are returning data (`?['value']` part)

### Issue: HTTP 404

**Problem:** Wrong webhook URL
**Fix:** Verify: `https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint-data`

### Issue: Flow runs but dashboard doesn't update

**Problem:** Data format might be wrong or file write failed
**Fix:** Check Vercel logs at https://vercel.com/dashboard

### Issue: Excel Online action says "Table not found"

**Problem:** Your Excel sheets aren't formatted as tables
**Fix:** In Excel:
1. Select your data
2. Home → Format as Table
3. Name the table "Revenue", "Cost", etc.

---

## 📱 Real-Time Flow Diagram

```
[File Edit in SharePoint]
            ↓
[Power Automate detects]
            ↓
[Reads all 4 sheets] 
            ↓
[Converts to JSON arrays]
            ↓
[POSTs to webhook]
            ↓
[Webhook writes to files]
            ↓
[Dashboard refreshes]
            ↓
[Charts show new data]
```

**Total time:** 10-15 seconds

---

## 🔗 Quick Reference

| Item | Value |
|------|-------|
| Webhook URL | https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint-data |
| Method | POST |
| SharePoint Site | HARTSFellowship-2025 |
| Excel File | Doc2.xlsx |
| Required Tables | Revenue, Cost, Transactions, FTE |
| Latency | 10-15 seconds |

---

## 🎉 You're Done!

Your HARTS dashboard now has **true live data sync**:
- ✅ No manual refresh needed
- ✅ Automatic when file changes  
- ✅ No Azure credentials on Vercel
- ✅ Simple and reliable

Just edit your Excel file and watch the dashboard update in real-time! 🚀

---

## 📞 Need Help?

**Vercel Logs:** https://vercel.com/dashboard (check for errors)

**Test Webhook:** 
```
GET https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint-data
```
Should return: `{"status": "ok", "message": "Power Automate data webhook ready"}`

---

**Version:** 2.0 (Direct Data Sync) | **Updated:** May 20, 2026
