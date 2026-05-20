# 🚀 HARTS Live Data Sync - NEW SIMPLE METHOD

**Direct data from Power Automate (No Azure Credentials Needed!)**

---

## 📋 Your File Details

```
Tenant: gobalharts.sharepoint.com
Site: HARTSFellowship-2025
File: Doc2.xlsx
Webhook: https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint-data
```

---

## ⚡ 7-Step Quick Setup

### 1️⃣ Open Power Automate
```
https://make.powerautomate.com
Create → Automated cloud flow
```

### 2️⃣ Set Trigger
```
Name: "HARTS Dashboard - Live Data"
Trigger: When a file is created or modified
Site: HARTSFellowship-2025
Library: [Your library]
```

### 3️⃣ Add 5-Second Delay
```
New Step → Delay
Count: 5, Unit: Seconds
```

### 4️⃣ Read Revenue Sheet
```
New Step → Excel Online
List rows present in a table
Table: Revenue
```

### 5️⃣ Read Other Sheets
```
Repeat Step 4 for:
- Cost
- Transactions  
- FTE
```

### 6️⃣ Send to Webhook
```
New Step → HTTP

Method: POST

URI: https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint-data

Headers:
Content-Type: application/json

Body:
{
  "revenue": @{body('List_rows_from_Revenue')?['value']},
  "cost": @{body('List_rows_from_Cost')?['value']},
  "transactions": @{body('List_rows_from_Transactions')?['value']},
  "fte": @{body('List_rows_from_FTE')?['value']}
}
```

### 7️⃣ Save & Test
```
Save
Test (Manual)
Edit Excel file
Watch flow run
Check HTTP 200 ✓
```

---

## ✅ Test it Works

```
1. Edit a cell in Doc2.xlsx
2. Save the file
3. Watch Power Automate run
4. Wait 15 seconds
5. Refresh dashboard
6. See updated data ✓
```

---

## 🎯 Key Advantages

| Old Method | ✅ New Method |
|-----------|-------------|
| Needs Azure credentials | No auth needed |
| Sync re-fetches from SharePoint | Direct data from Excel |
| Slow + complex | Fast + simple |
| Sync could fail | Reliable |

---

## 📌 Critical: Table Names in Excel

Your Excel file MUST have tables named:
- `Revenue`
- `Cost`
- `Transactions`
- `FTE`

**If not formatted as tables:**
1. Select data range
2. Home → Format as Table
3. Name each table correctly
4. Save

---

## 🔍 Quick Fixes

| Issue | Fix |
|-------|-----|
| "Table not found" | Format Excel data as tables + name them |
| HTTP 400 | Check table names match exactly |
| HTTP 404 | Verify webhook URL (no typos) |
| Dashboard not updating | Check Power Automate ran + wait 15 sec |

---

## 🎉 What Happens

```
Edit Excel (1 sec)
         ↓
Power Automate detects (2 sec)
         ↓
Reads all sheets (3 sec)
         ↓
Sends to webhook (1 sec)
         ↓
Dashboard updates (3 sec)
         ↓
Charts refresh ✅
━━━━━━━━━━━━━━
TOTAL: 10-15 sec
```

---

## 🔗 Webhook Details

```
URL: https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint-data
Method: POST
Expected Response: HTTP 200
Response Body: {"success": true, "message": "Data synced"}
```

---

## 📊 Expected JSON Body

```json
{
  "revenue": [
    {"Column1": "value", "Column2": "value"},
    ...
  ],
  "cost": [
    {"Column1": "value", "Column2": "value"},
    ...
  ],
  "transactions": [
    {...},
    ...
  ],
  "fte": [
    {...},
    ...
  ]
}
```

---

## ✨ Success Indicators

✅ Flow runs automatically when file changes
✅ HTTP returns 200
✅ Response shows row counts
✅ Dashboard updates in 10-15 seconds
✅ No manual steps needed
✅ Works every time

---

## 📋 Checklist

- [ ] Power Automate flow created
- [ ] Trigger configured (HARTSFellowship-2025 site)
- [ ] Excel actions for Revenue, Cost, Txn, FTE
- [ ] HTTP action configured
- [ ] Correct webhook URL
- [ ] Headers set correctly
- [ ] Body JSON correct
- [ ] Flow saved
- [ ] Manual test successful

---

## 🎯 Final Check

Open browser console while editing Excel:
```javascript
// Should see in dashboard logs:
"Data received: 48 revenue rows, 156 cost rows..."
```

---

## 🚀 You're All Set!

Your HARTS file now syncs **automatically to the dashboard** with the new simplified method!

**No Azure. No complications. Just live data.** ✅

---

**Version:** 2.0 (Simplified Direct Data) | **Updated:** May 20, 2026
