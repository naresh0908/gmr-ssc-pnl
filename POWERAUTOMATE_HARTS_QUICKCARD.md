# HARTS Scholarship Live Data Sync - Quick Reference Card

**For HARTSFellowship-2025 SharePoint Site**

---

## 📋 Your File Details

```
Tenant: gobalharts.sharepoint.com
Site: HARTSFellowship-2025
File: Doc2.xlsx
Location: https://gobalharts.sharepoint.com/sites/HARTSFellowship-2025/
Document ID: 0ca6c96d-326d-4cd4-8f93-5f2dbf2ca22a
```

---

## 🚀 Quick Setup (7 Steps)

### 1️⃣ Open Power Automate
```
https://make.powerautomate.com
Sign in with your Microsoft 365 account
```

### 2️⃣ Create Automated Flow
```
+ Create
→ Automated cloud flow
→ Name: "HARTS Scholarship - Live Data Sync"
→ Trigger: "When a file is created or modified"
```

### 3️⃣ Configure Trigger
```
Site Address: 
  https://gobalharts.sharepoint.com/sites/HARTSFellowship-2025
  
Library Name: 
  [Select from dropdown - where your file is located]
  
Folder: [Leave blank]

Click: Create
```

### 4️⃣ Add Delay
```
+ New Step
→ Search: "Delay"
→ Count: 5, Unit: Seconds
```

### 5️⃣ Add HTTP Request
```
+ New Step
→ Search: "HTTP"
→ Select: HTTP action

Method: POST

URI: 
https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint

Headers:
Content-Type: application/json
```

### 6️⃣ Add Body
```json
{
  "fileName": "@triggerBody()?['properties']?['displayName']",
  "siteUrl": "https://gobalharts.sharepoint.com/sites/HARTSFellowship-2025",
  "changeType": "updated",
  "timestamp": "@utcNow()",
  "source": "power-automate-harts"
}
```

### 7️⃣ Save & Test
```
Click: Save
Click: Test
Edit your file in SharePoint
Watch flow run
Check: HTTP 200 ✓
```

---

## ✅ Test Workflow

```
1. Open SharePoint file
   https://gobalharts.sharepoint.com/sites/HARTSFellowship-2025/

2. Make a change (edit cell, add row)

3. Save file (Ctrl+S)

4. Watch Power Automate trigger
   (Check run history in Power Automate)

5. Verify: HTTP status 200

6. Wait 20-30 seconds

7. Refresh dashboard
   https://gmr-ssc-pnl.vercel.app

8. See updated data ✓
```

---

## 🔍 Key Configuration Values

| Item | Value |
|------|-------|
| **Tenant** | gobalharts.sharepoint.com |
| **Site** | HARTSFellowship-2025 |
| **Webhook URL** | https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint |
| **Method** | POST |
| **Latency** | 20-30 seconds |

---

## 🐛 Quick Fixes

| Issue | Fix |
|-------|-----|
| Flow won't trigger | Check trigger site/library selected |
| HTTP 404 | Verify webhook URL (no typos) |
| HTTP 500 | Check Vercel logs + run npm run sync-data |
| Dashboard not updating | Wait 30 sec, hard refresh: Ctrl+Shift+R |
| Too many runs | Increase Delay to 30 seconds |

---

## ✨ Success Indicators

✅ Flow runs automatically when file changes
✅ HTTP returns status 200
✅ Dashboard updates in 20-30 seconds
✅ No manual sync steps needed
✅ Run history shows > 95% success rate

---

## 📍 File Information

**Your specific file:**
```
Site: HARTSFellowship-2025
Tenant: gobalharts
URL: https://gobalharts.sharepoint.com/sites/HARTSFellowship-2025/
File: Doc2 (or actual filename)
```

**Find exact library:**
1. Open your file
2. Look at top breadcrumb
3. Library name appears there
4. Example: "Shared Documents" or "Finance Data"

---

## 🎯 What Happens

```
You edit Excel
     ↓ 5 sec
Power Automate detects
     ↓ 2 sec
Sends to webhook
     ↓ 10 sec
Data syncs
     ↓ 3 sec
Dashboard updates
     ↓ 5 sec
Charts refresh
━━━━━━━━━━━━
TOTAL: 20-30 sec
```

---

## 📱 Troubleshooting

**Q: Flow doesn't trigger?**
A: Verify trigger site/library set correctly

**Q: HTTP 404 error?**
A: Check Vercel URL is exactly correct

**Q: Dashboard not updating?**
A: Hard refresh (Ctrl+Shift+R) + wait 30 sec

**Q: Need more help?**
A: See POWERAUTOMATE_HARTS_SETUP.md for detailed steps

---

## 🔗 Quick Links

| Resource | URL |
|----------|-----|
| Power Automate | https://make.powerautomate.com |
| Your SharePoint | https://gobalharts.sharepoint.com/sites/HARTSFellowship-2025/ |
| Dashboard | https://gmr-ssc-pnl.vercel.app |
| Vercel Logs | https://vercel.com/dashboard |

---

## 📋 Tracking

- [ ] Flow created
- [ ] Trigger configured (site: HARTSFellowship-2025)
- [ ] Library selected
- [ ] Delay added (5 sec)
- [ ] HTTP action added
- [ ] Headers correct
- [ ] Body correct JSON
- [ ] Flow saved
- [ ] Test run successful (HTTP 200)
- [ ] Dashboard updated

---

## 🎉 Done!

Your HARTS Scholarship file now syncs **automatically** to the dashboard!

**No more manual syncs. Just live data.** ✅

---

**Version:** 1.0 | **For:** HARTS Fellowship 2025 | **Updated:** May 20, 2026
