# Real-Time Webhook Setup Guide

## Overview

This setup enables **true real-time updates** on your Vercel dashboard:

```
Excel changes in SharePoint
        ↓ (instantly)
Microsoft Graph sends webhook notification
        ↓ (< 1 second)
Vercel API endpoint receives notification
        ↓ (< 2 seconds)
SharePoint data synced automatically
        ↓ (< 5 seconds)
Dashboard refreshes automatically
        ↓
Users see updated charts in real-time
```

**Total latency: 10-15 seconds from file change to dashboard update**

---

## Prerequisites

✅ Application already deployed to Vercel at: `https://gmr-ssc-pnl.vercel.app`
✅ Azure credentials configured in `.env`
✅ SharePoint access working (verified with `npm run sync-data`)

---

## Setup Steps

### Step 1: Update Vercel URL in .env

Edit `.env` and verify:
```env
VERCEL_URL=https://gmr-ssc-pnl.vercel.app
```

### Step 2: Push API Endpoint to Vercel

The webhook handler is in `api/webhooks/sharepoint.js`. Push to GitHub:

```bash
git add api/
git add src/utils/useRealtimeWebhookSync.js
git add src/App.jsx
git add scripts/setup-webhook.mjs
git add .env
git commit -m "Add real-time webhook support"
git push origin main
```

Vercel will auto-deploy. Wait ~2-3 minutes for deployment to complete.

**Verify deployment:**
```bash
# Should return 200
curl https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint
```

### Step 3: Create Microsoft Graph Webhook Subscription

Once Vercel deployment is live, run:

```bash
node scripts/setup-webhook.mjs
```

This script will:
1. Authenticate with Azure
2. Navigate to SharePoint folder
3. Find your Excel file
4. Create a webhook subscription
5. Save subscription details to `.webhook-subscription.json`

**Expected output:**
```
✅ Authentication successful!

📡 Setting up Microsoft Graph Webhook Subscription
   Notification URL: https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint

   Connecting to: HARTSFellowship-2025...
   ✓ Site ID: xxxx
   ✓ File found: 2026_May_HARTS_GMR_PNL_Dashboard_testingdata.xlsx

✅ Webhook setup complete!

   Next steps:
   1. Test: Change the Excel file in SharePoint
   2. Dashboard should auto-update within 10-15 seconds
```

### Step 4: Test Real-Time Sync

1. **Open dashboard** in browser: https://gmr-ssc-pnl.vercel.app/

2. **Open browser DevTools** (F12) → Console tab

3. **Edit the Excel file** in SharePoint (change any value)

4. **Watch for console messages:**
   ```
   ✅ Real-time data update detected!
   ```

5. **Charts should refresh** automatically within ~10 seconds

---

## How It Works

### Webhook Flow

1. **File changes in SharePoint**
   - SharePoint detects modification

2. **Microsoft Graph notification** (automatic)
   - Graph API calls: `POST /api/webhooks/sharepoint`
   - Sends change notification

3. **Vercel API processes notification**
   - `api/webhooks/sharepoint.js` receives notification
   - Triggers: `npm run sync-data`
   - Downloads latest Excel file
   - Updates data files

4. **Frontend detects change**
   - `useRealtimeWebhookSync()` hook polls every 5 seconds
   - Detects new data modules
   - Updates dashboard state

5. **Charts auto-refresh**
   - React re-renders with new data
   - User sees updated charts

### Rate Limiting

- **Notification cooldown**: 30 seconds (prevents duplicate syncs)
- **Browser poll interval**: 5 seconds (checks for sync completion)
- **Microsoft Graph limit**: ~1000 subscriptions per tenant (no worry for single file)

---

## Monitoring & Troubleshooting

### Check Webhook Status

```bash
# View subscription details
cat .webhook-subscription.json
```

### Monitor Syncs

**In Vercel Console:**
```
1. Go to: https://vercel.com/dashboard
2. Select your project: gmr-ssc-pnl
3. Deployments → Select recent deployment
4. Functions → webhooks/sharepoint → View logs
```

**Watch for logs:**
```
[Webhook] Triggering SharePoint sync...
[Webhook] ✅ Sync completed
```

### Browser Console Monitoring

Enable verbose logging in `src/App.jsx`:
```javascript
useRealtimeWebhookSync({ 
  pollInterval: 5000, 
  verbose: true  // Enable logs
})
```

Then check browser DevTools Console for detailed logs.

---

## Common Issues

### Issue: Webhook endpoint not responding

**Error:** `GET /api/webhooks/sharepoint` returns 404

**Solution:**
- Vercel deployment not yet complete (wait 2-3 min)
- Check deployment status: https://vercel.com/dashboard
- Redeploy: `git push origin main`

### Issue: Setup script fails with "Tenant ID not found"

**Error:** `Missing AZURE_TENANT_ID or AZURE_CLIENT_ID in .env file`

**Solution:**
- Verify `.env` has correct Azure credentials
- Run: `npm run sync-data` first (to verify auth works)
- Then run: `node scripts/setup-webhook.mjs`

### Issue: Dashboard not updating after file change

**Checklist:**
1. ✓ Vercel deployment live (check status at Vercel.com)
2. ✓ Webhook endpoint responds: `curl https://gmr-ssc-pnl.vercel.app/api/webhooks/sharepoint`
3. ✓ Subscription created: `ls -la .webhook-subscription.json`
4. ✓ File changed in SharePoint (not just opened)
5. ✓ Check browser console (F12) for errors
6. ✓ Hard refresh: `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac)

### Issue: Webhook subscription expired

**Symptom:** No updates after 3+ days

**Root cause:** Microsoft Graph subscriptions expire after 3 days

**Solution:** Re-run setup script to create new subscription
```bash
node scripts/setup-webhook.mjs
```

### Issue: Multiple file syncs happening

**Symptom:** Data syncing 2-3 times for single file change

**Root cause:** Multiple subscriptions created

**Solution:** Delete old subscriptions in Azure Portal
1. Go: https://portal.azure.com/
2. Azure AD → App registrations → Your app
3. Search for subscription in Microsoft Graph API

Or re-run setup which detects existing subscriptions.

---

## Subscription Management

### View Subscription Details

```bash
# Manually (replace with your subscription ID)
node scripts/check-subscription.mjs
```

### Renew Subscription (Before Expiry)

Subscriptions valid for 3 days. To extend:
```bash
# Delete old subscription and create new one
node scripts/setup-webhook.mjs
```

### Delete Subscription

To stop webhook notifications:
```bash
node scripts/delete-webhook.mjs
```

---

## Performance Notes

**Typical flow time:**
- File change → Graph notification: ~1 sec
- Webhook notification → Sync start: ~2 sec
- Sync complete: ~3-5 sec (depends on file size)
- Browser detects change: ~0-5 sec (next poll)
- Dashboard updates: ~100-300 ms (React render)

**Total: 6-15 seconds from file change to visible update**

---

## Cost Impact

✅ **No additional costs**
- Vercel API endpoint: included in free tier
- Microsoft Graph webhooks: included in free tier
- Azure subscriptions: included in existing tenant

---

## Next Steps (Optional)

- **Push notifications**: Add browser notifications when data updates
- **Audit logs**: Track who changed data and when
- **Multi-file webhooks**: Monitor multiple Excel files simultaneously
- **Webhook analytics**: Dashboard showing sync frequency and performance

---

## Support

**Test webhook locally:**
```bash
npm run dev
# In another terminal:
node scripts/setup-webhook.mjs
```

**Debug subscription creation:**
Add `verbose: true` to `setup-webhook.mjs` for detailed logging

**Check Vercel logs:**
```bash
# Install Vercel CLI
npm i -g vercel

# View live logs
vercel logs
```

---

**Setup complete! Your dashboard is now real-time.** 🚀

Any Excel change will appear on the dashboard within 10-15 seconds.
