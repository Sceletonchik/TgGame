import { useState, useEffect } from 'react';
import { api } from '../api';
import Avatar from './Avatar';

const GAMES = [
  { id: 'chess',      label: 'Шахматы',      icon: '♟' },
  { id: 'checkers',   label: 'Шашки',        icon: '🔴' },
  { id: 'battleship', label: 'Морской бой',  icon: '🚢' },
  { id: 'gomoku',     label: 'Пять в ряд',   icon: '⬤' },
  { id: 'connect4',   label: 'Четыре в ряд', icon: '🟡' },
];

const MEDALS = ['🥇','🥈','🥉'];

export default function Leaderboard({ user }) {
  const [game,    setGame]    = useState('chess');
  const [board,   setBoard]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getLeaderboard(game)
      .then(setBoard)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [game]);

  return (
    <div className="fade-in" style={{ paddingBottom: 16 }}>
      <div style={{ padding: '16px 16px 0' }}>
        <h2 style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:700, letterSpacing:'0.05em' }}>
          РЕЙТИНГ
        </h2>
      </div>

      {/* Game tabs */}
      <div style={{ display:'flex', overflowX:'auto', gap:8, padding:'12px 16px', scrollbarWidth:'none' }}>
        {GAMES.map(g => (
          <button
            key={g.id}
            onClick={() => setGame(g.id)}
            style={{
              display:'flex', alignItems:'center', gap:6,
              padding:'7px 14px', borderRadius:10, border:'none', cursor:'pointer',
              fontFamily:'var(--font-display)', fontWeight:600, fontSize:13, letterSpacing:'0.04em',
              whiteSpace:'nowrap', flexShrink:0,
              background: game === g.id ? 'var(--cyan)' : 'var(--bg-surface)',
              color:      game === g.id ? 'var(--bg-deep)' : 'var(--text-secondary)',
              boxShadow:  game === g.id ? 'var(--glow-cyan)' : 'none',
              transition:'all 0.15s',
            }}
          >
            <span>{g.icon}</span> {g.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', padding:40 }}><div className="spinner"/></div>
      ) : board.length === 0 ? (
        <div style={{ textAlign:'center', padding:'40px 16px', color:'var(--text-muted)' }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🏆</div>
          <p>Нет данных. Сыграйте первыми!</p>
        </div>
      ) : (
        <div style={{ padding:'0 16px' }}>
          {/* Top 3 podium */}
          {board.length >= 3 && (
            <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'center', gap:8, marginBottom:16 }}>
              {[1,0,2].map(i => (
                <PodiumCard key={i} rank={i+1} entry={board[i]} isMe={board[i]?.id === user?.id} />
              ))}
            </div>
          )}

          {/* Rest of leaderboard */}
          <div className="card" style={{ padding:0, overflow:'hidden' }}>
            {board.slice(3).map((entry, idx) => (
              <div
                key={entry.id}
                className="list-item"
                style={{ background: entry.id === user?.id ? 'rgba(0,229,255,0.05)' : undefined }}
              >
                <div style={{
                  width:28, textAlign:'center',
                  fontFamily:'var(--font-display)', fontWeight:700,
                  color:'var(--text-muted)', fontSize:14,
                }}>
                  {idx + 4}
                </div>
                <Avatar user={entry} size={38} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:600, fontSize:13, display:'flex', alignItems:'center', gap:6 }}>
                    {entry.first_name} {entry.last_name || ''}
                    {entry.id === user?.id && (
                      <span style={{ fontSize:10, color:'var(--cyan)', background:'rgba(0,229,255,0.1)', padding:'1px 5px', borderRadius:4 }}>ВЫ</span>
                    )}
                  </div>
                  {entry.username && <div style={{ color:'var(--text-secondary)', fontSize:11 }}>@{entry.username}</div>}
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontFamily:'var(--font-display)', fontWeight:700, color:'var(--gold)', fontSize:15 }}>
                    Ур.{entry.level}
                  </div>
                  <div style={{ fontSize:11, color:'var(--text-muted)' }}>{entry.wins}П/{entry.losses}Пр</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PodiumCard({ rank, entry, isMe }) {
  if (!entry) return <div style={{ flex:1 }} />;
  const heights = { 1:100, 2:76, 3:60 };
  const colors  = { 1:'var(--gold)', 2:'#C0C0C0', 3:'#CD7F32' };
  const isFirst = rank === 1;

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
      <Avatar user={entry} size={isFirst ? 56 : 44} />
      <div style={{ fontSize:isFirst?13:11, fontWeight:600, textAlign:'center', maxWidth:80, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
        {entry.first_name}
      </div>
      <div style={{ fontSize:11, color:'var(--text-muted)' }}>Ур.{entry.level}</div>
      <div style={{
        width:'100%', height:heights[rank],
        background:`linear-gradient(180deg, ${colors[rank]}22, ${colors[rank]}44)`,
        border:`1px solid ${colors[rank]}66`,
        borderRadius:'6px 6px 0 0',
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4,
        boxShadow: isFirst ? `0 0 20px ${colors[rank]}44` : 'none',
      }}>
        <span style={{ fontSize:isFirst?24:20 }}>{['🥇','🥈','🥉'][rank-1]}</span>
        <span style={{ fontFamily:'var(--font-display)', fontWeight:700, color:colors[rank], fontSize:14 }}>
          {entry.wins}П
        </span>
      </div>
    </div>
  );
}
