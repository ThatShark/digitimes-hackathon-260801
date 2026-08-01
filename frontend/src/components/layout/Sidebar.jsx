import { NavLink } from 'react-router-dom'
import { useBookmarks } from '../../hooks/useBookmarks'
import './Sidebar.css'

const NAV_ITEMS = [
  { to: '/', label: '主頁', icon: '🏠' },
  { to: '/community', label: '社群', icon: '💬' },
  { to: '/questionnaire', label: '問卷', icon: '📋' },
]

export default function Sidebar({ open, onToggle }) {
  const { bookmarks } = useBookmarks()

  return (
    <aside className={`sidebar ${open ? '' : 'collapsed'}`}>
      <div className="sidebar-top">
        <button className="sidebar-toggle" onClick={onToggle} title="展開/收合">
          <span className="toggle-icon">☰</span>
        </button>
        {open && <span className="sidebar-brand">L.I.V.E.</span>}
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''}`
            }
            title={item.label}
          >
            <span className="sidebar-icon">{item.icon}</span>
            {open && <span className="sidebar-label">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* 重點關注列表 */}
      {bookmarks.length > 0 && (
        <div className="sidebar-bookmarks">
          {open && <span className="sidebar-section-title">★ 重點關注</span>}
          {!open && <span className="sidebar-section-icon" title="重點關注">★</span>}
          <div className="bookmark-list">
            {bookmarks.map((symbol) => (
              <NavLink
                key={symbol}
                to={`/coin/${symbol}`}
                className={({ isActive }) =>
                  `bookmark-item ${isActive ? 'active' : ''}`
                }
                title={symbol}
              >
                <span className="bookmark-coin-icon">{symbol.charAt(0)}</span>
                {open && <span className="bookmark-coin-label">{symbol}</span>}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </aside>
  )
}
