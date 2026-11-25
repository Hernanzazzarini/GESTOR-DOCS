import { pantallasPermitidas, puedeEliminar, rutaInicial } from './permisos';

describe('permisos', () => {
  it('el admin ve todos los módulos aunque tenga una lista vacía', () => {
    expect(pantallasPermitidas({ rol: 'admin', pantallas: [] })).toEqual(['documentos']);
  });

  it('sin permisos propios se usan los del rol', () => {
    expect(pantallasPermitidas({ rol: 'operador' })).toEqual(['documentos']);
  });

  it('con permisos propios se usan esos (e ignora ids que ya no existen)', () => {
    expect(pantallasPermitidas({ rol: 'operador', pantallas: [] })).toEqual([]);
    expect(pantallasPermitidas({ rol: 'operador', pantallas: ['viejo' as any, 'documentos'] })).toEqual([
      'documentos',
    ]);
  });

  it('sin perfil no ve nada y no tiene ruta inicial', () => {
    expect(pantallasPermitidas(null)).toEqual([]);
    expect(rutaInicial(null)).toBeNull();
  });

  it('todos los que tienen algún módulo entran por Inicio', () => {
    expect(rutaInicial({ rol: 'operador' })).toBe('/');
    expect(rutaInicial({ rol: 'admin', pantallas: [] })).toBe('/');
    expect(rutaInicial({ rol: 'operador', pantallas: [] })).toBeNull();
  });

  it('solo admin y encargado eliminan', () => {
    expect(puedeEliminar({ rol: 'admin' })).toBe(true);
    expect(puedeEliminar({ rol: 'encargado' })).toBe(true);
    expect(puedeEliminar({ rol: 'operador' })).toBe(false);
  });
});
