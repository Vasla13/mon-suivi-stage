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

// 🔴 CONFIGURATION (REMPLIR ICI)
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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const stagesCollection = collection(db, "stages");
const provider = new GithubAuthProvider();

let isAdmin = false;
let allStages = [];
let filteredStages = []; // Pour la recherche
let myChart = null;
let map = null;
let markers = [];

// --- AUTHENTIFICATION ---
onAuthStateChanged(auth, (user) => {
  if (user) {
    isAdmin = user.uid === ADMIN_UID;
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("app-content").style.display = "block";
    if (user.photoURL)
      document.getElementById("userAvatar").src = user.photoURL;

    const badge = document.getElementById("userStatus");
    const btns = document.querySelectorAll(".admin-only");
    if (isAdmin) {
      badge.className = "badge bg-primary";
      badge.innerText = "Admin";
      btns.forEach((b) => b.classList.remove("admin-only"));
    } else {
      badge.className = "badge bg-secondary";
      badge.innerText = "Invité";
      btns.forEach((b) => b.classList.add("admin-only"));
    }
    chargerDonnees();
  } else {
    document.getElementById("login-screen").style.display = "flex";
    document.getElementById("app-content").style.display = "none";
  }
});
document
  .getElementById("btnGithubLogin")
  .addEventListener("click", () => signInWithPopup(auth, provider));
document
  .getElementById("btnLogout")
  .addEventListener("click", () => signOut(auth));

// --- VUES & FILTRES ---
const viewBtns = document.querySelectorAll(".view-btn");
const views = {
  list: document.getElementById("view-list"),
  kanban: document.getElementById("view-kanban"),
  map: document.getElementById("view-map"),
};
let currentView = "list";

viewBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    viewBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentView = btn.dataset.view;

    Object.values(views).forEach((div) => (div.style.display = "none"));
    views[currentView].style.display = "block";

    refreshCurrentView();
  });
});

// FILTRES (Recherche + Statut)
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
      s.poste.toLowerCase().includes(term) ||
      (s.adresse && s.adresse.toLowerCase().includes(term));
    const matchStatus =
      currentStatusFilter === "all" || s.etat === currentStatusFilter;
    return matchText && matchStatus;
  });

  refreshCurrentView();
}

function refreshCurrentView() {
  if (currentView === "list") renderList(filteredStages);
  if (currentView === "kanban") renderKanban(filteredStages);
  if (currentView === "map") setTimeout(() => initMap(filteredStages), 200);
}

// --- CHARGEMENT ---
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

    // Tri par défaut
    allStages.sort((a, b) => {
      if (a.dateRelance && !b.dateRelance) return -1;
      return 0;
    });

    updateStats(stats);
    applyFilters(); // Applique filtres et rafraîchit la vue active
  });
}

// --- RENDER LISTE (Avec Liens & Delete) ---
function renderList(stages) {
  const tbody = document.getElementById("stages-table-body");
  const today = new Date().toISOString().split("T")[0];
  let html = "";

  stages.forEach((s) => {
    let dateTxt = "-";
    if (s.etat === "En attente" || s.etat === "Suite Entretien") {
      if (s.dateRelance)
        dateTxt =
          s.dateRelance <= today
            ? `<span class="text-danger fw-bold">Relance!</span>`
            : `<span class="text-muted">${s.dateRelance}</span>`;
    } else if (s.dateStatut)
      dateTxt = `<span class="text-success fw-bold">${s.dateStatut}</span>`;

    let badgeClass = "bg-secondary";
    if (s.etat === "Validé") badgeClass = "bg-success";
    if (s.etat === "Refusé") badgeClass = "bg-danger";
    if (s.etat === "Entretien") badgeClass = "bg-info text-dark";
    if (s.etat === "Suite Entretien") badgeClass = "bg-primary";
    if (s.etat === "En attente") badgeClass = "bg-warning text-dark";

    // Icônes Liens
    let linksHtml = "";
    if (s.lien)
      linksHtml += `<a href="${s.lien}" target="_blank" class="text-secondary me-2" title="Annonce"><i class="bi bi-link-45deg"></i></a>`;
    if (isAdmin && s.lienMail)
      linksHtml += `<a href="${s.lienMail}" target="_blank" class="text-primary" title="Mail"><i class="bi bi-envelope-at-fill"></i></a>`;

    // Boutons Actions
    let actionsHtml = isAdmin
      ? `
            <button class="btn btn-sm btn-outline-secondary me-1" onclick="editStage('${s.id}')"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteStage('${s.id}')"><i class="bi bi-trash"></i></button>
        `
      : "";

    html += `<tr>
            <td><strong>${
              s.entreprise
            }</strong> ${linksHtml}<br><small class="text-muted">${
      s.poste
    }</small></td>
            <td><i class="bi bi-geo-alt"></i> ${s.adresse || "-"}</td>
            <td><span class="badge ${badgeClass}">${s.etat}</span></td>
            <td>${dateTxt}</td>
            <td class="text-end">${actionsHtml}</td>
        </tr>`;
  });
  tbody.innerHTML =
    html ||
    '<tr><td colspan="5" class="text-center p-3 text-muted">Aucun stage trouvé.</td></tr>';
}

// --- RENDER MAP (Auto-Zoom & Popup) ---
function initMap(stages) {
  if (!map) {
    map = L.map("map-container").setView([46.6, 1.8], 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
    }).addTo(map);
  } else {
    map.invalidateSize();
  }

  // Nettoyage
  markers.forEach((m) => map.removeLayer(m));
  markers = [];

  const featureGroup = L.featureGroup();

  stages.forEach((s) => {
    if (s.lat && s.lng) {
      const marker = L.marker([s.lat, s.lng]).addTo(map);

      // Popup Info
      const popupContent = `
                <div class="text-center">
                    <strong>${s.entreprise}</strong><br>${s.poste}<br>
                    <span class="badge bg-secondary">${s.etat}</span><br>
                    <button class="btn btn-sm btn-primary mt-2" onclick="editStage('${s.id}')">Voir / Modifier</button>
                </div>
            `;
      marker.bindPopup(popupContent);

      markers.push(marker);
      featureGroup.addLayer(marker);
    }
  });

  // Auto-Zoom
  if (markers.length > 0) {
    map.fitBounds(featureGroup.getBounds().pad(0.1));
  }
}

// --- RENDER KANBAN ---
function renderKanban(stages) {
  const container = document.querySelector(".kanban-container");
  container.innerHTML = "";
  const cols = [
    { id: "En attente", title: "⏳ En attente", color: "border-attente" },
    {
      id: "Entretien",
      title: "🗣️ Entretien / Suite",
      color: "border-entretien",
      filter: (s) => s.etat === "Entretien" || s.etat === "Suite Entretien",
    },
    { id: "Validé", title: "✅ Validé", color: "border-valide" },
    { id: "Refusé", title: "❌ Refusé", color: "border-refuse" },
  ];

  cols.forEach((col) => {
    const items = stages.filter((s) =>
      col.filter ? col.filter(s) : s.etat === col.id
    );
    let html = "";
    items.forEach((s) => {
      html += `<div class="kanban-card ${
        col.color
      }" draggable="${isAdmin}" ondragstart="drag(event, '${
        s.id
      }')" onclick="editStage('${s.id}')">
                <div class="fw-bold">${s.entreprise}</div><div class="small">${
        s.poste
      }</div>
                <div class="small text-muted mt-1"><i class="bi bi-geo-alt"></i> ${
                  s.adresse || "?"
                }</div>
            </div>`;
    });
    container.innerHTML += `<div class="kanban-column" ondrop="drop(event, '${col.id}')" ondragover="allowDrop(event)">
            <div class="kanban-header">${col.title} <span class="badge bg-secondary float-end">${items.length}</span></div>
            <div class="d-flex flex-column gap-2 flex-grow-1">${html}</div>
        </div>`;
  });
}

// --- GÉOCODING ---
async function geocodeAdresse(adresse) {
  if (!adresse) return null;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        adresse
      )}`
    );
    const data = await res.json();
    return data && data.length
      ? { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
      : null;
  } catch (e) {
    console.error(e);
    return null;
  }
}

// --- CRUD & FORM ---
document.getElementById("stageForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!isAdmin) return;

  const docId = document.getElementById("docId").value;
  const adresse = document.getElementById("adresse").value;
  let coords = {
    lat: document.getElementById("lat").value,
    lng: document.getElementById("lng").value,
  };

  if (adresse) {
    const newCoords = await geocodeAdresse(adresse);
    if (newCoords) coords = newCoords;
  }

  const stageData = {
    entreprise: document.getElementById("entreprise").value,
    poste: document.getElementById("poste").value,
    adresse: adresse,
    lat: coords.lat,
    lng: coords.lng,
    lien: document.getElementById("lien").value,
    lienMail: document.getElementById("lienMail").value,
    dateEnvoi: document.getElementById("dateEnvoi").value,
    dateRelance: document.getElementById("dateRelance").value,
    dateStatut: document.getElementById("dateStatut").value,
    etat: document.getElementById("etat").value,
    notes: document.getElementById("notes").value,
  };

  try {
    if (docId) await updateDoc(doc(db, "stages", docId), stageData);
    else await addDoc(stagesCollection, stageData);
    window.hideForm();
  } catch (err) {
    alert(err.message);
  }
});

// --- GLOBALS ---
window.editStage = (id) => {
  const s = allStages.find((x) => x.id === id);
  if (!s) return;
  document.getElementById("docId").value = s.id;
  document.getElementById("entreprise").value = s.entreprise;
  document.getElementById("poste").value = s.poste;
  document.getElementById("adresse").value = s.adresse || "";
  document.getElementById("lat").value = s.lat || "";
  document.getElementById("lng").value = s.lng || "";
  document.getElementById("lien").value = s.lien || "";
  document.getElementById("lienMail").value = s.lienMail || "";
  document.getElementById("dateEnvoi").value = s.dateEnvoi || "";
  document.getElementById("dateRelance").value = s.dateRelance || "";
  document.getElementById("dateStatut").value = s.dateStatut || "";
  document.getElementById("etat").value = s.etat;
  document.getElementById("notes").value = s.notes || "";
  document.getElementById("form-title").innerText = "Modifier";
  document.getElementById("btnDeleteForm").style.display = "inline-block";
  document.getElementById("form-overlay").style.display = "flex";
};

window.deleteStage = async (id) => {
  if (isAdmin && confirm("Supprimer ?")) await deleteDoc(doc(db, "stages", id));
};
window.deleteStageFromForm = async () => {
  const id = document.getElementById("docId").value;
  if (isAdmin && id && confirm("Supprimer ?")) {
    await deleteDoc(doc(db, "stages", id));
    window.hideForm();
  }
};
window.showForm = () => {
  document.getElementById("form-overlay").style.display = "flex";
  document.getElementById("form-title").innerText = "Ajouter";
  document.getElementById("docId").value = "";
  document.getElementById("stageForm").reset();
  document.getElementById("btnDeleteForm").style.display = "none";
};
window.hideForm = () =>
  (document.getElementById("form-overlay").style.display = "none");

// Drag & Drop
window.allowDrop = (ev) => ev.preventDefault();
window.drag = (ev, id) => ev.dataTransfer.setData("text", id);
window.drop = async (ev, newStatus) => {
  ev.preventDefault();
  if (!isAdmin) return;
  const id = ev.dataTransfer.getData("text");
  if (newStatus === "Entretien") newStatus = "Entretien";
  try {
    await updateDoc(doc(db, "stages", id), { etat: newStatus });
  } catch (e) {}
};

function updateStats(stats) {
  /* Identique précédent, conservé pour brièveté */
  const c = document.getElementById("stats-numbers");
  c.innerHTML = `<div class="col-4 mb-2"><div class="p-2 bg-primary text-white rounded shadow-sm"><h4 class="m-0 fw-bold">${stats.total}</h4><small style="font-size:0.6em">TOTAL</small></div></div><div class="col-4 mb-2"><div class="p-2 bg-body-tertiary border border-warning text-warning rounded shadow-sm"><h4 class="m-0 fw-bold">${stats.attente}</h4><small style="font-size:0.6em">ATTENTE</small></div></div><div class="col-4 mb-2"><div class="p-2 bg-info text-dark rounded shadow-sm"><h4 class="m-0 fw-bold">${stats.entretien}</h4><small style="font-size:0.6em">ENTR. PRÉVU</small></div></div><div class="col-6"><div class="p-2 text-white rounded shadow-sm" style="background-color: #6610f2;"><h4 class="m-0 fw-bold">${stats.suite}</h4><small style="font-size:0.6em">SUITE</small></div></div><div class="col-6"><div class="p-2 bg-success text-white rounded shadow-sm"><h4 class="m-0 fw-bold">${stats.valide}</h4><small style="font-size:0.6em">VALIDÉ</small></div></div>`;
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
