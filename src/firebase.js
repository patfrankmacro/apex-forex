import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCLseJPInlsVdFPTuv_yujPiqToqsubXBU",
  authDomain: "pboy-frank-fx.firebaseapp.com",
  databaseURL: "https://pboy-frank-fx-default-rtdb.firebaseio.com",
  projectId: "pboy-frank-fx",
  storageBucket: "pboy-frank-fx.firebasestorage.app",
  messagingSenderId: "892979664134",
  appId: "1:892979664134:web:e950c73f7e4fb6009f3a87",
  measurementId: "G-8F0CQVKR8T"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
