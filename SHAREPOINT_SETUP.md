# SharePoint Excel Integration Setup Guide

## Overview
This guide helps you connect your dashboard to a SharePoint Excel file so data updates automatically whenever the Excel file changes.

## Prerequisites
- Azure App Registration credentials (Application ID & Tenant ID) - ✅ You have these
- SharePoint site with Excel file - ✅ You have the link
- Node.js 16+ installed

## Step 1: Install Dependencies
```bash
npm install
```

This installs:
- `@azure/identity` - For Azure authentication
- `@microsoft/microsoft-graph-client` - For SharePoint access
- `dotenv` - For environment configuration

## Step 2: Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your credentials:
   ```env
   AZURE_TENANT_ID=7c51239d-08e0-4f24-92b0-68ca7dccba54
   AZURE_CLIENT_ID=de0d87c0-1e90-45ae-9660-27814dd40d8d
   SHAREPOINT_SITE_NAME=HARTSFellowship-2025
   SHAREPOINT_DOMAIN=gobalharts.sharepoint.com
   SYNC_METHOD=sharepoint
   ```

## Step 3: First-Time Authentication

Run the sync command:
```bash
npm run sync-data
```

**First time only:** You'll see a device code authentication prompt:
```
============================================================
Device Code Authentication Required
============================================================
To sign in, use a web browser to open the page: https://microsoft.com/devicelogin
Enter the code: XXXXXX
============================================================
```

1. Open the URL in your browser
2. Enter the code exactly as shown
3. Sign in with your Microsoft account (must have SharePoint access)
4. Return to the terminal - sync will proceed automatically

**⚠️ NOTE:** Your authentication token is cached locally. You may need to re-authenticate periodically or if permissions change.

## Step 4: Test the Sync

After first authentication:
```bash
npm run sync-data
```

You should see:
```
☁️  Syncing from SharePoint...
✅ Connected to site: HARTSFellowship-2025
🔍 Searching for Excel files...
📄 Found: [your Excel file name]
📥 Downloading Excel file from SharePoint...
✅ SharePoint sync complete
   Source: [filename]
   Revenue rows: 60
   Cost rows: 45
   Transaction rows: 120
   FTE rows: 48
```

The data is automatically written to:
- `src/data/sampleData.js` - Revenue and Cost data
- `src/data/transactionFteData.js` - Transactions and FTE data

Your app now uses the fresh data on next load! 🎉

## Step 5: Automate Syncs (Optional)

### Option A: Manual Sync Before Running Dev
Every time before starting dev, run:
```bash
npm run sync-data && npm run dev
```

### Option B: Automatic Sync on Dev Start
Edit `package.json`:
```json
"dev": "npm run sync-data && vite",
```

Then just run:
```bash
npm run dev
```

### Option C: Scheduled Sync (via CI/CD)
If you use GitHub Actions, GitLab CI, or similar, you can schedule syncs to run automatically.

Example GitHub Actions workflow (`.github/workflows/sync-sharepoint.yml`):
```yaml
name: Sync SharePoint Data
on:
  schedule:
    - cron: '0 9 * * 1-5'  # 9 AM weekdays
  workflow_dispatch:  # Manual trigger

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run sync-data
        env:
          AZURE_TENANT_ID: ${{ secrets.AZURE_TENANT_ID }}
          AZURE_CLIENT_ID: ${{ secrets.AZURE_CLIENT_ID }}
          SHAREPOINT_SITE_NAME: HARTSFellowship-2025
          SHAREPOINT_DOMAIN: gobalharts.sharepoint.com
      - run: git add src/data/
      - run: git commit -m "Auto: Sync SharePoint data" || echo "No changes"
      - run: git push
```

## Troubleshooting

### Error: "Missing AZURE_TENANT_ID or AZURE_CLIENT_ID"
- Verify `.env` file exists in project root
- Check you copied `.env.example` to `.env` correctly
- Verify credentials are correct (no quotes)

### Error: "No Excel files found in the SharePoint site"
- Verify you have the correct SharePoint site name
- Ensure the Excel file is in the site's root drive
- Check file is not inside a subfolder

### Error: "Missing sheet 'Revenue'"
- Verify Excel file has sheets named: Revenue, Cost, Transactions, FTE
- Sheet names must match exactly (case-sensitive)

### Error: "Authentication failed"
- Device code may have expired - run sync again
- Check your Microsoft account has SharePoint access
- Verify permissions on the SharePoint site

### Fallback to Local File
If SharePoint sync fails, the script automatically falls back to the local workbook:
```
LOCAL_WORKBOOK_PATH=data/real-data-workbook.xlsx
```

To force local sync:
```bash
SYNC_METHOD=local npm run sync-data
```

Or use the dedicated command:
```bash
npm run sync-local
```

## Real-Time Updates (Advanced)

For a dashboard that updates in real-time as Excel changes, see [real-time-sync.md](./real-time-sync.md) for WebSocket-based polling.

## Security Notes
- ✅ `.env` file is in `.gitignore` - never commit secrets
- ✅ Device code flow uses delegated permissions - no app secrets needed
- ✅ Token is cached locally in `~/.cache/` (Azure SDK default)
- ⚠️ Don't share your `.env` file or Azure credentials

## Support
If issues persist:
1. Check the error message carefully
2. Verify all credentials in `.env`
3. Test with `npm run sync-local` to rule out SharePoint connectivity
4. Check SharePoint file has correct sheet names and structure
