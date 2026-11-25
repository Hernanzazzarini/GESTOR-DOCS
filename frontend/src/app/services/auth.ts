import { Injectable, inject } from '@angular/core';
import { Auth, signInWithEmailAndPassword, signOut, user, User } from '@angular/fire/auth';
import { Firestore, collection, doc, getDoc, getDocs, setDoc, updateDoc } from '@angular/fire/firestore';
import { deleteApp, initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { Observable, from, map, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';
import { Pantalla, Perfil, Rol, pantallasPermitidas } from '../permisos';

export type { Rol } from '../permisos';

// Igual que en el PCC4: login con correo y contraseña de Firebase, y el rol y las
// pantallas de cada usuario en el documento users/{uid} de Firestore.
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private auth: Auth = inject(Auth);
  private firestore: Firestore = inject(Firestore);

  // Observable que emite el usuario actual de Firebase Authentication
  user$: Observable<User | null> = user(this.auth);

  // Iniciar sesión con correo y contraseña
  login(email: string, pass: string): Observable<any> {
    return from(signInWithEmailAndPassword(this.auth, email, pass));
  }

  // Cerrar sesión
  logout(): Observable<any> {
    return from(signOut(this.auth));
  }

  /**
   * Token del usuario conectado para mandarle al back end ("Authorization: Bearer ...").
   * Firebase lo renueva solo cuando está por vencer.
   */
  async tokenId(): Promise<string | null> {
    await this.auth.authStateReady();
    return this.auth.currentUser ? this.auth.currentUser.getIdToken() : null;
  }

  // Rol y pantallas del usuario actual según su documento en Firestore (null si no hay sesión o documento)
  perfil(): Observable<Perfil | null> {
    return this.user$.pipe(
      switchMap(async (user) => {
        if (!user) return null;

        const userSnap = await getDoc(doc(this.firestore, `users/${user.uid}`));
        if (!userSnap.exists()) return null;
        const data = userSnap.data();
        return { rol: data['role'] as Rol, pantallas: data['pantallas'] as Pantalla[] | undefined };
      }),
    );
  }

  rol(): Observable<Rol | null> {
    return this.perfil().pipe(map((perfil) => perfil?.rol ?? null));
  }

  // Pantallas que el usuario actual puede abrir
  pantallas(): Observable<Pantalla[]> {
    return this.perfil().pipe(map(pantallasPermitidas));
  }

  /** Mails de todos los usuarios registrados, ordenados (para elegir responsable y a quién avisar). */
  async emailsUsuarios(): Promise<string[]> {
    const snap = await getDocs(collection(this.firestore, 'users'));
    const emails = snap.docs.map((d) => String(d.data()['email'] ?? '').toLowerCase()).filter(Boolean);
    return [...new Set(emails)].sort();
  }

  // Guarda las pantallas habilitadas de un usuario (solo admin, por las reglas)
  async guardarPantallas(uid: string, pantallas: Pantalla[]): Promise<void> {
    await updateDoc(doc(this.firestore, `users/${uid}`), { pantallas });
  }

  // Verificar si el usuario actual es administrador consultando Firestore
  isAdmin(): Observable<boolean> {
    return this.rol().pipe(map((rol) => rol === 'admin'));
  }

  /**
   * Crea un usuario nuevo (Authentication + documento en `users`) sin cerrar la sesión del admin.
   * createUserWithEmailAndPassword inicia sesión con la cuenta creada, así que se usa una
   * instancia secundaria de Firebase que se descarta al terminar.
   */
  async crearUsuario(email: string, pass: string, role: Rol, pantallas: Pantalla[]): Promise<string> {
    const appSecundaria = initializeApp(environment.firebase, `alta-usuario-${Date.now()}`);
    try {
      const authSecundaria = getAuth(appSecundaria);
      const cred = await createUserWithEmailAndPassword(authSecundaria, email, pass);
      await signOut(authSecundaria);

      // El documento lo escribe la sesión del admin (las reglas solo permiten escribir a admins)
      await setDoc(doc(this.firestore, `users/${cred.user.uid}`), {
        email,
        role,
        pantallas,
        createdAt: new Date(),
      });
      return cred.user.uid;
    } finally {
      await deleteApp(appSecundaria);
    }
  }

  // Método auxiliar para crear el primer usuario administrador manualmente si hace falta
  async crearUsuarioAdmin(uid: string, email: string) {
    const userRef = doc(this.firestore, `users/${uid}`);
    await setDoc(userRef, { email, role: 'admin', createdAt: new Date() }, { merge: true });
  }
}
