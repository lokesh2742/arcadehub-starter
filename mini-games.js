import { getApps } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getDatabase, ref, get, runTransaction, onValue, update } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
const $ = id => document.getElementById(id);
let timer=null, cleanup=null, active="", memoryRoomRef=null, memoryRoomOff=null, memoryRoom=null, memoryMark="", memoryUserId=null, resolveTimer=null;
const firebaseConfig = {
  apiKey: "AIzaSyDAFaBhBwHvWkxkU7KH8n-IsGICwFzYUl4",
  authDomain: "arcadehub-3f060.firebaseapp.com",
  databaseURL: "https://arcadehub-3f060-default-rtdb.firebaseio.com",
  projectId: "arcadehub-3f060",
  storageBucket: "arcadehub-3f060.firebasestorage.app",
  messagingSenderId: "777660361833",
  appId: "1:777660361833:web:623f0ce7d78a4733ac46f8",
  measurementId: "G-Q1GX1EEMWX"
};
let miniDb=null,miniAuth=null;try{const app=getApps().find(a=>a.name==="[DEFAULT]");if(app){miniAuth=getAuth(app);miniDb=getDatabase(app);}}catch(e){console.warn("Online Memory Match unavailable:",e);}
async function ensureMemorySignIn(){if(!window.arcadeHubRequireGoogleSignIn)throw Error("Sign-in is not ready. Please try again.");const user=await window.arcadeHubRequireGoogleSignIn();memoryUserId=user.uid;return user;}
const player=()=>miniAuth?.currentUser?.displayName?.trim().slice(0,16)||"Player";
function stopRoom(){if(memoryRoomOff){memoryRoomOff();memoryRoomOff=null;}memoryRoomRef=null;memoryRoom=null;memoryMark="";clearTimeout(resolveTimer);}
function closeGame(){clearInterval(timer);clearTimeout(timer);timer=null;if(cleanup){cleanup();cleanup=null;}stopRoom();$("miniGameScreen").hidden=true;active="";}
function openGame(name){closeGame();active=name;$("miniGameScreen").hidden=false;$("miniGameTitle").textContent=({memory:"Memory Match",snake:"Snake","2048":"2048",blocks:"Block Puzzle",racer:"Neon Racer"})[name];if(name==="memory")memoryMenu();if(name==="snake")snake();if(name==="2048")game2048();if(name==="blocks")blocks();if(name==="racer")racer();}
$("miniGameBack").addEventListener("click",closeGame);
$("miniGameRestart").addEventListener("click",()=>openGame(active));
document.querySelectorAll(".game-card[data-game='upcoming']").forEach(b=>b.addEventListener("click",()=>alert("This multiplayer game is coming soon!")));
document.querySelectorAll(".game-card[data-game='memory'],.game-card[data-game='snake'],.game-card[data-game='2048'],.game-card[data-game='blocks'],.game-card[data-game='racer']").forEach(b=>b.addEventListener("click",()=>openGame(b.dataset.game)));

function memoryMenu(){
 $("miniGameBody").innerHTML='<div class="memory-welcome"><div class="memory-hero-icons"><span>◆</span><span>●</span><span>▲</span><span>★</span></div><p class="eyebrow">TEST YOUR MEMORY</p><h2>Match the pairs.</h2><p class="game-help">Play solo or challenge a friend in a private room. Invite a friend who is currently online.</p><div class="memory-mode-grid"><button class="memory-mode-card" id="memorySolo"><span>🧠</span><b>Solo challenge</b><small>Beat your best score</small></button><button class="memory-mode-card" id="memoryOnline"><span>🌐</span><b>Custom room</b><small>Play with a friend online</small></button></div></div>';
 $("memorySolo").onclick=()=>memorySolo();
 window.arcadeHubRenderGameInvites?.("memoryFriendInvites","memory");
 $("memoryOnline").onclick=()=>memoryRoomSetup();
}
function shuffledDeck(){const a=["◆","●","▲","★","♥","☀","☂","✿"];return [...a,...a].sort(()=>Math.random()-.5);}
function memorySolo(){
 const deck=shuffledDeck(),opened=[],matched=[];let moves=0,lock=false,started=Date.now();
 function draw(){
  $("miniGameBody").innerHTML='<div class="memory-hud"><span>Moves <b>'+moves+'</b></span><span>Pairs <b>'+matched.length/2+'/8</b></span><span>Time <b>'+Math.floor((Date.now()-started)/1000)+'s</b></span></div><div class="mini-board memory-board">'+deck.map((v,i)=>'<button class="memory-card '+(opened.includes(i)||matched.includes(i)?'revealed ':'')+(matched.includes(i)?'matched':'')+'" data-i="'+i+'" aria-label="Memory card">'+(opened.includes(i)||matched.includes(i)?v:"?")+'</button>').join("")+'</div><p class="game-help">Find all eight pairs in as few moves as possible.</p>';
  $("miniGameBody").querySelectorAll(".memory-card").forEach(b=>b.onclick=()=>{
   const i=+b.dataset.i;if(lock||opened.includes(i)||matched.includes(i))return;
   opened.push(i);if(opened.length===2){moves++;lock=true;draw();const [a,c]=opened;if(deck[a]===deck[c]){matched.push(a,c);opened.length=0;lock=false;draw();if(matched.length===16)memoryWin();}else timer=setTimeout(()=>{opened.length=0;lock=false;draw();},780);}else draw();
  });
 }
 function memoryWin(){const seconds=Math.floor((Date.now()-started)/1000);$("miniGameBody").innerHTML='<div class="memory-win"><div class="win-medal">✦</div><p class="eyebrow">PERFECT MATCH</p><h2>You did it!</h2><p>You found every pair in <b>'+moves+'</b> moves and <b>'+seconds+'</b> seconds.</p><button class="primary-button" id="memoryAgain">Play again ↻</button></div>';$("memoryAgain").onclick=()=>memorySolo();}
 draw();
}

function memoryRoomSetup(){
 $("miniGameBody").innerHTML='<div class="memory-room-panel"><p class="eyebrow">PRIVATE MULTIPLAYER</p><h2>Play with a friend.</h2><p class="game-help">Create a room and share its six-character code, or join a room created by a friend.</p><button class="primary-button full-button" id="memoryCreateRoom">Create custom room</button><div class="room-code-entry"><input id="memoryJoinCode" maxlength="6" placeholder="ENTER ROOM CODE" autocomplete="off"/><button class="secondary-button" id="memoryJoinRoom">Join room</button></div><div class="game-invite-panel" id="memoryFriendInvites"><p class="game-help">Loading online friends…</p></div><p class="game-help" id="memoryRoomStatus"></p></div>';
 window.arcadeHubRenderGameInvites?.("memoryFriendInvites","memory");
 $("memoryCreateRoom").onclick=createMemoryRoom;
 $("memoryJoinRoom").onclick=()=>joinMemoryRoom($("memoryJoinCode").value.trim().toUpperCase());
}
function makeRoomCode(){const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";const bytes=new Uint8Array(6);crypto.getRandomValues(bytes);return [...bytes].map(b=>chars[b%chars.length]).join("");}
async function createMemoryRoom(){
 try{await ensureMemorySignIn();}catch(e){$("memoryRoomStatus").textContent=e.message||"Sign in to play online.";return;}
 $("memoryCreateRoom").disabled=true;
 try{
  let code="",ok=false;
  for(let n=0;n<5&&!ok;n++){code=makeRoomCode();const candidate=ref(miniDb,"rooms/"+code);const r=await runTransaction(candidate,old=>old===null?{type:"memory",status:"waiting",players:{X:{id:memoryUserId,name:player()},O:null},deck:shuffledDeck(),matched:[],picks:[],turn:"X",scores:{X:0,O:0},moves:0,phase:"ready"}:undefined);if(r.committed){memoryRoomRef=candidate;ok=true;}}
  if(!ok)throw Error("Could not create a room. Try again.");
  memoryMark="X";$("miniGameBody").innerHTML='<div class="memory-room-panel"><p class="eyebrow">ROOM CREATED</p><h2>Invite your opponent.</h2><div class="memory-room-code" id="memoryRoomCode">'+code+'</div><button class="secondary-button" id="memoryCopyCode">Copy room code</button><div class="waiting-indicator"><i></i> Waiting for your friend to join…</div><button class="text-button" id="memoryCancelRoom">Cancel room</button></div>';
  $("memoryCopyCode").onclick=()=>navigator.clipboard?.writeText(code).then(()=>{$("memoryCopyCode").textContent="Copied ✓";}).catch(()=>{});
  $("memoryCancelRoom").onclick=async()=>{if(memoryRoomRef)await update(memoryRoomRef,{status:"closed"});stopRoom();memoryRoomSetup();};
  listenMemoryRoom();
 }catch(e){$("memoryRoomStatus").textContent=e.message||"Could not create room.";$("memoryCreateRoom").disabled=false;}
}
async function joinMemoryRoom(code){
 try{await ensureMemorySignIn();}catch(e){$("memoryRoomStatus").textContent=e.message||"Sign in to play online.";return;}
 if(!/^[A-HJ-NP-Z2-9]{6}$/.test(code)){$("memoryRoomStatus").textContent="Enter a valid six-character code.";return;}
 $("memoryJoinRoom").disabled=true;
 let stage="checking room";
 try{
  const candidate=ref(miniDb,"rooms/"+code);
  const snap=await get(candidate);
  if(!snap.exists())throw Error("Room not found. Check the code.");
  const existing=snap.val();
  if(existing.type!=="memory"||existing.status!=="waiting"||existing.players?.O)throw Error("This room is full or is for another game.");
  stage="joining room (Realtime Database transaction)";
  const joined=await runTransaction(candidate,room=>{
   // A transaction update callback can initially receive null when this
   // client's local RTDB cache has not populated the room yet. We already
   // fetched the room above; use that snapshot for the first local attempt.
   // If the server has changed since that read, RTDB retries the transaction
   // with the latest server value and this callback validates it again.
   const current=room===null?existing:room;
   if(!current||current.type!=="memory"||current.status!=="waiting")return;
   if(current.players?.O){if(current.players.O.id===memoryUserId)return current;return;}
   const next={...current,players:{...(current.players||{}),O:{id:memoryUserId,name:player()}},status:"playing"};
   return next;
  });
  if(!joined.committed){
   stage="checking room after an uncommitted transaction";
   const latest=await get(candidate),state=latest.val();
   console.error("[ArcadeHub] Memory Match join transaction did not commit",{
    roomCode:code,stage,exists:latest.exists(),roomType:state?.type??null,
    roomStatus:state?.status??null,secondPlayerPresent:!!state?.players?.O,
    transactionCommitted:joined.committed
   });
   if(state?.players?.O)throw Error("This room already has a second player. Ask the host to create a new room and share its new code.");
   if(!latest.exists()||state?.status!=="waiting")throw Error("This room is no longer waiting for a player. Ask the host to create a new room.");
   throw Error("Firebase did not commit the join. Open the browser console (F12) for the diagnostic details, then share them with me.");
  }
  memoryRoomRef=candidate;memoryMark="O";listenMemoryRoom();
 }catch(e){
  console.error("[ArcadeHub] Memory Match join failed",{
   roomCode:code,stage,errorCode:e?.code||null,errorMessage:e?.message||String(e),
   databasePath:"rooms/"+code
  },e);
  $("memoryRoomStatus").textContent=e.message||"Could not join room.";
  $("memoryJoinRoom").disabled=false;
 }
}
function listenMemoryRoom(){
 if(memoryRoomOff)memoryRoomOff();
 memoryRoomOff=onValue(memoryRoomRef,snap=>{
  const data=snap.val();if(!data||data.status==="closed"){stopRoom();memoryRoomSetup();$("miniGameBody").insertAdjacentHTML("afterbegin",'<p class="game-help">This room has been closed.</p>');return;}
  memoryRoom=data;if(data.status==="waiting"){if(!$("memoryRoomCode")){$("miniGameBody").innerHTML='<div class="memory-room-panel"><p class="eyebrow">ROOM CREATED</p><h2>Invite your opponent.</h2><div class="memory-room-code" id="memoryRoomCode">'+(memoryRoomRef.key||"")+'</div><div class="waiting-indicator"><i></i> Waiting for your friend to join…</div></div>';}return;}
  renderOnlineMemory(data);
  if(data.phase==="resolving"&&!resolveTimer){resolveTimer=setTimeout(resolveMemoryPair,850);}
  if(data.phase!=="resolving"){clearTimeout(resolveTimer);resolveTimer=null;}
 });
}
function renderOnlineMemory(data){
 const scores={X:0,O:0,...(data.scores||{})},mine=memoryMark===data.turn,finished=data.status==="finished";
 const xName=data.players?.X?.name||"Player 1",oName=data.players?.O?.name||"Player 2";
 const winner=scores.X===scores.O?null:(scores.X>scores.O?"X":"O");
 const resultTitle=winner?(winner==="X"?xName:oName)+" wins!":"It's a draw!";
 const resultCopy=winner?"Congratulations on the win!": "Both players finished with the same score.";
 $("miniGameBody").innerHTML='<div class="memory-online-top"><div class="memory-player '+(data.turn==="X"&&!finished?'your-turn':'')+'"><span>✦</span><b>'+xName+'</b><strong>'+scores.X+'</strong></div><div class="memory-turn">'+(finished?"ROUND COMPLETE":(mine?"YOUR TURN":"OPPONENT’S TURN"))+'</div><div class="memory-player '+(data.turn==="O"&&!finished?'your-turn':'')+'"><span>✦</span><b>'+oName+'</b><strong>'+scores.O+'</strong></div></div><div class="memory-room-strip">ROOM <b>'+(memoryRoomRef.key||"")+'</b> · '+(data.moves||0)+' turns</div><div class="mini-board memory-board">'+data.deck.map((v,i)=>{const shown=(data.picks||[]).includes(i)||(data.matched||[]).includes(i);return '<button class="memory-card '+(shown?'revealed ':'')+((data.matched||[]).includes(i)?'matched':'')+'" data-i="'+i+'" '+(shown||finished||data.phase==="resolving"||!mine?'disabled':'')+'>'+(shown?v:"?")+'</button>';}).join("")+'</div>'+(finished?'<div class="game-over-panel memory-result"><div class="win-medal">✦</div><p class="eyebrow">MATCH COMPLETE</p><h3>'+resultTitle+'</h3><p>'+resultCopy+'</p><div class="memory-final-score"><span>'+xName+' <b>'+scores.X+'</b></span><span>'+oName+' <b>'+scores.O+'</b></span></div><button class="primary-button" id="memoryNewRoom">Play again ↻</button><button class="secondary-button" id="memoryExitRoom">Back to games</button></div>':'<p class="game-help">'+(mine?"Find a pair. Matching pairs earn a point and another turn.":"Wait for your opponent to finish their turn.")+'</p>');
 $("miniGameBody").querySelectorAll(".memory-card").forEach(b=>b.onclick=()=>playOnlineMemory(+b.dataset.i));
 if(finished){
  $("memoryNewRoom").onclick=()=>{stopRoom();memoryRoomSetup();};
  $("memoryExitRoom").onclick=()=>{stopRoom();memoryMenu();};
 }
}
async function playOnlineMemory(index){
 if(!memoryRoomRef||!memoryRoom||memoryRoom.status!=="playing")return;
 if(memoryRoom.turn!==memoryMark||memoryRoom.phase==="resolving")return;
 const deck=Array.isArray(memoryRoom.deck)?memoryRoom.deck:[];
 const picks=Array.isArray(memoryRoom.picks)?memoryRoom.picks:[];
 const matched=Array.isArray(memoryRoom.matched)?memoryRoom.matched:[];
 if(!Number.isInteger(index)||index<0||index>=deck.length||picks.includes(index)||matched.includes(index))return;
 try{
  await runTransaction(memoryRoomRef,room=>{
   const current=room===null?memoryRoom:room;
   if(!current||current.status!=="playing"||current.turn!==memoryMark||current.phase==="resolving")return;
   const currentDeck=Array.isArray(current.deck)?current.deck:[];
   const currentPicks=Array.isArray(current.picks)?current.picks:[];
   const currentMatched=Array.isArray(current.matched)?current.matched:[];
   if(!Number.isInteger(index)||index<0||index>=currentDeck.length||currentPicks.includes(index)||currentMatched.includes(index))return;
   if(currentPicks.length>=2)return;
   return {...current,picks:[...currentPicks,index],moves:(Number(current.moves)||0)+1,phase:currentPicks.length===1?"resolving":"ready"};
  });
 }catch(error){
  console.error("[ArcadeHub] Memory Match card selection failed:",error);
  $("memoryRoomStatus")?.textContent;
 }
}
async function resolveMemoryPair(){
 resolveTimer=null;
 if(!memoryRoomRef||!memoryRoom)return;
 try{
  await runTransaction(memoryRoomRef,room=>{
   const current=room===null?memoryRoom:room;
   if(!current||current.status!=="playing"||current.phase!=="resolving")return;
   const deck=Array.isArray(current.deck)?current.deck:[];
   const picks=Array.isArray(current.picks)?current.picks:[];
   const matched=Array.isArray(current.matched)?current.matched:[];
   const scores={X:0,O:0,...(current.scores||{})};
   if(deck.length===0||picks.length!==2)return;
   const [a,b]=picks;
   if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0||a>=deck.length||b>=deck.length||a===b)return;
   const isMatch=deck[a]===deck[b];
   const nextMatched=isMatch?[...new Set([...matched,a,b])]:matched;
   const nextTurn=isMatch?current.turn:(current.turn==="X"?"O":"X");
   const next={...current,scores,picks:[],matched:nextMatched,phase:"ready",turn:nextTurn};
   if(isMatch)scores[current.turn]=(Number(scores[current.turn])||0)+1;
   if(nextMatched.length===deck.length)next.status="finished";
   return next;
  });
 }catch(error){
  console.error("[ArcadeHub] Memory Match pair resolution failed:",error);
 }
}

// 2048: smooth tile entry and keyboard/swipe support.
function game2048(){
 let g=Array(16).fill(0),score=0,touch=null;const add=()=>{const e=g.map((v,i)=>v?null:i).filter(v=>v!==null);if(e.length)g[e[Math.floor(Math.random()*e.length)]]=Math.random()<.9?2:4;};
 add();add();
 function draw(){$("miniGameBody").innerHTML='<div class="mini-score">SCORE <b>'+score+'</b></div><div class="mini-board tile-board">'+g.map((v,i)=>'<div class="tile" data-value="'+v+'" data-index="'+i+'">'+(v||"")+'</div>').join("")+'</div><p class="game-help">Use arrow keys or swipe to combine matching tiles.</p>';}
 function move(d){let old=g.join(",");for(let n=0;n<4;n++){let ids=d==="left"?[0,1,2,3].map(k=>n*4+k):d==="right"?[3,2,1,0].map(k=>n*4+k):d==="up"?[0,1,2,3].map(k=>k*4+n):[3,2,1,0].map(k=>k*4+n),v=ids.map(i=>g[i]).filter(Boolean),o=[];for(let k=0;k<v.length;k++){if(v[k]===v[k+1]){o.push(v[k]*2);score+=v[k]*2;k++;}else o.push(v[k]);}while(o.length<4)o.push(0);ids.forEach((id,k)=>g[id]=o[k]);}if(old!==g.join(","))add();draw();}
 const key=e=>{const d=({ArrowLeft:"left",ArrowRight:"right",ArrowUp:"up",ArrowDown:"down"})[e.key];if(d&&active==="2048"){e.preventDefault();move(d);}};
 window.addEventListener("keydown",key);cleanup=()=>window.removeEventListener("keydown",key);draw();
 $("miniGameBody").addEventListener("touchstart",e=>{touch=[e.touches[0].clientX,e.touches[0].clientY];},{passive:true});
 $("miniGameBody").addEventListener("touchend",e=>{if(!touch)return;let dx=e.changedTouches[0].clientX-touch[0],dy=e.changedTouches[0].clientY-touch[1];if(Math.max(Math.abs(dx),Math.abs(dy))>25)move(Math.abs(dx)>Math.abs(dy)?(dx>0?"right":"left"):(dy>0?"down":"up"));touch=null;},{passive:true});
}
function snake(){
 $("miniGameBody").innerHTML='<div class="mini-score">SCORE <b id="snakeScore">0</b></div><canvas class="game-canvas" id="snakeCanvas" width="400" height="400"></canvas><p class="game-help">Arrow keys or swipe to steer. Eat the glowing fruit and avoid your tail.</p><div class="game-controls"><button class="secondary-button" data-dir="up">↑</button><button class="secondary-button" data-dir="left">←</button><button class="secondary-button" data-dir="down">↓</button><button class="secondary-button" data-dir="right">→</button></div>';
 const c=$("snakeCanvas"),ctx=c.getContext("2d"),body=[{x:9,y:10},{x:8,y:10},{x:7,y:10}],s={d:{x:1,y:0},next:{x:1,y:0},food:{x:14,y:10},score:0,dead:false};const dirs={up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}};
 const turn=d=>{if(d.x!==-s.d.x||d.y!==-s.d.y)s.next=d;};$("miniGameBody").querySelectorAll("[data-dir]").forEach(b=>b.onclick=()=>turn(dirs[b.dataset.dir]));
 const key=e=>{let d=({ArrowUp:dirs.up,ArrowDown:dirs.down,ArrowLeft:dirs.left,ArrowRight:dirs.right})[e.key];if(d&&active==="snake"){e.preventDefault();turn(d);}};window.addEventListener("keydown",key);cleanup=()=>window.removeEventListener("keydown",key);
 const draw=()=>{ctx.clearRect(0,0,400,400);ctx.fillStyle="#111522";ctx.fillRect(0,0,400,400);ctx.strokeStyle="#ffffff08";for(let i=0;i<=20;i++){ctx.beginPath();ctx.moveTo(i*20,0);ctx.lineTo(i*20,400);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i*20);ctx.lineTo(400,i*20);ctx.stroke();}ctx.shadowBlur=18;ctx.shadowColor="#ff78b7";ctx.fillStyle="#ff78b7";ctx.beginPath();ctx.arc(s.food.x*20+10,s.food.y*20+10,7,0,Math.PI*2);ctx.fill();ctx.shadowColor="#8ef0c0";ctx.fillStyle="#8ef0c0";body.forEach((p,i)=>{ctx.globalAlpha=1-i*.025;ctx.beginPath();ctx.roundRect(p.x*20+2,p.y*20+2,16,16,5);ctx.fill();});ctx.globalAlpha=1;ctx.shadowBlur=0;};
 timer=setInterval(()=>{if(s.dead)return;s.d=s.next;const h={x:body[0].x+s.d.x,y:body[0].y+s.d.y};if(h.x<0||h.y<0||h.x>=20||h.y>=20||body.some(p=>p.x===h.x&&p.y===h.y)){s.dead=true;clearInterval(timer);$("miniGameBody").insertAdjacentHTML("beforeend",'<div class="game-over-panel"><h3>Game over</h3><p>Final score: '+s.score+'</p><button class="primary-button" id="snakeAgain">Try again ↻</button></div>');$("snakeAgain").onclick=()=>openGame("snake");return;}body.unshift(h);if(h.x===s.food.x&&h.y===s.food.y){s.score++;$("snakeScore").textContent=s.score;do{s.food={x:Math.floor(Math.random()*20),y:Math.floor(Math.random()*20)};}while(body.some(p=>p.x===s.food.x&&p.y===s.food.y));}else body.pop();draw();},115);draw();
}
function blocks(){
 const shapes=[[[0,0],[1,0],[0,1],[1,1]],[[0,0],[0,1],[0,2]],[[0,0],[1,0],[2,0]],[[0,0],[1,0],[1,1]],[[1,0],[0,1],[1,1],[2,1]],[[0,0],[0,1],[1,1]],[[0,0],[1,0],[2,0],[1,1]]];
 let grid=Array(100).fill(false),score=0,selected=0,pieces=[];
 const newPieces=()=>pieces=Array.from({length:3},()=>shapes[Math.floor(Math.random()*shapes.length)]);
 newPieces();
 function canPlace(shape,row,col){return shape.every(([x,y])=>row+y<10&&col+x<10&&!grid[(row+y)*10+col+x]);}
 function hasPlacement(shape){for(let r=0;r<10;r++)for(let c=0;c<10;c++)if(canPlace(shape,r,c))return true;return false;}
 function draw(){
  $("miniGameBody").innerHTML='<div class="mini-score">LINES CLEARED <b>'+score+'</b></div><div class="mini-board block-grid">'+grid.map((v,i)=>'<button class="block-cell '+(v?'filled':'')+'" data-i="'+i+'" aria-label="Board cell"></button>').join("")+'</div><p class="game-help">Choose a shape, then tap the board to place it. Complete a full row or column to clear it.</p><div class="block-tray">'+pieces.map((shape,i)=>'<button class="block-piece '+(selected===i?'selected':'')+'" data-piece="'+i+'" '+(shape.length===0?'disabled':'')+'>'+Array.from({length:3},(_,y)=>'<span class="piece-row">'+Array.from({length:3},(_,x)=>'<i class="'+(shape.some(([sx,sy])=>sx===x&&sy===y)?'piece-dot':'')+'"></i>').join("")+'</span>').join("")+'</button>').join("")+'</div>';
  $("miniGameBody").querySelectorAll(".block-piece").forEach(btn=>btn.onclick=()=>{selected=+btn.dataset.piece;draw();});
  $("miniGameBody").querySelectorAll(".block-cell").forEach(btn=>btn.onclick=()=>{const idx=+btn.dataset.i,row=Math.floor(idx/10),col=idx%10,shape=pieces[selected];if(!shape||!canPlace(shape,row,col)){btn.classList.add("invalid");setTimeout(()=>btn.classList.remove("invalid"),250);return;}shape.forEach(([x,y])=>grid[(row+y)*10+col+x]=true);pieces[selected]=[];const clearRows=[],clearCols=[];for(let r=0;r<10;r++)if(grid.slice(r*10,r*10+10).every(Boolean))clearRows.push(r);for(let c=0;c<10;c++)if(Array.from({length:10},(_,r)=>grid[r*10+c]).every(Boolean))clearCols.push(c);clearRows.forEach(r=>{for(let c=0;c<10;c++)grid[r*10+c]=false;});clearCols.forEach(c=>{for(let r=0;r<10;r++)grid[r*10+c]=false;});score+=clearRows.length+clearCols.length;if(pieces.every(p=>p.length===0))newPieces();if(pieces.every(p=>!p.length||!hasPlacement(p))){$("miniGameBody").insertAdjacentHTML("beforeend",'<div class="game-over-panel"><h3>No more moves!</h3><p>Lines cleared: '+score+'</p><button class="primary-button" id="blocksAgain">Play again</button></div>');$("blocksAgain").onclick=()=>openGame("blocks");return;}draw();});
 }
 draw();
}
function racer(){
 $("miniGameBody").innerHTML='<div class="mini-score">DISTANCE <b id="raceScore">0</b></div><canvas class="game-canvas" id="raceCanvas" width="360" height="500"></canvas><p class="game-help">Use ← and → or tap a lane to dodge traffic.</p>';
 const c=$("raceCanvas"),ctx=c.getContext("2d"),s={lane:1,obs:[],tick:0,score:0,dead:false,road:0};
 const key=e=>{if(active!=="racer")return;if(e.key==="ArrowLeft"){s.lane=Math.max(0,s.lane-1);e.preventDefault();}if(e.key==="ArrowRight"){s.lane=Math.min(2,s.lane+1);e.preventDefault();}};window.addEventListener("keydown",key);cleanup=()=>window.removeEventListener("keydown",key);c.onclick=e=>{let r=c.getBoundingClientRect();s.lane=Math.max(0,Math.min(2,Math.floor((e.clientX-r.left)/r.width*3)));};
 function draw(){ctx.fillStyle="#111522";ctx.fillRect(0,0,360,500);ctx.fillStyle="#35364a";ctx.fillRect(38,0,284,500);ctx.strokeStyle="#e8dfff99";ctx.lineWidth=4;ctx.setLineDash([26,24]);ctx.lineDashOffset=-s.road;ctx.beginPath();ctx.moveTo(132,0);ctx.lineTo(132,500);ctx.moveTo(226,0);ctx.lineTo(226,500);ctx.stroke();ctx.setLineDash([]);ctx.shadowBlur=18;ctx.shadowColor="#8ef0c0";ctx.fillStyle="#8ef0c0";ctx.beginPath();ctx.roundRect(58+s.lane*94,408,52,72,10);ctx.fill();ctx.shadowColor="#ff78b7";ctx.fillStyle="#ff78b7";s.obs.forEach(o=>{ctx.beginPath();ctx.roundRect(58+o.lane*94,o.y,52,66,9);ctx.fill();});ctx.shadowBlur=0;}
 timer=setInterval(()=>{if(s.dead)return;s.tick++;s.road=(s.road+7)%50;if(s.tick%30===0)s.obs.push({lane:Math.floor(Math.random()*3),y:-70});s.obs.forEach(o=>o.y+=7);s.obs=s.obs.filter(o=>o.y<520);if(s.obs.some(o=>o.lane===s.lane&&o.y>350&&o.y<475)){s.dead=true;clearInterval(timer);$("raceCanvas").classList.add("crash-shake");$("miniGameBody").insertAdjacentHTML("beforeend",'<div class="game-over-panel"><h3>CRASH!</h3><p>Distance: '+s.score+'</p><button class="primary-button" id="raceAgain">Race again ↻</button></div>');$("raceAgain").onclick=()=>openGame("racer");return;}if(s.tick%5===0){s.score++;$("raceScore").textContent=s.score;}draw();},35);draw();
}


// Friend invitations launch Memory Match in a room created by the inviter.
window.arcadeHubStartInvitedMemory=async(code,mark)=>{
 try{
  await ensureMemorySignIn();
  openGame("memory");
  const candidate=ref(miniDb,"rooms/"+code),snap=await get(candidate),data=snap.val();
  if(!data||data.type!=="memory"||data.status!=="playing"||data.players?.[mark]?.id!==memoryUserId)throw Error("This Memory Match invitation is no longer valid.");
  memoryRoomRef=candidate;memoryMark=mark;listenMemoryRoom();
 }catch(e){console.error("[ArcadeHub] Invited Memory Match could not open:",e);$("miniGameBody").innerHTML='<div class="memory-room-panel"><h2>Could not join game</h2><p class="game-help">'+String(e.message||"Please try again.")+'</p><button class="secondary-button" id="memoryBackToMenu">Back</button></div>';$("memoryBackToMenu").onclick=memoryMenu;}
};
