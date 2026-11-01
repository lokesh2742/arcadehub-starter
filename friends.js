import {getApps,initializeApp} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {getAuth,onAuthStateChanged} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {getDatabase,ref,get,set,update,remove,onValue,runTransaction,push,onDisconnect} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
const firebaseConfig={apiKey:"AIzaSyDAFaBhBwHvWkxkU7KH8n-IsGICwFzYUl4",authDomain:"arcadehub-3f060.firebaseapp.com",databaseURL:"https://arcadehub-3f060-default-rtdb.firebaseio.com",projectId:"arcadehub-3f060",storageBucket:"arcadehub-3f060.firebasestorage.app",messagingSenderId:"777660361833",appId:"1:777660361833:web:623f0ce7d78a4733ac46f8",measurementId:"G-Q1GX1EEMWX"};
const $=id=>document.getElementById(id);
let app=null,auth=null,db=null;
try{app=getApps().find(a=>a.name==="[DEFAULT]")||initializeApp(firebaseConfig);auth=getAuth(app);db=getDatabase(app);}catch(e){console.error("ArcadeHub Friends Firebase initialization failed:",e);}
let user=null,username="",friends={},requests={},invites={},presence={},presenceWatchers={},unsubs=[],presenceOff=null,launched={};
const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const say=s=>{if($("friendsStatus"))$("friendsStatus").textContent=s;};
const online=uid=>presence[uid]?.state==="online";
function stopListeners(){unsubs.forEach(fn=>fn());unsubs=[];presenceWatchers={};if(presenceOff){presenceOff();presenceOff=null;}}
function makeUsername(u){
 const base=(u.displayName||"player").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,18)||"player";
 return (base+"-"+u.uid.slice(-6)).toLowerCase();
}
async function ensureProfile(u){
 const profileRef=ref(db,"playerUsernames/"+u.uid),existing=await get(profileRef);
 if(existing.exists()){username=existing.val().username;return;}
 username=makeUsername(u);
 const directoryRef=ref(db,"playerDirectory/"+username);
 const result=await runTransaction(directoryRef,old=>old===null?{uid:u.uid,name:u.displayName||"ArcadeHub Player",username,createdAt:Date.now()}:undefined);
 if(!result.committed){const current=await get(directoryRef);if(!current.exists()||current.val().uid!==u.uid)throw Error("That username is already taken. Please sign in again or contact support.");}
 await set(profileRef,{username});
}
async function startPresence(){
 const statusRef=ref(db,"presence/"+user.uid);
 const connectedRef=ref(db,".info/connected");
 presenceOff=onValue(connectedRef,async snap=>{
  if(snap.val()!==true)return;
  try{await onDisconnect(statusRef).set({state:"offline",lastChanged:Date.now()});await set(statusRef,{state:"online",username,name:user.displayName||username,lastChanged:Date.now()});}
  catch(e){say("Presence could not start: "+(e.message||"database permission denied"));}
 });
}
function renderFriends(){
 const list=$("friendsList");if(!list)return;
 const entries=Object.entries(friends);
 list.innerHTML=entries.length?entries.map(([uid,f])=>'<div class="friend-row"><span class="friend-avatar">'+esc((f.name||"P").charAt(0).toUpperCase())+'</span><span class="friend-details"><b>'+esc(f.name||"Player")+'</b><small>@'+esc(f.username||"player")+' · '+(online(uid)?'<i class="online-dot"></i> Online':'Offline')+'</small></span></div>').join(""):'<p class="game-help">No friends yet. Search for a friend by their unique username.</p>';
}
function renderInbox(){
 const box=$("friendsInbox");if(!box)return;const rows=[];
 for(const [uid,r] of Object.entries(requests))rows.push('<div class="friend-row"><span class="friend-avatar">+</span><span class="friend-details"><b>'+esc(r.name||"Player")+'</b><small>Friend request · @'+esc(r.username||"player")+'</small></span><button class="primary-button" data-accept-friend="'+esc(uid)+'">Accept</button><button class="secondary-button" data-decline-friend="'+esc(uid)+'">Decline</button></div>');
 for(const [id,v] of Object.entries(invites))if(v.status==="pending")rows.push('<div class="friend-row"><span class="friend-avatar">🎮</span><span class="friend-details"><b>'+esc(v.fromName||"Player")+'</b><small>Invited you to '+esc(v.game==="memory"?"Memory Match":"Tic Tac Toe")+'</small></span><button class="primary-button" data-accept-invite="'+esc(id)+'">Play</button><button class="secondary-button" data-decline-invite="'+esc(id)+'">No thanks</button></div>');
 box.innerHTML=rows.length?rows.join(""):'<p class="game-help">Your inbox is clear. Friend requests and game invites will show up here.</p>';
 box.querySelectorAll("[data-accept-friend]").forEach(b=>b.onclick=()=>acceptFriend(b.dataset.acceptFriend));
 box.querySelectorAll("[data-decline-friend]").forEach(b=>b.onclick=()=>remove(ref(db,"friendRequests/"+user.uid+"/"+b.dataset.declineFriend)));
 box.querySelectorAll("[data-accept-invite]").forEach(b=>b.onclick=()=>acceptInvite(b.dataset.acceptInvite));
 box.querySelectorAll("[data-decline-invite]").forEach(b=>b.onclick=()=>update(ref(db,"gameInvites/"+user.uid+"/"+b.dataset.declineInvite),{status:"declined"}));
 const count=Object.keys(requests).length+Object.values(invites).filter(v=>v.status==="pending").length;
 $("inboxCount").textContent=count?String(count):"";$("friendNotice").hidden=!count;
}
function renderGameInvites(containerId,game){
 const box=$(containerId);if(!box)return;
 const entries=Object.entries(friends).filter(([uid])=>online(uid));
 box.innerHTML='<div class="game-invite-heading"><b>Invite an online friend</b><span class="online-count">'+entries.length+' online</span></div>'+
 (entries.length?entries.map(([uid,f])=>'<div class="game-invite-row"><span>'+esc(f.name||"Player")+' <small>@'+esc(f.username||"")+'</small></span><button class="secondary-button" data-game-invite="'+esc(uid)+'">Invite</button></div>').join(""):'<div class="no-online-friends"><p class="game-help">No friends are online right now. You can add another friend or invite them when they come online.</p><button type="button" class="secondary-button" data-add-friend-from-game>Add a friend</button></div>')+
 '<p class="game-help invite-feedback" aria-live="polite"></p>';
 box.querySelector("[data-add-friend-from-game]")?.addEventListener("click",()=>window.arcadeHubOpenFriendSearch?.());
 box.querySelectorAll("[data-game-invite]").forEach(b=>b.onclick=async()=>{b.disabled=true;try{await sendInvite(b.dataset.gameInvite,game);box.querySelector(".invite-feedback").textContent="Invitation sent!";}catch(e){box.querySelector(".invite-feedback").textContent=e.message||"Could not send invitation.";}finally{b.disabled=false;}});
}
window.arcadeHubRenderGameInvites=(containerId,game)=>renderGameInvites(containerId,game);
window.arcadeHubOpenFriendSearch=()=>{const overlay=$("friendsOverlay");if(overlay)overlay.hidden=false;showTab("search");$("friendSearchInput")?.focus();};
window.arcadeHubOpenFriends=()=>{const overlay=$("friendsOverlay");if(overlay)overlay.hidden=false;showTab("friends");};
async function acceptFriend(uid){
 try{
  const snap=await get(ref(db,"friendRequests/"+user.uid+"/"+uid));if(!snap.exists())return;
  const request=snap.val(),me={uid:user.uid,name:user.displayName||"Player",username};
  const updates={};updates["friends/"+user.uid+"/"+uid]={uid,name:request.name||"Player",username:request.username||""};updates["friends/"+uid+"/"+user.uid]=me;updates["friendRequests/"+user.uid+"/"+uid]=null;
  await update(ref(db),updates);say("Friend added!");
 }catch(e){say(e.message||"Could not accept request. Check Firebase database rules.");}
}
async function searchPlayer(){
 const query=$("friendSearchInput").value.trim().replace(/^@/,"").toLowerCase(),out=$("friendSearchResult");out.innerHTML="";
 if(!/^[a-z0-9-]{3,32}$/.test(query)){say("Enter the player's username (for example, @alex-12ab34).");return;}
 try{
  const snap=await get(ref(db,"playerDirectory/"+query));
  if(!snap.exists()){out.innerHTML='<p class="game-help">No player found. Check the username and try again.</p>';return;}
  const p=snap.val();if(p.uid===user.uid){out.innerHTML='<p class="game-help">That is your own username.</p>';return;}
  if(friends[p.uid]){out.innerHTML='<p class="game-help">You are already friends with '+esc(p.name)+'.</p>';return;}
  const sent=await get(ref(db,"friendRequests/"+p.uid+"/"+user.uid));
  const incoming=await get(ref(db,"friendRequests/"+user.uid+"/"+p.uid));
  const alreadySent=sent.exists(),hasIncoming=incoming.exists();
  out.innerHTML='<div class="friend-row"><span class="friend-avatar">'+esc((p.name||"P").charAt(0).toUpperCase())+'</span><span class="friend-details"><b>'+esc(p.name||"Player")+'</b><small>@'+esc(p.username||query)+' · '+(online(p.uid)?'<i class="online-dot"></i> Online':'Offline')+'</small></span><button class="primary-button" id="sendFriendRequest" '+(alreadySent||hasIncoming?'disabled':'')+'>'+(alreadySent?"Request sent":hasIncoming?"Accept from Inbox":"Add friend")+'</button></div>';
  if(!alreadySent&&!hasIncoming)$("sendFriendRequest").onclick=async()=>{try{await set(ref(db,"friendRequests/"+p.uid+"/"+user.uid),{uid:user.uid,name:user.displayName||"Player",username,createdAt:Date.now()});say("Friend request sent to @"+query);$("sendFriendRequest").disabled=true;$("sendFriendRequest").textContent="Sent";}catch(e){say(e.message||"Could not send request. Check Firebase database rules.");}};
 }catch(e){say(e.message||"Player search failed. Check Firebase database rules.");}
}
async function sendInvite(uid,type){
 if(!["memory","tictactoe"].includes(type))throw Error("This game is not available for invitations.");
 const target=await get(ref(db,"friends/"+user.uid+"/"+uid));if(!target.exists())throw Error("That player is not in your friend list.");
 const status=await get(ref(db,"presence/"+uid));if(status.val()?.state!=="online")throw Error("Your friend is offline. Invitations can only be sent to online friends.");
 const inviteRef=push(ref(db,"gameInvites/"+uid));
 await set(inviteRef,{fromUid:user.uid,fromName:user.displayName||username,fromUsername:username,toUid:uid,game:type,status:"pending",createdAt:Date.now()});
 return target.val().name||"your friend";
}
function makeCode(){const bytes=new Uint8Array(6);crypto.getRandomValues(bytes);return [...bytes].map(b=>chars[b%chars.length]).join("");}
async function acceptInvite(id){
 const invite=invites[id];if(!invite||invite.status!=="pending")return;
 try{
  const code=makeCode(),players={X:{id:user.uid,name:user.displayName||username},O:{id:invite.fromUid,name:invite.fromName||"Friend"}};
  const roomData=invite.game==="memory"?{type:"memory",status:"playing",players,deck:["◆","●","▲","★","♥","☀","☂","✿","◆","●","▲","★","♥","☀","☂","✿"].sort(()=>Math.random()-.5),matched:[],picks:[],turn:"X",scores:{X:0,O:0},moves:0,phase:"ready"}:{type:"tictactoe",status:"playing",hostId:user.uid,createdAt:Date.now(),players,board:Array(9).fill(""),turn:"X",round:1,scores:{X:0,O:0},winner:null,rematchRequests:{X:false,O:false}};
  const made=await runTransaction(ref(db,"rooms/"+code),old=>old===null?roomData:undefined);
  if(!made.committed)throw Error("Could not prepare the game room. Please try again.");
  await update(ref(db,"gameInvites/"+user.uid+"/"+id),{status:"accepted",roomCode:code,acceptedBy:user.uid});
  await set(ref(db,"gameInvites/"+invite.fromUid+"/accepted_"+id),{...invite,status:"accepted",roomCode:code,acceptedBy:user.uid,acceptedAt:Date.now()});
  launch(invite.game,code,"X");
 }catch(e){say(e.message||"Could not start the invited game.");}
}
function launch(game,code,mark){const key=game+":"+code;if(launched[key])return;launched[key]=true;if(game==="memory")window.arcadeHubStartInvitedMemory?.(code,mark);else window.arcadeHubStartInvitedTicTacToe?.(code,mark);}
function listenSocial(){
 stopListeners();
 const add=(path,cb)=>unsubs.push(onValue(ref(db,path),snap=>cb(snap.val()||{}),e=>say(e.message||"Could not load social data.")));
 add("friends/"+user.uid,data=>{friends=data;Object.keys(friends).forEach(uid=>{if(!presenceWatchers[uid]){const off=onValue(ref(db,"presence/"+uid),snap=>{presence[uid]=snap.val()||{};renderFriends();renderGameInvites("ticFriendInvites","tictactoe");renderGameInvites("memoryFriendInvites","memory");});presenceWatchers[uid]=off;unsubs.push(off);}});renderFriends();renderGameInvites("ticFriendInvites","tictactoe");renderGameInvites("memoryFriendInvites","memory");});
 add("friendRequests/"+user.uid,data=>{requests=data;renderInbox();});
 add("gameInvites/"+user.uid,data=>{invites=data;renderInbox();});

}
function listenAccepted(){
 unsubs.push(onValue(ref(db,"gameInvites/"+user.uid),snap=>{const data=snap.val()||{};Object.entries(data).forEach(([id,v])=>{if(id.startsWith("accepted_")&&v.status==="accepted"&&v.roomCode){launch(v.game,v.roomCode,"O");remove(ref(db,"gameInvites/"+user.uid+"/"+id)).catch(e=>console.warn("Could not clear handled invite",e));}});}));
}
function acceptAndClear(id){return acceptInvite(id);}
function showTab(tab){["friends","search","inbox"].forEach(name=>{$("friends"+(name==="friends"?"List":name==="search"?"Search":"Inbox")+"Panel").hidden=name!==tab;});document.querySelectorAll(".friends-tab").forEach(b=>b.classList.toggle("active",b.dataset.friendsTab===tab));}
$("friendsButton").addEventListener("click",()=>{$("friendsOverlay").hidden=false;});
$("closeFriendsButton").addEventListener("click",()=>$("friendsOverlay").hidden=true);
$("friendsOverlay").addEventListener("click",e=>{if(e.target===$("friendsOverlay"))$("friendsOverlay").hidden=true;});
document.querySelectorAll(".friends-tab").forEach(b=>b.addEventListener("click",()=>showTab(b.dataset.friendsTab)));
$("friendSearchButton").addEventListener("click",searchPlayer);
$("friendSearchInput").addEventListener("keydown",e=>{if(e.key==="Enter")searchPlayer();});
$("copyFriendCode").addEventListener("click",async()=>{if(username)try{await navigator.clipboard.writeText(username);say("Username copied.");}catch{say("Your username is @"+username);}});
onAuthStateChanged(auth,async u=>{
 if(user?.uid&&!u)update(ref(db,"presence/"+user.uid),{state:"offline",lastChanged:Date.now()}).catch(()=>{});
 user=u;stopListeners();username="";friends={};requests={};invites={};presence={};
 $("myFriendCode").textContent=u?"Setting up your username…":"Sign in with Google to get your username";
 if(!u){say("Sign in with Google to use friends and invitations.");renderFriends();renderInbox();return;}
 try{await ensureProfile(u);$("myFriendCode").textContent="@"+username;listenSocial();listenAccepted();await startPresence();renderFriends();renderInbox();say("Your unique username is ready. Share it so friends can find you.");}
 catch(e){$("myFriendCode").textContent="Username unavailable";say("Username setup failed: "+(e.message||"Check your Firebase connection and Realtime Database rules."));console.error("ArcadeHub username setup failed:",e);}
});
