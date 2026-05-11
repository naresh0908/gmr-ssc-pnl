/**
 * Real-Time SharePoint Data Sync
 * 
 * This module provides real-time data updates in the browser by polling
 * SharePoint at regular intervals. Include it in your App.jsx to automatically
 * sync data without page refreshes.
 * 
 * Usage:
 *   import { useRealtimeDataSync } from '@/utils/realtimeSharepointSync'
 * 
 *   function App() {
 *     useRealtimeDataSync({
 *       interval: 5 * 60 * 1000, // 5 minutes
 *       onDataUpdate: (data) => console.log('Data updated!'),
 *       onError: (error) => console.error('Sync failed:', error)
 *     })
 *     return <Dashboard />
 *   }
 */

import { useEffect, useRef, useCallback } from 'react'
import { useDashStore } from '../store/useDashStore'

/**
 * Hook for real-time SharePoint data synchronization
 * @param {Object} options - Configuration options
 * @param {number} options.interval - Poll interval in milliseconds (default: 5 minutes)
 * @param {Function} options.onDataUpdate - Callback when data updates
 * @param {Function} options.onError - Callback on sync errors
 * @param {boolean} options.enabled - Enable/disable polling (default: true)
 */
export function useRealtimeDataSync({
  interval = 5 * 60 * 1000, // 5 minutes default
  onDataUpdate = null,
  onError = null,
  enabled = true,
} = {}) {
  const pollIntervalRef = useRef(null)
  const lastSyncRef = useRef(null)
  const updateDashboardData = useDashStore((state) => state.updateDashboardData)

  const performSync = useCallback(async () => {
    try {
      // Call your backend API endpoint that triggers the SharePoint sync
      // This requires a backend API (see real-time-sync.md for backend setup)
      const response = await fetch('/api/sync-sharepoint-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.statusText}`)
      }

      const { data } = await response.json()
      lastSyncRef.current = new Date()

      if (data) {
        updateDashboardData(data)
        if (onDataUpdate) onDataUpdate(data)
        
        console.log(`✅ Data synced at ${lastSyncRef.current.toLocaleTimeString()}`)
      }
    } catch (error) {
      console.error('Real-time sync error:', error)
      if (onError) onError(error)
    }
  }, [updateDashboardData, onDataUpdate, onError])

  useEffect(() => {
    if (!enabled) return

    // Initial sync
    performSync()

    // Set up polling
    pollIntervalRef.current = setInterval(performSync, interval)

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [enabled, interval, performSync])

  return {
    lastSync: lastSyncRef.current,
    manualSync: performSync,
  }
}

/**
 * Simpler hook for background polling without data updates
 * Use this if you just want the app to re-fetch data periodically
 */
export function usePeriodicSharepointSync(interval = 5 * 60 * 1000, enabled = true) {
  const syncCountRef = useRef(0)

  useEffect(() => {
    if (!enabled) return

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch('/api/sync-sharepoint-data', { method: 'POST' })
        if (response.ok) {
          syncCountRef.current += 1
          console.log(`✅ Sync #${syncCountRef.current} completed`)
        }
      } catch (error) {
        console.error('Background sync failed:', error)
      }
    }, interval)

    return () => clearInterval(pollInterval)
  }, [enabled, interval])

  return { syncCount: syncCountRef.current }
}
