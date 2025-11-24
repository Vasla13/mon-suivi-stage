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
// 🔴 ZONE DE CONFIGURATION (A REMPLIR)
// ==========================================

// 1. Colle ta configuration Firebase ici :
  const firebaseConfig = {
    apiKey: "AIzaSyCGMFmFQ8KIqJoj9zXzH194V8L5epRsBeg",
    authDomain: "mon-suivi-stage.firebaseapp.com",
    projectId: "mon-suivi-stage",
    storageBucket: "mon-suivi-stage.firebasestorage.app",
    messagingSenderId: "134252253002",
    appId: "1:134252253002:web:fd5a8585299b6d58047bb3",
    measurementId: "G-GL4HPEBLRW",
  };

// 2. Colle ton UID Admin ici (celui copié depuis la console Firebase) :
const ADMIN_UID = "fAQazTtXxgWQXf8snjT6BankcUK2";

// ==========================================

// Initialisation Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const stagesCollection = collection(db, "stages");
const provider = new GithubAuthProvider();

// Variables globales
let isAdmin = false;
let allStages = [];
let myChart = null; // Pour stocker le graphique Chart.js

// --- GESTION DU THÈME (DARK MODE) ---
const btnTheme = document.getElementById("btnTheme");
const htmlEl = document.documentElement;

// Vérifier si un thème est déjà sauvegardé
if (localStorage.getItem("theme") === "dark") {
  htmlEl.setAttribute("data-bs-theme", "dark");
  btnTheme.innerHTML = '<i class="bi bi-sun-fill"></i>';
}

btnTheme.addEventListener("click", () => {
  const isDark = htmlEl.getAttribute("data-bs-theme") === "dark";
  // Basculer le thème
  htmlEl.setAttribute("data-bs-theme", isDark ? "light" : "dark");
  // Changer l'icône
  btnTheme.innerHTML = isDark
    ? '<i class="bi bi-moon-stars-fill"></i>'
    : '<i class="bi bi-sun-fill"></i>';
  // Sauvegarder la préférence
  localStorage.setItem("theme", isDark ? "light" : "dark");
});

// --- GESTION AUTHENTIFICATION ---
onAuthStateChanged(auth, (user) => {
  if (user) {
    // Utilisateur connecté
    isAdmin = user.uid === ADMIN_UID;

    // Interface
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("app-content").style.display = "block";
    if (user.photoURL)
      document.getElementById("userAvatar").src = user.photoURL;

    const badge = document.getElementById("userStatus");
    const btnNouveau = document.getElementById("btnNouveau");

    if (isAdmin) {
      badge.className = "badge bg-primary";
      badge.innerText = "Admin";
      btnNouveau.classList.remove("admin-only");
    } else {
      badge.className = "badge bg-secondary";
      badge.innerText = "Invité";
      btnNouveau.classList.add("admin-only");
    }

    // Lancer le chargement des données
    chargerDonnees();
  } else {
    // Utilisateur déconnecté
    document.getElementById("login-screen").style.display = "flex";
    document.getElementById("app-content").style.display = "none";
  }
});

// Boutons Login / Logout
document.getElementById("btnGithubLogin").addEventListener("click", () => {
  signInWithPopup(auth, provider).catch((e) => {
    document.getElementById("login-error").innerText = e.message;
  });
});
document
  .getElementById("btnLogout")
  .addEventListener("click", () => signOut(auth));

// --- CHARGEMENT DES DONNÉES (TEMPS RÉEL) ---
function chargerDonnees() {
  onSnapshot(stagesCollection, (snapshot) => {
    allStages = [];
    let stats = { total: 0, attente: 0, entretien: 0, valide: 0, refuse: 0 };

    snapshot.forEach((doc) => {
      let data = doc.data();
      data.id = doc.id;
      allStages.push(data);

      // Calcul Stats
      stats.total++;
      if (data.etat === "En attente") stats.attente++;
      if (data.etat === "Entretien") stats.entretien++;
      if (data.etat === "Validé") stats.valide++;
      if (data.etat === "Refusé") stats.refuse++;
    });

    // Tri : Urgences (Date Relance) en premier
    allStages.sort((a, b) => {
      if (a.dateRelance && !b.dateRelance) return -1;
      if (!a.dateRelance && b.dateRelance) return 1;
      if (a.dateRelance && b.dateRelance)
        return new Date(a.dateRelance) - new Date(b.dateRelance);
      return 0;
    });

    updateStats(stats);
    renderTable(allStages); // Affiche tout au chargement
    document.getElementById("loading").style.display = "none";
  });
}

// --- MISE À JOUR DES STATS & GRAPHIQUE ---
function updateStats(stats) {
  // 1. Chiffres
  const c = document.getElementById("stats-numbers");
  c.innerHTML = `
        <div class="col-6 mb-2"><div class="p-2 bg-primary text-white rounded shadow-sm"><h4 class="m-0 fw-bold">${stats.total}</h4><small style="font-size:0.7em">TOTAL</small></div></div>
        <div class="col-6 mb-2"><div class="p-2 bg-body-tertiary border border-warning text-warning rounded shadow-sm"><h4 class="m-0 fw-bold">${stats.attente}</h4><small style="font-size:0.7em">ATTENTE</small></div></div>
        <div class="col-6"><div class="p-2 bg-info text-dark rounded shadow-sm"><h4 class="m-0 fw-bold">${stats.entretien}</h4><small style="font-size:0.7em">ENTR.</small></div></div>
        <div class="col-6"><div class="p-2 bg-success text-white rounded shadow-sm"><h4 class="m-0 fw-bold">${stats.valide}</h4><small style="font-size:0.7em">VALIDÉ</small></div></div>
    `;

  // 2. Graphique Chart.js
  const ctx = document.getElementById("statsChart");
  if (myChart) myChart.destroy(); // Important: détruire l'ancien graphique avant d'en créer un nouveau

  let dataChart = [stats.attente, stats.entretien, stats.valide, stats.refuse];
  let colors = ["#ffc107", "#0dcaf0", "#198754", "#dc3545"];

  // Si vide, afficher un cercle gris
  if (stats.total === 0) {
    dataChart = [1];
    colors = ["#444"];
  }

  myChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Attente", "Entretien", "Validé", "Refusé"],
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

// --- AFFICHAGE DU TABLEAU ---
function renderTable(stagesToDisplay) {
  const tableBody = document.getElementById("stages-table-body");
  const today = new Date().toISOString().split("T")[0];
  let html = "";

  stagesToDisplay.forEach((stage) => {
    // Logique Relance
    let relanceHtml = '<span class="text-muted text-opacity-50 small">-</span>';
    if (
      stage.etat !== "Validé" &&
      stage.etat !== "Refusé" &&
      stage.dateRelance
    ) {
      if (stage.dateRelance < today)
        relanceHtml = `<div class="text-danger fw-bold small"><i class="bi bi-exclamation-circle-fill"></i> ${stage.dateRelance}</div>`;
      else if (stage.dateRelance === today)
        relanceHtml = `<span class="badge bg-warning text-dark border border-dark">AUJ.</span>`;
      else
        relanceHtml = `<span class="text-secondary small">${stage.dateRelance}</span>`;
    }

    // Badges État
    let badgeClass = "bg-warning text-dark bg-opacity-75";
    if (stage.etat === "Validé") badgeClass = "bg-success";
    if (stage.etat === "Refusé") badgeClass = "bg-danger";
    if (stage.etat === "Entretien") badgeClass = "bg-info text-dark";

    let lienHtml = stage.lien
      ? `<a href="${stage.lien}" target="_blank" class="text-primary ms-1"><i class="bi bi-box-arrow-up-right"></i></a>`
      : "";

    // Boutons Actions (Selon Admin ou non)
    let actionsHtml = isAdmin
      ? `
              <div class="btn-group">
                  <button class="btn btn-sm btn-outline-secondary btn-edit" data-id="${stage.id}"><i class="bi bi-pencil-fill"></i></button>
                  <button class="btn btn-sm btn-outline-danger btn-delete" data-id="${stage.id}"><i class="bi bi-trash-fill"></i></button>
              </div>`
      : `<span class="text-muted small"><i class="bi bi-eye"></i></span>`;

    html += `
            <tr>
                <td class="ps-3"><div class="fw-bold text-body">${stage.entreprise} ${lienHtml}</div><div class="small text-muted">${stage.poste}</div></td>
                <td><span class="badge ${badgeClass} fw-normal">${stage.etat}</span></td>
                <td>${relanceHtml}</td>
                <td class="text-end pe-3">${actionsHtml}</td>
            </tr>`;
  });

  tableBody.innerHTML = stagesToDisplay.length
    ? html
    : `<tr><td colspan="4" class="text-center py-4 text-muted">Aucun résultat.</td></tr>`;

  // Attacher les événements (Edit/Delete) uniquement si Admin
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

// --- RECHERCHE ET FILTRES ---
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

// --- EXPORT CSV (Fix pour Excel FR) ---
document.getElementById("btnExport").addEventListener("click", () => {
  if (allStages.length === 0) return alert("Rien à exporter !");

  // BOM + Séparateur point-virgule
  let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
  const sep = ";";
  csvContent += `Entreprise${sep}Poste${sep}Etat${sep}Date Envoi${sep}Date Relance${sep}Lien${sep}Notes\n`;

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
      clean(row.lien),
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

// --- CRUD (AJOUT / MODIF / SUPPRESSION) ---
document.getElementById("stageForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!isAdmin) return;

  const docId = document.getElementById("docId").value;
  const stageData = {
    entreprise: document.getElementById("entreprise").value,
    poste: document.getElementById("poste").value,
    lien: document.getElementById("lien").value,
    dateEnvoi: document.getElementById("dateEnvoi").value,
    dateRelance: document.getElementById("dateRelance").value,
    etat: document.getElementById("etat").value,
    notes: document.getElementById("notes").value,
  };

  try {
    if (docId) {
      // MODIFICATION
      await updateDoc(doc(db, "stages", docId), stageData);
    } else {
      // CRÉATION
      await addDoc(stagesCollection, stageData);
    }
    window.hideForm();
  } catch (err) {
    alert("Erreur : " + err.message);
  }
});

async function deleteStage(id) {
  if (isAdmin && confirm("Voulez-vous vraiment supprimer ce stage ?")) {
    await deleteDoc(doc(db, "stages", id));
  }
}

// Fonction pour remplir le formulaire sans reset (Mode Édition)
function editStage(s) {
  document.getElementById("docId").value = s.id;
  document.getElementById("entreprise").value = s.entreprise;
  document.getElementById("poste").value = s.poste;
  document.getElementById("lien").value = s.lien || "";
  document.getElementById("dateEnvoi").value = s.dateEnvoi || "";
  document.getElementById("dateRelance").value = s.dateRelance || "";
  document.getElementById("etat").value = s.etat;
  document.getElementById("notes").value = s.notes || "";

  document.getElementById("form-title").innerText = "Modifier";
  document.getElementById("form-card").style.display = "block";
  window.scrollTo(0, 0);
}

// Calcul automatique date relance (+7j)
document.getElementById("dateEnvoi").addEventListener("change", function () {
  if (this.value) {
    const d = new Date(this.value);
    d.setDate(d.getDate() + 7);
    document.getElementById("dateRelance").value = d
      .toISOString()
      .split("T")[0];
  }
});

// Fonctions globales pour le HTML
window.showForm = () => {
  document.getElementById("form-card").style.display = "block";
  document.getElementById("form-title").innerText = "Ajouter";
  document.getElementById("docId").value = "";
  document.getElementById("stageForm").reset();
  window.scrollTo(0, 0);
};
window.hideForm = () =>
  (document.getElementById("form-card").style.display = "none");
