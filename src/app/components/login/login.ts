import { Component, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../services/firebase';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  mostrarPassword = false;

  cargando = signal(false);
  mensajeError = signal('');

  form;

  constructor(private fb: FormBuilder, private router: Router) {
    this.form = this.fb.group({
      correo: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
    });
  }

  campoInvalido(nombre: string): boolean {
    const c = this.form.get(nombre);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  async iniciarSesion() {
    this.mensajeError.set('');

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { correo, password } = this.form.getRawValue();
    this.cargando.set(true);

    try {
      await signInWithEmailAndPassword(auth, correo!.trim(), password!);
      await this.router.navigate(['/solicitud-factura']);
    } catch (error: any) {
      console.error('Error Firebase:', error?.code);
      this.mensajeError.set(this.traducirError(error?.code));
    } finally {
      this.cargando.set(false);
    }
  }

  private traducirError(codigo: string): string {
    switch (codigo) {
      // Mensaje genérico a propósito: no revela si el correo existe o no
      case 'auth/invalid-credential':
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-email':
        return 'Correo o contraseña incorrectos.';
      case 'auth/user-disabled':
        return 'Esta cuenta ha sido deshabilitada.';
      case 'auth/too-many-requests':
        return 'Demasiados intentos fallidos. Espera unos minutos e intenta de nuevo.';
      case 'auth/network-request-failed':
        return 'Error de conexión. Revisa tu internet e intenta de nuevo.';
      default:
        return 'No se pudo iniciar sesión. Intenta nuevamente.';
    }
  }
}