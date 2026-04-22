import { useState, useEffect, useCallback } from 'react';
import Avatar from '../Avatar';

const SIZE = 15;
const empty = () => Array(SIZE * SIZE).fill(0);
const idx   = (r, c) => r * SIZE + c;
const rc    = i => ({ r: Math.floor(i / SIZE), c: i % SIZE });

const DIRS = [[0,1],[1,0],[1,1],[1,-1]];

function countDir(board, r, c, dr, dc, val) {
  let n = 0;
  let nr = r+dr, nc = c+dc;
  while (nr>=0&&nr<SIZE&&nc>=0&&nc<SIZE&&board[idx(nr,nc)]===val) { n++; nr+=dr; nc+=dc; }
  return n;
}

function checkWin(board, i) {
  const { r, c } = rc(i);
  const v = board[i];
  for (const [dr,dc] of DIRS) {
    const n = 1 + countDir(board,r,c,dr,dc,v) + countDir(board,r,c,-dr,-dc,v);
    if (n >= 5) return true;
  }
  return false;
}

export default function Gomoku({ socket, sessionId, user, myColor, players, onExit, showToast }) {
  const myVal = myColor === 'white' ? 1 : 2;
  const [board,  setBoard]  = useState(empty);
  const [turn,   setTurn]   = useState(1);
  const [status, setStatus] = useState('playing');
  const [last,   setLast]   = useState(null);
  const [winLine,setWinLine]= useState([]);

  useEffect(() => {
    if (!socket) return;
    socket.on('opponent_move', ({ state }) => {
      setBoard(state.board); setTurn(state.turn);
      setLast(state.last); setStatus(state.status||'playing');
      if (state.winLine) setWinLine(state.winLine);
    });
    return () => socket.off('opponent_move');
  }, [socket]);

  const getWinLine = (board, i) => {
    const { r, c } = rc(i);
    const v = board[i];
    for (const [dr,dc] of DIRS) {
      const cells = [i];
      let nr=r+dr,nc=c+dc;
      while(nr>=0&&nr<SIZE&&nc>=0&&nc<SIZE&&board[idx(nr,nc)]===v){cells.push(idx(nr,nc));nr+=dr;nc+=dc;}
      nr=r-dr;nc=c-dc;
      while(nr>=0&&nr<SIZE&&nc>=0&&nc<SIZE&&board[idx(nr,nc)]===v){cells.push(idx(nr,nc));nr-=dr;nc-=dc;}
      if(cells.length>=5) return cells;
    }
    return [];
  };

  const handleClick = useCallback((i) => {
    if (status!=='playing' || turn!==myVal || board[i]!==0) return;
    const nb = [...board]; nb[i] = myVal;
    const win = checkWin(nb, i);
    const ns = win ? 'finished' : 'playing';
    const wl = win ? getWinLine(nb,i) : [];
    const nextTurn = myVal===1 ? 2 : 1;

    setBoard(nb); setTurn(nextTurn); setLast(i); setStatus(ns); setWinLine(wl);
    socket?.emit('game_move',{sessionId,move:{idx:i},state:{board:nb,turn:nextTurn,last:i,status:ns,winLine:wl}});
    if (win) {
      socket?.emit('game_over',{sessionId,winnerId:user.id,result:'win',gameType:'gomoku'});
      showToast('🏆 Пять в ряд! Вы победили!');
    }
  }, [board, turn, myVal, status, socket, sessionId, user]);

  const opponent = myColor==='white'?players?.black:players?.white;
  const me       = myColor==='white'?players?.white:players?.black;

  return (
    <div className="fade-in" style={{display:'flex',flexDirection:'column',height:'100dvh'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 16px',borderBottom:'1px solid var(--border)'}}>
        <button className="btn btn-ghost btn-sm" onClick={onExit}>←</button>
        <span style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:16,flex:1}}>⬤ ПЯТЬ В РЯД</span>
        <span style={{color:turn===myVal?'var(--cyan)':'var(--text-muted)',fontFamily:'var(--font-display)',fontSize:12,fontWeight:600}}>
          {turn===myVal?'ВАШ ХОД':'ХОД ПРОТИВНИКА'}
        </span>
      </div>

      <PlayerBar player={opponent} active={turn!==myVal} stone={myColor==='white'?2:1} />

      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:4,overflow:'hidden'}}>
        <div style={{
          display:'grid',
          gridTemplateColumns:`repeat(${SIZE},1fr)`,
          width:'min(98vw, calc(100dvh - 200px))',
          background:'#DEB887',
          border:'2px solid #8B6914',
          borderRadius:4,
          gap:0,
        }}>
          {board.map((v,i) => {
            const isLast   = last===i;
            const isWin    = winLine.includes(i);
            return (
              <div
                key={i}
                onClick={()=>handleClick(i)}
                style={{
                  aspectRatio:'1',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  cursor: turn===myVal&&v===0&&status==='playing'?'pointer':'default',
                  position:'relative',
                  background: isWin ? 'rgba(255,215,0,0.4)' : 'transparent',
                }}
              >
                {/* Grid lines */}
                <div style={{
                  position:'absolute',
                  top:'50%', left:0, right:0, height:1,
                  background:'rgba(0,0,0,0.3)', transform:'translateY(-50%)',
                }}/>
                <div style={{
                  position:'absolute',
                  left:'50%', top:0, bottom:0, width:1,
                  background:'rgba(0,0,0,0.3)', transform:'translateX(-50%)',
                }}/>
                {/* Stone */}
                {v!==0 && (
                  <div style={{
                    position:'relative', zIndex:1,
                    width:'80%', height:'80%', borderRadius:'50%',
                    background: v===1
                      ? 'radial-gradient(circle at 35% 30%, #fff, #333)'
                      : 'radial-gradient(circle at 35% 30%, #555, #000)',
                    boxShadow: isLast ? `0 0 0 2px ${v===1?'var(--cyan)':'var(--magenta)'}` : '0 1px 3px rgba(0,0,0,0.5)',
                    transition:'transform 0.1s',
                    transform: isWin?'scale(1.15)':'scale(1)',
                  }}/>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <PlayerBar player={me} active={turn===myVal} stone={myVal} />

      {status==='playing' && (
        <div style={{display:'flex',gap:8,padding:'8px 16px 12px'}}>
          <button className="btn btn-danger btn-sm" style={{flex:1}} onClick={()=>{socket?.emit('resign',{sessionId,userId:user.id,gameType:'gomoku'});onExit();}}>🏳 Сдаться</button>
        </div>
      )}
    </div>
  );
}

function PlayerBar({ player, active, stone }) {
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
        width:20,height:20,borderRadius:'50%',
        background: stone===1?'radial-gradient(circle at 35% 30%,#fff,#333)':'radial-gradient(circle at 35% 30%,#555,#000)',
        border:'1px solid rgba(255,255,255,0.2)',
      }}/>
      {active && <span style={{width:8,height:8,borderRadius:'50%',background:'var(--cyan)',animation:'pulse-cyan 1s infinite'}}/>}
    </div>
  );
}
