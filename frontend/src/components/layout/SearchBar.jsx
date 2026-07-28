import './SearchBar.css'

export default function SearchBar() {
  return (
    <div className="search-bar">
      <span className="search-icon">🔍</span>
      <input
        type="text"
        placeholder="搜尋幣種..."
        className="search-input"
      />
    </div>
  )
}
