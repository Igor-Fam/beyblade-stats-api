import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Hub from './components/Hub';
import BattleLogger from './components/BattleLogger';
import Sidebar from './components/Sidebar';
import StatsPage from './components/StatsPage';
import PartDetailPage from './components/PartDetailPage';

function App() {
  return (
    <Router>
      <div id="app-layout">
        <Sidebar />
        <main id="app-content">
          <Routes>
            <Route path="/" element={<Hub />} />
            <Route path="/logger" element={<BattleLogger />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/stats/parts/:id" element={<PartDetailPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
