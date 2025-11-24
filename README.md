# 🚀 Mon Suivi de Stage (Internship Tracker)

Une application web moderne "Serverless" pour suivre efficacement ses candidatures de stage, gérer les relances et analyser ses statistiques.

![Statut du projet](https://img.shields.io/badge/Status-Actif-success)
![Sécurité](https://img.shields.io/badge/Security-Firebase_Auth-blue)
![Hébergement](https://img.shields.io/badge/Host-GitHub_Pages-lightgrey)

## 📋 Présentation

Ce projet est né du besoin d'organiser ma recherche de stage. Plutôt que d'utiliser un fichier Excel classique, j'ai développé une application web complète qui permet de centraliser toutes les informations, avec un système de rappel intelligent pour les relances.

L'application est sécurisée : seul l'administrateur (moi) peut modifier les données, tandis que les visiteurs peuvent consulter le tableau de bord en mode "Lecture seule".

### ✨ Fonctionnalités Principales

* **Gestion CRUD complète** : Ajouter, Modifier, Supprimer des candidatures.
* **Tableau de Bord** : Statistiques en temps réel (Total, En attente, Entretiens, Validés).
* **Calcul Intelligent des Dates** : Calcul automatique de la date de relance (J+7) dès la saisie de la date d'envoi.
* **Système d'Alertes Visuelles** :
    * 🔴 Rouge : Relance en retard.
    * 🟠 Orange : Relance à faire aujourd'hui.
    * ⚪ Gris : Relance future.
* **Authentification GitHub** : Connexion sécurisée sans mot de passe via OAuth.
* **Gestion des Rôles (RBAC)** :
    * 👑 **Admin** : Accès complet (Écriture/Lecture).
    * 👀 **Guest** : Accès visiteur (Lecture seule, boutons d'action masqués).
* **Responsive** : Interface adaptée mobile et desktop (Bootstrap 5).

---

## 🛠️ Stack Technique

Ce projet utilise une architecture **Serverless**.

* **Frontend** : HTML5, CSS3, JavaScript (ES6 Modules).
* **Framework UI** : Bootstrap 5.3 + Bootstrap Icons.
* **Backend (BaaS)** : Google Firebase Firestore (Base de données NoSQL temps réel).
* **Authentification** : Firebase Authentication (Provider GitHub).
* **Hébergement** : GitHub Pages.

---

## 🔒 Sécurité & Architecture

La sécurité repose sur deux niveaux :

1.  **Côté Client (UX)** : Le JavaScript détecte l'UID de l'utilisateur connecté. Si ce n'est pas l'UID de l'administrateur, l'interface masque les boutons d'édition et passe en mode "Invité".
2.  **Côté Serveur (Firestore Rules)** : Les règles de sécurité Firebase bloquent physiquement toute tentative d'écriture venant d'un autre utilisateur que l'admin.

**Extrait des règles de sécurité Firestore :**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      // Tout le monde peut voir (Portfolio)
      allow read: if request.auth != null;
      // Seul l'admin peut toucher aux données
      allow write: if request.auth.uid == "MON_UID_ADMIN_SECRET";
    }
  }
}