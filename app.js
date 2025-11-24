import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  signInWithPopup,
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
// 🔴 ZONE DE CONFIGURATION INTEGRÉE
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

    const badge = document.getElementById("userStatus");
    const btn = document.getElementById("btnNouveau");

    if (isAdmin) {
      badge.className = "badge bg-primary";
      badge.innerText = "Admin";
      btn.classList.remove("admin-only");
    } else {
      badge.className = "badge bg-secondary";
      badge.innerText = "Invité";
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
  .getElementById("btnLogout")
  .addEventListener("click", () => signOut(auth));

// --- DATA ---
function chargerDonnees() {
  onSnapshot(stagesCollection, (snapshot) => {
    allStages = [];
    // On compte le nouveau statut 'suite'
    let stats = {
      total: 0,
      attente: 0,
      entretien: 0,
      suite: 0,
      valide: 0,
      refuse: 0,
    };

    snapshot.forEach((doc) => {
      let data = doc.data();
      data.id = doc.id;
      allStages.push(data);
      stats.total++;
      if (data.etat === "En attente") stats.attente++;
      if (data.etat === "Entretien") stats.entretien++;
      if (data.etat === "Suite Entretien") stats.suite++;
      if (data.etat === "Validé") stats.valide++;
      if (data.etat === "Refusé") stats.refuse++;
    });

    // Tri intelligent
    allStages.sort((a, b) => {
      // Priorité absolue : Entretien et Suite Entretien
      const isPrioA = a.etat === "Entretien" || a.etat === "Suite Entretien";
      const isPrioB = b.etat === "Entretien" || b.etat === "Suite Entretien";

      if (isPrioA && !isPrioB) return -1;
      if (!isPrioA && isPrioB) return 1;

      // Ensuite par date de relance
      if (a.dateRelance && !b.dateRelance) return -1;
      if (!a.dateRelance && b.dateRelance) return 1;
      return 0;
    });

    updateStats(stats);
    renderTable(allStages);
    document.getElementById("loading").style.display = "none";
  });
}

function updateStats(stats) {
  const c = document.getElementById("stats-numbers");
  c.innerHTML = `
        <div class="col-4 mb-2"><div class="p-2 bg-primary text-white rounded shadow-sm"><h4 class="m-0 fw-bold">${stats.total}</h4><small style="font-size:0.6em">TOTAL</small></div></div>
        <div class="col-4 mb-2"><div class="p-2 bg-body-tertiary border border-warning text-warning rounded shadow-sm"><h4 class="m-0 fw-bold">${stats.attente}</h4><small style="font-size:0.6em">ATTENTE</small></div></div>
        <div class="col-4 mb-2"><div class="p-2 bg-info text-dark rounded shadow-sm"><h4 class="m-0 fw-bold">${stats.entretien}</h4><small style="font-size:0.6em">ENTR. PRÉVU</small></div></div>
        
        <div class="col-6"><div class="p-2 text-white rounded shadow-sm" style="background-color: #6610f2;"><h4 class="m-0 fw-bold">${stats.suite}</h4><small style="font-size:0.6em">SUITE ENTR.</small></div></div>
        <div class="col-6"><div class="p-2 bg-success text-white rounded shadow-sm"><h4 class="m-0 fw-bold">${stats.valide}</h4><small style="font-size:0.6em">VALIDÉ</small></div></div>
    `;

  const ctx = document.getElementById("statsChart");
  if (myChart) myChart.destroy();

  // Ajout de la couleur violette pour "Suite"
  let dataChart = [
    stats.attente,
    stats.entretien,
    stats.suite,
    stats.valide,
    stats.refuse,
  ];
  let colors = ["#ffc107", "#0dcaf0", "#6610f2", "#198754", "#dc3545"];

  if (stats.total === 0) {
    dataChart = [1];
    colors = ["#444"];
  }

  myChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Attente", "Entr. Prévu", "Suite Entr.", "Validé", "Refusé"],
      datasets: [
        {
          data: dataChart,
          backgroundColor: colors,
          borderWidth: 0,
          hoverOffset: 4,
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

function renderTable(stagesToDisplay) {
  const tableBody = document.getElementById("stages-table-body");
  const today = new Date().toISOString().split("T")[0];
  let html = "";

  stagesToDisplay.forEach((stage) => {
    // --- LOGIQUE DATES ---
    let dateHtml = '<span class="text-muted text-opacity-50 small">-</span>';

    // Si En attente OU Suite Entretien (on attend une réponse) -> On affiche Relance
    if (stage.etat === "En attente" || stage.etat === "Suite Entretien") {
      if (stage.dateRelance) {
        if (stage.dateRelance < today)
          dateHtml = `<div class="text-danger fw-bold small"><i class="bi bi-exclamation-circle-fill"></i> Relance: ${stage.dateRelance}</div>`;
        else if (stage.dateRelance === today)
          dateHtml = `<span class="badge bg-warning text-dark border border-dark">Relance: AUJ.</span>`;
        else
          dateHtml = `<span class="text-secondary small"><i class="bi bi-clock"></i> Relance: ${stage.dateRelance}</span>`;
      }
    } else {
      // Sinon -> Date de Retour/RDV
      if (stage.dateStatut) {
        let colorClass = "text-muted";
        if (stage.etat === "Refusé") colorClass = "text-danger";
        if (stage.etat === "Validé") colorClass = "text-success";
        if (stage.etat === "Entretien") colorClass = "text-info";
        dateHtml = `<span class="${colorClass} small fw-bold"><i class="bi bi-calendar-check"></i> ${stage.dateStatut}</span>`;
      }
    }

    // --- LOGIQUE COULEURS ETAT ---
    let badgeClass = "bg-warning text-dark bg-opacity-75";
    if (stage.etat === "Validé") badgeClass = "bg-success";
    if (stage.etat === "Refusé") badgeClass = "bg-danger";
    if (stage.etat === "Entretien") badgeClass = "bg-info text-dark";
    if (stage.etat === "Suite Entretien") badgeClass = "bg-primary text-white"; // Violet/Bleu

    let lienHtml = stage.lien
      ? `<a href="${stage.lien}" target="_blank" class="text-secondary ms-1 text-decoration-none" title="Annonce"><i class="bi bi-link-45deg"></i></a>`
      : "";

    // --- LIEN MAIL (ADMIN SEULEMENT) ---
    let mailHtml = "";
    if (isAdmin && stage.lienMail) {
      mailHtml = `<a href="${stage.lienMail}" target="_blank" class="text-primary ms-1" title="Ouvrir le mail"><i class="bi bi-envelope-at-fill"></i></a>`;
    }

    let actionsHtml = isAdmin
      ? `
              <div class="btn-group">
                  <button class="btn btn-sm btn-outline-secondary btn-edit" data-id="${stage.id}"><i class="bi bi-pencil-fill"></i></button>
                  <button class="btn btn-sm btn-outline-danger btn-delete" data-id="${stage.id}"><i class="bi bi-trash-fill"></i></button>
              </div>`
      : `<span class="text-muted small"><i class="bi bi-eye"></i></span>`;

    html += `<tr><td class="ps-3"><div class="fw-bold text-body">${stage.entreprise} ${mailHtml} ${lienHtml}</div><div class="small text-muted">${stage.poste}</div></td><td><span class="badge ${badgeClass} fw-normal">${stage.etat}</span></td><td>${dateHtml}</td><td class="text-end pe-3">${actionsHtml}</td></tr>`;
  });
  tableBody.innerHTML = stagesToDisplay.length
    ? html
    : `<tr><td colspan="4" class="text-center py-4 text-muted">Aucun résultat.</td></tr>`;

  if (isAdmin) {
    document
      .querySelectorAll(".btn-delete")
      .forEach((btn) =>
        btn.addEventListener("click", (e) =>
          deleteStage(e.currentTarget.dataset.id)
        )
      );
    document.querySelectorAll(".btn-edit").forEach((btn) =>
      btn.addEventListener("click", (e) => {
        const s = allStages.find((x) => x.id === e.currentTarget.dataset.id);
        editStage(s);
      })
    );
  }
}

const searchInput = document.getElementById("searchInput");
const filterBtns = document.querySelectorAll(".filter-btn");
let currentFilter = "all";
searchInput.addEventListener("input", (e) =>
  filtrerDonnees(e.target.value, currentFilter)
);
filterBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    filterBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.getAttribute("data-filter");
    filtrerDonnees(searchInput.value, currentFilter);
  });
});
function filtrerDonnees(text, status) {
  const lowerText = text.toLowerCase();
  const filtered = allStages.filter((stage) => {
    const matchText =
      stage.entreprise.toLowerCase().includes(lowerText) ||
      stage.poste.toLowerCase().includes(lowerText);
    const matchStatus = status === "all" || stage.etat === status;
    return matchText && matchStatus;
  });
  renderTable(filtered);
}
document.getElementById("btnExport").addEventListener("click", () => {
  if (allStages.length === 0) return alert("Rien à exporter !");
  let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
  const sep = ";";
  csvContent += `Entreprise${sep}Poste${sep}Etat${sep}Date Envoi${sep}Date Relance${sep}Date Retour${sep}Lien${sep}Mail${sep}Notes\n`;
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
    ].join(sep);
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

// --- CRUD ---
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

async function deleteStage(id) {
  if (isAdmin && confirm("Supprimer ?")) await deleteDoc(doc(db, "stages", id));
}

function editStage(s) {
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
}

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
