require('dotenv').config();  // Import dotenv package

const admin = require('firebase-admin');

// Check if the necessary environment variables are set
if (!process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL) {
  throw new Error("Missing Firebase environment variables.");
}

// Initialize Firebase Admin SDK using environment variables
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),  // Replace escaped newlines
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
  databaseURL: "https://dmbook-db210-default-rtdb.firebaseio.com"
});

const db = admin.database();
module.exports = db;
