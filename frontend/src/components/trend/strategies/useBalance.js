import { useState, useEffect } from 'react'
import { getBalance } from '../../../services/coinApi'

/**
 * Hook to fetch and return the user's TWD balance.
 * Returns { balance, loading } where balance is null during loading.
 */
export function useBalance() {
  const [balance, setBalance] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getBalance()
      .then((data) => {
        if (!cancelled) {
          setBalance(data.twd_balance ?? 0)
        }
      })
      .catch(() => {
        if (!cancelled) setBalance(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  return { balance, loading }
}
