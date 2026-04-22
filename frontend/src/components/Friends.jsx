import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import Avatar from './Avatar';

export default function Friends({ user, showToast }) {
  const [data,    setData]    = useState({ friends: [], incoming: [], outgoing: [] });
  const [tab,     setTab]     = useState('list');
  const [search,  setSearch]  = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  const load = useCallback(() => {
    if (!user?.id) return;
    setLoading(true);
    api.getFriends(user.id)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  // Debounced search
  useEffect(() => {
    if (search.length < 2) { setResults([]); return; }
    const t = setTimeout(() => {
      setSearching(true);
      api.searchUsers(search, user.id)
        .then(setResults)
        .catch(console.error)
        .finally(() => setSearching(false));
    }, 400);
    return () => clearTimeout(t);
  }, [search, user?.id]);

  const sendRequest = async (friendId) => {
    try {
      await api.sendRequest(user.id, friendId);
      showToast('✅ Запрос отправлен');
      load();
    } catch { showToast('❌ Ошибка'); }
  };

  const accept = async (requesterId) => {
    try {
      await api.acceptRequest(user.id, requesterId);
      showToast('✅ Друг добавлен!');
      load();
    } catch { showToast('❌ Ошибка'); }
  };

  const reject = async (requesterId) => {
    try {
      await api.rejectRequest(user.id, requesterId);
      showToast('Запрос отклонён');
      load();
    } catch { showToast('❌ Ошибка'); }
  };

  const remove = async (friendId) => {
    try {
      await api.removeFriend(user.id, friendId);
      showToast('Удалён из друзей');
      load();
    } catch { showToast('❌ Ошибка'); }
  };

  const isAlreadyFriend = (id) =>
    data.friends.some(f => f.id === id) ||
    data.outgoing.some(f => f.id === id);

  return (
    <div className="fade-in" style={{ paddingBottom: 16 }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 0' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, letterSpacing: '0.05em' }}>
          ДРУЗЬЯ
        </h2>

        {/* Search bar */}
        <div style={{ position: 'relative', marginTop: 12 }}>
          <input
            className="field"
            placeholder="Найти игрока по имени или @username…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 40 }}
          />
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>🔍</span>
        </div>
      </div>

      {/* Search results */}
      {(search.length >= 2) && (
        <div style={{ padding: '12px 16px 0' }}>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 8, fontFamily: 'var(--font-display)', fontWeight: 700, textTransform: 'uppercase' }}>
            Результаты поиска
          </p>
          {searching ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}><div className="spinner" /></div>
          ) : results.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 16 }}>Никого не найдено</p>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {results.map(u => (
                <div key={u.id} className="list-item">
                  <Avatar user={u} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, truncate: true }}>{u.first_name} {u.last_name || ''}</div>
                    {u.username && <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>@{u.username}</div>}
                  </div>
                  {!isAlreadyFriend(u.id) && u.id !== user.id && (
                    <button className="btn btn-primary btn-sm" onClick={() => sendRequest(u.id)}>
                      + Добавить
                    </button>
                  )}
                  {data.outgoing.some(f => f.id === u.id) && (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Отправлено</span>
                  )}
                  {data.friends.some(f => f.id === u.id) && (
                    <span style={{ fontSize: 12, color: 'var(--green)' }}>✓ Друг</span>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="divider" style={{ margin: '16px 0' }} />
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, padding: '8px 16px 4px' }}>
        {[
          { id: 'list',     label: `Друзья (${data.friends.length})` },
          { id: 'incoming', label: `Входящие${data.incoming.length ? ` (${data.incoming.length})` : ''}` },
          { id: 'outgoing', label: 'Исходящие' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '6px 14px',
              borderRadius: 8, border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 12, letterSpacing: '0.04em',
              background: tab === t.id ? 'var(--cyan)' : 'var(--bg-surface)',
              color: tab === t.id ? 'var(--bg-deep)' : 'var(--text-secondary)',
              transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: '8px 16px 0' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><div className="spinner" /></div>
        ) : (
          <>
            {tab === 'list' && (
              data.friends.length === 0
                ? <EmptyState icon="👥" text="У вас ещё нет друзей. Найдите игроков через поиск!" />
                : <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    {data.friends.map(f => (
                      <div key={f.id} className="list-item">
                        <Avatar user={f} size={44} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{f.first_name} {f.last_name || ''}</div>
                          {f.username && <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>@{f.username}</div>}
                        </div>
                        <button className="btn btn-danger btn-sm" onClick={() => remove(f.id)}>Удалить</button>
                      </div>
                    ))}
                  </div>
            )}

            {tab === 'incoming' && (
              data.incoming.length === 0
                ? <EmptyState icon="📩" text="Нет входящих запросов в друзья" />
                : <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    {data.incoming.map(f => (
                      <div key={f.id} className="list-item">
                        <Avatar user={f} size={44} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{f.first_name} {f.last_name || ''}</div>
                          {f.username && <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>@{f.username}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-primary btn-sm" onClick={() => accept(f.id)}>✓</button>
                          <button className="btn btn-danger  btn-sm" onClick={() => reject(f.id)}>✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
            )}

            {tab === 'outgoing' && (
              data.outgoing.length === 0
                ? <EmptyState icon="📤" text="Нет исходящих запросов" />
                : <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    {data.outgoing.map(f => (
                      <div key={f.id} className="list-item">
                        <Avatar user={f} size={44} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{f.first_name} {f.last_name || ''}</div>
                          {f.username && <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>@{f.username}</div>}
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-surface)', padding: '4px 8px', borderRadius: 6 }}>
                          Ожидание
                        </span>
                      </div>
                    ))}
                  </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState({ icon, text }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
      <p style={{ fontSize: 14 }}>{text}</p>
    </div>
  );
}
