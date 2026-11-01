import {getApps} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {getAuth,onAuthStateChanged} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {getDatabase,ref,get,set,update,remove,onValue,runTransaction,push} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
const $=id=>document.getElementById(id);
const app=getApps().find(a=>a.name==="[DEFAULT]");
if(!app){console.warn("[ArcadeHub] Friends need Firebase.");}
const auth=app?getAuth(app):null,db=app?getDatabase(app):null;
let user=null,friendCode="",friends={},requests={},invites={},unsubs=[],launched={};
const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const say=s=>{if($("friendsStatus"))$("friendsStatus").textContent=s;};
function stopListeners(){unsubs.forEach(fn=>fn());unsubs=[];}
async function ensureProfile(u){
 const codeRef=ref(db,"playerCodes/"+u.uid),existing=await get(codeRef);
 if(existing.exists()){friendCode=existing.val().code;return;}
 let code="",created=false;
 for(let n=0;n<8&&!created;n++){
  const bytes=new Uint8Array(8);crypto.getRandomValues(bytes);code=[...bytes].map(b=>chars[b%chars.length]).join("");
  const result=await runTransaction(ref(db,"playerDirectory/"+code),old=>old===null?{uid:u.uid,name:u.displayName||"ArcadeHub Player",friendCode:code,createdAt:Date.now()}:undefined);
  if(result.committed){created=true;await set(codeRef,{code});}
 }
 if(!created)throw Error("Couldn't create your Friend ID. Please try again.");
}
function renderFriends(){
 const list=$("friendsList");if(!list)return;
 const entries=Object.entries(friends);
 list.innerHTML=entries.length?entries.map(([uid,f])=>'<div class="friend-row"><span class="friend-avatar">'+esc((f.name||"P").charAt(0).toUpperCase())+'</span><span class="friend-details"><b>'+esc(f.name||"Player")+'</b><small>'+esc(f.friendCode||"ArcadeHub friend")+'</small></span><button class="secondary-button" data-invite="'+esc(uid)+'">Invite</button></div>').join(""):'<p class="game-help">No friends yet. Find a player by their Friend ID.</p>';
 list.querySelectorAll("[data-invite]").forEach(b=>b.onclick=()=>sendInvite(b.dataset.invite));
}
function renderInbox(){
 const box=$("friendsInbox");if(!box)return;
 const rows=[];
 for(const [uid,r] of Object.entries(requests))rows.push('<div class="friend-row"><span class="friend-avatar">+</span><span class="friend-details"><b>'+esc(r.name||"Player")+'</b><small>Friend request · '+esc(r.friendCode||"")+'</small></span><button class="primary-button" data-accept-friend="'+esc(uid)+'">Accept</button><button class="secondary-button" data-decline-friend="'+esc(uid)+'">Decline</button></div>');
 for(const [id,v] of Object.entries(invites))if(v.status==="pending")rows.push('<div class="friend-row"><span class="friend-avatar">🎮</span><span class="friend-details"><b>'+esc(v.fromName||"Player")+'</b><small>Invited you to '+esc(v.game==="memory"?"Memory Match":"Tic Tac Toe")+'</small></span><button class="primary-button" data-accept-invite="'+esc(id)+'">Play</button><button class="secondary-button" data-decline-invite="'+esc(id)+'">No thanks</button></div>');
 box.innerHTML=rows.length?rows.join(""):'<p class="game-help">Your inbox is clear. Friend requests and game invites will show up here.</p>';
 box.querySelectorAll("[data-accept-friend]").forEach(b=>b.onclick=()=>acceptFriend(b.dataset.acceptFriend));
 box.querySelectorAll("[data-decline-friend]").forEach(b=>b.onclick=()=>remove(ref(db,"friendRequests/"+user.uid+"/"+b.dataset.declineFriend)));
 box.querySelectorAll("[data-accept-invite]").forEach(b=>b.onclick=()=>acceptInvite(b.dataset.acceptInvite));
 box.querySelectorAll("[data-decline-invite]").forEach(b=>b.onclick=()=>update(ref(db,"gameInvites/"+user.uid+"/"+b.dataset.declineInvite),{status:"declined"}));
 const count=Object.keys(requests).length+Object.values(invites).filter(v=>v.status==="pending").length;
 $("inboxCount").textContent=count?String(count):"";$("friendNotice").hidden=!count;
}
function listenSocial(){
 stopListeners();
 const add=(path,cb)=>unsubs.push(onValue(ref(db,path),snap=>cb(snap.val()||{}),e=>say(e.message||"Could not load social data.")));
 add("friends/"+user.uid,async data=>{friends=data;renderFriends();});
 add("friendRequests/"+user.uid,data=>{requests=data;renderInbox();});
 add("gameInvites/"+user.uid,data=>{invites=data;renderInbox();});
}
async function acceptFriend(uid){
 try{
  const snap=await get(ref(db,"friendRequests/"+user.uid+"/"+uid));if(!snap.exists())return;
  const request=snap.val(),me={uid:user.uid,name:user.displayName||"Player",friendCode};
  const updates={};updates["friends/"+user.uid+"/"+uid]={uid,name:request.name||"Player",friendCode:request.friendCode||""};updates["friends/"+uid+"/"+user.uid]=me;updates["friendRequests/"+user.uid+"/"+uid]=null;
  await update(ref(db),updates);say("Friend added!"); 
 }catch(e){say(e.message||"Could not accept request.");}
}
async function searchPlayer(){
 const code=$("friendSearchInput").value.trim().toUpperCase(),out=$("friendSearchResult");
 out.innerHTML="";
 if(!/^[A-HJ-NP-Z2-9]{8}$/.test(code)){say("Enter a valid 8-character Friend ID.");return;}
 try{
  const snap=await get(ref(db,"playerDirectory/"+code));
  if(!snap.exists()){out.innerHTML='<p class="game-help">No player found with that Friend ID.</p>';return;}
  const p=snap.val();if(p.uid===user.uid){out.innerHTML='<p class="game-help">That is your own Friend ID.</p>';return;}
  if(friends[p.uid]){out.innerHTML='<p class="game-help">You are already friends with '+esc(p.name)+'.</p>';return;}
  const incoming=requests[p.uid];
  out.innerHTML='<div class="friend-row"><span class="friend-avatar">'+esc((p.name||"P").charAt(0).toUpperCase())+'</span><span class="friend-details"><b>'+esc(p.name||"Player")+'</b><small>'+esc(code)+'</small></span><button class="primary-button" id="sendFriendRequest">'+(incoming?"Request received":"Add friend")+'</button></div>';
  if(!incoming)$("sendFriendRequest").onclick=async()=>{try{await set(ref(db,"friendRequests/"+p.uid+"/"+user.uid),{uid:user.uid,name:user.displayName||"Player",friendCode,createdAt:Date.now()});say("Friend request sent!");$("sendFriendRequest").disabled=true;$("sendFriendRequest").textContent="Sent";}catch(e){say(e.message||"Could not send request.");}};
 }catch(e){say(e.message||"Player search failed. Check database permissions.");}
}
async function sendInvite(uid){
 const game=prompt("Which game? Enter tic tac toe or memory.","tic tac toe");
 if(!game)return;
 const normalized=game.trim().toLowerCase(),type=normalized.includes("memory")?"memory":normalized.includes("tic")?"tictactoe":null;
 if(!type){say("Choose Tic Tac Toe or Memory Match.");return;}
 try{
  const target=await get(ref(db,"friends/"+user.uid+"/"+uid));if(!target.exists())throw Error("That player is not in your friend list.");
  const inviteRef=push(ref(db,"gameInvites/"+uid));
  await set(inviteRef,{fromUid:user.uid,fromName:user.displayName||"Player",toUid:uid,game:type,status:"pending",createdAt:Date.now()});
  say("Game invitation sent to "+(target.val().name||"your friend")+".");
 }catch(e){say(e.message||"Could not send invitation.");}
}
function makeCode(){const bytes=new Uint8Array(6);crypto.getRandomValues(bytes);return [...bytes].map(b=>chars[b%chars.length]).join("");}
async function acceptInvite(id){
 const invite=invites[id];if(!invite||invite.status!=="pending")return;
 try{
  const code=makeCode(),players={X:{id:user.uid,name:user.displayName||"Player"},O:{id:invite.fromUid,name:invite.fromName||"Friend"}};
  let roomData=invite.game==="memory"?{type:"memory",status:"playing",players,deck:["◆","●","▲","★","♥","☀","☂","✿","◆","●","▲","★","♥","☀","☂","✿"].sort(()=>Math.random()-.5),matched:[],picks:[],turn:"X",scores:{X:0,O:0},moves:0,phase:"ready"}:{type:"tictactoe",status:"playing",hostId:user.uid,createdAt:Date.now(),players,board:Array(9).fill(""),turn:"X",round:1,scores:{X:0,O:0},winner:null,rematchRequests:{X:false,O:false}};
  const roomRef=ref(db,"rooms/"+code),made=await runTransaction(roomRef,old=>old===null?roomData:undefined);
  if(!made.committed)throw Error("Could not prepare the game room. Please try again.");
  await update(ref(db,"gameInvites/"+user.uid+"/"+id),{status:"accepted",roomCode:code,acceptedBy:user.uid});
  await set(ref(db,"gameInvites/"+invite.fromUid+"/accepted_"+id),{...invite,status:"accepted",roomCode:code,acceptedBy:user.uid,acceptedAt:Date.now()});
  launch(invite.game,code,"X");
 }catch(e){say(e.message||"Could not start the invited game.");}
}
function launch(game,code,mark){
 const key=game+":"+code;if(launched[key])return;launched[key]=true;
 if(game==="memory")window.arcadeHubStartInvitedMemory?.(code,mark);
 else window.arcadeHubStartInvitedTicTacToe?.(code,mark);
}
function listenAccepted(){
 unsubs.push(onValue(ref(db,"gameInvites/"+user.uid),snap=>{
  const data=snap.val()||{};
  Object.entries(data).forEach(([id,v])=>{if(id.startsWith("accepted_")&&v.status==="accepted"&&v.roomCode)launch(v.game,v.roomCode,"O");});
 }));
}
function showTab(tab){
 ["friends","search","inbox"].forEach(name=>{$("friends"+(name==="friends"?"List":"")+(name==="search"?"Search":"")+(name==="inbox"?"Inbox":"")+"Panel").hidden=name!==tab;});
 document.querySelectorAll(".friends-tab").forEach(b=>b.classList.toggle("active",b.dataset.friendsTab===tab));
}
$("friendsButton").addEventListener("click",()=>{$("friendsOverlay").hidden=false;});
$("closeFriendsButton").addEventListener("click",()=>{$("friendsOverlay").hidden=true;});
$("friendsOverlay").addEventListener("click",e=>{if(e.target===$("friendsOverlay"))$("friendsOverlay").hidden=true;});
document.querySelectorAll(".friends-tab").forEach(b=>b.addEventListener("click",()=>showTab(b.dataset.friendsTab)));
$("friendSearchButton").addEventListener("click",searchPlayer);
$("friendSearchInput").addEventListener("keydown",e=>{if(e.key==="Enter")searchPlayer();});
$("copyFriendCode").addEventListener("click",async()=>{if(friendCode)try{await navigator.clipboard.writeText(friendCode);say("Friend ID copied.");}catch{say("Your Friend ID is "+friendCode);}});
onAuthStateChanged(auth,async u=>{
 user=u;stopListeners();friendCode="";friends={};requests={};invites={};
 $("myFriendCode").textContent=u?"Creating your ID…":"Sign in with Google to get a Friend ID";
 if(!u){say("Sign in with Google to use friends and invitations.");renderFriends();renderInbox();return;}
 try{await ensureProfile(u);$("myFriendCode").textContent=friendCode;listenSocial();listenAccepted();renderFriends();renderInbox();say("Your Friend ID is ready. Share it so friends can find you.");}
 catch(e){say(e.message||"Could not set up your player profile.");}
});
