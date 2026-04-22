import { useState, useEffect, useCallback } from 'react';
import Avatar from '../Avatar';

// ── Chess logic ──────────────────────────────────────────────────────────────
const INIT_BOARD = [
  'R','N','B','Q','K','B','N','R',
  'P','P','P','P','P','P','P','P',
  ...Array(32).fill(null),
  'p','p','p','p','p','p','p','p',
  'r','n','b','q','k','b','n','r',
];

const color  = p => !p ? null : p === p.toUpperCase() ? 'white' : 'black';
const rank   = i => Math.floor(i / 8);
const file   = i => i % 8;
const idx    = (r, f) => r * 8 + f;
const valid  = (r, f) => r >= 0 && r < 8 && f >= 0 && f < 8;

const PIECE_UNICODE = {
  K:'♔',Q:'♕',R:'♖',B:'♗',N:'♘',P:'♙',
  k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟',
};

function pseudoMoves(board, i, ep, castle) {
  const p = board[i]; if (!p) return [];
  const c = color(p), r = rank(i), f = file(i);
  const moves = [];

  const slide = (dr, df) => {
    let nr = r+dr, nf = f+df;
    while (valid(nr,nf)) {
      const t = board[idx(nr,nf)];
      if (t) { if (color(t) !== c) moves.push(idx(nr,nf)); break; }
      moves.push(idx(nr,nf));
      nr+=dr; nf+=df;
    }
  };
  const step = (dr, df) => {
    if (valid(r+dr,f+df)) {
      const t = board[idx(r+dr,f+df)];
      if (!t || color(t) !== c) moves.push(idx(r+dr,f+df));
    }
  };

  switch (p.toLowerCase()) {
    case 'p': {
      const d = c==='white'?1:-1, start = c==='white'?1:6;
      if (valid(r+d,f) && !board[idx(r+d,f)]) {
        moves.push(idx(r+d,f));
        if (r===start && !board[idx(r+2*d,f)]) moves.push(idx(r+2*d,f));
      }
      [-1,1].forEach(df2 => {
        if (!valid(r+d,f+df2)) return;
        const t = board[idx(r+d,f+df2)];
        if (t && color(t)!==c) moves.push(idx(r+d,f+df2));
        if (ep === idx(r+d,f+df2)) moves.push(idx(r+d,f+df2));
      });
      break;
    }
    case 'n': [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr,df])=>step(dr,df)); break;
    case 'b': [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([dr,df])=>slide(dr,df)); break;
    case 'r': [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dr,df])=>slide(dr,df)); break;
    case 'q': [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]].forEach(([dr,df])=>slide(dr,df)); break;
    case 'k': {
      [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]].forEach(([dr,df])=>step(dr,df));
      // Castling
      if (c==='white' && i===4) {
        if (castle.K && !board[5] && !board[6] && board[7]==='R') moves.push(6);
        if (castle.Q && !board[1] && !board[2] && !board[3] && board[0]==='R') moves.push(2);
      }
      if (c==='black' && i===60) {
        if (castle.k && !board[61] && !board[62] && board[63]==='r') moves.push(62);
        if (castle.q && !board[57] && !board[58] && !board[59] && board[56]==='r') moves.push(58);
      }
      break;
    }
  }
  return moves;
}

function inCheck(board, c) {
  const king = c==='white' ? 'K' : 'k';
  const ki = board.indexOf(king); if (ki===-1) return false;
  const opp = c==='white'?'black':'white';
  for (let i=0;i<64;i++) {
    if (board[i] && color(board[i])===opp) {
      if (pseudoMoves(board,i,null,{K:false,Q:false,k:false,q:false}).includes(ki)) return true;
    }
  }
  return false;
}

function legalMoves(board, i, ep, castle) {
  const p = board[i]; if (!p) return [];
  const c = color(p);
  return pseudoMoves(board,i,ep,castle).filter(to => {
    const nb = [...board];
    // Handle castling
    if (p.toLowerCase()==='k' && Math.abs(to - i)===2) {
      if (to === i+2) { nb[i+1]=nb[i]; nb[to]=nb[i]; nb[i]=null; nb[to+1]=null; }
      else            { nb[i-1]=nb[i]; nb[to]=nb[i]; nb[i]=null; nb[to-2]=null; }
    } else {
      nb[to]=nb[i]; nb[i]=null;
      if (p==='P' && to===ep) nb[ep-8]=null;
      if (p==='p' && to===ep) nb[ep+8]=null;
    }
    return !inCheck(nb, c);
  });
}

function makeMove(board, from, to, ep, castle) {
  const nb = [...board];
  const p  = nb[from];
  const c  = color(p);
  let newEp = null;
  const nc = {...castle};

  // Pawn double push → set en passant
  if (p.toLowerCase()==='p' && Math.abs(to-from)===16) {
    newEp = (from+to)/2;
  }
  // En passant capture
  if (p==='P' && to===ep) nb[ep-8]=null;
  if (p==='p' && to===ep) nb[ep+8]=null;

  // Castling king move
  if (p==='K' && from===4) {
    nc.K=false; nc.Q=false;
    if (to===6)  { nb[5]=nb[7]; nb[7]=null; }
    if (to===2)  { nb[3]=nb[0]; nb[0]=null; }
  }
  if (p==='k' && from===60) {
    nc.k=false; nc.q=false;
    if (to===62) { nb[61]=nb[63]; nb[63]=null; }
    if (to===58) { nb[59]=nb[56]; nb[56]=null; }
  }

  // Update castling rights on rook moves
  if (p==='R') { if (from===0) nc.Q=false; if (from===7) nc.K=false; }
  if (p==='r') { if (from===56) nc.q=false; if (from===63) nc.k=false; }

  nb[to]=nb[from]; nb[from]=null;

  // Pawn promotion → auto queen
  if (p==='P' && rank(to)===7) nb[to]='Q';
  if (p==='p' && rank(to)===0) nb[to]='q';

  return { board: nb, ep: newEp, castle: nc };
}

function hasAnyLegal(board, c, ep, castle) {
  for (let i=0;i<64;i++) {
    if (board[i] && color(board[i])===c) {
      if (legalMoves(board,i,ep,castle).length>0) return true;
    }
  }
  return false;
}

// ── Component ────────────────────────────────────────────────────────────────
export default function Chess({ socket, sessionId, user, myColor, players, onExit, showToast }) {
  const [board,    setBoard]    = useState(INIT_BOARD);
  const [turn,     setTurn]     = useState('white');
  const [selected, setSelected] = useState(null);
  const [moves,    setMoves]    = useState([]);
  const [ep,       setEp]       = useState(null);
  const [castle,   setCastle]   = useState({ K:true, Q:true, k:true, q:true });
  const [status,   setStatus]   = useState('playing');
  const [lastMove, setLastMove] = useState(null);

  // Receive opponent move
  useEffect(() => {
    if (!socket) return;
    socket.on('opponent_move', ({ state }) => {
      setBoard(state.board);
      setTurn(state.turn);
      setEp(state.ep);
      setCastle(state.castle);
      setLastMove(state.lastMove);
      setStatus(state.status || 'playing');
    });
    socket.on('draw_offered', () => showToast('🤝 Противник предлагает ничью'));
    return () => { socket.off('opponent_move'); socket.off('draw_offered'); };
  }, [socket]);

  const handleSquare = useCallback((i) => {
    if (status !== 'playing') return;
    if (color(board[i]) === myColor && turn === myColor) {
      if (selected === i) { setSelected(null); setMoves([]); return; }
      setSelected(i);
      setMoves(legalMoves(board, i, ep, castle));
      return;
    }
    if (selected !== null && moves.includes(i)) {
      const { board: nb, ep: ne, castle: nc } = makeMove(board, selected, i, ep, castle);
      const nextTurn = turn === 'white' ? 'black' : 'white';

      // Check game over
      let newStatus = 'playing';
      if (!hasAnyLegal(nb, nextTurn, ne, nc)) {
        newStatus = inCheck(nb, nextTurn) ? 'checkmate' : 'stalemate';
      }

      const state = { board: nb, turn: nextTurn, ep: ne, castle: nc, lastMove: {from:selected,to:i}, status: newStatus };
      setBoard(nb); setTurn(nextTurn); setEp(ne); setCastle(nc);
      setLastMove({from:selected,to:i}); setSelected(null); setMoves([]);
      setStatus(newStatus);

      socket?.emit('game_move', { sessionId, move:{from:selected,to:i}, state });

      if (newStatus === 'checkmate') {
        socket?.emit('game_over', { sessionId, winnerId: user.id, result:'win', gameType:'chess' });
        showToast('♟ Шах и мат! Вы победили!');
      } else if (newStatus === 'stalemate') {
        socket?.emit('game_over', { sessionId, winnerId: null, result:'draw', gameType:'chess' });
        showToast('🤝 Пат — ничья!');
      }
    } else {
      setSelected(null); setMoves([]);
    }
  }, [board, selected, moves, turn, ep, castle, myColor, status]);

  const isMyTurn  = turn === myColor;
  const isCheck   = inCheck(board, turn);
  const opponent  = myColor === 'white' ? players?.black : players?.white;
  const me        = myColor === 'white' ? players?.white : players?.black;
  const flipped   = myColor === 'black';

  const renderSquares = () => {
    const squares = [];
    for (let row = 7; row >= 0; row--) {
      for (let col = 0; col < 8; col++) {
        const r = flipped ? 7-row : row;
        const c = flipped ? 7-col : col;
        const i = idx(r, c);
        const isDark    = (r+c)%2===1;
        const isSel     = selected === i;
        const isMove    = moves.includes(i);
        const isLast    = lastMove && (lastMove.from===i || lastMove.to===i);
        const piece     = board[i];
        const isKingChk = isCheck && piece && (piece==='K'||piece==='k') && color(piece)===turn;

        squares.push(
          <div
            key={i}
            onClick={() => handleSquare(i)}
            style={{
              width:'12.5%', aspectRatio:'1',
              background: isSel      ? 'rgba(0,229,255,0.5)'
                        : isMove     ? (board[i] ? 'rgba(255,61,255,0.35)' : 'rgba(0,229,255,0.25)')
                        : isLast     ? 'rgba(255,214,0,0.25)'
                        : isKingChk  ? 'rgba(255,68,88,0.5)'
                        : isDark     ? '#1E3A5A' : '#2D5078',
              display:'flex', alignItems:'center', justifyContent:'center',
              cursor: (color(piece)===myColor && turn===myColor) || (selected&&isMove) ? 'pointer' : 'default',
              position:'relative', userSelect:'none',
              boxShadow: isSel ? 'inset 0 0 0 2px var(--cyan)' : 'none',
              transition:'background 0.1s',
            }}
          >
            {isMove && !board[i] && (
              <div style={{
                width:'32%', height:'32%', borderRadius:'50%',
                background:'rgba(0,229,255,0.6)', pointerEvents:'none',
              }}/>
            )}
            {piece && (
              <span style={{
                fontSize: 'clamp(18px, 4vw, 30px)',
                lineHeight:1,
                filter: isKingChk ? 'drop-shadow(0 0 4px #FF4458)' : 'none',
                zIndex:1,
              }}>
                {PIECE_UNICODE[piece]}
              </span>
            )}
          </div>
        );
      }
    }
    return squares;
  };

  return (
    <div className="fade-in" style={{ display:'flex', flexDirection:'column', height:'100dvh' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 16px', borderBottom:'1px solid var(--border)' }}>
        <button className="btn btn-ghost btn-sm" onClick={onExit}>←</button>
        <span style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:16, flex:1 }}>♟ ШАХМАТЫ</span>
        <StatusBadge turn={turn} myColor={myColor} isCheck={isCheck} status={status} />
      </div>

      {/* Opponent */}
      <PlayerBar player={opponent} color={myColor==='white'?'black':'white'} active={turn !== myColor} />

      {/* Board */}
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'4px' }}>
        <div style={{
          display:'flex', flexWrap:'wrap',
          width:'min(100vw, calc(100dvh - 220px))',
          border:'2px solid var(--border)',
          borderRadius:4,
          overflow:'hidden',
          boxShadow:'0 0 40px rgba(0,0,0,0.5)',
        }}>
          {renderSquares()}
        </div>
      </div>

      {/* Me */}
      <PlayerBar player={me} color={myColor} active={isMyTurn} />

      {/* Actions */}
      {status === 'playing' && (
        <div style={{ display:'flex', gap:8, padding:'8px 16px 12px' }}>
          <button className="btn btn-ghost btn-sm" style={{flex:1}} onClick={() => socket?.emit('offer_draw', {sessionId})}>🤝 Ничья</button>
          <button className="btn btn-danger  btn-sm" style={{flex:1}} onClick={() => { socket?.emit('resign',{sessionId,userId:user.id,gameType:'chess'}); onExit(); }}>🏳 Сдаться</button>
        </div>
      )}
    </div>
  );
}

function PlayerBar({ player, color: pColor, active }) {
  if (!player) return null;
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:10, padding:'8px 16px',
      background: active ? 'rgba(0,229,255,0.05)' : 'transparent',
      borderBottom:'1px solid var(--border)',
      borderTop:'1px solid var(--border)',
      transition:'background 0.3s',
    }}>
      <Avatar user={player} size={34} />
      <div style={{ flex:1 }}>
        <div style={{ fontWeight:600, fontSize:13 }}>{player.first_name}</div>
        {player.username && <div style={{ fontSize:11, color:'var(--text-secondary)' }}>@{player.username}</div>}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        <span style={{ fontSize:18 }}>{pColor==='white' ? '♔' : '♚'}</span>
        {active && <span style={{ width:8, height:8, borderRadius:'50%', background:'var(--cyan)', animation:'pulse-cyan 1s infinite' }}/>}
      </div>
    </div>
  );
}

function StatusBadge({ turn, myColor, isCheck, status }) {
  if (status==='checkmate') return <span style={{ color:'var(--red)', fontFamily:'var(--font-display)', fontSize:13, fontWeight:700 }}>МАТ</span>;
  if (status==='stalemate') return <span style={{ color:'var(--gold)', fontFamily:'var(--font-display)', fontSize:13, fontWeight:700 }}>ПАТ</span>;
  if (isCheck) return <span style={{ color:'var(--red)', fontFamily:'var(--font-display)', fontSize:13, fontWeight:700, animation:'pulse-cyan 0.8s infinite' }}>ШАХ!</span>;
  const isMyTurn = turn === myColor;
  return (
    <span style={{ color: isMyTurn ? 'var(--cyan)' : 'var(--text-muted)', fontFamily:'var(--font-display)', fontSize:12, fontWeight:600 }}>
      {isMyTurn ? 'ВАШ ХОД' : 'ХОД ПРОТИВНИКА'}
    </span>
  );
}
