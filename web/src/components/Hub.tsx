import { Link } from 'react-router-dom';
import { Swords, BarChart3 } from 'lucide-react';

export default function Hub() {
  return (
    <div className="view">
      <h1 style={{ textAlign: 'center', marginBottom: '2rem', fontSize: '2.5rem', textShadow: '0 0 20px rgba(56, 189, 248, 0.3)' }}>
        Beyblade X Hub
      </h1>
      
      <div className="menu-cards">
        <Link to="/logger" className="menu-card">
          <h2><Swords style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'text-bottom' }} /> Battle Logger</h2>
          <p>Register matches, test setups, and tally performance.</p>
        </Link>
        
        <div className="menu-card disabled" style={{ cursor: 'not-allowed' }}>
          <h2><BarChart3 style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'text-bottom' }} /> Statistics</h2>
          <p>Coming Soon: Analyze matchups, metagame trends, and counters.</p>
        </div>
      </div>
    </div>
  );
}
