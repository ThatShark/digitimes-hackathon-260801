import { Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import MainPage from './pages/MainPage'
import CoinTrendPage from './pages/CoinTrendPage'
import ProfilePage from './pages/ProfilePage'

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<MainPage />} />
        <Route path="/coin/:symbol" element={<CoinTrendPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>
    </Routes>
  )
}

export default App
