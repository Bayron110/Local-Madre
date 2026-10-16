import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  computed,
  input,
  output,
  viewChild,
} from '@angular/core';

type Modo = 'atendido' | 'pendiente' | 'otro';

@Component({
  selector: 'app-respuesta-solicitud',
  imports: [],
  templateUrl: './respuesta-solicitud.html',
  styleUrl: './respuesta-solicitud.css',
})
export class RespuestaSolicitud implements AfterViewInit {
  estado = input.required<string>();
  correo = input<string>('');
  enlace = input<string>('');
  solicitudId = input<string>('');

  cerrar = output<void>();

  readonly modo = computed<Modo>(() => {
    const e = this.estado().trim().toLowerCase();

    if (['atendido', 'atendida', 'emitida', 'facturada', 'aprobada', 'completada'].includes(e)) {
      return 'atendido';
    }
    if (e === 'pendiente') return 'pendiente';
    return 'otro';
  });

  // Solo se muestra el enlace si empieza con http:// o https://
  readonly enlaceSeguro = computed(() => {
    const url = this.enlace().trim();
    return /^https?:\/\//i.test(url) ? url : '';
  });

  private btnCerrar = viewChild<ElementRef<HTMLButtonElement>>('btnCerrar');

  ngAfterViewInit() {
    this.btnCerrar()?.nativeElement.focus();
  }

  @HostListener('document:keydown.escape')
  alPresionarEscape() {
    this.cerrar.emit();
  }

  // Cierra solo si se hace clic en el fondo oscuro, no dentro del modal
  alHacerClicEnFondo(evento: MouseEvent) {
    if (evento.target === evento.currentTarget) {
      this.cerrar.emit();
    }
  }
}