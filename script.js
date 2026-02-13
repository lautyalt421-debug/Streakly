// script.js (type=module)
// Streakly v1.2.0: modular Firebase (v12) + Auth (email) + Firestore storage
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDtgN1u0Twg34Std9E4_NmZ8tkhSb379Ik",
  authDomain: "streakly-be-yourself.firebaseapp.com",
  projectId: "streakly-be-yourself",
  storageBucket: "streakly-be-yourself.firebasestorage.app",
  messagingSenderId: "455754798246",
  appId: "1:455754798246:web:03c7956876b4b6fd4a9067"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
};
// --------------------------------------------------------------------

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM helpers
const $ = id => document.getElementById(id);
const show = el => el && el.classList.remove('hidden');
const hide = el => el && el.classList.add('hidden');

// APP STATE
const MAX_FREE = 3;
let unlockedSlots = MAX_FREE;
let streaks = []; // local state (array of {id,name,start,resets,record})
let activeId = null;
let currentUID = null;
let isGuest = true;

// Theme restore asap
(function(){
  const saved = localStorage.getItem('theme') || 'light';
  document.body.classList.add(saved);
})();

// Splash + init flow
document.addEventListener('DOMContentLoaded', ()=>{
  // wire auth UI
  $('authBtn').onclick = attemptAuth;
  $('guestBtn').onclick = enterGuest;
  $('signOutBtn').onclick = signOutNow;
  $('modeBtn').onclick = toggleTheme;

  // splash progress
  const splash = $('splash'), prog = $('splashProgress');
  let pct = 0;
  const tick = setInterval(()=>{
    pct += Math.floor(Math.random()*12)+8;
    if(pct>100) pct=100;
    prog.style.width = pct + '%';
    if(pct>=100){
      clearInterval(tick);
      splash.style.opacity = '0';
      setTimeout(()=> splash.remove(), 420);
      // at this point wait for auth state event to continue
    }
  },110);
});

// AUTH FLOW: listen for state changes
onAuthStateChanged(auth, async user => {
  if(user){
    // logged in
    isGuest = false;
    currentUID = user.uid;
    $('signOutBtn').classList.remove('hidden');
    hide($('loginScreen'));
    await loadUserData(user.uid);
    startApp();
  } else {
    // not logged in: show login screen unless guest local data exists
    // keep guest as default until user picks otherwise
    if(!isGuest){
      // user explicitly signed out -> return to login
      show($('loginScreen'));
      hide($('appRoot'));
    }
  }
});

// Attempt to sign in or register
async function attemptAuth(){
  const email = $('authEmail').value.trim();
  const pass = $('authPass').value.trim();
  const msg = $('authMsg');
  msg.innerText = '';
  if(!email || !pass){ msg.innerText = 'Completá email y contraseña.'; return; }

  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    // onAuthStateChanged will take it from here
  } catch(e){
    // if user not found, try register
    if(e.code === 'auth/user-not-found' || e.code === 'auth/invalid-email'){
      try {
        const reg = await createUserWithEmailAndPassword(auth, email, pass);
        // onAuthStateChanged will run
      } catch(err){
        msg.innerText = err.message;
      }
    } else {
      msg.innerText = e.message;
    }
  }
}

// Guest flow: load local data and start
function enterGuest(){
  isGuest = true;
  currentUID = null;
  hide($('loginScreen'));
  // load from localStorage
  unlockedSlots = parseInt(localStorage.getItem('unlockedSlots')||MAX_FREE,10);
  streaks = JSON.parse(localStorage.getItem('streaks')||'[]');
  activeId = localStorage.getItem('activeId') || (streaks[0] && streaks[0].id) || null;
  startApp();
}

// Sign out function
async function signOutNow(){
  try {
    await signOut(auth);
    // clear UI and show login
    isGuest = true;
    currentUID = null;
    show($('loginScreen'));
    hide($('appRoot'));
    // keep local state intact
  } catch(e){
    showToast('Error al cerrar sesión.');
  }
}

/* ---------- App initialization (after auth or guest) ---------- */
function startApp(){
  hide($('loginScreen'));
  show($('appRoot'));
  // if user is authenticated, try to ensure unlockedSlots from backend
  // render UI and handlers
  bindAppEvents();
  render();
  // start 1s ticker
  setInterval(render, 1000);
}

function bindAppEvents(){
  $('createBtn').onclick = onCreate;
  $('watchAdBtn').onclick = onWatchAd;
  $('resetBtn').onclick = onReset;
  $('editBtn').onclick = onEdit;
}

// Utilities
const uidGen = ()=> Date.now().toString(36) + Math.random().toString(36).slice(2,6);
function saveLocal(){
  localStorage.setItem('streaks', JSON.stringify(streaks));
  localStorage.setItem('unlockedSlots', unlockedSlots);
  localStorage.setItem('activeId', activeId);
}
// Firestore save (per-user doc)
async function saveToFirestore(uid){
  if(!uid) return;
  try {
    const ref = doc(db, 'users', uid);
    await setDoc(ref, { streaks, unlockedSlots, activeId }, { merge: true });
  } catch(e){
    console.error('saveToFirestore', e);
  }
}
async function loadUserData(uid){
  // read doc
  try {
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    if(snap.exists()){
      const data = snap.data();
      streaks = Array.isArray(data.streaks) ? data.streaks : [];
      unlockedSlots = data.unlockedSlots || MAX_FREE;
      activeId = data.activeId || (streaks[0] && streaks[0].id) || null;
    } else {
      // new user: init defaults
      streaks = [];
      unlockedSlots = MAX_FREE;
      activeId = null;
      await saveToFirestore(uid);
    }
  } catch(e){
    console.error('loadUserData', e);
  }
}

// Time / phrase helpers
function formatDiff(ms){
  if(ms<0) ms=0;
  const s = Math.floor(ms/1000)%60;
  const m = Math.floor(ms/60000)%60;
  const h = Math.floor(ms/3600000)%24;
  const d = Math.floor(ms/86400000);
  return `${d} días ${h} horas ${m} minutos ${s} segundos`;
}
function phraseForDays(d){
  if(d<=0) return "Cada comienzo es valioso.";
  if(d<3) return "Estás construyendo impulso.";
  if(d<7) return "Una semana no es suerte.";
  if(d<30) return "Tu identidad está cambiando.";
  if(d<100) return "Esto ya es parte de quién sos.";
  return "Eres el hábito manifestado.";
}

// Render UI
function render(){
  // active
  const active = streaks.find(s=>s.id===activeId) || null;
  $('activeName').innerText = active ? active.name : '— Sin racha activa —';
  if(active){
    $('activeCounter').innerText = formatDiff(Date.now()-active.start);
    $('phrase').innerText = phraseForDays(Math.floor((Date.now()-active.start)/86400000));
    $('activeStats').innerHTML = `<div>Inicio: ${new Date(active.start).toLocaleDateString()}</div>
      <div>Récord: ${active.record || 0} días</div>
      <div>Reinicios: ${active.resets||0}</div>`;
  } else {
    $('activeCounter').innerText = '0 días 0 horas 0 minutos 0 segundos';
    $('activeStats').innerHTML = '';
  }

  // list
  const list = $('streakList'); if(!list) return;
  list.innerHTML = '';
  streaks.forEach(s=>{
    const row = document.createElement('div'); row.className='streak-card';
    const left = document.createElement('div'); left.className='streak-info';
    const name = document.createElement('div'); name.className='streak-name'; name.innerText = s.name;
    const small = document.createElement('div'); small.className='small-counter'; small.innerText = formatDiff(Date.now()-s.start);
    left.appendChild(name); left.appendChild(small);

    const right = document.createElement('div');
    const setBtn = document.createElement('button'); setBtn.className='small ghost'; setBtn.innerText = (s.id===activeId ? 'Activa' : 'Activar');
    setBtn.onclick = ()=>{ activeId = s.id; persist(); render(); };
    const delBtn = document.createElement('button'); delBtn.className='small danger'; delBtn.innerText='Eliminar';
    delBtn.onclick = ()=>{ confirmModal(`Eliminar "${s.name}"?`, ()=>{
      streaks = streaks.filter(x=>x.id!==s.id);
      if(activeId===s.id) activeId = streaks[0] ? streaks[0].id : null;
      persist(); render();
    }); };
    right.appendChild(setBtn); right.appendChild(delBtn);

    row.appendChild(left); row.appendChild(right);
    list.appendChild(row);
  });

  // UI states
  $('guestNotice').innerText = isGuest ? 'Modo invitado — tus datos están locales' : '';
  $('createBtn').disabled = (streaks.length >= unlockedSlots);
  $('watchAdBtn').disabled = (unlockedSlots >= 10);
}

// Create streak
function onCreate(){
  if(streaks.length >= unlockedSlots){ showToast(`Límite gratis (${unlockedSlots}). Ver anuncio para +1.`); return; }
  inputModal('Crear racha','Nombre de la racha','', (val)=>{
    if(!val) return showToast('El nombre no puede estar vacío.');
    const s = { id: uidGen(), name: val, start: Date.now(), resets:0, record:0 };
    streaks.push(s); activeId = s.id;
    persist(); render();
    showToast('Racha creada');
  });
}

// Simulated ad unlock
function onWatchAd(){
  showAdSimulation(()=> {
    unlockedSlots += 1;
    persist();
    showToast('+1 racha desbloqueada');
    render();
  });
}

// Reset active
function onReset(){
  if(!activeId) return showToast('No hay racha activa.');
  confirmModal('¿Seguro? "Volver a empezar" reinicia la racha. Si sos honesto, tocá aceptar.', ()=>{
    const s = streaks.find(x=>x.id===activeId);
    if(!s) return;
    const days = Math.floor((Date.now()-s.start)/86400000);
    if(days > s.record) s.record = days;
    s.start = Date.now();
    s.resets = (s.resets||0) + 1;
    persist(); render();
    showToast('Nuevo comienzo. Bien por admitirlo.');
  });
}

// Edit active
function onEdit(){
  if(!activeId) return showToast('No hay racha activa.');
  const s = streaks.find(x=>x.id===activeId);
  inputModal('Editar nombre de racha','Nombre', s.name, (val)=>{ if(val){ s.name = val; persist(); render(); }});
}

// Persist depending on guest/auth
function persist(){
  saveLocal();
  if(!isGuest && currentUID) saveToFirestore(currentUID);
}

// Modal helpers
function confirmModal(text, okCb){
  modalOpen(`<div>${text}</div>`, 'Aceptar', okCb);
}
function inputModal(title, placeholder, val, okCb){
  modalOpen(`<div><strong>${title}</strong><div style="height:8px"></div><input id="modalInput" placeholder="${placeholder}" value="${val}" style="width:100%;padding:10px;border-radius:8px;border:1px solid rgba(0,0,0,0.06)"></div>`, 'Crear', ()=>{
    const v = document.getElementById('modalInput') ? document.getElementById('modalInput').value.trim() : '';
    okCb(v);
  });
}
function modalOpen(html, okText='Aceptar', okCb=null){
  const m = $('modal'); if(!m) return;
  m.classList.remove('hidden'); $('modalContent').innerHTML = html; $('modalOk').innerText = okText;
  const cleanup = ()=>{ m.classList.add('hidden'); $('modalOk').onclick = null; $('modalCancel').onclick = null; };
  $('modalCancel').onclick = ()=> cleanup();
  $('modalOk').onclick = ()=> { if(okCb) okCb(); cleanup(); };
}

// Toast
function showToast(txt){
  const t = document.createElement('div'); t.innerText = txt;
  t.style.position='fixed'; t.style.left='50%'; t.style.transform='translateX(-50%)'; t.style.bottom='24px';
  t.style.background='rgba(0,0,0,0.75)'; t.style.color='white'; t.style.padding='10px 14px'; t.style.borderRadius='10px'; t.style.zIndex=99999;
  document.body.appendChild(t); setTimeout(()=> t.style.opacity='0',2200); setTimeout(()=> t.remove(),3000);
}

// Simulated ad modal
function showAdSimulation(cb){
  modalOpen('<div style="text-align:center;"><div>Reproduciendo anuncio...</div><div style="height:12px"></div><div style="height:6px;background:linear-gradient(90deg,var(--accent1),var(--accent2));border-radius:6px;width:80%;margin:0 auto;display:block"></div></div>','He visto', ()=>{
    cb && cb();
  });
}

// Theme toggle
function toggleTheme(){
  document.body.classList.toggle('dark'); document.body.classList.toggle('light');
  localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark':'light');
}

// Persist local helper
function saveLocal(){ localStorage.setItem('streaks', JSON.stringify(streaks)); localStorage.setItem('unlockedSlots', unlockedSlots); localStorage.setItem('activeId', activeId); }

// Sign-out helper already above

// End of script
