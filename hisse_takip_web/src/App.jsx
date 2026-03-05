import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Hisse from './pages/Hisse';
import Altin from './pages/Altin';
import Doviz from './pages/Doviz';
import Ozet from './pages/Ozet';
import Login from './pages/Login';
import { LogOut } from 'lucide-react';
import './index.css';

function Navbar({ onLogout }) {
  const location = useLocation();

  return (
    <nav className="navbar">
      <div className="nav-brand">Finans Takip Pro</div>
      <div className="nav-links">
        <Link to="/" className={location.pathname === '/' ? 'active' : ''}>📊 Özet</Link>
        <Link to="/hisseler" className={location.pathname === '/hisseler' ? 'active' : ''}>📈 Hisseler</Link>
        <Link to="/altin" className={location.pathname === '/altin' ? 'active' : ''}>🥇 K. Madenler</Link>
        <Link to="/doviz" className={location.pathname === '/doviz' ? 'active' : ''}>💵 Döviz</Link>
        <button onClick={onLogout} className="btn-logout" title="Çıkış Yap">
          <LogOut size={18} />
        </button>
      </div>
    </nav>
  );
}

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mevcut oturumu al
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Oturum değişikliklerini dinle
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return <div className="loading-screen">Yükleniyor...</div>;
  }

  if (!session) {
    return <Login />;
  }

  return (
    <Router>
      <div className="app-wrapper">
        <Navbar onLogout={handleLogout} />
        <Routes>
          <Route path="/" element={<Ozet />} />
          <Route path="/hisseler" element={<Hisse />} />
          <Route path="/altin" element={<Altin />} />
          <Route path="/doviz" element={<Doviz />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
