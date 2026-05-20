# Power Automate Flow Setup - HARTS Fellowship

**Your Specific Configuration**

```
Site: HARTSFellowship-2025
Library: Shared Documents
File: Doc2.xlsx
Tables: Revenue, Cost, Transactions, FTE
```

---

## 🚀 Complete Step-by-Step Setup

### **STEP 1: Create the Flow**

Open: https://make.powerautomate.com

1. Click **Create**
2. Select **Automated cloud flow**
3. Name: `HARTS Dashboard - Live Data`
4. Trigger: Search for and select **"When a file is created or modified"**
5. Click **Create**

---

### **STEP 2: Configure the Trigger**

In the trigger action, fill:

```
Site Address: 
https://gobalharts.sharepoint.com/sites/HARTSFellowship-2025

Library Name: 
Shared Documents

Folder: [Leave empty]
```

Click **Create**

---

### **STEP 3: Add 5-Second Delay**

1. Click **+ New step**
2. Search for `Delay`
3. Select **Delay** action
4. Configure:
   - **Count:** 5
   - **Unit:** Seconds

---

### **STEP 4: Read Revenue Sheet**

1. Click **+ New step**
2. Search for `Excel Online`
3. Select **List rows present in a table**
4. Configure:
   ```
   Location: https://gobalharts.sharepoint.com/sites/HARTSFellowship-2025
   Document Library: Shared Documents
   File: Doc2
   Table: Revenue
   ```

**Rename this step to:** `List_rows_Revenue`
(Right-click the action header, select "Rename")

---

### **STEP 5: Read Cost Sheet**

1. Click **+ New step**
2. Search for `Excel Online`
3. Select **List rows present in a table**
4. Configure:
   ```
   Location: https://gobalharts.sharepoint.com/sites/HARTSFellowship-2025
   Document Library: Shared Documents
   File: Doc2
   Table: Cost
   ```

**Rename to:** `List_rows_Cost`

---

### **STEP 6: Read Transactions Sheet**

1. Click **+ New step**
2. Search for `Excel Online`
3. Select **List rows present in a table**
4. Configure:
   ```
   Location: https://gobalharts.sharepoint.com/sites/HARTSFellowship-2025
   Document Library: Shared Documents
   File: Doc2
   Table: Transactions
   ```

**Rename to:** `List_rows_Transactions`

---

### **STEP 7: Read FTE Sheet**

1. Click **+ New step**
2. Search for `Excel Online`
3. Select **List rows present in a table**
4. Configure:
   ```
   Location: https://gobalharts.sharepoint.com/sites/HARTSFellowship-2025
   Document Library: Shared Documents
   File: Doc2
   Table: FTE
   ```

**Rename to:** `List_rows_FTE`

---

### **STEP 8: Send Data to Webhook**

1. Click **+ New step**
2. Search for `HTTP`
3. Select **HTTP** action
4. Configure:

```
Method: POST

URI: 
https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint-data

Headers: [Click to add]
Header 1:
  Name: Content-Type
  Value: application/json

Headers: [Click to add]
Header 2:
  Name: X-Source
  Value: power-automate-harts

Body: [Paste below]
```

**For the Body**, click on the Body field and paste this exactly:

```
{
  "revenue": @{body('List_rows_Revenue')?['value']},
  "cost": @{body('List_rows_Cost')?['value']},
  "transactions": @{body('List_rows_Transactions')?['value']},
  "fte": @{body('List_rows_FTE')?['value']}
}
```

---

### **STEP 9: Save the Flow**

1. Click **Save** (top right)
2. You should see a green checkmark

---

## ✅ Test Your Flow

### **Test Run 1: Manual Trigger**

1. Click **Test** (top right)
2. Select **Manually trigger a cloud flow**
3. Click **Test**
4. Watch the flow run
5. All steps should turn green ✓

If any steps fail:
- Click the failed step
- See the error message
- Fix the issue (usually table name mismatch)

### **Test Run 2: Edit Your File**

1. Go to your SharePoint: https://gobalharts.sharepoint.com/sites/HARTSFellowship-2025
2. Find **Shared Documents**
3. Open **Doc2.xlsx**
4. Edit a cell (change any value)
5. Save (Ctrl+S)
6. Go back to Power Automate
7. Watch the flow run automatically ✅

### **Test Run 3: Verify Dashboard Updated**

1. Go to: https://gmr-ssc-pnl.vercel.app
2. Hard refresh: **Ctrl+Shift+R** (or Cmd+Shift+R on Mac)
3. Check if your data changed ✓

---

## 🎯 Verifying Success

**In Power Automate run history, you should see:**

```
✅ Trigger: When file modified - Succeeded
✅ Delay - Succeeded  
✅ List_rows_Revenue - Succeeded (12 rows)
✅ List_rows_Cost - Succeeded (45 rows)
✅ List_rows_Transactions - Succeeded (342 rows)
✅ List_rows_FTE - Succeeded (89 rows)
✅ HTTP - Succeeded (HTTP 200)
```

**In HTTP response body:**

```json
{
  "success": true,
  "message": "Data synced",
  "rows": {
    "revenue": 12,
    "cost": 45,
    "transactions": 342,
    "fte": 89
  }
}
```

---

## 🐛 Troubleshooting

### **Issue: "List_rows_Revenue action failed"**

**Possible cause:** Table name wrong or table doesn't exist

**Fix:**
1. Go to your Excel file
2. Click the table
3. In ribbon, see **Table Name** field
4. Confirm it's exactly `Revenue` (case-sensitive)
5. Update the action if needed

### **Issue: HTTP returned 400 or 404**

**Possible cause:** Webhook URL wrong or body format invalid

**Fix:**
1. Verify URL: `https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint-data`
2. Check Body syntax in HTTP action
3. Make sure all references are correct: `body('List_rows_Revenue')` etc.

### **Issue: Dashboard didn't update**

**Possible causes:**
1. Flow ran but HTTP failed
2. Dashboard cache issue
3. Data format mismatch

**Fix:**
1. Check Power Automate run history
2. Click on HTTP action
3. See the response
4. Hard refresh dashboard: Ctrl+Shift+R
5. Wait 15 seconds

### **Issue: Excel table not showing in "Table" dropdown**

**Fix:**
1. Go to your Excel file
2. Select your data
3. Home → Format as Table
4. Give it a name: `Revenue`, `Cost`, etc.
5. Save
6. Refresh Power Automate action

---

## 🔄 Daily Usage

After setup, your workflow is:

```
1. Edit Doc2.xlsx in SharePoint
2. Save the file
3. Power Automate detects change (automatic)
4. Sends data to webhook (automatic)
5. Dashboard updates (automatic)
6. Done! ✅
```

**No manual steps needed. It just works.**

---

## 📋 Flow Checklist

- [ ] Flow created and named "HARTS Dashboard - Live Data"
- [ ] Trigger configured for Shared Documents / Doc2.xlsx
- [ ] Delay step added (5 seconds)
- [ ] List_rows_Revenue action added and renamed
- [ ] List_rows_Cost action added and renamed
- [ ] List_rows_Transactions action added and renamed
- [ ] List_rows_FTE action added and renamed
- [ ] HTTP POST action added
- [ ] Headers set (Content-Type: application/json)
- [ ] Body JSON correct with all 4 data sources
- [ ] Flow saved
- [ ] Manual test successful (all green)
- [ ] File edit test successful (dashboard updated)

---

## 🎉 Final Result

Your HARTS dashboard is now **completely live**:

✅ Changes in Excel → Automatic to dashboard  
✅ No manual refresh needed  
✅ Works every single time  
✅ 10-15 second sync time  
✅ Zero maintenance  

**You're done!** 🚀

---

## 📞 Quick Reference

| Item | Value |
|------|-------|
| **Webhook URL** | https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint-data |
| **Site** | https://gobalharts.sharepoint.com/sites/HARTSFellowship-2025 |
| **Library** | Shared Documents |
| **File** | Doc2.xlsx |
| **Tables** | Revenue, Cost, Transactions, FTE |
| **Method** | POST |
| **Headers** | Content-Type: application/json |

---

**Setup Time:** 10-15 minutes  
**Testing Time:** 5 minutes  
**Total:** ~20 minutes to live data sync ✅

---

**Version:** 2.0 Direct Data | **Date:** May 20, 2026 | **For:** HARTS Fellowship
