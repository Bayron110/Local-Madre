import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
    apiKey: 'AIzaSyDSBIGBvltKr9KOfmNwPXPNo2OxEFzwTp0',
    authDomain: 'solicitud-factura.firebaseapp.com',
    databaseURL: 'https://solicitud-factura-default-rtdb.firebaseio.com',
    projectId: 'solicitud-factura',
    storageBucket: 'solicitud-factura.firebasestorage.app',
    messagingSenderId: '1080614553134',
    appId: '1:1080614553134:web:4207d9c9b381f231a881bf',
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Servicios
export const auth = getAuth(app);
export const db = getDatabase(app);