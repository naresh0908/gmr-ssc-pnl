# Power Automate Setup Checklist & Quick Reference

## 📋 Pre-Setup Checklist (Do First!)

### Prerequisites Verified ✓
- [ ] You have Microsoft 365 account (with Power Automate license)
- [ ] You have SharePoint access (can edit files)
- [ ] You have Vercel project deployed
- [ ] Vercel URL works: https://gmr-ssc-pnl.vercel.app
- [ ] Webhook endpoint responds: https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint
- [ ] Your Excel file is in SharePoint (not local drive)

### Information Collected ✓
- [ ] SharePoint Site URL: ___________________________________
- [ ] Library Name: ___________________________________
- [ ] Excel File Name: ___________________________________
- [ ] Vercel URL: https://gmr-ssc-pnl.vercel.app
- [ ] Webhook Endpoint: https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint

---

## 🚀 Setup Phase Checklist

### Phase 1: Create Flow ✓
- [ ] Go to https://make.powerautomate.com
- [ ] Clicked "+ Create"
- [ ] Selected "Automated cloud flow"
- [ ] Named flow: "GMR Dashboard - Live Sync"
- [ ] Selected trigger: "When a file is created or modified"

### Phase 2: Configure Trigger ✓
- [ ] Selected correct SharePoint Site
- [ ] Selected correct Library
- [ ] Left Folder field empty
- [ ] Clicked "Create"

### Phase 3: Add Delay ✓
- [ ] Clicked "+ New Step"
- [ ] Added "Delay" action
- [ ] Set Count: 5
- [ ] Set Unit: Seconds

### Phase 4: Add HTTP Request ✓
- [ ] Clicked "+ New Step"
- [ ] Searched "HTTP"
- [ ] Selected "HTTP" action
- [ ] Method: POST
- [ ] URI: https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint
- [ ] Headers:
  - Content-Type: application/json

### Phase 5: Add HTTP Body ✓
- [ ] Clicked Body field
- [ ] Cleared defaults
- [ ] Added dynamic content:
  ```
  {
    "fileName": "@triggerBody()?['properties']?['displayName']",
    "changeType": "updated",
    "timestamp": "@utcNow()",
    "source": "power-automate"
  }
  ```
- [ ] Verified JSON is valid (no red squiggly lines)

### Phase 6: Save Flow ✓
- [ ] Clicked "Save" button
- [ ] Got "Flow saved" confirmation
- [ ] Flow name visible at top: "GMR Dashboard - Live Sync"

### Phase 7: Test Flow ✓
- [ ] Clicked "Test"
- [ ] Selected "Manually"
- [ ] Made change in SharePoint Excel file
- [ ] Watched flow execute
- [ ] Got HTTP status 200
- [ ] Checked dashboard updated

---

## 🔧 Configuration Reference

### HTTP Action Configuration (Copy/Paste Ready)

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
  "changeType": "updated",
  "timestamp": "@utcNow()",
  "source": "power-automate"
}
```

---

## ✅ Testing Checklist

### Manual Test Execution
- [ ] Power Automate flow ready to test
- [ ] Clicked "Test" → "Manually"
- [ ] SharePoint file opened in another tab
- [ ] Made a change to Excel (typed in cell, added row, etc.)
- [ ] Saved the file (Ctrl+S)
- [ ] Watched Power Automate trigger
- [ ] Saw all actions complete:
  - [ ] "When a file is created or modified" ✓
  - [ ] "Delay" ✓
  - [ ] "HTTP" ✓
- [ ] HTTP status: **200**
- [ ] HTTP response includes: "success": true

### Dashboard Update Verification
- [ ] Dashboard open: https://gmr-ssc-pnl.vercel.app
- [ ] Noted initial data values
- [ ] Made another file change in SharePoint
- [ ] Waited 20-30 seconds
- [ ] Dashboard refreshed automatically (no manual F5)
- [ ] Data values changed (proved sync happened)
- [ ] Latency acceptable (< 30 seconds)

### Run History Check
- [ ] Opened Power Automate flow
- [ ] Clicked "Run history"
- [ ] Recent runs visible
- [ ] Most runs show ✓ (success)
- [ ] Failed runs rare (< 5%)

---

## 🐛 Quick Troubleshooting

### "Flow didn't trigger"
**Step 1:** Check trigger configuration
```
□ Trigger site selected?
□ Trigger library selected?
□ File in that library?
```

**Step 2:** Manual trigger test
```
□ Clicked "Test"
□ Waited for "waiting for trigger" message
□ Made file change
□ Flow started?
```

**Step 3:** Try different file
```
□ Edit any file in library
□ Does flow trigger now?
```

---

### "HTTP returned 404"
**Problem:** Webhook endpoint not found

**Step 1:** Check URL
```
□ Exact URL in HTTP action:
  https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint
□ NO trailing slash?
□ NO typos?
```

**Step 2:** Test endpoint
```
Open URL in browser:
https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint

Should see JSON response (not 404)
```

**Step 3:** Check deployment
```
Vercel Dashboard:
□ Project "gmr-ssc-pnl" shows "Production"?
□ Status is green (Ready)?
□ Recent deployment successful?
```

---

### "HTTP returned 500"
**Problem:** Webhook error

**Step 1:** Check Vercel logs
```
Vercel Dashboard → gmr-ssc-pnl → Functions → sharepoint
Look for error messages
```

**Step 2:** Test sync locally
```bash
npm run sync-data

Should complete without errors
```

**Step 3:** Check environment
```
Vercel project settings:
□ Environment variables set?
□ SHAREPOINT_SITE?
□ SHAREPOINT_FILE_NAME?
□ Azure credentials?
```

---

### "Dashboard not updating"
**Checklist:**
```
□ Power Automate: Run actually executed?
  (Check run history)
□ HTTP: Status 200?
  (Not 404, not 500)
□ Wait 30 seconds
  (Sync takes time)
□ Force refresh: Ctrl+Shift+R
  (Not just F5)
□ Browser console (F12): Any errors?
  (Red messages = problem)
□ Verify sync actually ran:
  npm run sync-data
  (Manually, to test)
```

---

## 📊 Status Dashboard Quick View

Your Power Automate flow should show:

### Healthy Flow
```
✓ Flow enabled
✓ Last run: < 1 hour ago
✓ Success rate: > 95%
✓ Average run time: 20-30 seconds
✓ Recent runs all green (✓)
```

### Webhook Health
```
GET https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint

Response:
{
  "status": "webhook-active",
  "lastSync": "2026-05-20T15:30:45.123Z",
  "timestamp": "2026-05-20T15:35:12.456Z"
}
```

### Dashboard Health
```
Charts loading: ✓
KPI cards showing: ✓
Data refreshing: ✓ (check timestamps)
Last sync time < 30 min: ✓
```

---

## 🎯 Common Actions During Troubleshooting

### Test Webhook Accessibility
```bash
# From terminal:
curl https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint

# From browser:
https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint
```

### Test Sync Locally
```bash
npm run sync-data
# Should complete with: ✓ [timestamp] Data synced
```

### Check Power Automate Logs
```
1. Power Automate Dashboard
2. My flows
3. Select "GMR Dashboard - Live Sync"
4. Run history
5. Click any run to see details
```

### Check Vercel Logs
```
1. Vercel Dashboard
2. gmr-ssc-pnl project
3. Deployments tab
4. Recent deployment → Logs
5. Filter: "sharepoint"
```

### Hard Refresh Dashboard
```
Windows: Ctrl + Shift + R
Mac: Cmd + Shift + R
Or: Clear browser cache manually
```

---

## 📞 Quick Support Reference

### When Something Goes Wrong

**Error Type 1: Flow doesn't run**
- Answer: Check trigger configuration
- File: POWERAUTOMATE_VISUAL_GUIDE.md (Step 2)
- Fix time: 5 minutes

**Error Type 2: HTTP 404**
- Answer: Webhook endpoint missing
- Check: Vercel deployment active?
- Fix time: 10 minutes

**Error Type 3: HTTP 500**
- Answer: Webhook execution error
- Check: Vercel function logs
- Fix time: 15 minutes

**Error Type 4: Dashboard not updating**
- Answer: Multiple possible causes
- Check: Power Automate ran? HTTP 200? Waited 30 sec?
- Fix time: 10-20 minutes

### Documentation Reference
- Quick start: POWERAUTOMATE_QUICKREF.md
- Visual guide: POWERAUTOMATE_VISUAL_GUIDE.md
- Setup steps: POWERAUTOMATE_SETUP.md
- This guide: POWERAUTOMATE_DETAILED_STEPS.md
- Extended: POWERAUTOMATE_CHECKLIST.md (you are here)

---

## 🎉 Success Indicators

You'll know setup is complete when:

✅ **Immediate (after first test)**
- [ ] Power Automate flow runs without errors
- [ ] HTTP returns status 200
- [ ] Vercel logs show sync execution

✅ **Short term (after 2-3 runs)**
- [ ] Flow runs consistently
- [ ] Dashboard updates within 30 seconds
- [ ] Data values change after file edit

✅ **Medium term (after 1 hour of use)**
- [ ] Multiple successful runs in run history
- [ ] Success rate > 95%
- [ ] No manual interventions needed

✅ **Long term (after full day)**
- [ ] Dashboard automatically stays current
- [ ] Team sees live data
- [ ] Zero manual sync steps

---

## 📝 Notes & Customization

### Current Setup
```
Flow name: GMR Dashboard - Live Sync
Trigger: SharePoint file modified
Delay: 5 seconds
HTTP endpoint: https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint
Expected latency: 20-30 seconds
```

### Optional Enhancements
- [ ] Add file filter (monitor only specific file)
- [ ] Add error notifications (email on failure)
- [ ] Add condition logic (only sync certain changes)
- [ ] Scheduled backup sync (every hour as backup)

### Contact Information
- Power Automate Admin: ___________________________________
- Vercel Admin: ___________________________________
- SharePoint Admin: ___________________________________
- IT Support: ___________________________________

---

## 🔄 Maintenance Schedule

### Daily
- [ ] Dashboard loads properly
- [ ] No obvious errors

### Weekly
- [ ] Check Power Automate run history
- [ ] Verify success rate > 95%
- [ ] Test webhook endpoint

### Monthly
- [ ] Review Vercel logs
- [ ] Check for any pattern of errors
- [ ] Update documentation if needed

### Quarterly
- [ ] Review Power Automate performance
- [ ] Optimize if needed
- [ ] Update any credentials/settings

---

## 🚀 Next Steps After Setup

1. **Train team members**
   - Show them: just edit the Excel file
   - Data appears automatically in 30 seconds
   - No special steps needed

2. **Monitor first week**
   - Watch run history
   - Ensure no failures
   - Address any issues

3. **Set up alerts (optional)**
   - Email on failure
   - Slack notification
   - Dashboard status indicator

4. **Document team process**
   - How to edit Excel safely
   - What happens in background
   - Who to contact if issues

5. **Consider scaling**
   - Add more files to monitor?
   - Add more Power Automate flows?
   - Integrate with other systems?

---

## ✨ You're All Set!

Print this checklist and keep it handy during setup. Reference the guides as needed.

**Remember:** If anything doesn't work, refer to the detailed steps document and the troubleshooting section. Most issues have simple fixes!

**Good luck! 🎉**
