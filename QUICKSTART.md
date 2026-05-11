# Quick Start: SharePoint Integration

## TL;DR - Get Started in 3 Minutes

### 1. Install dependencies
```bash
npm install
```

### 2. Create `.env` file
```bash
cp .env.example .env
```
Edit `.env` with your credentials:
```env
AZURE_TENANT_ID=7c51239d-08e0-4f24-92b0-68ca7dccba54
AZURE_CLIENT_ID=de0d87c0-1e90-45ae-9660-27814dd40d8d
SHAREPOINT_SITE_NAME=HARTSFellowship-2025
SYNC_METHOD=sharepoint
```

### 3. First sync (interactive - follow the device code prompt)
```bash
npm run sync-data
```

🎉 **Done!** Your SharePoint data is now synced to `src/data/sampleData.js`

---

## How It Works

```
Your Excel File in SharePoint
           ↓
    npm run sync-data
           ↓
    Data synced to src/data/sampleData.js
           ↓
    Dashboard automatically uses new data
```

---

## Usage Options

**Option A: Manual sync when needed**
```bash
npm run sync-data
npm run dev
```

**Option B: Auto-sync on dev start**
```bash
# Edit package.json: "dev": "npm run sync-data && vite"
npm run dev
```

**Option C: Real-time polling every 5 min** (see [REALTIME_SYNC.md](./REALTIME_SYNC.md))

---

## Full Documentation
- 📖 **[SHAREPOINT_SETUP.md](./SHAREPOINT_SETUP.md)** - Detailed setup & troubleshooting
- 🚀 **[REALTIME_SYNC.md](./REALTIME_SYNC.md)** - Real-time auto-update options
- ⚙️ **[.env.example](./.env.example)** - All configuration options

---

## Commands

| Command | Purpose |
|---------|---------|
| `npm run sync-data` | Sync from SharePoint (or fallback to local) |
| `npm run sync-local` | Sync only from local Excel file |
| `npm run dev` | Start dev server |
| `npm run build` | Build for production |

---

## What Gets Updated?
- ✅ `src/data/sampleData.js` - All revenue & cost data
- ✅ `src/data/transactionFteData.js` - Transactions & FTE data
- ✅ Dashboard automatically uses fresh data

---

## Security
- 🔒 `.env` file is in `.gitignore` - never commit secrets
- 🔒 No app secrets needed - uses device code flow
- 🔒 Credentials stored in environment only

---

## Troubleshooting

**Device code authentication?**
→ Open the URL shown, enter the code, sign in. That's it!

**"No Excel files found"?**
→ Check SharePoint site name in `.env`, verify Excel file exists in site root

**SharePoint sync fails?**
→ Automatically falls back to local workbook - still works!

**Need real-time updates?**
→ See [REALTIME_SYNC.md](./REALTIME_SYNC.md) for automatic polling setup

---

Ready? Run: `npm install && cp .env.example .env` → edit `.env` → `npm run sync-data`
