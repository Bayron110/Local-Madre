import { Component, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { ref, serverTimestamp, set } from 'firebase/database';
import { auth, db } from '../../services/firebase';

// Validador de cédula ecuatoriana (algoritmo módulo 10)
function cedulaEcuatoriana(control: AbstractControl): ValidationErrors | null {
  const cedula: string = control.value ?? '';
  if (!/^\d{10}$/.test(cedula)) return { cedulaInvalida: true };

  const provincia = parseInt(cedula.substring(0, 2), 10);
  const tercerDigito = parseInt(cedula[2], 10);
  if (provincia < 1 || (provincia > 24 && provincia !== 30) || tercerDigito > 5) {
    return { cedulaInvalida: true };
  }

  let suma = 0;
  for (let i = 0; i < 9; i++) {
    let valor = parseInt(cedula[i], 10) * (i % 2 === 0 ? 2 : 1);
    if (valor > 9) valor -= 9;
    suma += valor;
  }
  const verificador = (10 - (suma % 10)) % 10;
  return verificador === parseInt(cedula[9], 10) ? null : { cedulaInvalida: true };
}

@Component({
  selector: 'app-registro',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './registro.html',
  styleUrl: './registro.css',
})
export class Registro {
  mostrarPassword = false;

  cargando = signal(false);
  mensajeError = signal('');
  mensajeExito = signal('');

  form;

  constructor(private fb: FormBuilder, private router: Router) {
    this.form = this.fb.group({
      cedula: ['', [Validators.required, cedulaEcuatoriana]],
      nombres: ['', [Validators.required, Validators.minLength(3)]],
      apellidos: ['', [Validators.required, Validators.minLength(3)]],
      telefono: ['', [Validators.required, Validators.pattern(/^(09\d{8}|0[2-7]\d{7})$/)]],
      correo: ['', [Validators.required, Validators.email]],
      direccion: ['', [Validators.required, Validators.minLength(10)]],
      password: ['', [Validators.required, Validators.minLength(8)]],
    });
  }

  campoInvalido(nombre: string): boolean {
    const c = this.form.get(nombre);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  async registrar() {
    this.mensajeError.set('');
    this.mensajeExito.set('');

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { cedula, nombres, apellidos, telefono, correo, direccion, password } =
      this.form.getRawValue();

    // El código del cliente es su número de cédula
    const codigoCliente = cedula!.trim();

    this.cargando.set(true);

    try {
      // 1. Crear el usuario en Firebase Authentication
      const credencial = await createUserWithEmailAndPassword(
        auth,
        correo!.trim(),
        password!
      );

      try {
        // 2. Guardar los datos en Realtime Database usando la cédula como clave
        await set(ref(db, `clientes/${codigoCliente}`), {
          codigoCliente,
          uid: credencial.user.uid,
          cedula: codigoCliente,
          nombres: nombres!.trim(),
          apellidos: apellidos!.trim(),
          telefono: telefono!.trim(),
          correo: correo!.trim().toLowerCase(),
          direccion: direccion!.trim(),
          fechaRegistro: serverTimestamp(),
        });
      } catch (errorBd) {
        // Si no se pudo guardar (p. ej. cédula ya registrada), se elimina
        // la cuenta recién creada para no dejar usuarios huérfanos.
        await credencial.user.delete();
        throw errorBd;
      }

      this.mensajeExito.set(
        `¡Registro exitoso! Tu código de cliente es ${codigoCliente}. Redirigiendo...`
      );
      this.form.reset();

      setTimeout(() => this.router.navigate(['/login']), 2000);
    } catch (error: any) {
      console.error('Error Firebase:', error?.code, error?.message);
      this.mensajeError.set(this.traducirError(error?.code, error?.message));
    } finally {
      this.cargando.set(false);
    }
  }

  private traducirError(codigo: string, mensaje?: string): string {
    if (codigo === 'auth/email-already-in-use') return 'Este correo ya está registrado.';
    if (codigo === 'auth/invalid-email') return 'El correo electrónico no es válido.';
    if (codigo === 'auth/weak-password') return 'La contraseña es muy débil (mínimo 8 caracteres).';
    if (codigo === 'auth/operation-not-allowed')
      return 'El registro con correo y contraseña no está habilitado en Firebase.';
    if (codigo === 'auth/configuration-not-found')
      return 'Authentication no está configurado en el proyecto de Firebase.';
    if (codigo === 'auth/network-request-failed')
      return 'Error de conexión. Revisa tu internet e intenta de nuevo.';
    if (mensaje?.toLowerCase().includes('permission_denied'))
      return 'Esta cédula ya está registrada o no hay permisos para guardar los datos.';
    return 'No se pudo completar el registro. Intenta nuevamente.';
  }
}