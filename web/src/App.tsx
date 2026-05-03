import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useSyncCatalog } from './hooks/useSyncCatalog';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { restoreFromCloud } from './hooks/useCloudSync';
import Hub from './components/Hub';
import BattleLogger from './components/BattleLogger';
import Sidebar from './components/Sidebar';
import StatsPage from './components/StatsPage';
import PartDetailPage from './components/PartDetailPage';
import BattleHistoryPage from './components/BattleHistoryPage';
import BattleDetailPage from './components/BattleDetailPage';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

// Triggers cloud restore when a premium user logs in for the first time on this device
function CloudSyncEffect() {
  const { isLoggedIn, isPremium, getToken } = useAuth();
  useEffect(() => {
    if (!isLoggedIn || !isPremium) return;
    getToken().then(token => {
      if (token) restoreFromCloud(token).catch(console.error);
    });
  }, [isLoggedIn, isPremium, getToken]);
  return null;
}

function AppContent() {
  useSyncCatalog();

  return (
    <Router>
      <ScrollToTop />
      <CloudSyncEffect />
      <div id="app-layout">
        <Sidebar />
        <main id="app-content">
          <Routes>
            <Route path="/" element={<Hub />} />
            <Route path="/logger" element={<BattleLogger />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/stats/parts/:id" element={<PartDetailPage />} />
            <Route path="/battles" element={<BattleHistoryPage />} />
            <Route path="/battles/:id" element={<BattleDetailPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
