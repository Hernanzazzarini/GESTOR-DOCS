# Avisos de vencimiento y planilla de registro

Este programa de Google (Apps Script) vive dentro de una planilla de Google en la carpeta
**Documentos generales**.

1. **Cada hora** actualiza la hoja **Documentos**, con una fila por cada archivo (PDF, Word o Excel): categoría, tipo,
   área, fechas, estado, responsable, a quién se avisa y el link.
2. **Todos los días, alrededor de las 7 de la mañana**, manda un mail al responsable de cada documento que llegó a uno de sus días de aviso.
   Las personas cargadas en "A quién avisar" van en copia.

Cuándo se avisa y a quién se configura en cada documento, desde el gestor (al subirlo o con **Editar**).

Es gratis: los mails salen de la cuenta de Google de la empresa de quien lo instala.
El límite es de 1.500 mails por día.

## Instalación (una sola vez, unos 10 minutos)

Hacelo con la cuenta **de la empresa** (la misma que tiene acceso a la Unidad compartida).

1. En Drive, entrá a **Documentos generales** → **Nuevo** → **Hojas de cálculo de Google** →
   **Hoja de cálculo en blanco**. Ponele de nombre **Registro de documentos**.
2. En la planilla: menú **Extensiones** → **Apps Script**. Se abre otra pestaña.
3. Arriba a la izquierda, donde dice "Proyecto sin título", ponele **Avisos de vencimiento**.
4. A la izquierda, en **Servicios**, tocá el **+** → buscá **Drive API** → versión **v3** →
   **Agregar**.
5. Tocá el archivo **Código.gs**, borrá todo lo que tiene y pegá el contenido de
   `apps-script/Avisos.gs`. Guardá con **Cmd + S**.
6. Volvé a la pestaña de la planilla y **recargala**. Arriba aparece el menú **Gestor de documentos**.
7. Menú **Gestor de documentos** → **Instalar tareas automáticas (una sola vez)**.
8. Google pide permiso:
   - Elegí tu cuenta de la empresa.
   - Si aparece "Google no verificó esta app", tocá **Configuración avanzada** → **Ir a
     Avisos de vencimiento**. Es normal: el programa es tuyo y no está publicado.
   - Tocá **Permitir**.
9. Si en el paso anterior se cortó, repetí el paso 7. Al final aparece un mensaje con cuántos
   documentos encontró y cuántos mails mandó.

Listo. Desde ese momento corre solo.

Si actualizás el código, pegalo de nuevo, guardá y repetí el paso 7. Así se reprograman las
tareas.

## Uso

- **Gestor de documentos → Actualizar ahora**: actualiza la planilla y manda los avisos que
  correspondan, sin esperar.
- No edites la hoja **Documentos** a mano: se reescribe en cada actualización. Podés usar los
  filtros de las columnas y crear otras hojas en la misma planilla para tus propios cálculos.
- Cada aviso se manda **una sola vez**. Si se cambia la fecha de vencimiento de un documento,
  los avisos vuelven a empezar.
- Si un día no corrió, o un documento se cargó cuando ya estaba cerca de vencer, se manda
  **un solo mail** con la situación actual, no uno por cada aviso atrasado.

## Si cambia algo

- Si cambia el ID de la carpeta Documentos generales o la dirección de la app, actualizá
  `CONFIG` al principio del código.
- Si la persona que lo instaló se va de la empresa, otra persona tiene que repetir la
  instalación con su cuenta. Los mails dejan de salir cuando se desactiva la cuenta de quien
  lo instaló.
