const express = require("express");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");
const methodOverride = require("method-override");

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, "data", "stages.json");

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(methodOverride("_method"));

function getStages() {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    const data = fs.readFileSync(DATA_FILE, "utf8");
    return data ? JSON.parse(data) : [];
  } catch (error) {
    return [];
  }
}

function saveStages(stages) {
  if (!fs.existsSync(path.dirname(DATA_FILE)))
    fs.mkdirSync(path.dirname(DATA_FILE));
  fs.writeFileSync(DATA_FILE, JSON.stringify(stages, null, 2));
}

// --- ROUTES ---

app.get("/", (req, res) => {
  let stages = getStages();
  const query = req.query.q ? req.query.q.toLowerCase() : null;

  if (query) {
    stages = stages.filter(
      (s) =>
        s.entreprise.toLowerCase().includes(query) ||
        s.poste.toLowerCase().includes(query)
    );
  }

  stages.sort((a, b) => {
    if (a.dateRelance && !b.dateRelance) return -1;
    if (!a.dateRelance && b.dateRelance) return 1;
    if (a.dateRelance && b.dateRelance)
      return new Date(a.dateRelance) - new Date(b.dateRelance);
    return 0;
  });

  const stats = {
    total: stages.length,
    attente: stages.filter((s) => s.etat === "En attente").length,
    entretien: stages.filter((s) => s.etat === "Entretien").length,
    valide: stages.filter((s) => s.etat === "Validé").length,
  };

  const today = new Date().toISOString().split("T")[0];
  res.render("index", { stages, stats, today, search: req.query.q });
});

app.get("/nouveau", (req, res) => {
  res.render("form", { stage: null, title: "Ajouter un stage" });
});

app.post("/stages", (req, res) => {
  const stages = getStages();
  stages.push({
    id: Date.now().toString(),
    entreprise: req.body.entreprise,
    poste: req.body.poste,
    etat: req.body.etat,
    dateEnvoi: req.body.dateEnvoi, // NOUVEAU CHAMP
    dateRelance: req.body.dateRelance,
    dateDebut: req.body.dateDebut,
    lien: req.body.lien,
    notes: req.body.notes,
  });
  saveStages(stages);
  res.redirect("/");
});

app.get("/edit/:id", (req, res) => {
  const stages = getStages();
  const stage = stages.find((s) => s.id === req.params.id);
  stage ? res.render("form", { stage, title: "Modifier" }) : res.redirect("/");
});

app.put("/stages/:id", (req, res) => {
  let stages = getStages();
  const index = stages.findIndex((s) => s.id === req.params.id);
  if (index !== -1) {
    stages[index] = { ...stages[index], ...req.body };
    saveStages(stages);
  }
  res.redirect("/");
});

app.delete("/stages/:id", (req, res) => {
  let stages = getStages();
  stages = stages.filter((s) => s.id !== req.params.id);
  saveStages(stages);
  res.redirect("/");
});

app.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
});
