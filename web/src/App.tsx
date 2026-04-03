import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
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

function App() {
  return (
    <Router>
      <ScrollToTop />
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

export default App;
