import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import SearchBar from './SearchBar'
import './Layout.css'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const navigate = useNavigate()

  return (
    <div className={`layout ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <div className="layout-main">
        <header className="layout-header">
          <SearchBar />
          <button
            className="avatar-btn"
            title="個人資料"
            onClick={() => navigate('/profile')}
          >
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
