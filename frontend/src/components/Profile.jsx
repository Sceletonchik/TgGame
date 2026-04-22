import { useState, useEffect } from 'react';
import { api } from '../api';
import Avatar from './Avatar';

const GAMES = [
  { id: 'chess',      label: 'Шахматы',      icon: '♟', color: '#E8C86A' },
  { id: 'checkers',   label: 'Шашки',        icon: '🔴', color: '#FF6B6B' },
  { id: 'battleship', label: 'Морской бой',  icon: '🚢', color: '#4FC3F7' },
  { id: 'gomoku',     label: 'Пять в ряд',   icon: '⬤', color: '#81C784' },
  { id: 'connect4',   label: 'Четыре в ряд', icon: '🟡', color: '#FFD54F' },
];

const XP_FOR_LEVEL = (lvl) => Math.floor(100 * Math.pow(1.4, lvl - 1));

export default function Profile({ user, tgUser }) {
  const [stats,   setStats]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    api.getStats(user.id)
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user?.id]);

  const getStatForGame = (gameId) =>
    stats.find(s => s.game_type === gameId) || { level: 1, xp: 0, wins: 0, losses: 0, draws: 0 };

  const totalWins   = stats.reduce((a, s) => a + s.wins,   0);
  const totalGames  = stats.reduce((a, s) => a + s.wins + s.losses + s.draws, 0);
  const maxLevel    = stats.length ? Math.max(...stats.map(s => s.level)) : 1;
  const winRate     = totalGames ? Math.round((totalWins / totalGames) * 100) : 0;

  return (
    <div style={{ padding: '0 0 16px' }} className="fade-in">
      {/* ── Hero header ─────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(0,229,255,0.08) 0%, transparent 100%)',
        borderBottom: '1px solid var(--border)',
        padding: '24px 16px 20px',
        textAlign: 'center',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, position: 'relative' }}>
          <div style={{
            position: 'absolute', inset: -4,
            borderRadius: '50%',
            background: 'conic-gradient(var(--cyan), var(--magenta), var(--cyan))',
            opacity: 0.5,
          }} />
          <Avatar user={tgUser} size={80} />
        </div>

        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, letterSpacing: '0.03em' }}>
          {tgUser?.first_name} {tgUser?.last_name || ''}
        </h1>
        {tgUser?.username && (
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 2 }}>
            @{tgUser.username}
          </p>
        )}

        {/* Summary row */}
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 16 }}>
          <StatPill label="Игр" value={totalGames} />
          <StatPill label="Побед" value={totalWins} color="var(--green)" />
          <StatPill label="Win%" value={`${winRate}%`} color="var(--cyan)" />
          <StatPill label="Макс. ур." value={maxLevel} color="var(--gold)" />
        </div>
      </div>

      {/* ── Per-game stats ──────────────────────────────────────────── */}
      <div style={{ padding: '16px 16px 0' }}>
        <p style={{
          fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700,
          letterSpacing: '0.15em', color: 'var(--text-muted)',
          textTransform: 'uppercase', marginBottom: 12,
        }}>Статистика по играм</p>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
            <div className="spinner" />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {GAMES.map(game => (
              <GameStatCard key={game.id} game={game} stat={getStatForGame(game.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatPill({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700,
        color: color || 'var(--text-primary)',
      }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>{label}</div>
    </div>
  );
}

function GameStatCard({ game, stat }) {
  const xpNeeded  = XP_FOR_LEVEL(stat.level);
  const progress  = Math.min(stat.xp / xpNeeded, 1);
  const totalGames = stat.wins + stat.losses + stat.draws;

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: `${game.color}18`,
          border: `1px solid ${game.color}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, flexShrink: 0,
        }}>
          {game.icon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>
              {game.label}
            </span>
            <span style={{
              background: `linear-gradient(135deg, ${game.color}, ${game.color}99)`,
              color: '#000',
              borderRadius: 6, padding: '2px 8px',
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12,
            }}>
              UR.{stat.level}
            </span>
          </div>

          {/* XP bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <div className="xp-bar-track" style={{ flex: 1 }}>
              <div
                className="xp-bar-fill"
                style={{
                  width: `${progress * 100}%`,
                  background: `linear-gradient(90deg, ${game.color}, ${game.color}88)`,
                }}
              />
            </div>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {stat.xp}/{xpNeeded} XP
            </span>
          </div>
        </div>
      </div>

      {/* Win/Loss/Draw row */}
      <div style={{
        display: 'flex', gap: 0,
        background: 'var(--bg-surface)',
        borderRadius: 8, overflow: 'hidden',
      }}>
        <MiniStat label="П" value={stat.wins}   color="var(--green)" />
        <MiniStat label="Пр" value={stat.losses} color="var(--red)" />
        <MiniStat label="Н" value={stat.draws}  color="var(--text-secondary)" />
        <MiniStat label="Игр" value={totalGames} color="var(--text-muted)" />
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div style={{
      flex: 1, textAlign: 'center', padding: '8px 4px',
      borderRight: '1px solid var(--border)',
    }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color }}>
        {value}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
        {label}
      </div>
    </div>
  );
}
