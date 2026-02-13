// script.js - Streakly v1.3.2
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

/* ----------------- FIREBASE CONFIG ----------------- */
/* Reemplaza por tu config si es necesario */
const firebaseConfig = {
  apiKey: "AIzaSyDtgN1u0Twg34Std9E4_NmZ8tkhSb379Ik",
  authDomain: "streakly-be-yourself.firebaseapp.com",
  projectId: "streakly-be-yourself",
  storageBucket: "streakly-be-yourself.appspot.com",
  messagingSenderId: "455754798246",
  appId: "1:455754798246:web:03c7956876b4b6fd4a9067"
};
/* -------------------------------------------------- */

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

/* ----------------- DOM helpers ----------------- */
const $ = id => document.getElementById(id);
const show = el => el && el.classList.remove('hidden');
const hide = el => el && el.classList.add('hidden');
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ----------------- App state ----------------- */
const MAX_FREE = 3;
let unlockedSlots = MAX_FREE;
let streaks = [];
let activeId = null;
let currentUID = null;
let isGuest = true;

/* ----------------- Splash progress ----------------- */
async function startSplashAutoHide() {
  const splash = $('splash'), prog = $('splashProgress');
  if(!splash || !prog) return;
  let pct = 0;
  return new Promise(res => {
    const tick = setInterval(() => {
      pct += Math.floor(Math.random()*10)+8;
      if(pct>100) pct = 100;
      prog.style.width = pct + '%';
      if(pct >= 100) {
        clearInterval(tick);
        splash.style.opacity = '0';
        setTimeout(()=> { if(splash.parentNode) splash.parentNode.removeChild(splash); res(); }, 420);
      }
    }, 90);
    // fallback
    setTimeout(()=> {
      if(pct < 100) {
        prog.style.width = '100%';
        clearInterval(tick);
        splash.style.opacity = '0';
        setTimeout(()=> { if(splash.parentNode) splash.parentNode.removeChild(splash); res(); }, 420);
      }
    }, 2200);
  });
}

/* ----------------- Firestore save/load ----------------- */
async function saveToFirestore(uid) {
  if(!uid) return;
  try { await setDoc(doc(db,'users',uid), { streaks, unlockedSlots, activeId }, { merge:true }); }
  catch(e){ console.error('saveToFirestore', e); }
}
async function loadUserData(uid) {
  if(!uid) return;
  try {
    const ref = doc(db,'users',uid);
    const snap = await getDoc(ref);
    if(snap.exists()) {
      const data = snap.data();
      streaks = Array.isArray(data.streaks) ? data.streaks : [];
      unlockedSlots = data.unlockedSlots || MAX_FREE;
      activeId = data.activeId || (streaks[0] && streaks[0].id) || null;
    } else {
      streaks = [];
      unlockedSlots = MAX_FREE;
      activeId = null;
      await saveToFirestore(uid);
    }
  } catch(e){ console.error('loadUserData', e); }
}

/* ----------------- Auth listener ----------------- */
onAuthStateChanged(auth, async (user) => {
  if(user) {
    isGuest = false; currentUID = user.uid;
    $('signOutBtn') && $('signOutBtn').classList.remove('hidden');
    hide($('loginScreen'));
    await loadUserData(user.uid);
    startApp();
  } else {
    currentUID = null;
    if(!isGuest) {
      show($('loginScreen'));
      hide($('appRoot'));
    }
  }
});

/* ----------------- Auth actions ----------------- */
async function signInUser(){
  const email = $('authEmail')?.value.trim() || '';
  const pass = $('authPass')?.value.trim() || '';
  const msg = $('authMsg'); if(msg) msg.innerText = '';
  if(!email || !pass){ if(msg) msg.innerText = 'Completá email y contraseña.'; return; }

  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch(e){
    console.error('signin err', e);
    if(e.code === 'auth/user-not-found') {
      if(msg) msg.innerText = 'Usuario no encontrado. Registrate abajo.';
    } else {
      if(msg) msg.innerText = e.message || 'Error al iniciar sesión';
    }
  }
}

async function registerUser(){
  const email = $('regEmail')?.value.trim() || '';
  const pass = $('regPass')?.value.trim() || '';
  const msg = $('regMsg'); if(msg) msg.innerText = '';
  if(!email || !pass){ if(msg) msg.innerText = 'Completá email y contraseña.'; return; }
  if(pass.length < 6){ if(msg) msg.innerText = 'La contraseña debe tener al menos 6 caracteres.'; return; }

  try {
    await createUserWithEmailAndPassword(auth, email, pass);
    runConfetti(30);
    showToast('Registro OK — Bienvenido 👋');
  } catch(e){
    console.error('register err', e);
    if(msg) msg.innerText = e.message || 'Error al registrarse';
  }
}

async function signInWithGoogle(){
  try {
    await signInWithPopup(auth, googleProvider);
    runConfetti(30);
  } catch(e){
    console.error('google sign error', e);
    showToast('Error con Google: ' + (e.message || e.code));
  }
}

/* ----------------- Guest ----------------- */
function enterGuest(){
  isGuest = true; currentUID = null;
  hide($('loginScreen'));
  unlockedSlots = parseInt(localStorage.getItem('unlockedSlots')||MAX_FREE,10);
  streaks = JSON.parse(localStorage.getItem('streaks')||'[]');
  activeId = localStorage.getItem('activeId') || (streaks[0] && streaks[0].id) || null;
  startApp();
}

async function signOutNow(){
  try {
    await signOut(auth);
    isGuest = true; currentUID = null;
    show($('loginScreen')); hide($('appRoot'));
  } catch(e){ console.error(e); showToast('Error al cerrar sesión'); }
}

/* ----------------- App start ----------------- */
function startApp(){
  hide($('loginScreen'));
  show($('appRoot'));
  bindAppEvents();
  render();
  if(!window._ticker) window._ticker = setInterval(render,1000);
}

/* ----------------- Bind events ----------------- */
function bindAppEvents(){
  // Auth
  $('signInBtn') && ($('signInBtn').onclick = signInUser);
  $('registerBtn') && ($('registerBtn').onclick = registerUser);
  $('googleBtn') && ($('googleBtn').onclick = signInWithGoogle);
  $('googleBtnReg') && ($('googleBtnReg').onclick = signInWithGoogle);
  $('guestBtn') && ($('guestBtn').onclick = enterGuest);
  $('guestBtnReg') && ($('guestBtnReg').onclick = enterGuest);
  $('showRegister') && ($('showRegister').onclick = ()=>{ hide($('loginForm')); hide($('authMsg')); show($('registerForm')); hide($('authMsg')); });
  $('showLogin') && ($('showLogin').onclick = ()=>{ show($('loginForm')); hide($('registerForm')); });
  // App
  $('createBtn') && ($('createBtn').onclick = onCreate);
  $('watchAdBtn') && ($('watchAdBtn').onclick = onWatchAd);
  $('resetBtn') && ($('resetBtn').onclick = onReset);
  $('editBtn') && ($('editBtn').onclick = onEdit);
  $('signOutBtn') && ($('signOutBtn').onclick = signOutNow);
  $('modeBtn') && ($('modeBtn').onclick = toggleTheme);
}

/* ----------------- Render / UI ----------------- */
function formatDiff(ms){
  if(ms < 0) ms = 0;
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

function render(){
  const active = streaks.find(s=>s.id===activeId) || null;
  if($('activeName')) $('activeName').innerText = active ? active.name : '— Sin racha activa —';
  if(active){
    if($('activeCounter')) {
      $('activeCounter').innerText = formatDiff(Date.now() - active.start);
      // small pop animation each render tick second
      $('activeCounter').classList.add('pop');
      setTimeout(()=> $('activeCounter') && $('activeCounter').classList.remove('pop'), 200);
    }
    if($('phrase')) $('phrase').innerText = phraseForDays(Math.floor((Date.now()-active.start)/86400000));
    if($('activeStats')) $('activeStats').innerHTML = `<div>Inicio: ${new Date(active.start).toLocaleDateString()}</div><div>Récord: ${active.record || 0} días</div><div>Reinicios: ${active.resets||0}</div>`;
  } else {
    if($('activeCounter')) $('activeCounter').innerText = '0 días 0 horas 0 minutos 0 segundos';
    if($('activeStats')) $('activeStats').innerHTML = '';
  }

  // list
  const list = $('streakList'); if(!list) return;
  list.innerHTML = '';
  streaks.forEach(s=>{
    const el = document.createElement('div'); el.className = 'streak-card';
    el.style.opacity = 0; el.style.transform = 'translateY(12px)';
    requestAnimationFrame(()=> { el.style.transition = 'all .36s var(--ease)'; el.style.opacity = 1; el.style.transform = 'translateY(0)'; });

    const left = document.createElement('div'); left.className='streak-info';
    const name = document.createElement('div'); name.className='streak-name'; name.innerText = s.name;
    const small = document.createElement('div'); small.className='small-counter'; small.innerText = formatDiff(Date.now()-s.start);
    left.appendChild(name); left.appendChild(small);

    const right = document.createElement('div');
    const setBtn = document.createElement('button'); setBtn.className = 'btn ghost'; setBtn.innerText = (s.id===activeId ? 'Activa' : 'Activar');
    setBtn.onclick = ()=>{ activeId = s.id; persist(); render(); showToast('Racha activada'); };
    const delBtn = document.createElement('button'); delBtn.className = 'btn danger'; delBtn.innerText = 'Eliminar';
    delBtn.onclick = ()=>{ confirmModal(`Eliminar "${s.name}"?`, ()=>{ streaks = streaks.filter(x=>x.id!==s.id); if(activeId===s.id) activeId = streaks[0] ? streaks[0].id : null; persist(); render(); }); };
    right.appendChild(setBtn); right.appendChild(delBtn);

    el.appendChild(left); el.appendChild(right);
    list.appendChild(el);
  });

  if($('guestNotice')) $('guestNotice').innerText = isGuest ? 'Modo invitado — tus datos están locales' : '';
  if($('createBtn')) $('createBtn').disabled = (streaks.length >= unlockedSlots);
  if($('watchAdBtn')) $('watchAdBtn').disabled = (unlockedSlots >= 10);
}

/* ----------------- CRUD & actions ----------------- */
function uidGen(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

function onCreate(){
  if(streaks.length >= unlockedSlots){ showToast(`Límite de rachas gratis (${unlockedSlots}). Ver anuncio para +1.`); return; }
  inputModal('Crear racha','Nombre de la racha','', (val)=>{
    if(!val) return showToast('El nombre no puede estar vacío.');
    const s = { id: uidGen(), name: val, start: Date.now(), resets:0, record:0 };
    streaks.unshift(s); activeId = s.id;
    persist(); render();
    showToast('Racha creada');
    runConfetti(16);
  });
}

function onWatchAd(){
  showAdSimulation(()=> {
    unlockedSlots += 1;
    persist();
    showToast('+1 racha desbloqueada');
    render();
  });
}

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
    runConfetti(8);
  });
}

function onEdit(){
  if(!activeId) return showToast('No hay racha activa.');
  const s = streaks.find(x=>x.id===activeId);
  inputModal('Editar nombre de racha','Nombre', s.name, (val)=>{ if(val){ s.name = val; persist(); render(); showToast('Nombre actualizado'); }});
}

/* ----------------- Persistence ----------------- */
function persist(){
  saveLocal();
  if(!isGuest && currentUID) saveToFirestore(currentUID);
}
function saveLocal(){ localStorage.setItem('streaks', JSON.stringify(streaks)); localStorage.setItem('unlockedSlots', unlockedSlots); localStorage.setItem('activeId', activeId); }

/* ----------------- Modal / Toast ----------------- */
function modalOpen(html, okText='Aceptar', okCb=null){
  const m=$('modal'); if(!m) return;
  m.classList.remove('hidden'); $('modalContent').innerHTML = html; $('modalOk').innerText = okText;
  const cleanup = ()=>{ m.classList.add('hidden'); $('modalOk').onclick = null; $('modalCancel').onclick = null; };
  $('modalCancel').onclick = ()=> cleanup();
  $('modalOk').onclick = ()=> { if(okCb) okCb(); cleanup(); };
}
function confirmModal(text, okCb){ modalOpen(`<div>${text}</div>`, 'Aceptar', okCb); }
function inputModal(title, placeholder='', val='', okCb){
  const html = `<div style="display:flex;flex-direction:column"><strong>${title}</strong><div style="height:8px"></div><input id="modalInput" placeholder="${placeholder}" value="${val}" style="padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.04);background:transparent;color:inherit"></div>`;
  modalOpen(html, 'Crear', ()=>{ const v=document.getElementById('modalInput')?document.getElementById('modalInput').value.trim():''; okCb(v); });
}
function showToast(txt, t=2000){
  const el = document.createElement('div'); el.innerText = txt; el.style.position='fixed'; el.style.left='50%'; el.style.bottom='24px'; el.style.transform='translateX(-50%)'; el.style.background='linear-gradient(90deg,var(--accent1),var(--accent2))'; el.style.color='#02101a'; el.style.padding='10px 14px'; el.style.borderRadius='12px'; el.style.zIndex=13000; el.style.boxShadow='0 12px 30px rgba(0,0,0,0.35)';
  document.body.appendChild(el); setTimeout(()=> el.style.opacity='0', t); setTimeout(()=> el.remove(), t+300);
}

/* ----------------- Simulated ad ----------------- */
function showAdSimulation(cb){
  modalOpen('<div style="text-align:center"><div>Reproduciendo anuncio...</div><div style="height:12px"></div><div style="height:8px;background:linear-gradient(90deg,var(--accent1),var(--accent2));border-radius:8px;width:80%;margin:0 auto"></div></div>','He visto', ()=>{ if(cb) cb(); });
}

/* ----------------- Confetti (small, lightweight) ----------------- */
function rand(min,max){ return Math.random()*(max-min)+min; }
function runConfetti(count=20){
  const layer = $('confettiLayer');
  if(!layer) return;
  const colors = [getComputedStyle(document.documentElement).getPropertyValue('--accent1').trim() || '#34E0D1', '#FFD166', '#FF7A6A', '#8C38C1', '#2C5AE5'];
  for(let i=0;i<count;i++){
    const el = document.createElement('div'); el.className='confetti';
    el.style.left = (rand(20,80)) + '%';
    el.style.top = '-10%';
    el.style.width = (rand(6,12))+'px';
    el.style.height = (rand(8,18))+'px';
    el.style.background = colors[Math.floor(rand(0,colors.length))];
    el.style.transform = `rotate(${rand(0,360)}deg)`;
    layer.appendChild(el);
    // animate
    const duration = rand(1000, 2200);
    el.animate([
      { transform: `translateY(0) rotate(${rand(0,360)}deg)`, opacity:1 },
      { transform: `translateY(${window.innerHeight + 200}px) rotate(${rand(360,720)}deg)`, opacity:0.2 }
    ], { duration: duration, easing: 'cubic-bezier(.2,.8,.25,1)'});
    setTimeout(()=> el.remove(), duration+100);
  }
}

/* ----------------- Theme toggle ----------------- */
function toggleTheme(){
  document.body.classList.toggle('light');
  localStorage.setItem('theme', document.body.classList.contains('light') ? 'light' : 'dark');
}

/* ----------------- Init / DOMContentLoaded ----------------- */
document.addEventListener('DOMContentLoaded', async ()=>{
  // Attach initial bindings
  bindAppEvents();

  // Splash then show login
  await startSplashAutoHide();
  // Show login by default if not auto-signed
  if(!currentUID && isGuest) {
    show($('loginScreen'));
    hide($('appRoot'));
  }
});

/* ----------------- Local helper load (if guest) ----------------- */
(function(){ // restore theme immediately
  const saved = localStorage.getItem('theme') || 'dark';
  if(saved === 'light') document.body.classList.add('light');
})();

/* ----------------- Local save/load used when guest ----------------- */
(function(){
  // on first load, try to hydrate local
  unlockedSlots = parseInt(localStorage.getItem('unlockedSlots')||MAX_FREE,10);
  streaks = JSON.parse(localStorage.getItem('streaks')||'[]');
  activeId = localStorage.getItem('activeId') || (streaks[0] && streaks[0].id) || null;
})();

/* ----------------- END ----------------- */
