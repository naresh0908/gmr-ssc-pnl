// Shared in-memory store — populated by the Power Automate webhook, read by /api/data
// Works reliably on vercel dev (single process) and on warm Vercel Lambda instances
export const store = {
  sampleData: null,
  transactionFteData: null,
  timestamp: null,
  source: null,
}
