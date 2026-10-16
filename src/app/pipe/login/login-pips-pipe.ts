import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'loginPips',
})
export class LoginPipsPipe implements PipeTransform {
  transform(value: string | null | undefined, visibles: number = 2): string {
    if (!value) return '';

    const texto = String(value);
    if (texto.length <= visibles * 2) return texto;

    const ocultos = '*'.repeat(texto.length - visibles * 2);
    return texto.slice(0, visibles) + ocultos + texto.slice(-visibles);
  }
}