# Power Automate Setup - Quick Reference Card

**Print this page and keep it nearby!**

---

## 🚀 30-Second Overview

```
SharePoint file changes
        ↓ (30 sec total)
Power Automate detects
        ↓
Calls webhook
        ↓
Dashboard auto-refreshes
        ↓
Team sees live data ✓
```

---

## 📋 5-Step Setup

### 1️⃣ Create Flow
- Go: https://make.powerautomate.com
- Create: **Automated cloud flow**
- Trigger: **When file created/modified**
- Site: [Your SharePoint Site]
- Library: [Your Document Library]

### 2️⃣ Add Delay
- "+ New Step"
- Action: **Delay**
- Count: **5** Seconds

### 3️⃣ Add HTTP Request
- "+ New Step"  
- Action: **HTTP**
- Method: **POST**
- URI: **https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint**

### 4️⃣ Add Headers
```
Content-Type: application/json
```

### 5️⃣ Add Body
```json
{
  "fileName": "@triggerBody()?['properties']?['displayName']",
  "changeType": "updated",
  "timestamp": "@utcNow()",
  "source": "power-automate"
}
```

### ✅ Save & Test
- Click **Save**
- Click **Test** → Make Excel change
- Should see: HTTP 200 ✓
- Dashboard updates in 30 sec

---

## 🔍 Troubleshooting Quick Guide

| Problem | Solution | Time |
|---------|----------|------|
| **Flow won't trigger** | Check trigger site/library set correctly | 5 min |
| **HTTP 404** | Check URL: `https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint` | 5 min |
| **HTTP 500** | Check Vercel logs + run `npm run sync-data` locally | 15 min |
| **Dashboard not updating** | Wait 30 sec, F5 refresh, check Power Automate run history | 10 min |
| **Multiple triggers** | Increase Delay from 5 to 30 seconds | 2 min |

---

## ✅ Validation Checklist

Before considering complete:

```
☐ Power Automate flow created
☐ Trigger configured (site + library)
☐ Delay added (5 sec)
☐ HTTP action added
☐ Method: POST
☐ URI correct
☐ Headers added
☐ Body correct JSON
☐ Flow saved
☐ Test run successful (HTTP 200)
☐ Dashboard updated automatically
☐ Run history shows successes
```

---

## 📊 Status Check Commands

### Test Webhook (in browser):
```
https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint

Should return:
{
  "status": "webhook-active",
  ...
}
```

### Test Sync Locally:
```bash
npm run sync-data
# Should complete without errors
```

---

## 🎯 Expected Behavior

```
Edit Excel file
     ↓ 5 sec
Power Automate triggered
     ↓ 2 sec
Webhook called
     ↓ 10 sec
Data synced
     ↓ 3 sec
Dashboard checks new data
     ↓ 5 sec
Charts refresh
━━━━━━━━━━━━━━━━━━━━
TOTAL: 20-30 seconds
```

---

## 📞 Quick Links

- **Power Automate**: https://make.powerautomate.com
- **Dashboard**: https://gmr-ssc-pnl.vercel.app
- **Vercel Logs**: https://vercel.com/dashboard
- **SharePoint**: https://[tenant].sharepoint.com

---

## 🔑 Key Values (Copy/Paste Ready)

**Webhook URL:**
```
https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint
```

**HTTP Method:**
```
POST
```

**Content-Type Header:**
```
Content-Type: application/json
```

**Sample Response (Success):**
```json
{
  "success": true,
  "message": "Dashboard data updated",
  "statusCode": 200
}
```

---

## ⚡ Common Issues & Fixes

### Flow triggers but HTTP fails
→ Check Vercel deployment: https://vercel.com/dashboard

### Dashboard doesn't update  
→ Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

### Too many flow runs
→ Increase Delay to 30 seconds (prevents duplicate triggers)

### Can't see flow in Power Automate
→ Refresh page or check environment filter (top right)

---

## 📱 Screenshots References

Look for these in Power Automate UI:

1. **Create button**: Top left "+ Create"
2. **Flow name field**: "GMR Dashboard - Live Sync"
3. **Trigger selector**: Search for "SharePoint"
4. **New Step button**: Blue "+ New Step" between actions
5. **HTTP action fields**: Method, URI, Headers, Body
6. **Test button**: Top right "Test"
7. **Run history**: Flow name → "Run history"

---

## ✨ Success Indicators

✅ **Setup complete when you see:**
- Flow runs without errors
- HTTP status: 200
- Dashboard updates 30 sec after file change
- Power Automate run history shows 10+ runs
- Success rate: > 95%

---

## 📚 Full Documentation

For detailed steps, see:
- `POWERAUTOMATE_SETUP.md` - Complete guide
- `POWERAUTOMATE_VISUAL_GUIDE.md` - Screenshots reference
- `POWERAUTOMATE_DETAILED_STEPS.md` - Step-by-step walkthrough
- `POWERAUTOMATE_CHECKLIST.md` - Full checklist

---

## 🎉 You're Set!

**Now your dashboard updates automatically when files change!**

No more manual syncs. No more stale data. Just live P&L, KPIs, and insights.

**Questions?** Check the detailed guides or troubleshooting section.

**Print this card** for quick reference during setup.

---

**Last Updated:** May 20, 2026
**Version:** 1.0
**Status:** ✅ Ready to Use
