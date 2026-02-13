// script.js (module) - Streakly v1.3 completo
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

/* ---------- FIREBASE CONFIG ---------- */
const firebaseConfig = {
  apiKey: "AIzaSyDtgN1u0Twg34Std9E4_NmZ8tkhSb379Ik",
  authDomain: "streakly-be-yourself.firebaseapp.com",
  projectId: "streakly-be-yourself",
  storageBucket: "streakly-be-yourself.appspot.com",
  messagingSenderId: "455754798246",
  appId: "1:455754798246:web:03c7956876b4b6fd4a9067"
};
/* ------------------------------------- */

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

/* ---------- DOM HELPERS ---------- */
const $ = id => document.getElementById(id);
const show = el => el && el.classList.remove('hidden');
const hide = el => el && el.classList.add('hidden');
function showToast(txt, timeout=2200){
  const t = document.createElement('div'); t.innerText = txt;
  t.style.position='fixed'; t.style.left='50%'; t.style.transform='translateX(-50%)'; t.style.bottom='24px';
  t.style.background='rgba(0,0,0,0.75)'; t.style.color='white'; t.style.padding='10px 14px'; t.style.borderRadius='10px'; t.style.zIndex=99999;
  document.body.appendChild(t); setTimeout(()=> t.style.opacity='0',timeout); setTimeout(()=> t.remove(), timeout+300);
}

/* ---------- STATE ---------- */
const MAX_FREE = 3;
let unlockedSlots = MAX_FREE;
let streaks = [];
let activeId = null;
let currentUID = null;
let isGuest = true;

/* ---------- THEME ASAP ---------- */
(function(){ const t = localStorage.getItem('theme') || 'light'; document.body.classList.add(t); })();

/* ---------- SPLASH ---------- */
function startSplashAutoHide(minMs=700){
  const splash = $('splash'), progress = $('splashProgress');
  if(!splash || !progress) return Promise.resolve();
  return new Promise((res)=>{
    let pct=0;
    const tick = setInterval(()=> {
      pct += Math.floor(Math.random()*12)+6;
      if(pct>100) pct=100;
      progress.style.width = pct + '%';
      if(pct>=100){ clearInterval(tick); setTimeout(()=> { splash.style.opacity='0'; setTimeout(()=> { if(splash.parentNode) splash.parentNode.removeChild(splash); res(); },420); },120); }
    },110);
    setTimeout(()=> { if(pct<100){ progress.style.width='100%'; clearInterval(tick); splash.style.opacity='0'; setTimeout(()=> { if(splash.parentNode) splash.parentNode.removeChild(splash); res(); },420); } }, Math.max(1600,minMs));
  });
}

/* ---------- FIRESTORE ---------- */
async function saveToFirestore(uid){
  if(!uid) return;
  try { await setDoc(doc(db,'users',uid), { streaks, unlockedSlots, activeId }, { merge:true }); }
  catch(e){ console.error('saveToFirestore', e); }
}
async function loadUserData(uid){
  if(!uid) return;
  try {
    const ref = doc(db,'users',uid);
    const snap = await getDoc(ref);
    if(snap.exists()){
      const data = snap.data();
      streaks = Array.isArray(data.streaks) ? data.streaks : [];
      unlockedSlots = data.unlockedSlots || MAX_FREE;
      activeId = data.activeId || (streaks[0] && streaks[0].id) || null;
    } else {
      streaks = []; unlockedSlots = MAX_FREE; activeId = null; await saveToFirestore(uid);
    }
  } catch(e){ console.error('loadUserData', e); }
}

/* ---------- AUTH LISTENER ---------- */
onAuthStateChanged(auth, async (user) => {
  if(user){
    isGuest = false; currentUID = user.uid;
    $('signOutBtn') && $('signOutBtn').classList.remove('hidden');
    hide($('loginScreen'));
    await loadUserData(user.uid);
    startApp();
  } else {
    currentUID = null;
    if(!isGuest){ show($('loginScreen')); hide($('appRoot')); }
  }
});

/* ---------- AUTH ACTIONS (separadas) ---------- */
async function signInUser(){
  const email = $('authEmail')?.value.trim() || '';
  const pass = $('authPass')?.value.trim() || '';
  const msg = $('authMsg');
  if(msg) msg.innerText = '';
  if(!email || !pass){ if(msg) msg.innerText = 'Completá email y contraseña.'; return; }
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch(e){
    console.error('signin err', e);
    if(e.code === 'auth/user-not-found'){ if(msg) msg.innerText = 'Usuario no encontrado. Registrate abajo.'; }
    else { if(msg) msg.innerText = e.message || 'Error al iniciar sesión'; }
  }
}
async function registerUser(){
  const email = $('regEmail')?.value.trim() || '';
  const pass = $('regPass')?.value.trim() || '';
  const msg = $('regMsg');
  if(msg) msg.innerText = '';
  if(!email || !pass){ if(msg) msg.innerText = 'Completá email y contraseña.'; return; }
  if(pass.length < 6){ if(msg) msg.innerText = 'La contraseña debe tener al menos 6 caracteres.'; return; }
  try {
    await createUserWithEmailAndPassword(auth, email, pass);
  } catch(e){
    console.error('register err', e);
    if(msg) msg.innerText = e.message || 'Error al registrarse';
  }
}
async function signInWithGoogle(){
  try {
    await signInWithPopup(auth, googleProvider);
  } catch(e){
    console.error('google sign error', e);
    showToast('Error con Google: ' + (e.message || e.code));
  }
}

function enterGuest(){
  isGuest = true; currentUID = null;
  hide($('loginScreen'));
  unlockedSlots = parseInt(localStorage.getItem('unlockedSlots')||MAX_FREE,10);
  streaks = JSON.parse(localStorage.getItem('streaks')||'[]');
  activeId = localStorage.getItem('activeId') || (streaks[0] && streaks[0].id) || null;
  startApp();
}

async function signOutNow(){
  try { await signOut(auth); isGuest = true; currentUID = null; show($('loginScreen')); hide($('appRoot')); }
  catch(e){ console.error('signout', e); showToast('Error al cerrar sesión'); }
}

/* ---------- START APP ---------- */
function startApp(){ hide($('loginScreen')); show($('appRoot')); bindAppEvents(); render(); if(!window._ticker) window._ticker = setInterval(render,1000); }

function bindAppEvents(){
  $('signInBtn') && ($('signInBtn').onclick = signInUser);
  $('registerBtn') && ($('registerBtn').onclick = registerUser);
  $('googleBtn') && ($('googleBtn').onclick = signInWithGoogle);
  $('googleBtnReg') && ($('googleBtnReg').onclick = signInWithGoogle);
  $('guestBtn') && ($('guestBtn').onclick = enterGuest);
  $('guestBtnReg') && ($('guestBtnReg').onclick = enterGuest);
  $('showRegister') && ($('showRegister').onclick = ()=>{ hide($('loginForm')); hide($('authMsg')); show($('registerForm')); hide($('loginForm')); hide($('authMsg')); show($('registerForm')); });
  $('showLogin') && ($('showLogin').onclick = ()=>{ show($('loginForm')); hide($('registerForm')); });
  $('createBtn') && ($('createBtn').onclick = onCreate);
  $('watchAdBtn') && ($('watchAdBtn').onclick = onWatchAd);
  $('resetBtn') && ($('resetBtn').onclick = onReset);
  $('editBtn') && ($('editBtn').onclick = onEdit);
  $('signOutBtn') && ($('signOutBtn').onclick = signOutNow);
  $('modeBtn') && ($('modeBtn').onclick = toggleTheme);
}

/* ---------- RENDER ---------- */
function formatDiff(ms){ if(ms<0) ms=0; const s=Math.floor(ms/1000)%60; const m=Math.floor(ms/60000)%60; const h=Math.floor(ms/3600000)%24; const d=Math.floor(ms/86400000); return `${d} días ${h} horas ${m} minutos ${s} segundos`; }
function phraseForDays(d){ if(d<=0) return "Cada comienzo es valioso."; if(d<3) return "Estás construyendo impulso."; if(d<7) return "Una semana no es suerte."; if(d<30) return "Tu identidad está cambiando."; if(d<100) return "Esto ya es parte de quién sos."; return "Eres el hábito manifestado."; }

function render(){
  const active = streaks.find(s=>s.id===activeId) || null;
  if($('activeName')) $('activeName').innerText = active ? active.name : '— Sin racha activa —';
  if(active){ $('activeCounter') && ($('activeCounter').innerText = formatDiff(Date.now()-active.start)); $('phrase') && ($('phrase').innerText = phraseForDays(Math.floor((Date.now()-active.start)/86400000))); if($('activeStats')) $('activeStats').innerHTML = `<div>Inicio: ${new Date(active.start).toLocaleDateString()}</div><div>Récord: ${active.record||0} días</div><div>Reinicios: ${active.resets||0}</div>`; } else { $('activeCounter') && ($('activeCounter').innerText = '0 días 0 horas 0 minutos 0 segundos'); if($('activeStats')) $('activeStats').innerHTML = ''; }

  const list = $('streakList'); if(!list) return; list.innerHTML='';
  streaks.forEach(s=>{
    const card = document.createElement('div'); card.className='streak-card';
    const left = document.createElement('div'); left.className='streak-info';
    const name = document.createElement('div'); name.className='streak-name'; name.innerText = s.name;
    const small = document.createElement('div'); small.className='small-counter'; small.innerText = formatDiff(Date.now()-s.start);
    left.appendChild(name); left.appendChild(small);

    const right = document.createElement('div');
    const setBtn = document.createElement('button'); setBtn.className='small ghost'; setBtn.innerText = (s.id===activeId ? 'Activa' : 'Activar');
    setBtn.onclick = ()=>{ activeId = s.id; persist(); render(); };
    const delBtn = document.createElement('button'); delBtn.className='small danger'; delBtn.innerText = 'Eliminar';
    delBtn.onclick = ()=>{ confirmModal(`Eliminar "${s.name}"?`, ()=>{ streaks = streaks.filter(x=>x.id!==s.id); if(activeId===s.id) activeId = streaks[0] ? streaks[0].id : null; persist(); render(); }); };
    right.appendChild(setBtn); right.appendChild(delBtn);

    card.appendChild(left); card.appendChild(right);
    list.appendChild(card);
  });

  if($('guestNotice')) $('guestNotice').innerText = isGuest ? 'Modo invitado — tus datos están locales' : '';
  if($('createBtn')) $('createBtn').disabled = (streaks.length >= unlockedSlots);
  if($('watchAdBtn')) $('watchAdBtn').disabled = (unlockedSlots >= 10);
}

/* ---------- CRUD ---------- */
function uidGen(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

function onCreate(){
  if(streaks.length >= unlockedSlots){ showToast(`Límite de rachas gratis (${unlockedSlots}). Ver anuncio para +1.`); return; }
  inputModal('Crear racha','Nombre de la racha','', (val)=>{ if(!val) return showToast('El nombre no puede estar vacío.'); const s={id:uidGen(),name:val,start:Date.now(),resets:0,record:0}; streaks.push(s); activeId = s.id; persist(); render(); showToast('Racha creada'); });
}
function onWatchAd(){ showAdSimulation(()=>{ unlockedSlots +=1; persist(); showToast('+1 racha desbloqueada'); render(); }); }
function onReset(){ if(!activeId) return showToast('No hay racha activa.'); confirmModal('¿Seguro? "Volver a empezar" reinicia la racha. Si sos honesto, tocá aceptar.', ()=>{ const s = streaks.find(x=>x.id===activeId); if(!s) return; const days = Math.floor((Date.now()-s.start)/86400000); if(days > s.record) s.record = days; s.start = Date.now(); s.resets = (s.resets||0)+1; persist(); render(); showToast('Nuevo comienzo. Bien por admitirlo.'); }); }
function onEdit(){ if(!activeId) return showToast('No hay racha activa.'); const s = streaks.find(x=>x.id===activeId); inputModal('Editar nombre de racha','Nombre', s.name, (val)=>{ if(val){ s.name = val; persist(); render(); } }); }

/* ---------- PERSIST ---------- */
function persist(){ saveLocal(); if(!isGuest && currentUID) saveToFirestore(currentUID); }
function saveLocal(){ localStorage.setItem('streaks', JSON.stringify(streaks)); localStorage.setItem('unlockedSlots', unlockedSlots); localStorage.setItem('activeId', activeId); }

/* ---------- MODAL/TOAST ---------- */
function modalOpen(html, okText='Aceptar', okCb=null){ const m=$('modal'); if(!m) return; m.classList.remove('hidden'); $('modalContent').innerHTML = html; $('modalOk').innerText = okText; const cleanup = ()=>{ m.classList.add('hidden'); $('modalOk').onclick = null; $('modalCancel').onclick = null; }; $('modalCancel').onclick = ()=> cleanup(); $('modalOk').onclick = ()=> { if(okCb) okCb(); cleanup(); }; }
function confirmModal(text, okCb){ modalOpen(`<div>${text}</div>`,'Aceptar',okCb); }
function inputModal(title, placeholder='', val='', okCb){ const html = `<div><strong>${title}</strong><div style="height:8px"></div><input id="modalInput" placeholder="${placeholder}" value="${val}" style="width:100%;padding:10px;border-radius:8px;border:1px solid rgba(0,0,0,0.06)"></div>`; modalOpen(html,'Crear', ()=>{ const v = document.getElementById('modalInput') ? document.getElementById('modalInput').value.trim() : ''; okCb(v); }); }

/* ---------- SIMULATED AD ---------- */
function showAdSimulation(cb){ modalOpen('<div style="text-align:center;"><div>Reproduciendo anuncio...</div><div style="height:12px"></div><div style="height:6px;background:linear-gradient(90deg,var(--accent1),var(--accent2));border-radius:6px;width:80%;margin:0 auto;display:block"></div></div>','He visto', ()=>{ if(cb) cb(); }); }

/* ---------- THEME ---------- */
function toggleTheme(){ document.body.classList.toggle('dark'); document.body.classList.toggle('light'); localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light'); }

/* ---------- BOOTSTRAP (DOMContentLoaded) ---------- */
document.addEventListener('DOMContentLoaded', async ()=>{
  // initial binds for overlay controls
  bindAppEvents();
  await startSplashAutoHide(800);
  // show login by default
  if(!currentUID && isGuest){ show($('loginScreen')); hide($('appRoot')); }
});
