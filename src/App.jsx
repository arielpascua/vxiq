import { Routes, Route, Navigate } from 'react-router-dom'
import AdminPage from './pages/AdminPage'
import LiveQueuePage from './pages/LiveQueuePage'
import SettingsPage from './pages/SettingsPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/live" element={<LiveQueuePage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  )
}

export default App
