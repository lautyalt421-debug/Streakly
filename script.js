let streakStart = localStorage.getItem("streakStart");

if (!streakStart) {
  streakStart = null;
}

function startStreak() {
  if (!streakStart) {
    streakStart = new Date().getTime();
    localStorage.setItem("streakStart", streakStart);
  }
}

function resetStreak() {
  localStorage.removeItem("streakStart");
  streakStart = null;
  document.getElementById("counter").innerText =
    "0 días 0 horas 0 minutos 0 segundos";
}

function updateCounter() {
  if (!streakStart) return;

  const now = new Date().getTime();
  const diff = now - streakStart;

  const seconds = Math.floor(diff / 1000) % 60;
  const minutes = Math.floor(diff / (1000 * 60)) % 60;
  const hours = Math.floor(diff / (1000 * 60 * 60)) % 24;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  document.getElementById("counter").innerText =
    `${days} días ${hours} horas ${minutes} minutos ${seconds} segundos`;
}

function toggleMode() {
  document.body.classList.toggle("dark");
  document.body.classList.toggle("light");
}

setInterval(updateCounter, 1000);

// Modo inicial
document.body.classList.add("light");
