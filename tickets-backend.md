# Tickets de backend

Instrucciones para implementar BE-0 a BE-4 en este repositorio. El contrato cerrado está en `Abathur/roadmap.html` (secciones 4 y 8) y las tarjetas salen de `Abathur/backlog.html`. Si este archivo y el roadmap se contradicen, manda el roadmap y después se actualiza este archivo.

Hoy el repo no tiene commits. El remoto es `https://github.com/melonchelo/Abathur-back.git` y `origin/main` no tiene historia local. No hay código que reutilizar.

Fecha de referencia de este archivo: 7/11/2026. BE-0 (28/10) y BE-1 (3/11) ya vencieron sin código. BE-2 vence el lunes 9/11. El orden de implementación no cambia: BE-0, después BE-1, después BE-2.

## Stack y reglas que valen para todos los tickets

- Express, TypeScript strict y SQLite con `better-sqlite3`.
- Prohibido `any`, `as any` y objetos genéricos. `strict`, `noImplicitAny` y `@typescript-eslint/no-explicit-any` en error.
- Base `http://localhost:3000/api`.
- Identificadores `string`. Fechas `string` ISO. Estados: uniones de literales, el mismo literal viaja en el JSON.
- Los tipos se escriben a mano en este repo. El front los duplica. El JSON es el contrato.
- Todo error responde `{ code: string; message: string }` con el status HTTP que corresponda.
- Cada escritura vuelve a chequear el rol en el servidor. El rol del cliente no alcanza.
- Una cuenta, un rol: `admin` | `moderador` | `cliente`.
- El archivo SQLite no se commitea. La semilla se recrea con un script.
- CORS abierto al puerto de Angular (`http://localhost:4200`).
- `ArticleLink`, sanciones del documento maestro, adjuntos, recuperación de contraseña, búsqueda full-text y el índice para una IA quedan fuera. La ruta `POST /users/:id/sanctions` de BE-4 es solo el evento manual `conducta_abusiva`.

### Peso, voto y reputación

```
peso = min(5, max(1, Math.floor(reputacion / 10)))
```

El cliente puede mostrar una previa. El peso que vale es el que calcula el servidor al guardar el voto (`weight_at_vote`).

Un voto por moderador y propuesta. No se edita. La elección es `a_favor` o `en_contra`. No hay abstención.

El puntaje de reputación es la suma de los eventos. Publicar, comentar, votar o rechazar una propuesta no cambia la reputación.

| Evento | Delta | Cuándo | `source_id` |
|---|---|---|---|
| `asignacion_inicial` | el valor inicial | al crear la cuenta | id de usuario |
| `aporte_respaldado` | +5 al autor de la propuesta | el administrador acepta | id de propuesta |
| `error_comprobado` | −5 a quien publicó la versión de base | acepta una modificación y marca el contenido anterior como error | id de propuesta |
| `conducta_abusiva` | −8 | acción manual del administrador, con motivo | id del registro de auditoría de esa acción |

La unicidad de `user_id + event_type + source_id` impide repetir un respaldo o un error. La conducta abusiva puede repetirse porque cada acción crea una auditoría nueva.

### Contenido Markdown

`ArticleVersion.content` y el cuerpo de `ProposedArticle` son un `string` Markdown. En esta entrega se admiten `#`, `##`, párrafos y listas con `-`. El POST rechaza el cuerpo si trae una etiqueta HTML y, si lo acepta, lo guarda igual a como llegó. El servidor no renderiza HTML.

### Estados de propuesta

`abierta` → `en_votacion` → `recomendada` | `desaconsejada` | `controvertida` → `aceptada` | `rechazada`.

El cierre comunitario no publica ni cierra el artículo. Solo la decisión del administrador pasa la propuesta a `aceptada` o `rechazada`. `desaconsejada` espera al administrador igual que `recomendada`. `controvertida` no vence.

`underReview` de un artículo es verdadero cuando existe una propuesta de ese artículo cuyo estado no es `aceptada` ni `rechazada`.

## BE-0 · Login, `/me` y GET con semilla

Vencimiento original: 28/10/2026. Desbloquea F-07, F-10, F-11, F-12, F-14, F-15, F-16 y F-17.

Sin este ticket el front no puede mostrar ninguna pantalla contra HTTP real. Es el primer commit del repo.

### Qué construir

1. Proyecto TypeScript strict, Express y SQLite. Carpetas de modelos, acceso a datos y HTTP.
2. `POST /auth/login` con usuario y contraseña. Responde un JWT que incluye el rol. Una cuenta desactivada no entra.
3. `GET /me` lee el token y devuelve el usuario actual.
4. GET autenticados de artículos, versiones, categorías, propuestas, comentarios, votos, reputación y auditoría. Leen la semilla. El detalle de artículo incluye `underReview` calculado.
5. Búsqueda `GET /articles?q=&categoryId=`. `q` busca en título y resumen. `categoryId` es exacto. El cuerpo del artículo no entra en esta búsqueda.
6. Script de semilla repetible y CORS para Angular.

### Semilla mínima

Contraseña de todas las cuentas: `abathur`.

| Persona | Rol | Reputación | Para qué |
|---|---|---|---|
| Lucía | admin | la que corresponda al alta | decisión y usuarios |
| Tomás | moderador | 30 | peso 3 |
| Sofía | moderador | 30 | peso 3 |
| Raúl | moderador | 10 | peso 1 |
| Ana | cliente | 10 | propuestas y comentarios |
| un segundo cliente | cliente | 10 | el mockup no le pone nombre |

Categorías: Operación → Turnos, Operación → Caja, Seguridad.

Artículos:

- Uno vigente con propuesta en curso, para el aviso de revisión. El cuerpo es Markdown y tiene al menos un encabezado. El ejemplo del mockup es «Apertura de caja», versión 2.
- Otro con versión 1 y versión 2, para el historial inmutable.

Propuestas, una de cada estado: `abierta`, `en_votacion` con 2 votos, `recomendada`, `desaconsejada`, `controvertida`, `aceptada`, `rechazada` por el administrador con motivo, y `aceptada` excepcional con un solo voto.

También eventos de reputación y una fila de auditoría.

### Listo cuando

- El JWT trae el rol y una cuenta inactiva no entra.
- Cada GET de la lista responde con la semilla y tipos literales.
- Hay un artículo cuyo cuerpo es Markdown con un encabezado.
- CORS deja pasar el puerto de Angular.
- Se puede borrar el SQLite y volver a crearlo con el script.

## BE-1 · POST de artículos, categorías, propuestas y comentarios, y apertura de votación

Vencimiento original: 3/11/2026. Desbloquea F-18, F-20, F-21, F-26 y F-27. Depende de BE-0.

### Qué construir

1. `POST /articles`, solo admin. Crea el artículo y su versión 1. No reescribe una versión existente. `version_number` es único por artículo. `content` se guarda tal cual si es Markdown y se rechaza si trae una etiqueta HTML.
2. `POST /categories` y `PATCH /categories/:id`, solo admin. Una categoría no puede ser su propio padre ni formar un ciclo.
3. `POST /proposals`. Cliente y moderador. El cuerpo es el objeto tipado: título, resumen, contenido Markdown, categoría, etiquetas y fuentes `{ title, url }`. La creación no tiene artículo ni versión de base. La modificación guarda `articleId` y `baseVersionId`. Arranca en `abierta`. El mismo rechazo de HTML aplica al contenido propuesto.
4. `POST /proposals/:id/comments`. Cliente y moderador. Comentario plano, sin hilos.
5. `POST /proposals/:id/voting`. Solo moderador o admin. Pasa la propuesta de `abierta` a `en_votacion`.

### Listo cuando

- El rol se rechaza en el servidor aunque el front lo oculte.
- Una categoría cíclica responde `ApiError`.
- El alta de un artículo deja la versión 1 y el `current_version_id` apuntando a ella.
- Un cuerpo con `<p>` o cualquier etiqueta HTML no se persiste.
- Una modificación queda ligada a la versión de base y no toca el artículo publicado.

## BE-2 · Voto y cierre de votación

Vencimiento: 9/11/2026. Desbloquea F-24. Depende de BE-1.

La previa del front usa la misma fórmula, pero el número confirmado es solo el de esta API.

### Qué construir

1. `POST /proposals/:id/votes`. Solo moderador, y solo si la propuesta está `en_votacion`. Un voto por moderador y propuesta. El cuerpo trae `a_favor` o `en_contra`. El servidor calcula el peso con la reputación actual y guarda `weight_at_vote`. Ignora cualquier peso que mande el cliente.
2. `POST /proposals/:id/close`. Moderador o admin. Exige tres votos. Si hay menos, responde error tipado y no cambia el estado.
3. Con quórum, suma los pesos. Más peso a favor: `recomendada`. Más peso en contra: `desaconsejada`. Empate: `controvertida`. El artículo publicado no cambia.

Casos que tienen que coincidir con la spec del front:

- Reputación 10 → peso 1. Reputación 30 → peso 3. Reputación 50 o más → peso 5.
- Pesos 3, 3 y 1, dos a favor y uno en contra: quórum, 6 contra 1, `recomendada`.
- Pesos 4, 2 y 2, el 4 en contra y los otros a favor: quórum, 4 contra 4, `controvertida`.
- Menos de tres votos: el cierre falla.

### Listo cuando

- El segundo voto del mismo moderador se rechaza.
- El voto guardado trae `weight_at_vote` del servidor.
- Cerrar con tres votos deja el resultado comunitario y el artículo igual.
- Cerrar con menos de tres votos devuelve `ApiError` y la propuesta sigue `en_votacion`.

## BE-3 · Decisión, versiones, reputación y auditoría

Vencimiento: 11/11/2026. Desbloquea F-28, F-29, F-30 y F-31. Depende de BE-2.

### Qué construir

`POST /proposals/:id/decision`, solo admin.

El cuerpo indica aceptar o rechazar, un motivo opcional y, en una modificación aceptada, si el contenido anterior se marca como error.

Reglas del motivo:

- Obligatorio si la decisión se aparta del resultado comunitario (`recomendada` y rechazar, o `desaconsejada` y aceptar).
- Obligatorio si el resultado fue empate (`controvertida`).
- Obligatorio si no hubo quórum. Esa resolución es excepcional, distinta de un consenso.
- Si la decisión coincide con `recomendada` o `desaconsejada` y hubo quórum, el motivo puede ir vacío.

Al aceptar:

- Si la propuesta crea un artículo, nace el artículo con su versión 1.
- Si modifica, nace una versión nueva. La anterior no se reescribe. `current_version_id` pasa a la nueva. El número de versión sigue siendo único por artículo.
- El autor de la propuesta recibe `aporte_respaldado` (+5), una sola vez para esa propuesta.
- Si se marcó el contenido anterior como error, quien publicó la versión de base recibe `error_comprobado` (−5), una sola vez para esa propuesta.
- La propuesta queda `aceptada` y `underReview` del artículo pasa a falso cuando ya no quedan propuestas abiertas.

Al rechazar no hay versión nueva ni cambio de reputación. La propuesta queda `rechazada`.

Siempre se escribe auditoría con actor, acción, entidad, motivo cuando existe, y una marca que distinga decisión acorde, apartada y excepcional. La respuesta incluye los eventos de reputación creados, para que el front actualice el puntaje sin recargar a mano.

### Listo cuando

- Aceptar crea una versión nueva y la anterior sigue en el historial.
- El mismo respaldo o el mismo error no se insertan dos veces.
- Falta el motivo cuando corresponde y la API lo rechaza.
- La fila de auditoría permite distinguir los tres tipos de decisión.

## BE-4 · Usuarios y listado de auditoría

Vencimiento: 12/11/2026. Desbloquea F-32 y F-33. Depende de BE-0 para el listado y de BE-3 para que la auditoría ya tenga decisiones.

### Qué construir

1. `POST /users`, solo admin. Alta con seudónimo, usuario, rol y reputación inicial. Crea el evento `asignacion_inicial` con ese valor y `source_id` igual al id de usuario.
2. `PATCH /users/:id`, solo admin. Cambiar rol o desactivar. Desactivar no borra votos, eventos ni auditoría, y el login posterior falla.
3. `POST /users/:id/sanctions`, solo admin, con motivo obligatorio. Escribe primero la auditoría y después `conducta_abusiva` (−8) usando el id de esa auditoría como `source_id`. No implementa el módulo de sanciones del documento maestro.
4. `GET /audit`, solo admin. Actor, acción, entidad, motivo y fecha. Las decisiones excepcionales se distinguen de las demás.

### Listo cuando

- El alta deja el evento inicial y el puntaje coincide con ese delta.
- Un usuario desactivado conserva su historia y no obtiene JWT.
- Dos conductas abusivas sobre la misma persona generan dos auditorías y dos eventos.
- El listado muestra las decisiones de BE-3 y el alta de usuarios.

## Fuera de estos tickets

No construir relaciones entre artículos, grafo, embeddings, notificaciones, fusión de texto, edición de votos, varios roles por cuenta, ni recuperación de contraseña. El índice para una búsqueda asistida, más adelante, se arma leyendo el Markdown publicado y partiéndolo por encabezados. No hace falta una tabla nueva en esta entrega.
