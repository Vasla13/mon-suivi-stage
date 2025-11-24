import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  signInWithPopup,
  signInAnonymously,
  GithubAuthProvider,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ==========================================
// 🔴 CONFIGURATION FIREBASE & UID
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyCGMFmFQ8KIqJoj9zXzH194V8L5epRsBeg",
  authDomain: "mon-suivi-stage.firebaseapp.com",
  projectId: "mon-suivi-stage",
  storageBucket: "mon-suivi-stage.firebasestorage.app",
  messagingSenderId: "134252253002",
  appId: "1:134252253002:web:fd5a8585299b6d58047bb3",
  measurementId: "G-GL4HPEBLRW",
};

const ADMIN_UID = "fAQazTtXxgWQXf8snjT6BankcUK2";
// ==========================================

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const stagesCollection = collection(db, "stages");
const provider = new GithubAuthProvider();

let isAdmin = false;
let allStages = [];
let filteredStages = [];
let myChart = null;

// --- DARK MODE ---
const btnTheme = document.getElementById("btnTheme");
const htmlEl = document.documentElement;
if (localStorage.getItem("theme") === "dark") {
  htmlEl.setAttribute("data-bs-theme", "dark");
  btnTheme.innerHTML = '<i class="bi bi-sun-fill"></i>';
}
btnTheme.addEventListener("click", () => {
  const isDark = htmlEl.getAttribute("data-bs-theme") === "dark";
  htmlEl.setAttribute("data-bs-theme", isDark ? "light" : "dark");
  btnTheme.innerHTML = isDark
    ? '<i class="bi bi-moon-stars-fill"></i>'
    : '<i class="bi bi-sun-fill"></i>';
  localStorage.setItem("theme", isDark ? "light" : "dark");
});

// --- AUTH ---
onAuthStateChanged(auth, (user) => {
  if (user) {
    isAdmin = user.uid === ADMIN_UID;
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("app-content").style.display = "block";

    if (user.photoURL)
      document.getElementById("userAvatar").src = user.photoURL;
    else
      document.getElementById("userAvatar").src =
        "https://ui-avatars.com/api/?name=Invité&background=random";

    const badge = document.getElementById("userStatus");
    const btn = document.getElementById("btnNouveau");

    if (isAdmin) {
      badge.className = "badge bg-primary";
      badge.innerText = "Admin";
      btn.classList.remove("admin-only");
    } else {
      badge.className = "badge bg-secondary";
      badge.innerText = "Invité (Lecture)";
      btn.classList.add("admin-only");
    }
    chargerDonnees();
  } else {
    document.getElementById("login-screen").style.display = "flex";
    document.getElementById("app-content").style.display = "none";
  }
});

document
  .getElementById("btnGithubLogin")
  .addEventListener("click", () =>
    signInWithPopup(auth, provider).catch((e) => alert(e.message))
  );
document
  .getElementById("btnGuestLogin")
  .addEventListener("click", () =>
    signInAnonymously(auth).catch((e) => alert(e.message))
  );
document
  .getElementById("btnLogout")
  .addEventListener("click", () => signOut(auth));

// --- UTILITAIRES ---
function getDaysDiff(dateString) {
  if (!dateString) return 0;
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

// --- DATA ---
function chargerDonnees() {
  onSnapshot(stagesCollection, (snapshot) => {
    allStages = [];
    let stats = {
      total: 0,
      attente: 0,
      entretien: 0,
      suite: 0,
      valide: 0,
      refuse: 0,
    };

    snapshot.forEach((docSnapshot) => {
      let data = docSnapshot.data();
      data.id = docSnapshot.id;

      if (
        isAdmin &&
        (data.etat === "En attente" || data.etat === "Suite Entretien") &&
        data.dateEnvoi
      ) {
        const daysElapsed = getDaysDiff(data.dateEnvoi);
        if (daysElapsed > 21) {
          updateDoc(doc(db, "stages", data.id), {
            etat: "Refusé",
            notes: (data.notes || "") + " \n[Auto] > 21j sans rép.",
          });
          data.etat = "Refusé";
        }
      }

      allStages.push(data);
      stats.total++;
      if (data.etat === "En attente") stats.attente++;
      if (data.etat === "Entretien") stats.entretien++;
      if (data.etat === "Suite Entretien") stats.suite++;
      if (data.etat === "Validé") stats.valide++;
      if (data.etat === "Refusé") stats.refuse++;
    });

    allStages.sort((a, b) => {
      const isPrioA = a.etat === "Entretien" || a.etat === "Suite Entretien";
      const isPrioB = b.etat === "Entretien" || b.etat === "Suite Entretien";
      if (isPrioA && !isPrioB) return -1;
      if (!isPrioA && isPrioB) return 1;
      if (a.dateRelance && !b.dateRelance) return -1;
      if (!a.dateRelance && b.dateRelance) return 1;
      return 0;
    });

    document.getElementById("loading").style.display = "none";
    updateStats(stats);
    applyFilters();
  });
}

function updateStats(stats) {
  const c = document.getElementById("stats-numbers");
  c.innerHTML = `
        <div class="col-4 mb-2"><div class="p-2 bg-primary text-white rounded shadow-sm"><h4 class="m-0 fw-bold">${stats.total}</h4><small style="font-size:0.6em">TOTAL</small></div></div>
        <div class="col-4 mb-2"><div class="p-2 bg-body-tertiary border border-warning text-warning rounded shadow-sm"><h4 class="m-0 fw-bold">${stats.attente}</h4><small style="font-size:0.6em">ATTENTE</small></div></div>
        <div class="col-4 mb-2"><div class="p-2 bg-info text-dark rounded shadow-sm"><h4 class="m-0 fw-bold">${stats.entretien}</h4><small style="font-size:0.6em">ENTR. PRÉVU</small></div></div>
        <div class="col-6"><div class="p-2 text-white rounded shadow-sm" style="background-color: #6610f2;"><h4 class="m-0 fw-bold">${stats.suite}</h4><small style="font-size:0.6em">SUITE</small></div></div>
        <div class="col-6"><div class="p-2 bg-success text-white rounded shadow-sm"><h4 class="m-0 fw-bold">${stats.valide}</h4><small style="font-size:0.6em">VALIDÉ</small></div></div>
    `;
  if (myChart) myChart.destroy();
  const ctx = document.getElementById("statsChart");
  let data = [
    stats.attente,
    stats.entretien,
    stats.suite,
    stats.valide,
    stats.refuse,
  ];
  if (stats.total === 0) data = [1];
  myChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: [],
      datasets: [
        {
          data: data,
          backgroundColor: [
            "#ffc107",
            "#0dcaf0",
            "#6610f2",
            "#198754",
            "#dc3545",
          ],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
    },
  });
}

const searchInput = document.getElementById("searchInput");
const filterBtns = document.querySelectorAll(".filter-btn");
let currentStatusFilter = "all";

searchInput.addEventListener("input", applyFilters);
filterBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    filterBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentStatusFilter = btn.dataset.filter;
    applyFilters();
  });
});

function applyFilters() {
  const term = searchInput.value.toLowerCase();
  filteredStages = allStages.filter((s) => {
    const matchText =
      s.entreprise.toLowerCase().includes(term) ||
      s.poste.toLowerCase().includes(term);
    const matchStatus =
      currentStatusFilter === "all" || s.etat === currentStatusFilter;
    return matchText && matchStatus;
  });
  renderTable(filteredStages);
}

function renderTable(stages) {
  const tbody = document.getElementById("stages-table-body");
  const today = new Date().toISOString().split("T")[0];
  let html = "";

  stages.forEach((stage) => {
    let dateHtml = '<span class="text-muted text-opacity-50 small">-</span>';

    if (stage.etat === "En attente" || stage.etat === "Suite Entretien") {
      let daysCounter = "";
      if (stage.dateEnvoi) {
        const days = getDaysDiff(stage.dateEnvoi);
        const color =
          days > 14
            ? "text-danger fw-bold"
            : days > 7
            ? "text-warning"
            : "text-muted";
        daysCounter = `<span class="${color} small ms-1">(${days}j)</span>`;
      }
      if (stage.dateRelance) {
        if (stage.dateRelance < today)
          dateHtml = `<div class="text-danger fw-bold small"><i class="bi bi-exclamation-circle-fill"></i> Relance: ${stage.dateRelance} ${daysCounter}</div>`;
        else if (stage.dateRelance === today)
          dateHtml = `<span class="badge bg-warning text-dark border border-dark">Relance: AUJ.</span> ${daysCounter}`;
        else
          dateHtml = `<span class="text-secondary small"><i class="bi bi-clock"></i> Relance: ${stage.dateRelance} ${daysCounter}</span>`;
      } else if (daysCounter) {
        dateHtml = `<span class="text-muted small">En cours ${daysCounter}</span>`;
      }
    } else {
      if (stage.dateStatut) {
        let color = "text-muted";
        if (stage.etat === "Refusé") color = "text-danger";
        if (stage.etat === "Validé") color = "text-success";
        if (stage.etat === "Entretien") color = "text-info";
        dateHtml = `<span class="${color} small fw-bold"><i class="bi bi-calendar-check"></i> ${stage.dateStatut}</span>`;
      }
    }

    let badgeClass = "bg-warning text-dark bg-opacity-75";
    if (stage.etat === "Validé") badgeClass = "bg-success";
    if (stage.etat === "Refusé") badgeClass = "bg-danger";
    if (stage.etat === "Entretien") badgeClass = "bg-info text-dark";
    if (stage.etat === "Suite Entretien") badgeClass = "bg-primary text-white";

    let links = "";
    if (stage.lien)
      links += `<a href="${stage.lien}" target="_blank" class="text-secondary me-2"><i class="bi bi-link-45deg"></i></a>`;
    if (isAdmin && stage.lienMail)
      links += `<a href="${stage.lienMail}" target="_blank" class="text-primary"><i class="bi bi-envelope-at-fill"></i></a>`;

    let actions = isAdmin
      ? `<div class="btn-group"><button class="btn btn-sm btn-outline-secondary btn-edit" onclick="editStage('${stage.id}')"><i class="bi bi-pencil-fill"></i></button><button class="btn btn-sm btn-outline-danger btn-delete" onclick="deleteStage('${stage.id}')"><i class="bi bi-trash-fill"></i></button></div>`
      : "";

    // LOGO AUTOMATIQUE
    const logoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(
      stage.entreprise
    )}&background=random&color=fff&size=40&rounded=true&bold=true&font-size=0.5`;

    html += `<tr>
            <td class="ps-3">
                <div class="d-flex align-items-center">
                    <img src="${logoUrl}" class="me-3 shadow-sm" width="40" height="40" alt="Logo" style="border-radius: 8px;">
                    <div>
                        <div class="fw-bold text-body">${stage.entreprise} ${links}</div>
                        <div class="small text-muted">${stage.poste}</div>
                    </div>
                </div>
            </td>
            <td><span class="badge ${badgeClass} fw-normal">${stage.etat}</span></td>
            <td>${dateHtml}</td>
            <td class="text-end pe-3">${actions}</td>
          </tr>`;
  });

  tbody.innerHTML =
    html ||
    '<tr><td colspan="4" class="text-center py-4 text-muted">Aucun résultat.</td></tr>';
}

document.getElementById("btnExport").addEventListener("click", () => {
  if (allStages.length === 0) return alert("Rien à exporter !");
  let csvContent =
    "data:text/csv;charset=utf-8,\uFEFFEntreprise;Poste;Etat;Date Envoi;Date Relance;Date Retour;Lien;Mail;Notes\n";
  allStages.forEach((row) => {
    const clean = (txt) => {
      if (!txt) return "";
      return '"' + txt.toString().replace(/"/g, '""').replace(/\n/g, " ") + '"';
    };
    const ligne = [
      clean(row.entreprise),
      clean(row.poste),
      clean(row.etat),
      clean(row.dateEnvoi),
      clean(row.dateRelance),
      clean(row.dateStatut),
      clean(row.lien),
      clean(row.lienMail),
      clean(row.notes),
    ].join(";");
    csvContent += ligne + "\n";
  });
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "mes_stages.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});

document.getElementById("stageForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!isAdmin) return;
  const docId = document.getElementById("docId").value;
  const stageData = {
    entreprise: document.getElementById("entreprise").value,
    poste: document.getElementById("poste").value,
    lien: document.getElementById("lien").value,
    lienMail: document.getElementById("lienMail").value,
    dateEnvoi: document.getElementById("dateEnvoi").value,
    dateRelance: document.getElementById("dateRelance").value,
    dateStatut: document.getElementById("dateStatut").value,
    etat: document.getElementById("etat").value,
    notes: document.getElementById("notes").value,
  };
  try {
    if (docId) {
      await updateDoc(doc(db, "stages", docId), stageData);
    } else {
      await addDoc(stagesCollection, stageData);
    }
    window.hideForm();
  } catch (err) {
    alert("Erreur : " + err.message);
  }
});
window.deleteStage = async (id) => {
  if (isAdmin && confirm("Supprimer ?")) await deleteDoc(doc(db, "stages", id));
};
window.editStage = (id) => {
  const s = allStages.find((x) => x.id === id);
  if (!s) return;
  document.getElementById("docId").value = s.id;
  document.getElementById("entreprise").value = s.entreprise;
  document.getElementById("poste").value = s.poste;
  document.getElementById("lien").value = s.lien || "";
  document.getElementById("lienMail").value = s.lienMail || "";
  document.getElementById("dateEnvoi").value = s.dateEnvoi || "";
  document.getElementById("dateRelance").value = s.dateRelance || "";
  document.getElementById("dateStatut").value = s.dateStatut || "";
  document.getElementById("etat").value = s.etat;
  document.getElementById("notes").value = s.notes || "";
  document.getElementById("form-title").innerText = "Modifier";
  document.getElementById("form-card").style.display = "block";
  window.scrollTo(0, 0);
};
document.getElementById("dateEnvoi").addEventListener("change", function () {
  if (this.value) {
    const d = new Date(this.value);
    d.setDate(d.getDate() + 7);
    document.getElementById("dateRelance").value = d
      .toISOString()
      .split("T")[0];
  }
});
window.showForm = () => {
  document.getElementById("form-card").style.display = "block";
  document.getElementById("form-title").innerText = "Ajouter";
  document.getElementById("docId").value = "";
  document.getElementById("stageForm").reset();
  window.scrollTo(0, 0);
};
window.hideForm = () =>
  (document.getElementById("form-card").style.display = "none");
