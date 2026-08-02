import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import SearchBar from './SearchBar'
import { CURRENT_USER_AVATAR, CURRENT_USER_NAME } from '../../utils/currentUser'
import './Layout.css'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const navigate = useNavigate()
  const location = useLocation()

  const isProfile = location.pathname === '/profile'

  return (
    <div className={`layout ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <div className="layout-main">
        <header className="layout-header">
          {isProfile ? <div className="search-bar-placeholder" /> : <SearchBar />}
          <button
            className="avatar-btn"
            title="個人資料"
            onClick={() => navigate('/profile')}
          >
            <img src={CURRENT_USER_AVATAR} alt={CURRENT_USER_NAME} className="avatar-circle" />
          </button>
        </header>
        <main className="layout-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
