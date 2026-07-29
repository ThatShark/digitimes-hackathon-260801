import './SearchBar.css'

export default function SearchBar({ placeholder = '搜尋幣種...' }) {
  return (
    <div className="search-bar">
      <span className="search-icon">🔍</span>
      <input
        type="text"
        placeholder={placeholder}
        className="search-input"
      />
    </div>
  )
}
