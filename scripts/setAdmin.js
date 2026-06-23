// scripts/setAdmin.js
// Uso: node scripts/setAdmin.js <USER_UID> [role]
// Requiere: colocar serviceAccountKey.json en la raíz del repo

const path = require('path');

// Modular imports for firebase-admin v14+
const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

const uid = process.argv[2];
const role = process.argv[3] || 'admin';

if (!uid) {
  console.error('Usage: node scripts/setAdmin.js <USER_UID> [role]');
  process.exit(1);
}

const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');
let serviceAccount;
try {
  serviceAccount = require(serviceAccountPath);
} catch (err) {
  console.error('No se pudo cargar serviceAccountKey.json. Descarga la clave desde Firebase Console y colócala en la raíz del repo como serviceAccountKey.json');
  console.error(err.message || err);
  process.exit(1);
}

// Compatibilidad: algunas versiones exportan `admin.credential.cert`, otras `admin.cert`
let adminCredential;
if (typeof cert === 'function') {
  adminCredential = cert(serviceAccount);
} else {
  console.error('No se encontró la función cert() en firebase-admin/app.');
  process.exit(1);
}

initializeApp({
  credential: adminCredential
});

async function main() {
  try {
    console.log(`Asignando custom claim role='${role}' al uid=${uid} ...`);
    const auth = getAuth();
    await auth.setCustomUserClaims(uid, { role });
    console.log('Custom claim establecido.');

    console.log('Actualizando documento users/{uid} en Firestore (merge)...');
    const db = getFirestore();
    await db.collection('users').doc(uid).set({ role }, { merge: true });
    console.log('Firestore actualizado.');

    console.log('Hecho. Pide al usuario que cierre sesión y vuelva a iniciar sesión para que el token se actualice.');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(2);
  }
}

main();
