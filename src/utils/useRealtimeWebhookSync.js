import { useEffect, useRef } from 'react'
import { useDashStore } from '../store/useDashStore'

/**
 * Real-time Webhook Hook: Detects SharePoint file changes via webhook
 * 
 * How it works:
 * 1. SharePoint notifies Vercel webhook when file changes
 * 2. Webhook triggers sync (data files updated)
 * 3. This hook polls for sync completion
 * 4. Dashboard auto-updates with new data
 * 
 * Works on both local dev and Vercel production
 * 
 * Usage in App.jsx:
 *   useRealtimeWebhookSync({ pollInterval: 5000, verbose: false })
 */
export function useRealtimeWebhookSync({ 
  pollInterval = 5000,
  verbose = false,
  onDataRefresh = null
} = {}) {
  const lastTimestampRef = useRef(null)
  const pollTimeoutRef = useRef(null)

  useEffect(() => {
    const checkForSync = async () => {
      try {
        // Fetch current data from API endpoint
        const response = await fetch('/api/data', {
          cache: 'no-store',
          headers: { 'pragma': 'no-cache' }
        })

        if (!response.ok) {
          if (verbose) console.log('⏳ Data API not ready')
          // Schedule next check and return
          pollTimeoutRef.current = setTimeout(checkForSync, pollInterval)
          return
        }

        const { sampleData, transactionFteData, timestamp } = await response.json()

        // Check if data has changed
        if (lastTimestampRef.current === null) {
          // First load — immediately apply data so the dashboard shows live PA data
          lastTimestampRef.current = timestamp
          if (sampleData?.revenue?.length) {
            useDashStore.getState().setData(
              sampleData.revenue,
              sampleData.cost,
              transactionFteData?.transactions,
              transactionFteData?.fte
            )
            console.log('✅ Initial data loaded from Power Automate')
          }
          if (verbose) console.log('📡 Monitoring for Power Automate updates...')
        } else if (lastTimestampRef.current !== timestamp) {
          // Data has changed!
          console.log('✅ Real-time data update detected!')
          
          // Update store with all live data from Power Automate
          useDashStore.getState().setData(
            sampleData.revenue,
            sampleData.cost,
            transactionFteData?.transactions,
            transactionFteData?.fte
          )
          
          lastTimestampRef.current = timestamp
          
          if (onDataRefresh) {
            onDataRefresh({ sampleData, transactionFteData })
          }
        } else if (verbose) {
          console.log('✓ No data changes')
        }
      } catch (error) {
        if (verbose) console.error('Sync check error:', error)
      }

      // Schedule next check
      pollTimeoutRef.current = setTimeout(checkForSync, pollInterval)
    }

    // Start checking
    if (verbose) {
      console.log(`📡 Real-time monitoring active (poll every ${pollInterval}ms)`)
    }
    checkForSync()

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
