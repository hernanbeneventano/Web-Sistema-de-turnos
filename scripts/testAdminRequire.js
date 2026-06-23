// scripts/testAdminRequire.js
// Ejecutar: node scripts/testAdminRequire.js
try {
  const admin = require('firebase-admin');
  console.log('firebase-admin loaded. Keys:', Object.keys(admin));
  console.log('credential exists?', !!(admin && admin.credential && admin.credential.cert));
} catch (e) {
  console.error('require error:', e && e.stack ? e.stack : e);
}
