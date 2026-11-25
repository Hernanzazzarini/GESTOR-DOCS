import { crearApp } from './app.js';
import { crearClienteDrive } from './config/drive.js';
import { leerEntorno } from './config/entorno.js';
import { crearLectorPerfil, crearVerificadorToken } from './servicios/usuarios.js';

const entorno = leerEntorno();

const app = crearApp({
  drive: crearClienteDrive(entorno.credenciales),
  rootFolderId: entorno.rootFolderId,
  verificarToken: crearVerificadorToken(entorno.firebaseProjectId),
  leerPerfil: crearLectorPerfil(entorno.firebaseProjectId),
  origenes: entorno.origenes,
});

app.listen(entorno.puerto, () => {
  console.log(`✅ API del gestor de documentación en http://localhost:${entorno.puerto}/api`);
  console.log(`   Orígenes permitidos: ${entorno.origenes.join(', ')}`);
});
