# 🚀 **Hub de Suivi de Stage**

![Statut du projet](https://img.shields.io/badge/Status-Actif-success)
![Sécurité](https://img.shields.io/badge/Security-Firebase_Auth-blue)
![Hébergement](https://img.shields.io/badge/Host-GitHub_Pages-lightgrey)

Une application web moderne **Serverless** conçue pour optimiser la recherche de stage, centraliser les candidatures et automatiser le suivi des relances.

---

## 📋 **Présentation**

**Hub de Suivi de Stage** transforme un simple tableau Excel en une véritable **application web intelligente**.  
Elle offre une vue claire et dynamique de toutes les candidatures, des relances à effectuer, et des statistiques en temps réel.

### 👥 Double Authentification & Rôles

- **👑 Admin (Moi)**  
  → Accès complet : Ajout, Modification, Suppression, Validation des relances  
- **👀 Visiteur (Recruteur / Ami)**  
  → Accès lecture seule sécurisé, données sensibles masquées

---

## ✨ **Fonctionnalités Clés**

### 🧠 **Intelligence & Automatisation**

- **Auto-Refus (21 jours)** : Les candidatures sans réponse passent automatiquement en *Refusé* après 21 jours.  
- **Relance Automatique** : La prochaine relance est générée automatiquement **J+7** après l’envoi.  
- **Compteur de Jours** : Affichage dynamique du délai (ex : **(5j)**, **(13j)**).

---

## 📊 **Tableau de Bord & Interface**

- **Graphique Interactif** : Diagramme en beignet mis à jour en temps réel (Chart.js)  
- **Mode Sombre Premium** : Design moderne gris anthracite  
- **Logos Automatiques** : Avatars générés selon le nom de l’entreprise  
- **Filtres Dynamiques** : Recherche instantanée par nom, ville, statut  

---

## 🛡️ **Sécurité & Gestion des Accès**

- **Authentification GitHub OAuth**  
- **Mode Invité Anonyme**  
- **Protection des Données**
  - Emails visibles **uniquement** par l’Admin  
  - Boutons d’action masqués pour les invités  
  - Dates précises de relance cachées pour les invités  
  - Affichage simplifié : *"Sans réponse depuis X jours"*  

---

## 💾 **Export & Données**

- **Export CSV instantané** (format Excel ; séparateur `;`)  
- **Persistance Cloud** via **Google Firestore (NoSQL temps réel)**  

---

## 🛠️ **Stack Technique**

- **Frontend** : HTML5, CSS3, JavaScript (ES6 Modules)  
- **UI** : Bootstrap 5 + Bootstrap Icons  
- **Backend Serverless** : Google Firebase  
- **Base de données** : Firestore  
- **Auth** : GitHub + Anonyme  
- **Graphiques** : Chart.js  
- **Hébergement** : GitHub Pages  

---

## ⚙️ **Installation (Développeurs)**

### 🔧 1. Cloner le dépôt
git clone https://github.com/Vasla13/mon-suivi-stage.git

🔧 2. Configurer Firebase

Créer un projet sur Firebase Console

Activer :

Firestore Database

Authentication → GitHub + Anonyme

Ajouter les clés dans app.js :

const firebaseConfig = {
  apiKey: "VOTRE_API_KEY",
  // ...
};

🔧 3. Définir l'Administrateur
const ADMIN_UID = "VOTRE_UID_ADMIN";


Récupérable dans : Firebase → Authentication → UID utilisateur.

🔧 4. Déploiement sur GitHub Pages

Paramètres → Pages

Source : main

Le site est automatiquement publié.

🔒 Règles de Sécurité Firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {

      // Tout utilisateur connecté (invité ou admin) peut lire
      allow read: if request.auth != null;
      
      // Seul l'admin peut modifier les données
      allow write: if request.auth.uid == "UID_DE_L_ADMIN";
    }
  }
}

📸 Aperçu des Statuts

🟡 En attente

🔵 Entretien prévu

🟣 Suite Entretien

🟢 Validé

🔴 Refusé

👤 Auteur

Projet développé par Eric Petersen dans le cadre de ma recherche de stage.
🔗 Profil GitHub : https://github.com/Vasla13

```bash
git clone https://github.com/VOTRE-PSEUDO/mon-suivi-stage.git
