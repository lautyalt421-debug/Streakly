// Streakly v1.1.2 - local-first + splash + theme fixes
const MAX_FREE = 3;
let unlockedSlots = parseInt(localStorage.getItem('unlockedSlots')||MAX_FREE,10);
let streaks = JSON.parse(localStorage.getItem('streaks')||'[]');
let activeId = localStorage.getItem('activeId') || (streaks[0] && streaks[0].id) || null;
const isGuest = true; // por ahora modo invitado (sin login)

const el = id => document.getElementById(id);

// Utils
const uid = ()=> Date.now().toString(36) + Math.random().toString(36).slice(2,6);
const save = ()=> { localStorage.setItem('streaks', JSON.stringify(streaks)); localStorage.setItem('unlockedSlots', unlockedSlots); localStorage.setItem('activeId', activeId); }

// Motivational phrases por rango
function phraseForDays(d){
  if(d<=0) return "Cada comienzo es valioso.";
  if(d<3) return "Estás construyendo impulso.";
  if(d<7) return "Una semana no es suerte.";
  if(d<30) return "Tu identidad está cambiando.";
  if(d<100) return "Esto ya es parte de quién sos.";
  return "Eres el hábito manifestado.";
}

// Time formatting
function formatDiff(ms){
  if(ms<0) ms=0;
  const s = Math.floor(ms/1000)%60;
  const m = Math.floor(ms/60000)%60;
  const h = Math.floor(ms/3600000)%24;
  const d = Math.floor(ms/86400000);
  return `${d} días ${h} horas ${m} minutos ${s} segundos`;
}

// Theme restore asap to avoid flash
(function(){
  const t = localStorage.getItem('theme') || 'light';
  document.body.classList.add(t);
})();

// Splash handling (Op A)
function hideSplash(){
  const splash = document.getElementById('splash');
  if(!splash) return;
  splash.style.opacity = '0';
  setTimeout(()=> splash.remove(), 450);
}
// show splash briefly then hide
window.addEventListener('load', ()=> {
  // keep splash visible 800-1100ms
  setTimeout(hideSplash, 900);
});

// Render
function render(){
  // Active
  const active = streaks.find(s=>s.id===activeId) || null;
  el('activeName').innerText = active ? active.name : '— Sin racha activa —';
  if(active){
    const now = Date.now();
    document.querySelectorAll('.active-counter').forEach(n=>n.innerText = formatDiff(now - active.start));
    el('phrase').innerText = phraseForDays(Math.floor((Date.now()-active.start)/86400000));
    el('activeStats').innerHTML = `
      <div>Inicio: ${new Date(active.start).toLocaleDateString()}</div>
      <div>Récord: ${active.record || 0} días</div>
      <div>Reinicios: ${active.resets||0}</div>
    `;
  } else {
    el('activeCounter').innerText = '0 días 0 horas 0 minutos 0 segundos';
    el('activeStats').innerHTML = '';
  }

  // List
  const list = el('streakList');
  list.innerHTML = '';
  streaks.forEach(s=>{
    const div = document.createElement('div');
    div.className = 'streak-card';
    const left = document.createElement('div'); left.className='streak-info';
    const name = document.createElement('div'); name.className='streak-name'; name.innerText = s.name;
    const small = document.createElement('div'); small.className='small-counter';
    small.innerText = formatDiff(Date.now()-s.start);
    left.appendChild(name); left.appendChild(small);

    const right = document.createElement('div');
    const setBtn = document.createElement('button'); setBtn.className='small ghost'; setBtn.innerText = (s.id===activeId ? 'Activa' : 'Activar');
    setBtn.onclick = ()=>{ activeId = s.id; save(); render(); };
    const delBtn = document.createElement('button'); delBtn.className='small danger'; delBtn.innerText='Eliminar';
    delBtn.onclick = ()=>{ confirmModal(`Eliminar la racha "${s.name}"? Esta acción borra el registro.`, ()=>{
      streaks = streaks.filter(x=>x.id!==s.id);
      if(activeId===s.id) activeId = streaks[0] ? streaks[0].id : null;
      save(); render();
    }); };
    right.appendChild(setBtn); right.appendChild(delBtn);

    div.appendChild(left); div.appendChild(right);
    list.appendChild(div);
  });

  // guest notice and create button enable
  el('guestNotice').innerText = isGuest ? 'Modo invitado — tus datos están locales' : '';
  el('createBtn').disabled = (streaks.length >= unlockedSlots);
  el('watchAdBtn').disabled = (unlockedSlots >= 10); // cap
}
render();

// Update counters every second
setInterval(()=> { render(); }, 1000);

// UI actions
el('createBtn').onclick = ()=> {
  if(streaks.length >= unlockedSlots){
    showToast(`Límite de rachas gratis (${unlockedSlots}). Ver anuncio para +1.`);
    return;
  }
  inputModal('Crear racha', 'Nombre de la racha', '', (val)=>{
    if(!val) return showToast('El nombre no puede estar vacío.');
    const s = { id: uid(), name: val, start: Date.now(), resets:0, record:0 };
    streaks.push(s);
    activeId = s.id;
    save(); render();
  });
};

el('watchAdBtn').onclick = ()=> {
  showAdSimulation(()=> {
    unlockedSlots += 1;
    save();
    showToast('+1 racha desbloqueada');
    render();
  });
};

el('resetBtn').onclick = ()=> {
  if(!activeId) return showToast('No hay racha activa.');
  confirmModal(`¿Seguro? "Volver a empezar" reinicia la racha. Si sos honesto, tocá aceptar.`, ()=>{
    const s = streaks.find(x=>x.id===activeId);
    if(!s) return;
    const days = Math.floor((Date.now()-s.start)/86400000);
    if(days > s.record) s.record = days;
    s.start = Date.now();
    s.resets = (s.resets||0) + 1;
    save(); render();
    showToast('Nuevo comienzo. Bien por admitirlo.');
  });
};

el('editBtn').onclick = ()=> {
  if(!activeId) return showToast('No hay racha activa.');
  const s = streaks.find(x=>x.id===activeId);
  inputModal('Editar nombre de racha', 'Nombre', s.name, (val)=>{
    if(val){ s.name = val; save(); render(); }
  });
};

el('modeBtn').onclick = ()=> {
  document.body.classList.toggle('dark');
  document.body.classList.toggle('light');
  localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark':'light');
};

// Simple modal helpers
function confirmModal(text, okCb){
  modalOpen(`<div>${text}</div>`, 'Aceptar', okCb);
}
function inputModal(title, placeholder, val, okCb){
  modalOpen(`<div><strong>${title}</strong><div style="height:8px"></div><input id="modalInput" placeholder="${placeholder}" value="${val}" style="width:100%;padding:10px;border-radius:8px;border:1px solid rgba(0,0,0,0.06)"></div>`, 'Crear', ()=>{
    const v = document.getElementById('modalInput').value.trim();
    okCb(v);
  });
}

function modalOpen(html, okText='Aceptar', okCb=null){
  const m = el('modal'); m.classList.remove('hidden');
  el('modalContent').innerHTML = html;
  el('modalOk').innerText = okText;
  const cleanup = ()=>{ el('modal').classList.add('hidden'); el('modalOk').onclick = null; el('modalCancel').onclick = null; };
  el('modalCancel').onclick = ()=>{ cleanup(); };
  el('modalOk').onclick = ()=>{ if(okCb) okCb(); cleanup(); };
}

// Toast básico
function showToast(txt){
  const t = document.createElement('div'); t.innerText = txt;
  t.style.position='fixed'; t.style.left='50%'; t.style.transform='translateX(-50%)'; t.style.bottom='24px';
  t.style.background='rgba(0,0,0,0.7)'; t.style.color='white'; t.style.padding='10px 14px'; t.style.borderRadius='10px';
  document.body.appendChild(t);
  setTimeout(()=> t.style.opacity='0.0',2200);
  setTimeout(()=> t.remove(),3000);
}

// Simulación de anuncio (5s)
function showAdSimulation(cb){
  modalOpen('<div style="text-align:center;"><div>Reproduciendo anuncio...</div><div style="height:12px"></div><div class="spinner" style="height:6px;background:linear-gradient(90deg,var(--accent1),var(--accent2));border-radius:6px;width:80%;margin:0 auto;display:block"></div></div>','He visto', ()=>{
    cb && cb();
  });
}
