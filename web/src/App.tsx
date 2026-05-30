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
import LoginView from './components/LoginView';
import { ALLOWED_TESTER_EMAILS } from './config/testers';

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
  const { isLoggedIn, user, isLoading } = useAuth();
  useSyncCatalog();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#0f172a' }}>
        <div style={{
          width: '32px',
          height: '32px',
          border: '3px solid rgba(56, 189, 248, 0.1)',
          borderTopColor: '#38bdf8',
          borderRadius: '50%',
          animation: 'spin 1s infinite linear'
        }} />
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <LoginView />;
  }

  const isAllowed = user?.email 
    ? ALLOWED_TESTER_EMAILS.map(e => e.toLowerCase()).includes(user.email.toLowerCase()) 
    : false;

  if (!isAllowed) {
    return <LoginView isUnauthorized={true} />;
  }

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
