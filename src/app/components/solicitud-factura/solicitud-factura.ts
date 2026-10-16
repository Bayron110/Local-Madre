import { Component, OnInit, signal } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { signOut } from 'firebase/auth';
import {
  DatabaseReference,
  equalTo,
  get,
  orderByChild,
  query,
  ref,
  serverTimestamp,
  set,
} from 'firebase/database';
import { auth, db } from '../../services/firebase';
import { miniaturaProducto } from './miniatures/producto-miniatura';

interface Cliente {
  codigoCliente: string;
  cedula: string;
  nombres: string;
  apellidos: string;
  telefono: string;
  correo: string;
  direccion: string;
}

type TipoSolicitud = 'valor' | 'productos';

type FilaProducto = FormGroup<{
  producto: FormControl<string>;
  cantidad: FormControl<number | null>;
}>;

@Component({
  selector: 'app-solicitud-factura',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './solicitud-factura.html',
  styleUrl: './solicitud-factura.css',
})
export class SolicitudFactura implements OnInit {
  // Datos del cliente
  cliente = signal<Cliente | null>(null);
  cargandoCliente = signal(true);
  errorCliente = signal('');

  // Solicitud
  tipo = signal<TipoSolicitud>('valor');
  enviando = signal(false);
  mensajeError = signal('');
  mensajeExito = signal('');

  private readonly MAX_SOLICITUDES_POR_DIA = 2;

  form;

  constructor(private fb: FormBuilder, private router: Router) {
    this.form = this.fb.group({
      productos: this.fb.array<FilaProducto>([]),
      valorTotal: [null as number | null, [Validators.required, Validators.min(0.01)]],
    });
  }

  get productos() {
    return this.form.controls.productos;
  }

  async ngOnInit() {
    await this.cargarCliente();
  }

  // ---------- Datos del cliente ----------
  private async cargarCliente() {
    this.cargandoCliente.set(true);
    this.errorCliente.set('');

    try {
      await auth.authStateReady();
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('Sin sesión');

      // Busca el cliente cuyo uid coincide con el usuario logueado
      const consulta = query(ref(db, 'clientes'), orderByChild('uid'), equalTo(uid));
      const snapshot = await get(consulta);

      if (!snapshot.exists()) {
        this.errorCliente.set('No se encontraron los datos de tu cuenta.');
        return;
      }

      const datos = snapshot.val() as Record<string, Cliente>;
      const cedula = Object.keys(datos)[0];
      this.cliente.set({ ...datos[cedula], cedula });
    } catch (error) {
      console.error('Error al cargar cliente:', error);
      this.errorCliente.set('No se pudieron cargar tus datos. Intenta recargar la página.');
    } finally {
      this.cargandoCliente.set(false);
    }
  }

  // ---------- Opciones de la solicitud ----------
  seleccionarTipo(tipo: TipoSolicitud) {
    this.tipo.set(tipo);
    this.mensajeError.set('');
    this.mensajeExito.set('');

    if (tipo === 'productos' && this.productos.length === 0) {
      this.agregarProducto();
    }
    if (tipo === 'valor') {
      this.productos.clear();
    }
  }

  agregarProducto() {
    const fila: FilaProducto = new FormGroup({
      producto: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(2)],
      }),
      cantidad: new FormControl<number | null>(null, [
        Validators.required,
        Validators.min(0.01),
      ]),
    });

    this.productos.push(fila);
  }

  quitarProducto(indice: number) {
    if (this.productos.length > 1) {
      this.productos.removeAt(indice);
    }
  }

  filaInvalida(indice: number, campo: 'producto' | 'cantidad'): boolean {
    const c = this.productos.at(indice).get(campo);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  totalInvalido(): boolean {
    const c = this.form.controls.valorTotal;
    return c.invalid && (c.touched || c.dirty);
  }

  // ---------- Miniatura según el producto escrito ----------
  miniatura(nombre: string | null | undefined) {
    return miniaturaProducto(nombre);
  }

  // ---------- Guardar ----------
  async solicitarFactura() {
    this.mensajeError.set('');
    this.mensajeExito.set('');

    const cliente = this.cliente();
    if (!cliente) {
      this.mensajeError.set('No se pudieron cargar tus datos. Recarga la página.');
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const valorTotal = Math.round(Number(this.form.controls.valorTotal.value) * 100) / 100;

    const solicitud: Record<string, unknown> = {
      tipo: this.tipo(),
      valorTotal,
      estado: 'pendiente',
      fecha: serverTimestamp(),
    };

    if (this.tipo() === 'productos') {
      const detalle: Record<string, { numero: number; producto: string; cantidadLibras: number }> =
        {};

      this.productos.controls.forEach((fila, i) => {
        const { producto, cantidad } = fila.getRawValue();
        detalle[String(i + 1)] = {
          numero: i + 1,
          producto: producto.trim(),
          cantidadLibras: Number(cantidad),
        };
      });

      solicitud['productos'] = detalle;
    }

    // ID de la solicitud = cédula + fecha (AAAAMMDD) + número del día (01 o 02)
    const hoy = new Date();
    const fecha =
      `${hoy.getFullYear()}` +
      String(hoy.getMonth() + 1).padStart(2, '0') +
      String(hoy.getDate()).padStart(2, '0');

    this.enviando.set(true);

    try {
      // Busca el primer cupo libre del día (máximo 2 por día)
      let numeroDelDia = 0;
      let rutaSolicitud: DatabaseReference | null = null;

      for (let n = 1; n <= this.MAX_SOLICITUDES_POR_DIA; n++) {
        const id = `${cliente.cedula}${fecha}${String(n).padStart(2, '0')}`;
        const ruta = ref(db, `clientes/${cliente.cedula}/solicitudes/${id}`);
        const existente = await get(ruta);

        if (!existente.exists()) {
          numeroDelDia = n;
          rutaSolicitud = ruta;
          break;
        }
      }

      if (!rutaSolicitud) {
        this.mensajeError.set(
          'Ya enviaste el máximo de 2 solicitudes de factura por hoy. Intenta mañana.'
        );
        return;
      }

      await set(rutaSolicitud, solicitud);

      this.mensajeExito.set(
        `¡Solicitud enviada correctamente! (${numeroDelDia} de ${this.MAX_SOLICITUDES_POR_DIA} de hoy)`
      );
      this.productos.clear();
      this.form.reset();
      if (this.tipo() === 'productos') this.agregarProducto();
    } catch (error) {
      console.error('Error al guardar solicitud:', error);
      this.mensajeError.set('No se pudo enviar la solicitud. Intenta nuevamente.');
    } finally {
      this.enviando.set(false);
    }
  }

  // ---------- Sesión ----------
  async cerrarSesion() {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
    await this.router.navigate(['/login']);
  }
}