import { useState, useEffect } from 'react'
import { getBalance } from '../../../services/coinApi'
import { isBackendConfigured } from '../../../services/api'
import { CURRENT_USER_ID } from '../../../utils/currentUser'

/**
 * Hook to fetch and return the user's TWD balance.
 * Returns { balance, loading } where balance is 0 if unavailable.
 */
export function useBalance() {
  const [balance, setBalance] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isBackendConfigured()) {
      setBalance(0)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    getBalance(CURRENT_USER_ID)
      .then((data) => {
        if (!cancelled) {
          setBalance(data.twd_balance ?? 0)
        }
      })
      .catch(() => {
        if (!cancelled) setBalance(0)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  return { balance, loading }
}
