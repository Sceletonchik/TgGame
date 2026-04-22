import { useState, useEffect, useCallback } from 'react';
import { useTelegram } from './hooks/useTelegram';
import { api } from './api';
import Navigation from './components/Navigation';
import GameLobby  from './components/GameLobby';
import Friends    from './components/Friends';
import Profile    from './components/Profile';
import Leaderboard from './components/Leaderboard';

export default function App() {
  const { tg, user: tgUser, ready, expand } = useTelegram();
  const [tab,     setTab]     = useState('games');
  const [authUser, setAuthUser] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [toast,    setToast]    = useState(null);

  const showToast = useCallback((msg, ms = 2500) => {
    setToast(msg);
    setTimeout(() => setToast(null), ms);
  }, []);

  useEffect(() => {
    ready?.();
    expand?.();

    api.auth({
      tg_id:      tgUser.id,
      username:   tgUser.username,
      first_name: tgUser.first_name,
      last_name:  tgUser.last_name,
      photo_url:  tgUser.photo_url || null,
    })
      .then(({ user }) => setAuthUser(user))
      .catch(() => {
        // offline — create local fallback
        setAuthUser({ id: 0, tg_id: tgUser.id, first_name: tgUser.first_name, username: tgUser.username });
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div style={{ height:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
        <div className="spinner" />
        <p style={{ color:'var(--text-secondary)', fontFamily:'var(--font-display)', fontSize:14, letterSpacing:'0.1em' }}>ЗАГРУЗКА…</p>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {toast && <div className="toast">{toast}</div>}

      <div className="page-content">
        {tab === 'games'  && <GameLobby   user={authUser} tgUser={tgUser} showToast={showToast} />}
        {tab === 'friends'&& <Friends     user={authUser} tgUser={tgUser} showToast={showToast} />}
        {tab === 'profile'&& <Profile     user={authUser} tgUser={tgUser} showToast={showToast} />}
        {tab === 'rank'   && <Leaderboard user={authUser} showToast={showToast} />}
      </div>

      <Navigation active={tab} onChange={setTab} />
    </div>
  );
}
