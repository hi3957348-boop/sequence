import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth }       from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore }  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyCO4NF_xsn0u9PkcYVnudx7MwGRpIwgUiQ",
  authDomain:        "sequence-df2e5.firebaseapp.com",
  projectId:         "sequence-df2e5",
  storageBucket:     "sequence-df2e5.firebasestorage.app",
  messagingSenderId: "86026836998",
  appId:             "1:86026836998:web:48f5ea97e2d4a0d97ff787"
};

const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db   = getFirestore(firebaseApp);
