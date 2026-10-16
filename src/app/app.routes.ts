import { Routes } from '@angular/router';

import { guardLoginGuard, guestGuard } from './guard/login/guard-login-guard';
import { Login } from './components/login/login';
import { Registro } from './components/registro/registro';
import { SolicitudFactura } from './components/solicitud-factura/solicitud-factura';
import { HistorialSolicitudes } from './components/solicitud-factura/components/historial-solicitudes/historial-solicitudes';

export const routes: Routes = [
    { path: '', redirectTo: 'login', pathMatch: 'full' },
    { path: 'login', component: Login, canMatch: [guestGuard] },
    { path: 'registro', component: Registro, canMatch: [guestGuard] },
    { path: 'historial', component: HistorialSolicitudes, canMatch: [guardLoginGuard] },
    { path: 'solicitud-factura', component: SolicitudFactura, canMatch: [guardLoginGuard] },
    { path: '**', redirectTo: 'login' },
];