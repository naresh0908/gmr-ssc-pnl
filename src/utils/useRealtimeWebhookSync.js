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
  const lastSyncTimeRef = useRef(null)
  const pollTimeoutRef = useRef(null)
  const lastDataRef = useRef(null)

  useEffect(() => {
    const checkForSync = async () => {
      try {
        // Check if webhook endpoint is responding
        // (indicates Vercel/API is running)
        const healthCheck = await fetch('/api/webhooks/sharepoint', {
          method: 'GET',
          cache: 'no-store'
        }).catch(() => null)

        if (!healthCheck?.ok && verbose) {
          console.log('⏳ Webhook endpoint not ready')
        }

        // Try to load fresh data modules with cache buster
        const now = Date.now()
        const cacheBuster = `?t=${now}`

        try {
          const sampleDataModule = await import(
            /* @vite-ignore */
            `/src/data/sampleData.js${cacheBuster}`
          )
          const txnFteModule = await import(
            /* @vite-ignore */
            `/src/data/transactionFteData.js${cacheBuster}`
          )

          const newData = {
            revenue: sampleDataModule.sampleData.revenue,
            cost: sampleDataModule.sampleData.cost,
            transactions: txnFteModule.transactionFteData.transactions,
            fte: txnFteModule.transactionFteData.fte,
          }

          // Check if data has changed
          const hasChanged = !lastDataRef.current || 
            JSON.stringify(lastDataRef.current) !== JSON.stringify(newData)

          if (hasChanged) {
            console.log('✅ Real-time data update detected!')
            
            // Update store with new data
            useDashStore.getState().setData(newData.revenue, newData.cost)
            lastDataRef.current = newData

            if (onDataRefresh) {
              onDataRefresh(newData)
            }
          }
        } catch (e) {
          if (verbose) console.debug('Data check:', e.message)
        }
      } catch (error) {
        if (verbose) console.error('Sync check error:', error)
      }

      // Schedule next check
      pollTimeoutRef.current = setTimeout(checkForSync, pollInterval)
    }

    // Start checking
    if (verbose) {
      console.log(`📡 Real-time webhook monitoring active (poll every ${pollInterval}ms)`)
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
