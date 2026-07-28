import { NavLink } from 'react-router-dom'
import './Sidebar.css'

const NAV_ITEMS = [
  { to: '/', label: '主頁', icon: '🏠' },
  { to: '/community', label: '社群', icon: '💬' },
]

export default function Sidebar({ open, onToggle }) {
  return (
    <aside className={`sidebar ${open ? '' : 'collapsed'}`}>
      <div className="sidebar-top">
        <button className="sidebar-toggle" onClick={onToggle} title="展開/收合">
          <span className="toggle-icon">{open ? '◀' : '▶'}</span>
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
    </aside>
  )
}
