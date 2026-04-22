import { useState, useEffect, useCallback } from 'react';
import Avatar from '../Avatar';

const GRID = 10;
const SHIPS = [
  { size:4, name:'Линкор',     count:1 },
  { size:3, name:'Крейсер',    count:2 },
  { size:2, name:'Эсминец',    count:3 },
  { size:1, name:'Катер',      count:4 },
];

const emptyGrid   = () => Array(GRID*GRID).fill(0);
// cell values: 0=empty, 1=ship, 2=hit, 3=miss, 4=sunk

const getShipCells = (r, c, size, horiz) => {
  const cells = [];
  for (let i=0;i<size;i++) cells.push(horiz ? r*GRID+c+i : (r+i)*GRID+c);
  return cells;
};

const canPlace = (grid, r, c, size, horiz) => {
  for (let i=0;i<size;i++) {
    const nr = r + (horiz?0:i), nc = c + (horiz?i:0);
    if (nr>=GRID||nc>=GRID) return false;
    // Check 8-neighbour
    for (let dr=-1;dr<=1;dr++) for (let dc=-1;dc<=1;dc++) {
      const ar = nr+dr, ac = nc+dc;
      if (ar>=0&&ar<GRID&&ac>=0&&ac<GRID && grid[ar*GRID+ac]===1) return false;
    }
  }
  return true;
};

const autoPlace = () => {
  const grid = emptyGrid();
  for (const { size, count } of SHIPS) {
    for (let k=0;k<count;k++) {
      let placed = false;
      while (!placed) {
        const horiz = Math.random()<0.5;
        const r = Math.floor(Math.random()*(horiz?GRID:GRID-size+1));
        const c = Math.floor(Math.random()*(horiz?GRID-size+1:GRID));
        if (canPlace(grid,r,c,size,horiz)) {
          getShipCells(r,c,size,horiz).forEach(i=>grid[i]=1);
          placed=true;
        }
      }
    }
  }
  return grid;
};

export default function Battleship({ socket, sessionId, user, myColor, players, onExit, showToast }) {
  const [phase,      setPhase]      = useState('placement'); // placement | waiting | battle | finished
  const [myGrid,     setMyGrid]     = useState(emptyGrid);
  const [enemyGrid,  setEnemyGrid]  = useState(emptyGrid);
  const [myShips,    setMyShips]    = useState([]);     // [{cells,sunk}]
  const [cursor,     setCursor]     = useState(null);
  const [horiz,      setHoriz]      = useState(true);
  const [shipIdx,    setShipIdx]    = useState(0);
  const [shipCount,  setShipCount]  = useState(0);
  const [myTurn,     setMyTurn]     = useState(myColor==='white');
  const [status,     setStatus]     = useState('playing');
  const [lastHit,    setLastHit]    = useState(null);

  // Flatten SHIPS into sequence
  const shipQueue = SHIPS.flatMap(s => Array(s.count).fill(s));

  useEffect(() => {
    if (!socket) return;
    socket.on('opponent_move', ({ state }) => {
      if (state.type==='ready') {
        setPhase(prev => { if (prev==='waiting') return 'battle'; return 'waiting-both'; });
      }
      if (state.type==='shoot') {
        const { idx, result, sunkCells } = state;
        setMyGrid(prev => {
          const ng = [...prev];
          ng[idx] = result==='miss' ? 3 : 2;
          if (sunkCells) sunkCells.forEach(i => ng[i]=4);
          return ng;
        });
        setMyTurn(true);
        if (result==='sunk') showToast('💥 Противник потопил ваш корабль!');
        if (state.status==='finished') {
          setStatus('finished'); setPhase('finished');
          showToast('😔 Вы проиграли!');
          socket.emit('game_over',{sessionId,winnerId:null,result:'loss',gameType:'battleship'});
        }
      }
    });
    return () => socket.off('opponent_move');
  }, [socket]);

  const placeShip = useCallback((r, c) => {
    if (shipIdx >= shipQueue.length) return;
    const { size } = shipQueue[shipIdx];
    if (!canPlace(myGrid, r, c, size, horiz)) return;
    const cells = getShipCells(r, c, size, horiz);
    const ng = [...myGrid]; cells.forEach(i=>ng[i]=1);
    setMyGrid(ng);
    setMyShips(prev=>[...prev,{cells,sunk:false}]);
    const next = shipIdx+1;
    if (next >= shipQueue.length) {
      setPhase('waiting');
      socket?.emit('game_move',{sessionId,move:{},state:{type:'ready'}});
      showToast('⚓ Флот расставлен! Ждём противника…');
    }
    setShipIdx(next);
  }, [myGrid, shipIdx, horiz, socket, sessionId]);

  const shoot = useCallback((i) => {
    if (!myTurn || enemyGrid[i]===2||enemyGrid[i]===3||enemyGrid[i]===4) return;
    // We don't know enemy's real grid — send shoot event, server/opponent responds
    // For this P2P version, simulate: we track hits on opponent's declared grid
    // Enemy sends their hits back via opponent_move
    socket?.emit('game_move',{sessionId,move:{idx:i},state:{type:'myShoot',idx:i}});
    setMyTurn(false);
    setLastHit(i);
  }, [myTurn, enemyGrid, socket, sessionId]);

  const handleShootResult = useCallback(({ idx, result, sunkCells, status: ns }) => {
    setEnemyGrid(prev => {
      const ng=[...prev];
      ng[idx] = result==='miss'?3:2;
      if (sunkCells) sunkCells.forEach(i=>ng[i]=4);
      return ng;
    });
    if (result==='sunk') showToast('💥 Вы потопили корабль!');
    if (ns==='finished') {
      setStatus('finished'); setPhase('finished');
      showToast('🏆 Вы победили!');
      socket?.emit('game_over',{sessionId,winnerId:user.id,result:'win',gameType:'battleship'});
    }
    if (result==='miss') setMyTurn(false); else setMyTurn(true);
  }, [socket, sessionId, user]);

  // Listen for shoot confirmation
  useEffect(()=>{
    if (!socket) return;
    socket.on('opponent_move', ({ state }) => {
      if (state.type==='shootResult') handleShootResult(state);
    });
  },[socket, handleShootResult]);

  const curShip = shipQueue[shipIdx];

  const renderGrid = (grid, clickable, onCellClick, onCellHover) => (
    <div style={{
      display:'grid', gridTemplateColumns:`repeat(${GRID},1fr)`,
      border:'1px solid var(--border)', borderRadius:4, overflow:'hidden',
      width:'min(48vw, 200px)',
    }}>
      {grid.map((v,i)=>{
        const r = Math.floor(i/GRID), c = i%GRID;
        const isCursor = cursor!==null && clickable && phase==='placement' && (() => {
          if (!curShip) return false;
          const cells = getShipCells(cursor[0],cursor[1],curShip.size,horiz);
          return cells.includes(i);
        })();
        return (
          <div
            key={i}
            onClick={()=>onCellClick&&onCellClick(r,c,i)}
            onMouseEnter={()=>onCellHover&&onCellHover(r,c)}
            style={{
              aspectRatio:'1',
              background:
                isCursor   ? 'rgba(0,229,255,0.4)' :
                v===1      ? '#1A4A7A' :
                v===2      ? 'rgba(255,68,88,0.7)' :
                v===3      ? 'rgba(255,255,255,0.08)' :
                v===4      ? 'rgba(255,68,88,0.4)' :
                (r+c)%2===0 ? 'rgba(13,37,80,0.8)' : 'rgba(13,37,80,0.5)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:'clamp(8px,2vw,14px)', cursor: clickable?'pointer':'default',
              border:'0.5px solid rgba(255,255,255,0.05)',
              transition:'background 0.1s',
            }}
          >
            {v===2 && '💥'}
            {v===3 && '•'}
            {v===4 && '🔥'}
          </div>
        );
      })}
    </div>
  );

  const opponent = myColor==='white'?players?.black:players?.white;
  const me       = myColor==='white'?players?.white:players?.black;

  if (phase==='placement') return (
    <div className="fade-in" style={{display:'flex',flexDirection:'column',height:'100dvh'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 16px',borderBottom:'1px solid var(--border)'}}>
        <button className="btn btn-ghost btn-sm" onClick={onExit}>←</button>
        <span style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:16,flex:1}}>🚢 МОРСКОЙ БОЙ</span>
      </div>
      <div style={{flex:1,overflow:'auto',padding:16,display:'flex',flexDirection:'column',gap:16}}>
        <div style={{textAlign:'center'}}>
          <p style={{fontFamily:'var(--font-display)',fontSize:15,fontWeight:600,color:'var(--cyan)'}}>
            Расставьте флот
          </p>
          {curShip && (
            <p style={{color:'var(--text-secondary)',fontSize:13,marginTop:4}}>
              {curShip.name} ({curShip.size} клетки)
            </p>
          )}
        </div>
        <div style={{display:'flex',justifyContent:'center'}}>
          {renderGrid(myGrid, true, placeShip, (r,c)=>setCursor([r,c]))}
        </div>
        <div style={{display:'flex',gap:8,justifyContent:'center',flexWrap:'wrap'}}>
          <button className="btn btn-secondary btn-sm" onClick={()=>setHoriz(h=>!h)}>
            🔄 {horiz?'Горизонтально':'Вертикально'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={()=>{setMyGrid(autoPlace());setMyShips([]);setShipIdx(99);setPhase('waiting');socket?.emit('game_move',{sessionId,move:{},state:{type:'ready'}});}}>
            🎲 Авто
          </button>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',justifyContent:'center'}}>
          {shipQueue.map((s,i)=>(
            <div key={i} style={{
              padding:'4px 10px',borderRadius:6,fontSize:12,
              background: i<shipIdx?'rgba(0,255,135,0.15)':i===shipIdx?'rgba(0,229,255,0.2)':'var(--bg-surface)',
              color: i<shipIdx?'var(--green)':i===shipIdx?'var(--cyan)':'var(--text-muted)',
              border:`1px solid ${i===shipIdx?'var(--cyan)':'transparent'}`,
            }}>{s.name}</div>
          ))}
        </div>
      </div>
    </div>
  );

  if (phase==='waiting') return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100dvh',gap:20}}>
      <div className="spinner"/>
      <p style={{fontFamily:'var(--font-display)',fontSize:18,fontWeight:700,color:'var(--cyan)'}}>ЖДЁМ ПРОТИВНИКА…</p>
      <button className="btn btn-ghost" onClick={onExit}>Отмена</button>
    </div>
  );

  return (
    <div className="fade-in" style={{display:'flex',flexDirection:'column',height:'100dvh'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 16px',borderBottom:'1px solid var(--border)'}}>
        <button className="btn btn-ghost btn-sm" onClick={onExit}>←</button>
        <span style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:16,flex:1}}>🚢 МОРСКОЙ БОЙ</span>
        <span style={{color:myTurn?'var(--cyan)':'var(--text-muted)',fontFamily:'var(--font-display)',fontSize:12,fontWeight:600}}>
          {myTurn?'ВАШ ВЫСТРЕЛ':'ХОД ПРОТИВНИКА'}
        </span>
      </div>

      <div style={{flex:1,overflow:'auto',padding:12,display:'flex',flexDirection:'column',gap:12}}>
        <div style={{display:'flex',gap:12,justifyContent:'center'}}>
          {/* Enemy grid */}
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6}}>
            <div style={{fontSize:11,color:'var(--text-muted)',letterSpacing:'0.08em',fontFamily:'var(--font-display)',fontWeight:700}}>
              ПРОТИВНИК
            </div>
            {renderGrid(enemyGrid, myTurn, (r,c,i)=>myTurn&&shoot(i), null)}
          </div>
          {/* My grid */}
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6}}>
            <div style={{fontSize:11,color:'var(--text-muted)',letterSpacing:'0.08em',fontFamily:'var(--font-display)',fontWeight:700}}>
              ВАШ ФЛОТ
            </div>
            {renderGrid(myGrid, false, null, null)}
          </div>
        </div>
      </div>
    </div>
  );
}
