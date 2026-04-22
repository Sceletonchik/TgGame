import { useState, useEffect, useCallback } from 'react';
import Avatar from '../Avatar';

// Board: 8x8, only dark squares used (32 playable squares)
// Pieces: 1=white man, 2=white king, -1=black man, -2=black king, 0=empty
// Coordinate: [row][col], row 0 = bottom (white side)

const initBoard = () => {
  const b = Array.from({ length: 8 }, () => Array(8).fill(0));
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 8; c++)
      if ((r + c) % 2 === 1) b[r][c] = -1; // black
  for (let r = 5; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if ((r + c) % 2 === 1) b[r][c] = 1;  // white
  return b;
};

const clone = b => b.map(r => [...r]);

const getJumps = (board, r, c, captured = []) => {
  const p = board[r][c];
  const isKing = Math.abs(p) === 2;
  const dirs = isKing ? [[-1,-1],[-1,1],[1,-1],[1,1]] : (p > 0 ? [[1,-1],[1,1]] : [[-1,-1],[-1,1]]);
  // Russian checkers: kings can jump far
  const jumps = [];

  for (const [dr, dc] of dirs) {
    if (isKing) {
      // Slide until we find an enemy, then continue sliding past
      let er = r+dr, ec = c+dc;
      while (er>=0&&er<8&&ec>=0&&ec<8 && board[er][ec]===0) { er+=dr; ec+=dc; }
      if (er<0||er>=8||ec<0||ec>=8) continue;
      const ep = board[er][ec];
      if (ep === 0 || Math.sign(ep) === Math.sign(p)) continue;
      const key = `${er},${ec}`;
      if (captured.includes(key)) continue;
      let lr = er+dr, lc = ec+dc;
      while (lr>=0&&lr<8&&lc>=0&&lc<8 && board[lr][lc]===0) {
        jumps.push({ to:[lr,lc], over:[er,ec] });
        lr+=dr; lc+=dc;
      }
    } else {
      const mr = r+dr, mc = c+dc;
      const er = r+2*dr, ec = c+2*dc;
      if (er<0||er>=8||ec<0||ec>=8) continue;
      const mp = board[mr]?.[mc];
      if (!mp || Math.sign(mp) === Math.sign(p)) continue;
      const key = `${mr},${mc}`;
      if (captured.includes(key)) continue;
      if (board[er][ec] === 0) jumps.push({ to:[er,ec], over:[mr,mc] });
    }
  }
  return jumps;
};

const getMoves = (board, r, c) => {
  const p = board[r][c];
  const isKing = Math.abs(p) === 2;
  const dirs = isKing ? [[-1,-1],[-1,1],[1,-1],[1,1]] : (p > 0 ? [[1,-1],[1,1]] : [[-1,-1],[-1,1]]);
  const moves = [];
  for (const [dr, dc] of dirs) {
    if (isKing) {
      let nr = r+dr, nc = c+dc;
      while (nr>=0&&nr<8&&nc>=0&&nc<8 && board[nr][nc]===0) {
        moves.push([nr, nc]); nr+=dr; nc+=dc;
      }
    } else {
      const nr = r+dr, nc = c+dc;
      if (nr>=0&&nr<8&&nc>=0&&nc<8 && board[nr][nc]===0) moves.push([nr, nc]);
    }
  }
  return moves;
};

const mustJump = (board, playerSign) => {
  for (let r=0;r<8;r++)
    for (let c=0;c<8;c++)
      if (Math.sign(board[r][c])===playerSign && getJumps(board,r,c).length>0)
        return true;
  return false;
};

export default function Checkers({ socket, sessionId, user, myColor, players, onExit, showToast }) {
  const mySign   = myColor === 'white' ? 1 : -1;
  const [board,    setBoard]    = useState(initBoard);
  const [turn,     setTurn]     = useState(1); // 1=white, -1=black
  const [selected, setSelected] = useState(null);
  const [targets,  setTargets]  = useState([]);
  const [chain,    setChain]    = useState(null); // piece locked in jump chain
  const [status,   setStatus]   = useState('playing');

  useEffect(() => {
    if (!socket) return;
    socket.on('opponent_move', ({ state }) => {
      setBoard(state.board); setTurn(state.turn); setStatus(state.status||'playing');
      setChain(null); setSelected(null); setTargets([]);
    });
    return () => socket.off('opponent_move');
  }, [socket]);

  const sendState = useCallback((nb, nt, ns) => {
    socket?.emit('game_move', { sessionId, move:{}, state:{ board:nb, turn:nt, status:ns } });
    if (ns === 'finished') {
      socket?.emit('game_over', { sessionId, winnerId: user.id, result:'win', gameType:'checkers' });
    }
  }, [socket, sessionId, user]);

  const checkWin = (b, nextTurn) => {
    let hasWhite = false, hasBlack = false;
    for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
      if (b[r][c] > 0) hasWhite=true;
      if (b[r][c] < 0) hasBlack=true;
    }
    if (!hasWhite) return -1; // black wins
    if (!hasBlack) return  1; // white wins
    // Check if next player has any moves
    let hasMoves = false;
    outer: for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
      if (Math.sign(b[r][c])===nextTurn) {
        if (getJumps(b,r,c).length || getMoves(b,r,c).length) { hasMoves=true; break outer; }
      }
    }
    if (!hasMoves) return nextTurn * -1; // current player wins
    return 0;
  };

  const handleSquare = useCallback((r, c) => {
    if (status !== 'playing') return;
    if (turn !== mySign) return;

    const p = board[r][c];
    const forceJump = mustJump(board, mySign);

    // Clicking own piece
    if (Math.sign(p) === mySign && (!chain || (chain[0]===r && chain[1]===c))) {
      const jumps = getJumps(board,r,c);
      if (forceJump) {
        if (jumps.length === 0) { showToast('Обязательный взятие!'); return; }
        setSelected([r,c]); setTargets(jumps.map(j=>j.to));
      } else {
        const moves = getMoves(board,r,c);
        setSelected([r,c]); setTargets(moves);
      }
      return;
    }

    // Move to target
    if (selected && targets.some(([tr,tc])=>tr===r&&tc===c)) {
      const [sr, sc] = selected;
      const jumps = getJumps(board, sr, sc);
      const isJump = jumps.some(j=>j.to[0]===r&&j.to[1]===c);

      const nb = clone(board);
      nb[r][c] = nb[sr][sc]; nb[sr][sc] = 0;

      if (isJump) {
        const j = jumps.find(j=>j.to[0]===r&&j.to[1]===c);
        nb[j.over[0]][j.over[1]] = 0;
        // Promote before checking chain
        if (nb[r][c]===1 && r===7) nb[r][c]=2;
        if (nb[r][c]===-1 && r===0) nb[r][c]=-2;
        // Check for continuation jump
        const moreJumps = getJumps(nb, r, c);
        if (moreJumps.length > 0) {
          setBoard(nb); setSelected([r,c]);
          setTargets(moreJumps.map(j=>j.to)); setChain([r,c]);
          return;
        }
      }

      // Promote
      if (nb[r][c]===1 && r===7) nb[r][c]=2;
      if (nb[r][c]===-1 && r===0) nb[r][c]=-2;

      const nextTurn = turn * -1;
      const winner = checkWin(nb, nextTurn);
      const ns = winner !== 0 ? 'finished' : 'playing';

      setBoard(nb); setTurn(nextTurn); setChain(null); setSelected(null); setTargets([]); setStatus(ns);
      sendState(nb, nextTurn, ns);
      if (winner !== 0) showToast(winner === mySign ? '🏆 Вы победили!' : '😔 Вы проиграли');
      return;
    }

    setSelected(null); setTargets([]);
  }, [board, selected, targets, turn, mySign, chain, status]);

  const flipped = myColor === 'black';
  const rows = flipped ? Array.from({length:8},(_,i)=>i) : Array.from({length:8},(_,i)=>7-i);
  const cols = flipped ? Array.from({length:8},(_,i)=>7-i) : Array.from({length:8},(_,i)=>i);

  const opponent = myColor==='white' ? players?.black : players?.white;
  const me       = myColor==='white' ? players?.white : players?.black;

  return (
    <div className="fade-in" style={{display:'flex',flexDirection:'column',height:'100dvh'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 16px',borderBottom:'1px solid var(--border)'}}>
        <button className="btn btn-ghost btn-sm" onClick={onExit}>←</button>
        <span style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:16,flex:1}}>🔴 ШАШКИ</span>
        <span style={{color:turn===mySign?'var(--cyan)':'var(--text-muted)',fontFamily:'var(--font-display)',fontSize:12,fontWeight:600}}>
          {turn===mySign?'ВАШ ХОД':'ХОД ПРОТИВНИКА'}
        </span>
      </div>

      <PlayerBar player={opponent} active={turn !== mySign} />

      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:4}}>
        <div style={{
          display:'grid', gridTemplateColumns:'repeat(8,1fr)',
          width:'min(100vw, calc(100dvh - 220px))',
          border:'2px solid var(--border)', borderRadius:4, overflow:'hidden',
        }}>
          {rows.map(r => cols.map(c => {
            const isDark = (r+c)%2===1;
            const p      = board[r][c];
            const isSel  = selected?.[0]===r && selected?.[1]===c;
            const isTgt  = targets.some(([tr,tc])=>tr===r&&tc===c);
            const bg     = isSel ? 'rgba(0,229,255,0.4)'
                         : isTgt ? 'rgba(0,229,255,0.2)'
                         : isDark ? '#2D3E2D' : '#4A5E4A';
            return (
              <div
                key={`${r}-${c}`}
                onClick={() => isDark && handleSquare(r,c)}
                style={{
                  aspectRatio:'1', background:bg, display:'flex',
                  alignItems:'center', justifyContent:'center',
                  cursor: isDark ? 'pointer' : 'default',
                  boxShadow: isSel ? 'inset 0 0 0 2px var(--cyan)' : 'none',
                  position:'relative',
                }}
              >
                {isTgt && !p && (
                  <div style={{width:'30%',height:'30%',borderRadius:'50%',background:'rgba(0,229,255,0.7)'}}/>
                )}
                {p !== 0 && (
                  <div style={{
                    width:'75%', height:'75%', borderRadius:'50%',
                    background: p > 0
                      ? 'radial-gradient(circle at 35% 35%, #fff, #ddd)'
                      : 'radial-gradient(circle at 35% 35%, #555, #111)',
                    border: `2px solid ${p>0?'#aaa':'#000'}`,
                    boxShadow: `0 2px 6px rgba(0,0,0,0.5), inset 0 -2px 4px rgba(0,0,0,0.2)`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:'clamp(10px,2.5vw,18px)', fontWeight:700,
                    color: p > 0 ? '#333' : '#fff',
                  }}>
                    {Math.abs(p)===2 ? '★' : ''}
                  </div>
                )}
              </div>
            );
          }))}
        </div>
      </div>

      <PlayerBar player={me} active={turn === mySign} />

      {status==='playing' && (
        <div style={{display:'flex',gap:8,padding:'8px 16px 12px'}}>
          <button className="btn btn-ghost btn-sm" style={{flex:1}} onClick={()=>socket?.emit('offer_draw',{sessionId})}>🤝 Ничья</button>
          <button className="btn btn-danger btn-sm" style={{flex:1}} onClick={()=>{socket?.emit('resign',{sessionId,userId:user.id,gameType:'checkers'});onExit();}}>🏳 Сдаться</button>
        </div>
      )}
    </div>
  );
}

function PlayerBar({ player, active }) {
  if (!player) return null;
  return (
    <div style={{
      display:'flex',alignItems:'center',gap:10,padding:'8px 16px',
      background: active ? 'rgba(0,229,255,0.05)' : 'transparent',
      borderBottom:'1px solid var(--border)', borderTop:'1px solid var(--border)',
    }}>
      <Avatar user={player} size={34} />
      <div style={{flex:1}}>
        <div style={{fontWeight:600,fontSize:13}}>{player.first_name}</div>
        {player.username&&<div style={{fontSize:11,color:'var(--text-secondary)'}}>@{player.username}</div>}
      </div>
      {active && <span style={{width:8,height:8,borderRadius:'50%',background:'var(--cyan)',animation:'pulse-cyan 1s infinite'}}/>}
    </div>
  );
}
