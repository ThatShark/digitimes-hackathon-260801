import { Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import MainPage from './pages/MainPage'
import CoinTrendPage from './pages/CoinTrendPage'
import CommunityPage from './pages/CommunityPage'

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<MainPage />} />
        <Route path="/coin/:symbol" element={<CoinTrendPage />} />
        <Route path="/community" element={<CommunityPage />} />
      </Route>
    </Routes>
  )
}

export default App
