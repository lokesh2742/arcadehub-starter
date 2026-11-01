// Firebase is used for internet multiplayer rooms.
// Enable Realtime Database and Anonymous Authentication in Firebase.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getDatabase, ref, get, set, update, onValue, runTransaction, onDisconnect, remove
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

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

const firebaseConfigured = !Object.values(firebaseConfig).some(value => value.includes("PASTE_YOUR"));
let db=null,auth=null,userId=null,firebaseReady=false,playerName="Guest";
const googleProvider=new GoogleAuthProvider();
if(firebaseConfigured){try{const app=initializeApp(firebaseConfig);auth=getAuth(app);db=getDatabase(app);firebaseReady=true;onAuthStateChanged(auth,user=>{userId=user?.uid||null;playerName=user?.displayName?.trim().slice(0,16)||"Guest";updateProfileUI();});}catch(error){console.error("Firebase setup error:",error);}}
async function requireGoogleSignIn(){if(!firebaseReady||!auth)throw Error("Online play is not configured yet.");let user=auth.currentUser;if(!user){try{user=(await signInWithPopup(auth,googleProvider)).user;}catch(error){if(error.code==="auth/popup-closed-by-user")throw Error("Sign-in was cancelled.");if(error.code==="auth/unauthorized-domain")throw Error("This website domain is not authorized in Firebase Authentication.");throw error;}}userId=user.uid;playerName=user.displayName?.trim().slice(0,16)||"Guest";updateProfileUI();return user;}
window.arcadeHubRequireGoogleSignIn=requireGoogleSignIn;

const $ = id => document.getElementById(id);
const gameScreen = $("ticTacToeScreen"), nameScreen = $("nameScreen");
const modeSelection = $("modeSelection"), onlineSetup = $("onlineSetup");
const waitingRoom = $("waitingRoom"), boardArea = $("boardArea");
const cells = [...document.querySelectorAll(".cell")];
const toast = $("toast");

const wins = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
];

let gameMode = "ai", myMark = "X";
let board = Array(9).fill("");
let currentPlayer = "X", gameOver = false;
let scores = {X:0,O:0};
let roomCode = "", roomRef = null;
let roomUnsubscribe = null, currentRoom = null;
let toastTimer, aiTimer, isApplyingRemote = false;


function updateProfileUI(){const user=auth?.currentUser;playerName=user?.displayName?.trim().slice(0,16)||"Guest";$("profileButtonName").textContent=user?playerName:"Sign in";$("profileAvatar").textContent=user?playerName.charAt(0).toUpperCase():"?";$("profileLargeAvatar").textContent=user?playerName.charAt(0).toUpperCase():"?";$("profileAccountStatus").textContent=user?"Signed in with Google":"Playing as a guest";$("googleSignInButton").hidden=!!user;$("signOutButton").hidden=!user;$("playerName").value=playerName;}
$("profileButton").addEventListener("click",()=>{updateProfileUI();$("profileOverlay").hidden=false;});
$("closeProfileButton").addEventListener("click",()=>$("profileOverlay").hidden=true);
$("profileOverlay").addEventListener("click",e=>{if(e.target===$("profileOverlay"))$("profileOverlay").hidden=true;});
$("googleSignInButton").addEventListener("click",async()=>{try{await requireGoogleSignIn();$("profileOverlay").hidden=true;showToast("Signed in with Google.");}catch(error){showToast(error.message||"Google sign-in failed.");}});
$("signOutButton").addEventListener("click",async()=>{try{await signOut(auth);$("profileOverlay").hidden=true;showToast("Signed out. Solo games remain available.");}catch(error){showToast(error.message||"Could not sign out.");}});
function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2300);
}

function showOnly(screen) {
  [nameScreen, modeSelection, onlineSetup, waitingRoom, boardArea]
    .forEach(el => el.hidden = el !== screen);
}

function openGame() {
  gameScreen.classList.add("open");
  gameScreen.setAttribute("aria-hidden","false");
  document.body.style.overflow = "hidden";
  showOnly(modeSelection);
  $("playerName").value = playerName;
}

function closeGame() {
  leaveRoomListener();
  gameScreen.classList.remove("open");
  gameScreen.setAttribute("aria-hidden","true");
  document.body.style.overflow = "";
  clearTimeout(aiTimer);
  $("onlineResultModal").hidden = true;
}

function leaveRoomListener() {
  if (roomUnsubscribe) {
    roomUnsubscribe();
    roomUnsubscribe = null;
  }
}

document.querySelector('[data-game="tictactoe"]')
  .addEventListener("click", openGame);

$("backButton").addEventListener("click", closeGame);

$("homeLink").addEventListener("click", e => {
  e.preventDefault();
  closeGame();
  window.scrollTo({top:0,behavior:"smooth"});
});

$("nameForm").addEventListener("submit",e=>{e.preventDefault();showOnly(modeSelection);});
$("editNameButton").addEventListener("click",()=>{$("profileOverlay").hidden=false;updateProfileUI();});

$("vsAiButton").addEventListener("click", () => startLocalMode("ai"));
$("vsPlayerButton").addEventListener("click", () => startLocalMode("local"));

$("onlineButton").addEventListener("click",async()=>{try{await requireGoogleSignIn();showOnly(onlineSetup);}catch(error){showToast(error.message||"Sign in to play online.");}});

$("onlineBackButton").addEventListener("click", () => showOnly(modeSelection));

$("changeModeButton").addEventListener("click", async () => {
  if (gameMode === "online" && roomRef) {
    if (roomUnsubscribe) leaveRoomListener();
    roomRef = null;
    roomCode = "";
    currentRoom = null;
  }

  showOnly(modeSelection);
});

$("newRoundButton").addEventListener("click", () => {
  if (gameMode === "online") requestOnlineRematch();
  else resetLocalRound();
});
$("newMatchButton").addEventListener("click", requestOnlineRematch);
$("exitToMenuButton").addEventListener("click", exitOnlineToMenu);

$("createRoomButton").addEventListener("click", createRoom);

$("joinRoomForm").addEventListener("submit", e => {
  e.preventDefault();
  joinRoom($("roomCodeInput").value.trim().toUpperCase());
});

$("copyRoomCodeButton").addEventListener("click", () => copyText(roomCode));
$("copyActiveCodeButton").addEventListener("click", () => copyText(roomCode));

$("cancelRoomButton").addEventListener("click", async () => {
  leaveRoomListener();

  if (roomRef && myMark === "X") {
    try {
      await update(roomRef, {status:"closed"});
    } catch {}
  }

  roomRef = null;
  roomCode = "";
  currentRoom = null;
  showOnly(modeSelection);
});

// Mini-game card interactions are registered in mini-games.js.

// LOCAL GAME MODES

function startLocalMode(mode) {
  gameMode = mode;
  $("onlineResultModal").hidden = true;
  myMark = "X";
  roomCode = "";
  roomRef = null;
  currentRoom = null;

  leaveRoomListener();
  scores = {X:0,O:0};

  $("modeEyebrow").textContent =
    mode === "ai" ? "PLAYER VS AI" : "LOCAL MULTIPLAYER";

  $("xName").textContent = playerName;
  $("oName").textContent = mode === "ai" ? "AI" : "PLAYER 2";

  $("activeRoomBanner").hidden = true;
  $("connectionStatus").textContent = "";

  showOnly(boardArea);
  updateScores();
  resetLocalRound();
}

function resetLocalRound() {
  board = Array(9).fill("");
  currentPlayer = "X";
  gameOver = false;

  renderBoard();
  updateStatus();

  $("gameHint").textContent =
    gameMode === "ai"
      ? "You are X. Get three in a row to win."
      : "Take turns on the same device.";
}

function renderBoard() {
  cells.forEach((cell,i) => {
    const mark = board[i];

    cell.textContent =
      mark === "X" ? "×" : mark === "O" ? "○" : "";

    cell.className = "cell" + (mark === "O" ? " o-cell" : "");
    cell.disabled = !!mark || gameOver;

    cell.setAttribute(
      "aria-label",
      mark ? `Cell ${i+1}: ${mark}` : `Empty cell ${i+1}`
    );
  });
}

function updateScores() {
  $("xScore").textContent = scores.X;
  $("oScore").textContent = scores.O;
}

function updateStatus() {
  $("xScoreCard").classList.toggle(
    "active-turn", currentPlayer === "X" && !gameOver
  );

  $("oScoreCard").classList.toggle(
    "active-turn", currentPlayer === "O" && !gameOver
  );

  if (gameMode === "online") {
    const opponent =
      currentRoom?.players?.[currentPlayer]?.name ||
      (currentPlayer === myMark ? "You" : "Opponent");

    $("turnStatus").textContent = gameOver
      ? "Round over"
      : currentPlayer === myMark
        ? "Your turn"
        : `${opponent}'s turn`;

  } else if (gameMode === "ai") {
    $("turnStatus").textContent = gameOver
      ? "Round over"
      : currentPlayer === "X"
        ? "Your turn"
        : "AI thinking…";

  } else {
    $("turnStatus").textContent = gameOver
      ? "Round over"
      : currentPlayer === "X"
        ? `${playerName}'s turn`
        : "Player 2's turn";
  }

  if (gameMode === "online") {
    cells.forEach((cell,i) => {
      cell.disabled =
        gameOver || !!board[i] || currentPlayer !== myMark;
    });
  }
}

function winningLine(state, mark) {
  return wins.find(line => line.every(i => state[i] === mark));
}

function finishLocalIfNeeded() {
  const line = winningLine(board,currentPlayer);

  if (line) {
    gameOver = true;

    line.forEach(i => cells[i].classList.add("winning"));

    scores[currentPlayer]++;
    updateScores();

    $("turnStatus").textContent =
      currentPlayer === "X"
        ? (gameMode === "ai" ? "You win! 🎉" : `${playerName} wins!`)
        : (gameMode === "ai" ? "AI wins this round" : "Player 2 wins!");

    $("gameHint").textContent =
      "Nice game! Start a new round when ready.";

    cells.forEach(c => c.disabled = true);
    return true;
  }

  if (board.every(Boolean)) {
    gameOver = true;
    $("turnStatus").textContent = "It's a draw!";
    $("gameHint").textContent = "Well played. Try another round!";
    cells.forEach(c => c.disabled = true);
    return true;
  }

  return false;
}

function makeLocalMove(index) {
  if (gameOver || board[index]) return;

  board[index] = currentPlayer;
  renderBoard();

  if (finishLocalIfNeeded()) {
    updateStatus();
    return;
  }

  currentPlayer = currentPlayer === "X" ? "O" : "X";
  updateStatus();

  if (gameMode === "ai" && currentPlayer === "O") {
    cells.forEach(c => c.disabled = true);

    aiTimer = setTimeout(() => {
      const move = bestAiMove();

      if (move >= 0 && !gameOver) {
        makeLocalMove(move);
      }
    }, 380);
  }
}

cells.forEach(cell => cell.addEventListener("click", () => {
  const index = Number(cell.dataset.cell);

  if (gameMode === "online") {
    makeOnlineMove(index);
  } else if (gameMode === "ai" && currentPlayer !== "X") {
    return;
  } else {
    makeLocalMove(index);
  }
}));

// MINIMAX AI

function bestAiMove() {
  let best = -Infinity, move = -1;

  for (let i=0;i<9;i++) {
    if (!board[i]) {
      board[i] = "O";

      const score = minimax(board,0,false);

      board[i] = "";

      if (score > best) {
        best = score;
        move = i;
      }
    }
  }

  return move;
}

function minimax(state,depth,maximizing) {
  if (winningLine(state,"O")) return 10-depth;
  if (winningLine(state,"X")) return depth-10;
  if (state.every(Boolean)) return 0;

  let best = maximizing ? -Infinity : Infinity;

  for (let i=0;i<9;i++) {
    if (!state[i]) {
      state[i] = maximizing ? "O" : "X";

      const score = minimax(state,depth+1,!maximizing);

      state[i] = "";

      best = maximizing
        ? Math.max(best,score)
        : Math.min(best,score);
    }
  }

  return best;
}

// ONLINE MULTIPLAYER — FIREBASE

async function ensureOnlineReady() {
  if (!firebaseReady) { showToast("Online rooms aren't configured yet. Follow the Firebase setup steps."); return false; }
  try { await requireGoogleSignIn(); return true; } catch(error) { showToast(error.message||"Sign in to play online."); return false; }
}

function randomRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);

  crypto.getRandomValues(bytes);

  return [...bytes]
    .map(b => chars[b % chars.length])
    .join("");
}

async function createRoom() {
  if (!(await ensureOnlineReady())) return;

  $("createRoomButton").disabled = true;

  try {
    let code = "", created = false;

    for (let attempt=0; attempt<5 && !created; attempt++) {
      code = randomRoomCode();

      const candidate = ref(db, `rooms/${code}`);

      const result = await runTransaction(candidate, existing => {
        if (existing === null) {
          return {
            status:"waiting",
            hostId:userId,
            createdAt:Date.now(),

            players:{
              X:{id:userId,name:playerName},
              O:null
            },

            board:Array(9).fill(""),
            turn:"X",
            round:1,
            scores:{X:0,O:0},
            winner:null,
            rematchRequests:{X:false,O:false}
          };
        }

        return;
      });

      if (result.committed) {
        created = true;
        roomRef = candidate;
      }
    }

    if (!created) {
      throw new Error("Could not create a unique room. Try again.");
    }

    roomCode = code;
    myMark = "X";
    gameMode = "online";

    $("roomCodeDisplay").textContent = code;
    showOnly(waitingRoom);

    listenToRoom();

    onDisconnect(ref(db, `rooms/${code}/players/X/connected`))
      .set(false);

  } catch (error) {
    console.error(error);
    showToast(error.message || "Couldn't create room.");
  } finally {
    $("createRoomButton").disabled = false;
  }
}




async function joinRoom(code) {
  if (!(await ensureOnlineReady())) return;

  if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) {
    showToast("Enter a valid six-character room code.");
    return;
  }

  $("roomCodeInput").disabled = true;

  try {
    const candidate = ref(db, `rooms/${code}`);

    // Fetch the existing room.
    const roomSnapshot = await get(candidate);

    if (!roomSnapshot.exists()) {
      throw new Error("Room does not exist. Check the code.");
    }

    // Keep an untouched copy for the transaction.
    const existingRoom = roomSnapshot.val();

    if (
      existingRoom.status !== "waiting" ||
      existingRoom.players?.O
    ) {
      throw new Error("Room is already full or no longer waiting.");
    }

    // Join using a fresh object on every transaction attempt.
    const result = await runTransaction(candidate, room => {

      const currentRoom = JSON.parse(
        JSON.stringify(room ?? existingRoom)
      );

      if (
        currentRoom.status !== "waiting" ||
        currentRoom.players?.O
      ) {
        return;
      }

      currentRoom.players = currentRoom.players || {};

      currentRoom.players.O = {
        id: userId,
        name: playerName
      };

      currentRoom.status = "playing";

      return currentRoom;
    });

    if (!result.committed) {
      throw new Error(
        "Join transaction was rejected. Check the room status."
      );
    }

    roomRef = candidate;
    roomCode = code;
    myMark = "O";
    gameMode = "online";

    listenToRoom();

    onDisconnect(ref(db, `rooms/${code}/players/O/connected`))
      .set(false);

  } catch (error) {
    console.error("Join room error:", error);
    showToast(error.message || "Couldn't join room.");
  } finally {
    $("roomCodeInput").disabled = false;
  }
}



function enterOnlineBoard(data) {
  currentRoom = data;

  if (data.players?.O && data.status === "playing") {
    $("xName").textContent = data.players.X?.name || "PLAYER 1";
    $("oName").textContent = data.players.O?.name || "PLAYER 2";

    $("modeEyebrow").textContent = "ONLINE MULTIPLAYER";
    $("activeRoomBanner").hidden = false;
    $("activeRoomCode").textContent = roomCode;

    $("connectionStatus").textContent =
      "● Connected to online room";

    showOnly(boardArea);
    applyRoomState(data);

    if (!roomUnsubscribe) {
      listenToRoom();
    }
  }
}

function listenToRoom() {
  leaveRoomListener();

  roomUnsubscribe = onValue(roomRef, snapshot => {
    const data = snapshot.val();

    if (!data || data.status === "closed") {
      leaveRoomListener();
      $("onlineResultModal").hidden = true;
      roomRef = null; roomCode = ""; currentRoom = null;
      closeGame();
      showToast("The room has ended.");
      return;
    }
    currentRoom = data;
    if (data.status === "waiting") { showOnly(waitingRoom); $("roomCodeDisplay").textContent = roomCode; return; }
    if ((data.status === "playing" || data.status === "finished") && data.players?.O) {
      $("xName").textContent = data.players.X?.name || "PLAYER 1";
      $("oName").textContent = data.players.O?.name || "PLAYER 2";
      $("modeEyebrow").textContent = "ONLINE MULTIPLAYER";
      $("activeRoomBanner").hidden = false; $("activeRoomCode").textContent = roomCode;
      $("connectionStatus").textContent = "● Connected to online room";
      showOnly(boardArea); applyRoomState(data);
    }

  }, error => {
    console.error(error);
    $("connectionStatus").textContent =
      "Connection interrupted. Check your internet.";
  });
}

function applyRoomState(data) {
  if (!data) return;

  isApplyingRemote = true;

  board = Array.isArray(data.board)
    ? data.board
    : Array(9).fill("");

  currentPlayer = data.turn || "X";
  scores = data.scores || {X:0,O:0};

  gameOver =
    data.status === "finished" ||
    !!data.winner ||
    board.every(Boolean);

  renderBoard();
  updateScores();
  updateStatus();

  const win = data.winner;

  if (win) {
    const line = winningLine(board,win);

    if (line) {
      line.forEach(i => cells[i].classList.add("winning"));
    }

    $("turnStatus").textContent =
      win === myMark
        ? "You win! 🎉"
        : `${data.players?.[win]?.name || "Opponent"} wins`;

    $("gameHint").textContent =
      "Round finished. Start a new round when ready.";

  } else if (gameOver) {
    $("turnStatus").textContent = "It's a draw!";
    $("gameHint").textContent =
      "Well played! Start another round.";

  } else {
    $("gameHint").textContent =
      currentPlayer === myMark
        ? "Your turn — make your move."
        : "Waiting for your opponent's move…";
  }

  const modal = $("onlineResultModal");
  if (gameMode === "online" && data.status === "finished") {
    const name = data.winner ? (data.players?.[data.winner]?.name || "Player") : "";
    $("resultTitle").textContent = data.winner ? name + " wins!" : "It is a draw!";
    $("resultMessage").textContent = data.winner ? "Congratulations on the win!" : "Both players played well.";
    const requests = data.rematchRequests || {};
    $("rematchNote").textContent = requests[myMark] ? "Waiting for the other player to choose New Match…" : "Both players need to choose New Match.";
    $("newMatchButton").textContent = requests[myMark] ? "Waiting for opponent…" : "New match ↻";
    $("newMatchButton").disabled = !!requests[myMark];
    modal.hidden = false;
  } else { modal.hidden = true; $("newMatchButton").disabled = false; $("newMatchButton").textContent = "New match ↻"; }
  isApplyingRemote = false;
}

async function makeOnlineMove(index) {
  if (
    !roomRef ||
    !currentRoom ||
    gameOver ||
    board[index] ||
    currentPlayer !== myMark
  ) {
    return;
  }

  const targetRef = roomRef;

  try {
    const result = await runTransaction(targetRef, room => {
      if (
        !room ||
        room.status !== "playing" ||
        room.turn !== myMark ||
        room.board?.[index]
      ) {
        return;
      }

      const nextBoard = [...room.board];
      nextBoard[index] = myMark;

      const line = winningLine(nextBoard,myMark);
      const draw = !line && nextBoard.every(Boolean);

      room.board = nextBoard;

      if (line) {
        room.status = "finished";
        room.winner = myMark;
        room.scores[myMark] =
          (room.scores[myMark] || 0) + 1;

      } else if (draw) {
        room.status = "finished";
        room.winner = null;

      } else {
        room.turn = myMark === "X" ? "O" : "X";
      }

      return room;
    });

    if (!result.committed) {
      showToast("That move is no longer available.");
    }

  } catch (error) {
    console.error(error);
    showToast("Move failed. Check your internet connection.");
  }
}

async function requestOnlineRematch() {
  if (!roomRef || !currentRoom || currentRoom.status !== "finished") return;
  try {
    const result = await runTransaction(roomRef, room => {
      if (!room || room.status !== "finished") return;
      if (room.players?.X?.id !== userId && room.players?.O?.id !== userId) return;
      room.rematchRequests = room.rematchRequests || {X:false,O:false};
      room.rematchRequests[myMark] = true;
      if (room.rematchRequests.X && room.rematchRequests.O) {
        room.board = Array(9).fill("");
        room.turn = "X";
        room.winner = null;
        room.round = (room.round || 1) + 1;
        room.status = "playing";
        room.rematchRequests = {X:false,O:false};
      }
      return room;
    });
    if (!result.committed) showToast("Could not request a new match. Try again.");
  } catch (error) { console.error(error); showToast("Could not request a new match."); }
}
async function startOnlineRound() { return requestOnlineRematch(); }
async function exitOnlineToMenu() {
  $("onlineResultModal").hidden = true;
  if (roomRef) { try { await update(roomRef, {status:"closed"}); } catch (error) { console.warn(error); } }
  leaveRoomListener(); roomRef = null; roomCode = ""; currentRoom = null;
  closeGame(); showToast("Back to the main menu.");
}

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    showToast("Room code copied!");
  } catch {
    showToast(`Room code: ${value}`);
  }
}

// GAME LIBRARY SEARCH AND FILTERS

let activeFilter = "all";
const cards = [...document.querySelectorAll(".game-card")];

function filterGames() {
  const term = $("searchInput").value.trim().toLowerCase();
  let count = 0;

  cards.forEach(card => {
    const show =
      card.dataset.name.includes(term) &&
      (
        activeFilter === "all" ||
        card.dataset.type.split(" ").includes(activeFilter)
      );

    card.hidden = !show;

    if (show) count++;
  });

  $("resultsLabel").textContent =
    `Showing ${count} game${count === 1 ? "" : "s"}`;

  $("emptyState").hidden = count !== 0;
}

$("searchInput").addEventListener("input",filterGames);

document.querySelectorAll(".filter-chip").forEach(button => {
  button.addEventListener("click",() => {
    document.querySelectorAll(".filter-chip")
      .forEach(b => b.classList.remove("active"));

    button.classList.add("active");
    activeFilter = button.dataset.filter;

    filterGames();
  });
});