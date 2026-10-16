import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { auth } from '../../services/firebase';

// Protege las pantallas privadas: solo pasa quien tiene sesión iniciada
export const guardLoginGuard: CanMatchFn = async () => {
  const router = inject(Router);
  await auth.authStateReady(); // espera a que Firebase restaure la sesión

  return auth.currentUser ? true : router.createUrlTree(['/login']);
};

// Evita que un usuario ya logueado vea login o registro
export const guestGuard: CanMatchFn = async () => {
  const router = inject(Router);
  await auth.authStateReady();

  return auth.currentUser ? router.createUrlTree(['/solicitud-factura']) : true;
};