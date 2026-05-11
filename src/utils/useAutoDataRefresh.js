import { useEffect, useRef } from 'react'
import { useDashStore } from '../store/useDashStore'

/**
 * Hook that periodically checks if SharePoint data has been synced
 * and automatically reloads the dashboard with new data.
 * 
 * Usage in App.jsx:
 *   useAutoDataRefresh({ checkInterval: 10000 })  // Check every 10 seconds
 * 
 * Configuration via component props:
 *   checkInterval: milliseconds between checks (default: 30000 = 30 sec)
 *   verbose: log sync checks (default: false)
 *   onDataRefresh: callback when data is refreshed
 */
export function useAutoDataRefresh({ 
  checkInterval = 30000, 
  verbose = false,
  onDataRefresh = null 
} = {}) {
  const lastDataRef = useRef(null)
  const checkTimeoutRef = useRef(null)

  useEffect(() => {
    const checkAndReload = async () => {
      try {
        // Dynamically import to get fresh module
        const sampleDataModule = await import(
          /* @vite-ignore */
          `/src/data/sampleData.js?t=${Date.now()}`
        )
        const txnFteModule = await import(
          /* @vite-ignore */
          `/src/data/transactionFteData.js?t=${Date.now()}`
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
          if (verbose) {
            console.log('📊 Data change detected, updating dashboard...')
          }
          
          // Update store with new data
          useDashStore.getState().setData(newData.revenue, newData.cost)
          
          lastDataRef.current = newData
          
          if (onDataRefresh) {
            onDataRefresh(newData)
          }
          
          console.log('✅ Dashboard updated with latest SharePoint data')
        } else if (verbose) {
          console.log('✓ No data changes')
        }
      } catch (error) {
        console.error('Error checking for data updates:', error)
      }

      // Schedule next check
      checkTimeoutRef.current = setTimeout(checkAndReload, checkInterval)
    }

    // Start checking
    checkAndReload()

    // Cleanup
    return () => {
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current)
      }
    }
  }, [checkInterval, verbose, onDataRefresh])
}

/**
 * Alternative: Hook for checking file metadata without reloading modules
 * (requires backend API endpoint)
 */
export function useSharePointFileMonitor({ 
  checkInterval = 30000,
  verbose = false 
} = {}) {
  const lastModifiedRef = useRef(null)
  const checkTimeoutRef = useRef(null)

  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const response = await fetch('/.last-sync-check.json')
        if (!response.ok) {
          console.warn('Could not fetch sync status')
          return
        }

        const syncData = await response.json()
        const currentModified = syncData.lastModifiedDateTime

        if (lastModifiedRef.current === null) {
          lastModifiedRef.current = currentModified
          if (verbose) console.log('📡 Monitoring SharePoint file for changes...')
          return
        }

        if (lastModifiedRef.current !== currentModified) {
          console.log('✅ SharePoint file updated, refreshing dashboard...')
          lastModifiedRef.current = currentModified
          
          // Force reload data modules
          // This would trigger a full page reload or reload just the data
          window.location.reload()
        } else if (verbose) {
          console.log('✓ No updates since', lastModifiedRef.current)
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
