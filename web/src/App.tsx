import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Hub from './components/Hub';
import BattleLogger from './components/BattleLogger';

function App() {
  return (
    <Router>
      <div id="app">
        <Routes>
          <Route path="/" element={<Hub />} />
          <Route path="/logger" element={<BattleLogger />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
