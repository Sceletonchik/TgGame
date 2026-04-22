import { useState } from 'react';
import { io } from 'socket.io-client';
import { api } from '../api';
import Chess      from './games/Chess';
import Checkers   from './games/Checkers';
import Battleship from './games/Battleship';
import Gomoku     from './games/Gomoku';
import Connect4   from './games/Connect4';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '';

const GAMES = [
  {
    id: 'chess', label: 'Шахматы', icon: '♟',
    desc: 'Классические шахматы. Стандартные правила.', color: '#E8C86A',
    players: '2',
  },
  {
    id: 'checkers', label: 'Шашки', icon: '🔴',
    desc: 'Русские шашки на доске 8×8. Дамки, взятия.', color: '#FF6B6B',
    players: '2',
  },
  {
    id: 'battleship', label: 'Морской бой', icon: '🚢',
    desc: 'Расставь флот и топи корабли противника!', color: '#4FC3F7',
    players: '2',
  },
  {
    id: 'gomoku', label: 'Пять в ряд', icon: '⬤',
    desc: 'Выстрой 5 камней в линию на доске 15×15.', color: '#81C784',
    players: '2',
  },
  {
    id: 'connect4', label: 'Четыре в ряд', icon: '🟡',
    desc: 'Сбрось фишку — четыре в ряд победа!', color: '#FFD54F',
    players: '2',
  },
];

export default function GameLobby({ user, showToast }) {
  const [activeGame, setActiveGame]   = useState(null);
  const [socket,     setSocket]       = useState(null);
  const [sessionId,  setSessionId]    = useState(null);
  const [players,    setPlayers]      = useState(null);
  const [gameStatus, setGameStatus]   = useState('idle'); // idle | waiting | playing | finished
  const [myColor,    setMyColor]      = useState(null);
  const [lobby,      setLobby]        = useState([]);
  const [showLobby,  setShowLobby]    = useState(false);

  const connectSocket = () => {
    const s = io(SOCKET_URL, { transports: ['websocket'] });
    setSocket(s);
    return s;
  };

  const createGame = async (gameId) => {
    try {
      const s = connectSocket();
      const session = await api.createSession(gameId, user.id);
      setSessionId(session.id);
      setActiveGame(gameId);
      setGameStatus('waiting');

      s.emit('join_session', { sessionId: session.id, userId: user.id });

      s.on('session_start', ({ session: sess, players: ps }) => {
        setPlayers(ps);
        setMyColor(sess.player1_id === user.id ? 'white' : 'black');
        setGameStatus('playing');
      });

      s.on('game_finished', ({ winnerId, result }) => {
        setGameStatus('finished');
        if (result === 'resign')  showToast(winnerId === user.id ? '🏆 Противник сдался!' : '😔 Вы сдались');
        else if (result === 'draw') showToast('🤝 Ничья!');
        else showToast(winnerId === user.id ? '🏆 Вы победили!' : '😔 Вы проиграли');
      });

      s.on('opponent_disconnected', () => showToast('⚡ Противник отключился'));

    } catch (e) {
      showToast('❌ Ошибка создания игры');
    }
  };

  const joinGame = async (sessionId, gameId) => {
    try {
      const s = connectSocket();
      setSessionId(sessionId);
      setActiveGame(gameId);
      setGameStatus('waiting');

      s.emit('join_session', { sessionId, userId: user.id });

      s.on('session_start', ({ session: sess, players: ps }) => {
        setPlayers(ps);
        setMyColor(sess.player1_id === user.id ? 'white' : 'black');
        setGameStatus('playing');
      });

      s.on('game_finished', ({ winnerId, result }) => {
        setGameStatus('finished');
        if (result === 'resign')  showToast(winnerId === user.id ? '🏆 Противник сдался!' : '😔 Вы сдались');
        else if (result === 'draw') showToast('🤝 Ничья!');
        else showToast(winnerId === user.id ? '🏆 Вы победили!' : '😔 Вы проиграли');
      });

      s.on('opponent_disconnected', () => showToast('⚡ Противник отключился'));

    } catch (e) {
      showToast('❌ Ошибка подключения к игре');
    }
  };

  const openLobby = async (gameId) => {
    try {
      const sessions = await api.getSessions(gameId);
      setLobby(sessions);
      setActiveGame(gameId);
      setShowLobby(true);
    } catch { showToast('❌ Ошибка загрузки лобби'); }
  };

  const exitGame = () => {
    if (socket) { socket.disconnect(); setSocket(null); }
    setActiveGame(null);
    setSessionId(null);
    setPlayers(null);
    setGameStatus('idle');
    setMyColor(null);
    setShowLobby(false);
  };

  // ── Render active game ───────────────────────────────────────────────────
  if (activeGame && (gameStatus === 'playing' || gameStatus === 'waiting')) {
    if (gameStatus === 'waiting') {
      return (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'80dvh', gap:20, padding:24 }}>
          <div className="spinner" />
          <p style={{ fontFamily:'var(--font-display)', fontSize:18, fontWeight:700, letterSpacing:'0.08em', color:'var(--cyan)' }}>
            ОЖИДАНИЕ ПРОТИВНИКА…
          </p>
          <p style={{ color:'var(--text-muted)', fontSize:12 }}>ID: {sessionId?.slice(0,8)}</p>
          <button className="btn btn-ghost" onClick={exitGame}>Отмена</button>
        </div>
      );
    }

    const gameProps = {
      socket, sessionId, user, myColor, players,
      onExit: exitGame,
      showToast,
    };

    return (
      <>
        {activeGame === 'chess'      && <Chess      {...gameProps} />}
        {activeGame === 'checkers'   && <Checkers   {...gameProps} />}
        {activeGame === 'battleship' && <Battleship {...gameProps} />}
        {activeGame === 'gomoku'     && <Gomoku     {...gameProps} />}
        {activeGame === 'connect4'   && <Connect4   {...gameProps} />}
      </>
    );
  }

  // ── Lobby modal ──────────────────────────────────────────────────────────
  if (showLobby) {
    return (
      <div className="fade-in" style={{ padding:'16px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowLobby(false)}>← Назад</button>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:18, fontWeight:700 }}>
            {GAMES.find(g=>g.id===activeGame)?.label} — Лобби
          </h2>
        </div>

        <button className="btn btn-primary btn-full" style={{ marginBottom:16 }} onClick={() => { setShowLobby(false); createGame(activeGame); }}>
          + Создать новую игру
        </button>

        {lobby.length === 0 ? (
          <div style={{ textAlign:'center', padding:'40px 0', color:'var(--text-muted)' }}>
            <p>Нет открытых игр. Создайте первыми!</p>
          </div>
        ) : (
          <div className="card" style={{ padding:0, overflow:'hidden' }}>
            {lobby.map(s => (
              <div key={s.id} className="list-item">
                <div style={{
                  width:40, height:40, borderRadius:10,
                  background:'var(--bg-surface)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:20,
                }}>
                  {s.p1_photo
                    ? <img src={s.p1_photo} style={{ width:40, height:40, borderRadius:10 }} alt="" />
                    : (s.p1_name?.[0] || '?')
                  }
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:600, fontSize:13 }}>{s.p1_name}</div>
                  {s.p1_username && <div style={{ color:'var(--text-secondary)', fontSize:11 }}>@{s.p1_username}</div>}
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => { setShowLobby(false); joinGame(s.id, activeGame); }}>
                  Войти
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Game selection ───────────────────────────────────────────────────────
  return (
    <div className="fade-in">
      <div style={{ padding:'20px 16px 8px' }}>
        <h2 style={{ fontFamily:'var(--font-display)', fontSize:26, fontWeight:700, letterSpacing:'0.06em' }}>
          GAME<span style={{ color:'var(--cyan)' }}>ARENA</span>
        </h2>
        <p style={{ color:'var(--text-secondary)', fontSize:13, marginTop:4 }}>Выберите игру и начните матч</p>
      </div>

      <div style={{ padding:'8px 16px', display:'flex', flexDirection:'column', gap:12 }}>
        {GAMES.map(game => (
          <div
            key={game.id}
            className="card"
            style={{
              display:'flex', alignItems:'center', gap:16,
              borderColor: `${game.color}30`,
              cursor:'pointer', transition:'all 0.2s',
            }}
            onClick={() => openLobby(game.id)}
          >
            <div style={{
              width:56, height:56, borderRadius:14, flexShrink:0,
              background:`linear-gradient(135deg, ${game.color}22, ${game.color}11)`,
              border:`1px solid ${game.color}44`,
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:28,
              boxShadow:`0 0 20px ${game.color}22`,
            }}>
              {game.icon}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:17, letterSpacing:'0.04em' }}>
                {game.label}
              </div>
              <div style={{ color:'var(--text-secondary)', fontSize:12, marginTop:2 }}>
                {game.desc}
              </div>
              <div style={{ display:'flex', gap:8, marginTop:6 }}>
                <span style={{ fontSize:11, color:game.color, background:`${game.color}18`, padding:'2px 8px', borderRadius:4 }}>
                  👥 {game.players} игрока
                </span>
              </div>
            </div>
            <div style={{ color:'var(--text-muted)', fontSize:20 }}>›</div>
          </div>
        ))}
      </div>
    </div>
  );
}
