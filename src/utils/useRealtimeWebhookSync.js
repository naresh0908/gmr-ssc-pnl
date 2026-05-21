import { useEffect, useRef } from 'react'
import { useDashStore } from '../store/useDashStore'

/**
 * Real-time Data Sync Hook: Polls SharePoint directly for fresh data
 * 
 * How it works:
 * 1. Every 5 seconds, fetches fresh data directly from SharePoint
 * 2. Updates dashboard with latest Excel data
 * 3. No webhook complexity, no persistence issues
 * 4. Works perfectly on Vercel (stateless, always fresh)
 * 
 * Usage in App.jsx:
 *   useRealtimeWebhookSync()
 */
export function useRealtimeWebhookSync({ 
  pollInterval = 5000,
  verbose = false,
  onDataRefresh = null
} = {}) {
  const pollTimeoutRef = useRef(null)

  useEffect(() => {
    const fetchLatestData = async () => {
      try {
        // Fetch fresh data directly from SharePoint
        const response = await fetch('/api/sync-fresh', {
          cache: 'no-store',
          headers: { 'pragma': 'no-cache' }
        })

        if (!response.ok) {
          if (verbose) console.log('⏳ SharePoint API not ready:', response.status)
          pollTimeoutRef.current = setTimeout(fetchLatestData, pollInterval)
          return
        }

        const data = await response.json()
        const { sampleData, transactionFteData, source } = data

        if (verbose) {
          console.log('📊 Fresh data from SharePoint:', {
            source,
            revenue: sampleData?.revenue?.length || 0,
            cost: sampleData?.cost?.length || 0,
            transactions: transactionFteData?.transactions?.length || 0,
            fte: transactionFteData?.fte?.length || 0,
          })
        }

        // Update dashboard with fresh data
        if (sampleData?.revenue?.length || sampleData?.cost?.length) {
          useDashStore.getState().setData(
            sampleData.revenue,
            sampleData.cost,
            transactionFteData?.transactions,
            transactionFteData?.fte
          )

          if (verbose) console.log('✅ Dashboard updated with fresh SharePoint data')
          
          if (onDataRefresh) {
            onDataRefresh({ sampleData, transactionFteData })
          }
        }
      } catch (error) {
        if (verbose) console.error('❌ Error fetching from SharePoint:', error.message)
      }

      // Schedule next fetch
      pollTimeoutRef.current = setTimeout(fetchLatestData, pollInterval)
    }

    // Start fetching immediately
    if (verbose) {
      console.log(`🔄 Real-time sync active (polling every ${pollInterval}ms)`)
    }
    fetchLatestData()

    // Cleanup
    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current)
      }
    }
  }, [pollInterval, verbose, onDataRefresh])
}

/**
 * Alternative: Browser-based file change detection
 * Watches .last-sync-check.json for updates
 */
export function useWebhookFileMonitor({ 
  checkInterval = 5000,
  verbose = false 
} = {}) {
  const lastModifiedRef = useRef(null)
  const checkTimeoutRef = useRef(null)

  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const response = await fetch('/.last-sync-check.json', {
          cache: 'no-store',
          headers: { 'pragma': 'no-cache' }
        })
        
        if (!response.ok) return

        const syncData = await response.json()
        const currentModified = syncData.lastModifiedDateTime

        if (lastModifiedRef.current === null) {
          lastModifiedRef.current = currentModified
          if (verbose) console.log('📡 Monitoring file for webhook updates...')
          return
        }

        if (lastModifiedRef.current !== currentModified) {
          console.log('✅ Webhook triggered sync, reloading data...')
          lastModifiedRef.current = currentModified
          
          // Trigger a full page reload to get fresh data
          window.location.reload()
        } else if (verbose) {
          console.log('✓ No sync yet')
        }
      } catch (error) {
        if (verbose) console.error('Monitor error:', error)
      }

      checkTimeoutRef.current = setTimeout(checkForUpdates, checkInterval)
    }

    checkForUpdates()

    return () => {
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current)
      }
    }
  }, [checkInterval, verbose])
}
