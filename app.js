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

// 🔴 CONFIGURATION FIREBASE & UID
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
let myChart = null;
let map = null; // Instance Carte Leaflet
let markers = []; // Liste des épingles

// --- AUTHENTIFICATION ---
onAuthStateChanged(auth, (user) => {
  if (user) {
    isAdmin = user.uid === ADMIN_UID;
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("app-content").style.display = "block";
    if (user.photoURL)
      document.getElementById("userAvatar").src = user.photoURL;

    // Gestion visuelle Admin/Invité
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

// --- GESTION DES VUES (Liste / Kanban / Map) ---
const viewBtns = document.querySelectorAll(".view-btn");
const views = {
  list: document.getElementById("view-list"),
  kanban: document.getElementById("view-kanban"),
  map: document.getElementById("view-map"),
};

viewBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    viewBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    const viewName = btn.dataset.view;
    Object.values(views).forEach((div) => (div.style.display = "none"));
    views[viewName].style.display = "block";

    // Rafraîchir les vues spécifiques
    if (viewName === "kanban") renderKanban();
    if (viewName === "map") setTimeout(() => initMap(), 200); // Petit délai pour affichage correct
  });
});

// --- CHARGEMENT DONNÉES ---
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

    updateStats(stats);
    renderList(allStages); // Vue Liste
    if (views.kanban.style.display !== "none") renderKanban(); // Refresh si ouvert
    if (views.map.style.display !== "none") initMap(); // Refresh pins si ouvert
  });
}

// --- RENDER LISTE ---
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

    html += `<tr onclick="editStage('${s.id}')" style="cursor:pointer">
            <td><strong>${s.entreprise}</strong><br><small class="text-muted">${
      s.poste
    }</small></td>
            <td><i class="bi bi-geo-alt"></i> ${s.adresse || "-"}</td>
            <td><span class="badge ${badgeClass}">${s.etat}</span></td>
            <td>${dateTxt}</td>
            <td class="text-end"><button class="btn btn-sm btn-outline-secondary"><i class="bi bi-pencil"></i></button></td>
        </tr>`;
  });
  tbody.innerHTML = html;
}

// --- RENDER KANBAN ---
function renderKanban() {
  const container = document.querySelector(".kanban-container");
  container.innerHTML = "";

  const columns = [
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

  columns.forEach((col) => {
    // Filtrer les stages de cette colonne
    const stagesInCol = allStages.filter((s) =>
      col.filter ? col.filter(s) : s.etat === col.id
    );

    let cardsHtml = "";
    stagesInCol.forEach((s) => {
      cardsHtml += `
            <div class="kanban-card ${
              col.color
            }" draggable="${isAdmin}" ondragstart="drag(event, '${
        s.id
      }')" onclick="editStage('${s.id}')">
                <div class="fw-bold">${s.entreprise}</div>
                <div class="small">${s.poste}</div>
                <div class="small text-muted mt-1"><i class="bi bi-geo-alt"></i> ${
                  s.adresse || "?"
                }</div>
            </div>`;
    });

    container.innerHTML += `
        <div class="kanban-column" ondrop="drop(event, '${col.id}')" ondragover="allowDrop(event)">
            <div class="kanban-header">${col.title} <span class="badge bg-secondary float-end">${stagesInCol.length}</span></div>
            <div class="d-flex flex-column gap-2 flex-grow-1">${cardsHtml}</div>
        </div>`;
  });
}

// --- DRAG & DROP KANBAN (Global Functions) ---
window.allowDrop = (ev) => ev.preventDefault();
window.drag = (ev, id) => ev.dataTransfer.setData("text", id);
window.drop = async (ev, newStatus) => {
  ev.preventDefault();
  if (!isAdmin) return;
  const id = ev.dataTransfer.getData("text");
  // Cas spécial : Entretien et Suite vont dans la même colonne visuelle, mais on force "Entretien" par défaut si drop
  if (newStatus === "Entretien") newStatus = "Entretien";
  try {
    await updateDoc(doc(db, "stages", id), { etat: newStatus });
  } catch (e) {
    alert(e.message);
  }
};

// --- RENDER MAP ---
function initMap() {
  if (!map) {
    map = L.map("map-container").setView([46.603354, 1.888334], 5); // France centrée
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
    }).addTo(map);
  } else {
    map.invalidateSize(); // Important si le conteneur était caché
  }

  // Nettoyer les marqueurs existants
  markers.forEach((m) => map.removeLayer(m));
  markers = [];

  allStages.forEach((s) => {
    if (s.lat && s.lng) {
      let color = "blue"; // Par défaut
      if (s.etat === "Validé") color = "green";
      if (s.etat === "Refusé") color = "red";

      // Création d'une icône simple (on pourrait faire mieux)
      const marker = L.marker([s.lat, s.lng]).addTo(map);
      marker.bindPopup(
        `<b>${s.entreprise}</b><br>${s.poste}<br><span class="badge bg-secondary">${s.etat}</span><br><button onclick="editStage('${s.id}')" class="btn btn-sm btn-primary mt-2">Détails</button>`
      );
      markers.push(marker);
    }
  });
}

// --- GÉOCODING (Nominatim) ---
async function geocodeAdresse(adresse) {
  if (!adresse) return null;
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        adresse
      )}`
    );
    const data = await response.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch (e) {
    console.error("Erreur Géocoding", e);
  }
  return null;
}

// --- FORMULAIRE & CRUD ---
document.getElementById("stageForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!isAdmin) return;

  // On récupère les données
  const docId = document.getElementById("docId").value;
  const adresse = document.getElementById("adresse").value;

  // On tente de géocoder si l'adresse a changé ou pas de coords
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
    lat: coords.lat || null,
    lng: coords.lng || null,
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

// --- UI HELPERS ---
window.showForm = () => {
  document.getElementById("form-overlay").style.display = "flex";
  document.getElementById("form-title").innerText = "Ajouter un stage";
  document.getElementById("docId").value = "";
  document.getElementById("stageForm").reset();
  // Masquer bouton supprimer si nouveau
  document.getElementById("btnDeleteForm").style.display = "none";
};
window.hideForm = () =>
  (document.getElementById("form-overlay").style.display = "none");

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

  document.getElementById("form-title").innerText = "Modifier / Détails";
  document.getElementById("btnDeleteForm").style.display = "inline-block"; // Afficher suppression
  document.getElementById("form-overlay").style.display = "flex";
};

window.deleteStageFromForm = async () => {
  const id = document.getElementById("docId").value;
  if (isAdmin && id && confirm("Supprimer définitivement ?")) {
    await deleteDoc(doc(db, "stages", id));
    window.hideForm();
  }
};

function updateStats(stats) {
  const c = document.getElementById("stats-numbers");
  c.innerHTML = `
        <div class="col-4 mb-2"><div class="p-2 bg-primary text-white rounded shadow-sm"><h4 class="m-0 fw-bold">${stats.total}</h4><small style="font-size:0.6em">TOTAL</small></div></div>
        <div class="col-4 mb-2"><div class="p-2 bg-body-tertiary border border-warning text-warning rounded shadow-sm"><h4 class="m-0 fw-bold">${stats.attente}</h4><small style="font-size:0.6em">ATTENTE</small></div></div>
        <div class="col-4 mb-2"><div class="p-2 bg-info text-dark rounded shadow-sm"><h4 class="m-0 fw-bold">${stats.entretien}</h4><small style="font-size:0.6em">ENTR.</small></div></div>
        <div class="col-6"><div class="p-2 text-white rounded shadow-sm" style="background-color: #6610f2;"><h4 class="m-0 fw-bold">${stats.suite}</h4><small style="font-size:0.6em">SUITE</small></div></div>
        <div class="col-6"><div class="p-2 bg-success text-white rounded shadow-sm"><h4 class="m-0 fw-bold">${stats.valide}</h4><small style="font-size:0.6em">VALIDÉ</small></div></div>
    `;
  if (myChart) myChart.destroy();
  const ctx = document.getElementById("statsChart");
  let dataChart = [
    stats.attente,
    stats.entretien,
    stats.suite,
    stats.valide,
    stats.refuse,
  ];
  if (stats.total === 0) dataChart = [1];
  myChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Attente", "Entretien", "Suite", "Validé", "Refusé"],
      datasets: [
        {
          data: dataChart,
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
