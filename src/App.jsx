import { Routes, Route, Navigate } from 'react-router-dom'
import AdminPage from './pages/AdminPage'
import LiveQueuePage from './pages/LiveQueuePage'
import SettingsPage from './pages/SettingsPage'
import LoginPage from './pages/LoginPage'

function ProtectedRoute({ children }) {
  const isAuth = sessionStorage.getItem('vxi-auth') === 'true';
  return isAuth ? children : <Navigate to="/login" replace />;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/live" element={<LiveQueuePage />} />
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
    </Routes>
  )
}

export default App
