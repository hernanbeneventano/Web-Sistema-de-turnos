/**
 * SALUD GOYA - Configuración de Firebase (firebase-config.js)
 * Inicializa Firebase Auth y Firestore.
 */

 const firebaseConfig = {
    apiKey: "AIzaSyDvTIw1I9d1qmDm0EprxogtJnLNdD4sp-U",
    authDomain: "web-sistema-de-turnos.firebaseapp.com",
    projectId: "web-sistema-de-turnos",
    storageBucket: "web-sistema-de-turnos.firebasestorage.app",
    messagingSenderId: "675558617543",
    appId: "1:675558617543:web:c992b1d4505bf2a70629e2",
    measurementId: "G-TS23Z59QLR"
  };

// Bandera para indicar si Firebase está activo y configurado
let firebaseEnabled = false;

if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "TU_API_KEY_AQUI") {
    try {
        // Inicializar Firebase
        firebase.initializeApp(firebaseConfig);
        window.auth = firebase.auth();
        window.firestore = firebase.firestore();
        firebaseEnabled = true;
        console.log("Firebase inicializado correctamente.");
    } catch (error) {
        console.error("Error al inicializar Firebase:", error);
    }
} else {
    console.warn("Firebase no está configurado aún. La aplicación funcionará en modo de simulación local (localStorage).");
}

window.firebaseEnabled = firebaseEnabled;
