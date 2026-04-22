import { useState, useEffect, useCallback } from 'react';
import Avatar from '../Avatar';

const COLS = 7;
const ROWS = 6;
const empty = () => Array(ROWS * COLS).fill(0);
const idx   = (r, c) => r * COLS + c;

const DIRS = [[0,1],[1,0],[1,1],[1,-1]];

function countDir(board, r, c, dr, dc, val) {
  let n = 0, nr = r+dr, nc = c+dc;
  while (nr>=0&&nr<ROWS&&nc>=0&&nc<COLS&&board[idx(nr,nc)]===val) { n++; nr+=dr; nc+=dc; }
  return n;
}

function checkWin(board, r, c) {
  const v = board[idx(r,c)];
  for (const [dr,dc] of DIRS) {
    if (1 + countDir(board,r,c,dr,dc,v) + countDir(board,r,c,-dr,-dc,v) >= 4) return true;
  }
  return false;
}

function getWinLine(board, r, c) {
  const v = board[idx(r,c)];
  for (const [dr,dc] of DIRS) {
    const cells = [idx(r,c)];
    let nr=r+dr,nc=c+dc;
    while(nr>=0&&nr<ROWS&&nc>=0&&nc<COLS&&board[idx(nr,nc)]===v){cells.push(idx(nr,nc));nr+=dr;nc+=dc;}
    nr=r-dr;nc=c-dc;
    while(nr>=0&&nr<ROWS&&nc>=0&&nc<COLS&&board[idx(nr,nc)]===v){cells.push(idx(nr,nc));nr-=dr;nc-=dc;}
    if(cells.length>=4) return cells;
  }
  return [];
}

function dropRow(board, col) {
  for (let r = ROWS-1; r >= 0; r--) {
    if (board[idx(r,col)] === 0) return r;
  }
  return -1;
}

export default function Connect4({ socket, sessionId, user, myColor, players, onExit, showToast }) {
  const myVal = myColor === 'white' ? 1 : 2;
  const [board,   setBoard]   = useState(empty);
  const [turn,    setTurn]    = useState(1);
  const [status,  setStatus]  = useState('playing');
  const [winLine, setWinLine] = useState([]);
  const [hover,   setHover]   = useState(null);
  const [dropping, setDropping] = useState(null); // {col, row} animation

  useEffect(() => {
    if (!socket) return;
    socket.on('opponent_move', ({ state }) => {
      setBoard(state.board); setTurn(state.turn);
      setStatus(state.status||'playing');
      if (state.winLine) setWinLine(state.winLine);
    });
    return () => socket.off('opponent_move');
  }, [socket]);

  const drop = useCallback((col) => {
    if (status!=='playing'||turn!==myVal) return;
    const row = dropRow(board, col);
    if (row===-1) return;

    const nb = [...board]; nb[idx(row,col)] = myVal;
    const win  = checkWin(nb, row, col);
    const draw = !win && nb.every(v=>v!==0);
    const ns   = win ? 'win' : draw ? 'draw' : 'playing';
    const wl   = win ? getWinLine(nb,row,col) : [];
    const next = myVal===1 ? 2 : 1;

    setBoard(nb); setTurn(next); setStatus(ns); setWinLine(wl);
    socket?.emit('game_move',{sessionId,move:{col},state:{board:nb,turn:next,status:ns,winLine:wl}});

    if (win) {
      socket?.emit('game_over',{sessionId,winnerId:user.id,result:'win',gameType:'connect4'});
      showToast('🏆 Четыре в ряд! Вы победили!');
    } else if (draw) {
      socket?.emit('game_over',{sessionId,winnerId:null,result:'draw',gameType:'connect4'});
      showToast('🤝 Ничья!');
    }
  }, [board, turn, myVal, status, socket, sessionId, user]);

  const opponent = myColor==='white'?players?.black:players?.white;
  const me       = myColor==='white'?players?.white:players?.black;
  const isMyTurn = turn === myVal;

  const COLORS = {
    0: 'rgba(255,255,255,0.05)',
    1: '#F44336',   // red for p1
    2: '#FFD600',   // yellow for p2
  };
  const GLOW = {
    1: 'rgba(244,67,54,0.7)',
    2: 'rgba(255,214,0,0.7)',
  };

  return (
    <div className="fade-in" style={{display:'flex',flexDirection:'column',height:'100dvh'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 16px',borderBottom:'1px solid var(--border)'}}>
        <button className="btn btn-ghost btn-sm" onClick={onExit}>←</button>
        <span style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:16,flex:1}}>🟡 ЧЕТЫРЕ В РЯД</span>
        <span style={{color:isMyTurn?'var(--cyan)':'var(--text-muted)',fontFamily:'var(--font-display)',fontSize:12,fontWeight:600}}>
          {isMyTurn?'ВАШ ХОД':'ХОД ПРОТИВНИКА'}
        </span>
      </div>

      <PlayerBar player={opponent} color={myColor==='white'?2:1} active={!isMyTurn} colors={COLORS} />

      <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:12,gap:8}}>
        {/* Column selector arrows */}
        <div style={{display:'flex',gap:3}}>
          {Array.from({length:COLS},(_,c)=>(
            <div
              key={c}
              style={{
                width:'clamp(36px, calc((min(96vw, 360px)) / 7), 52px)',
                display:'flex', alignItems:'center', justifyContent:'center',
                height:20, cursor: isMyTurn&&status==='playing'?'pointer':'default',
                color: hover===c&&isMyTurn ? COLORS[myVal] : 'transparent',
                fontSize:14, transition:'color 0.1s',
              }}
              onClick={()=>drop(c)}
              onMouseEnter={()=>setHover(c)}
              onMouseLeave={()=>setHover(null)}
            >▼</div>
          ))}
        </div>

        {/* Board */}
        <div style={{
          background:'#1565C0',
          borderRadius:10,
          padding:4,
          boxShadow:'0 8px 32px rgba(0,0,0,0.5)',
          border:'2px solid #0D47A1',
        }}>
          <div style={{
            display:'grid',
            gridTemplateColumns:`repeat(${COLS},1fr)`,
            gap:4,
          }}>
            {Array.from({length:ROWS*COLS},(_,i)=>{
              const r = Math.floor(i/COLS), c = i%COLS;
              const v = board[idx(r,c)];
              const isWin  = winLine.includes(idx(r,c));
              const isHov  = hover===c && isMyTurn && dropRow(board,c)===r && status==='playing';

              return (
                <div
                  key={i}
                  onClick={()=>drop(c)}
                  onMouseEnter={()=>setHover(c)}
                  onMouseLeave={()=>setHover(null)}
                  style={{
                    width:'clamp(36px, calc((min(96vw, 360px) - 32px) / 7), 52px)',
                    aspectRatio:'1',
                    borderRadius:'50%',
                    background: isHov && v===0
                      ? `${COLORS[myVal]}66`
                      : COLORS[v],
                    boxShadow: isWin
                      ? `0 0 12px ${GLOW[v]}, inset 0 0 8px ${GLOW[v]}`
                      : v!==0 ? `inset 0 -3px 6px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.4)` : 'none',
                    cursor: isMyTurn&&status==='playing'?'pointer':'default',
                    transition:'background 0.15s, box-shadow 0.15s',
                    transform: isWin ? 'scale(1.08)' : 'scale(1)',
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>

      <PlayerBar player={me} color={myVal} active={isMyTurn} colors={COLORS} />

      {status==='playing' && (
        <div style={{padding:'8px 16px 12px'}}>
          <button className="btn btn-danger btn-sm btn-full" onClick={()=>{socket?.emit('resign',{sessionId,userId:user.id,gameType:'connect4'});onExit();}}>🏳 Сдаться</button>
        </div>
      )}
    </div>
  );
}

function PlayerBar({ player, color, active, colors }) {
  if (!player) return null;
  return (
    <div style={{
      display:'flex',alignItems:'center',gap:10,padding:'8px 16px',
      background: active?'rgba(0,229,255,0.05)':'transparent',
      borderBottom:'1px solid var(--border)',borderTop:'1px solid var(--border)',
    }}>
      <Avatar user={player} size={34} />
      <div style={{flex:1}}>
        <div style={{fontWeight:600,fontSize:13}}>{player.first_name}</div>
        {player.username&&<div style={{fontSize:11,color:'var(--text-secondary)'}}>@{player.username}</div>}
      </div>
      <div style={{
        width:22,height:22,borderRadius:'50%',
        background:colors[color],
        boxShadow:`0 0 8px ${colors[color]}88`,
      }}/>
      {active && <span style={{width:8,height:8,borderRadius:'50%',background:'var(--cyan)',animation:'pulse-cyan 1s infinite'}}/>}
    </div>
  );
}
