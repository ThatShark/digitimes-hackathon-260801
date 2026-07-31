import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import SearchBar from './SearchBar'
import NotificationBanner from '../shared/NotificationBanner'
import './Layout.css'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const location = useLocation()

  const isCoinRoute = location.pathname.startsWith('/coin/')
  const searchPlaceholder = isCoinRoute ? '搜尋其他幣種...' : '搜尋幣種...'

  return (
    <div className={`layout ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <div className="layout-main">
        <NotificationBanner />
        <header className="layout-header">
          <SearchBar placeholder={searchPlaceholder} />
          <button className="avatar-btn" title="設定 / 個人資料">
            <div className="avatar-circle" />
          </button>
        </header>
        <main className="layout-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
