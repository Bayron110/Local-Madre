import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { signOut } from 'firebase/auth';
import {
  equalTo,
  get,
  onValue,
  orderByChild,
  query,
  ref,
  Unsubscribe,
} from 'firebase/database';
import { auth, db } from '../../../../services/firebase';
import { RespuestaSolicitud } from '../respuesta-solicitud/respuesta-solicitud';

interface ProductoSolicitud {
  numero: number;
  producto: string;
  cantidadLibras: number;
}

interface Solicitud {
  id: string;
  tipo: 'valor' | 'productos';
  valorTotal: number;
  estado: string; // nombre del estado: pendiente, atendido...
  correoEnvio: string; // correo al que el admin envió la factura
  enlace: string; // enlace que proporciona el admin
  fecha: number | null;
  productos: ProductoSolicitud[];
}

@Component({
  selector: 'app-historial-solicitudes',
  imports: [DatePipe, RouterLink, DecimalPipe, RespuestaSolicitud],
  templateUrl: './historial-solicitudes.html',
  styleUrl: './historial-solicitudes.css',
})
export class HistorialSolicitudes implements OnInit, OnDestroy {
  solicitudes = signal<Solicitud[]>([]);
  cedula = signal('');
  correo = signal('');
  cargando = signal(true);
  error = signal('');

  // Solicitud abierta en el modal (se busca por id para que se actualice en vivo)
  private seleccionadaId = signal<string | null>(null);
  seleccionada = computed(
    () => this.solicitudes().find((s) => s.id === this.seleccionadaId()) ?? null
  );

  private detener?: Unsubscribe;
  private destruido = false;

  constructor(private router: Router) {}

  async ngOnInit() {
    try {
      await auth.authStateReady();
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('Sin sesión');

      // 1. Buscar la cédula y el correo del cliente logueado
      const consulta = query(ref(db, 'clientes'), orderByChild('uid'), equalTo(uid));
      const snapshot = await get(consulta);

      if (!snapshot.exists()) {
        this.error.set('No se encontraron los datos de tu cuenta.');
        this.cargando.set(false);
        return;
      }

      const datos = snapshot.val() as Record<string, { correo?: string }>;
      const cedula = Object.keys(datos)[0];
      if (this.destruido) return;
      this.cedula.set(cedula);
      this.correo.set(datos[cedula]?.correo ?? '');

      // 2. Escuchar sus solicitudes en tiempo real
      this.detener = onValue(
        ref(db, `clientes/${cedula}/solicitudes`),
        (snap) => {
          const lista: Solicitud[] = [];

          snap.forEach((hijo) => {
            const d = hijo.val();
            const estado = this.leerEstado(d.estado);

            lista.push({
              id: hijo.key ?? '',
              tipo: d.tipo === 'productos' ? 'productos' : 'valor',
              valorTotal: Number(d.valorTotal ?? 0),
              estado: estado.nombre,
              correoEnvio: estado.correo,
              enlace: estado.enlace,
              fecha: typeof d.fecha === 'number' ? d.fecha : null,
              productos: this.normalizarProductos(d.productos),
            });
          });

          // Más recientes primero
          lista.sort((a, b) => (b.fecha ?? 0) - (a.fecha ?? 0));

          this.solicitudes.set(lista);
          this.error.set('');
          this.cargando.set(false);
        },
        (err) => {
          console.error('Error al leer solicitudes:', err);
          this.error.set('No se pudieron cargar tus solicitudes.');
          this.cargando.set(false);
        }
      );
    } catch (e) {
      console.error('Error en historial:', e);
      this.error.set('No se pudieron cargar tus solicitudes. Intenta recargar la página.');
      this.cargando.set(false);
    }
  }

  ngOnDestroy() {
    this.destruido = true;
    this.detener?.(); // deja de escuchar la base al salir de la pantalla
  }

  // "estado" puede ser un texto ("pendiente") o un nodo con nombre, correo y enlace
  private leerEstado(raw: unknown): { nombre: string; correo: string; enlace: string } {
    if (raw && typeof raw === 'object') {
      const e = raw as Record<string, unknown>;
      return {
        nombre: String(e['nombre'] ?? 'pendiente'),
        correo: String(e['correo'] ?? ''),
        enlace: String(e['enlace'] ?? ''),
      };
    }

    return {
      nombre: typeof raw === 'string' && raw ? raw : 'pendiente',
      correo: '',
      enlace: '',
    };
  }

  // Firebase puede devolver "productos" como array con huecos (por claves 1, 2, 3...)
  private normalizarProductos(raw: unknown): ProductoSolicitud[] {
    if (!raw) return [];

    return Object.values(raw as Record<string, ProductoSolicitud | null>)
      .filter((p): p is ProductoSolicitud => !!p)
      .sort((a, b) => a.numero - b.numero);
  }

  etiquetaTipo(tipo: Solicitud['tipo']): string {
    return tipo === 'productos' ? 'Detalle de productos' : 'Solo valor de la factura';
  }

  claseEstado(estado: string): string {
    const e = estado.toLowerCase();
    if (['atendido', 'atendida', 'emitida', 'facturada', 'aprobada', 'completada'].includes(e)) {
      return 'estado-ok';
    }
    if (['rechazada', 'anulada', 'cancelada'].includes(e)) return 'estado-mal';
    return 'estado-pendiente';
  }

  abrirResultado(id: string) {
    this.seleccionadaId.set(id);
  }

  cerrarResultado() {
    this.seleccionadaId.set(null);
  }

  async cerrarSesion() {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
    await this.router.navigate(['/login']);
  }
}