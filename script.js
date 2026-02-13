// ---------------- Firebase setup ----------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

// Tu config de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDtgN1u0Twg34Std9E4_NmZ8tkhSb379Ik",
  authDomain: "streakly-be-yourself.firebaseapp.com",
  projectId: "streakly-be-yourself",
  storageBucket: "streakly-be-yourself.appspot.com",
  messagingSenderId: "455754798246",
  appId: "1:455754798246:web:03c7956876b4b6fd4a9067"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ---------------- Utils ----------------
function $(id){ return document.getElementById(id); }
function show(el){ el.classList.remove('hidden'); }
function hide(el){ el.classList.add('hidden'); }

// ---------------- Splash ----------------
const splash = $('splash');
const prog = $('splashProgress');
let pct = 0;
let tick = setInterval(() => {
  pct += 5;
  prog.style.width = pct + '%';
  if(pct>=100){
    clearInterval(tick);
    splash.style.opacity = '0';
    setTimeout(()=> splash.remove(), 420);
  }
},110);

// ---------------- Auth flow ----------------
let isGuest = false;
let currentUID = null;
onAuthStateChanged(auth, async user => {
  if(user){
    isGuest = false;
    currentUID = user.uid;
    $('signOutBtn').classList.remove('hidden');
    hide($('loginScreen'));
    await loadUserData(user.uid);
    startApp();
  } else if(!isGuest){
    show($('loginScreen'));
    hide($('appRoot'));
  }
});

// ---------------- Login/Register ----------------
async function attemptAuth(){
  const email = $('authEmail').value.trim();
  const pass = $('authPass').value.trim();
  const msg = $('authMsg');
  msg.innerText = '';
  if(!email || !pass){ msg.innerText = 'Completá email y contraseña.'; return; }

  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch(e){
    if(e.code === 'auth/user-not-found' || e.code === 'auth/invalid-email'){
      try { await createUserWithEmailAndPassword(auth, email, pass); } 
      catch(err){ msg.innerText = err.message; }
    } else { msg.innerText = e.message; }
  }
}

// ---------------- Guest ----------------
function enterGuest(){
  isGuest = true;
  currentUID = null;
  hide($('loginScreen'));
  startApp();
}

// ---------------- Sign out ----------------
async function signOutNow(){
  try {
    await signOut(auth);
    isGuest = true;
    currentUID = null;
    show($('loginScreen'));
    hide($('appRoot'));
  } catch(e){ alert('Error al cerrar sesión'); }
}

// ---------------- App ----------------
function startApp(){
  hide($('loginScreen'));
  show($('appRoot'));
  bindAppEvents();
  render();
  setInterval(render, 1000);
}

function bindAppEvents(){
  $('createBtn').onclick = onCreate;
  $('watchAdBtn').onclick = onWatchAd;
  $('resetBtn').onclick = onReset;
  $('editBtn').onclick = onEdit;
  $('modeBtn').onclick = toggleTheme;
}

// ---------------- Renders / Funciones de rachas ----------------
function render(){
  // Aquí va tu código para mostrar rachas, contador, frases motivacionales, etc.
}

// ---------------- Funciones dummy ----------------
async function loadUserData(uid){ /* cargar rachas desde Firestore si querés */ }
function onCreate(){ /* crear nueva racha */ }
function onWatchAd(){ /* desbloquear slot extra */ }
function onReset(){ /* resetear racha */ }
function onEdit(){ /* editar racha */ }
function toggleTheme(){ /* modo normal / noche */ }
