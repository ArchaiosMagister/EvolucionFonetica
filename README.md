# Evolutio · Evolución fonética (Latín → castellano)

Webapp autónoma para **estudiar y practicar** las **20 normas oficiales de evolución fonética PAU** facilitadas por el docente. Repositorio distinto de VocabulaLatinaGraecaque y GeneradorExamenes.

## Prueba la webapp

Web publicada: <https://archaiosmagister.github.io/EvolucionFonetica/> (GitHub Pages).

Se seleccionan las normas, la modalidad (guiada o a ciegas) y el número de tarjetas. Cada tarjeta obliga a acertar el resultado castellano antes de relacionar las transformaciones con posiciones exactas, grupos, tramos discontiguos o lugares de inserción. La **-m final de acusativo** se trabaja como norma fija, nunca como «apócope» seleccionable.

## Modo Estudiar (consulta sin corrección)

La portada conserva **Practicar** y añade **Estudiar** como secciones independientes. Cambiar de sección no borra una sesión de práctica en curso: sus selecciones y respuestas quedan en memoria mientras la pestaña siga abierta. El modo Estudiar no asigna notas, no sortea palabras y no modifica la lógica de evaluación.

- **Buscador bidireccional:** localiza las 252 fichas revisadas por forma latina o resultado castellano, con coincidencias parciales y tolerancia a mayúsculas, ligaduras `æ/ae`, `œ/oe`, cantidades vocálicas y tildes **solo en la búsqueda**. La corrección estricta del modo Practicar no cambia. La lista se pagina sin perder resultados.
- **Catálogo de normas:** presenta exactamente las 20 categorías oficiales, sus definiciones y ejemplos tal como figuran en `src/rules.mjs`. Indica las fichas del banco que contienen cada norma, incluso si requieren otras transformaciones para llegar al castellano. Las normas fijas se consultan dentro de las fichas, no como categoría número 21.
- **Subtipos documentados:** cuando el banco incluye subtipos, pueden filtrarse desde el catálogo (p. ej. `-ct- > -ch-`, `-CUL- > -J-` y `-CUL- > -G-`). Nunca se deducen ejemplos nuevos a partir de una regla.
- **Tarjetas filológicas interactivas:** resultado visible, botones para recorrer cada transformación, letras/grupos originales resaltados según posiciones Unicode de la ficha, puntos de inserción `＋`, tramos discontinuos, nota de la transformación, etapas intermedias **solo cuando están anotadas**, definición oficial, resumen del banco y referencia a fila y lote del Excel. Navegación entre fichas de la consulta sin volver a buscar.
- Las fichas marcadas como pendientes en `docs/REVISION.md` siguen fuera del banco y del buscador; no se generan etimologías ni explicaciones nuevas.
- Módulo puro `src/study.mjs` separado de la evaluación; comprobaciones automáticas en `tests/study.test.mjs`. El recurso está incluido en la caché offline de la PWA.

### Comprobaciones

Ejecutar `npm test` (incluye búsqueda, catálogo, subtipos, resaltado, integridad del banco y ausencia de regresiones de práctica). La interfaz ha sido probada mediante una simulación DOM en Chromium para anchuras de escritorio y móvil. La navegación real a `http://localhost` y a `file://` está bloqueada en el navegador de este entorno; no equivale a una prueba en iOS físico.

## Inicio local y pruebas

```bash
python3 -m http.server 8000
# Abrir http://localhost:8000
npm test
```

No hay paquetes de producción ni compilación. JavaScript nativo, HTML y CSS compatibles con GitHub Pages. El service worker almacena la web y el banco para lectura sin conexión después de la primera visita. El ámbito PWA es relativo y funciona bajo la ruta `/EvolucionFonetica/`.

## Fuentes y ampliaciones

- `data/pilot.json`: banco acumulado anotado (252 fichas: 52 iniciales, 100 del segundo lote y 100 del tercero) con referencia a fila y lote del archivo `banco_evolucion_fonetica_con_filtro_didactico.xlsx`.
- `src/rules.mjs`: exactamente las 20 categorías oficiales; incluye subtipos de -CUL- > -J- y -CUL- > -G-.
- `src/engine.mjs`: filtrado por inclusión total, corrección y validación de rangos; los fragmentos solapados son legítimos.
- `src/app.mjs`: interfaz, selección táctil, inserciones y navegación.
- `tests/engine.test.mjs`: pruebas de integridad, corrección, progreso y regresiones.
- `docs/COBERTURA.md`: cobertura real y palabras por norma.
- `docs/REVISION.md`: discrepancias con el Excel y cuestiones que necesitan revisión filológica.

**Importante:** el Excel original no se modifica ni se incorpora íntegramente al repositorio; se utiliza para preparar lotes pequeños con anotaciones revisadas. Para ampliar el banco, añadir registros con nuevos ID y rangos Unicode correctos, mantener todos los fenómenos exigibles y ejecutar `npm test`. La publicación automática sólo se realiza cuando el trabajo de GitHub Actions aprueba las pruebas.

**Revisión específica:** `miraculum → milagro` incorporada con el subtipo -CUL- → -G- y seis cambios anotados. La explicación está documentada en `docs/REVISION.md`.

## Limitaciones del banco actual

- Cada palabra presenta los cambios indicados por las normas didácticas del corpus, no una reconstrucción histórico-fonética exhaustiva de cada etapa del latín al romance.
- Todas las categorías tienen al menos un ejemplo; algunos **subtipos** de palatalización, simplificación, grafías griegas quedan pendientes de incorporación segura; los subtipos -CUL- → -J- y -CUL- → -G- ya están representados.
- No hay servidor, cuentas de alumnado ni estadísticas persistentes; el resumen pertenece a la sesión actual.
- La interfaz está preparada para pantallas táctiles; las pruebas automáticas de lógica no equivalen a certificación manual en cada dispositivo físico.

## Interacción y temas (versión piloto 1.1)

- **Aspecto:** Claro, Oscuro y OLED (fondo negro puro), seleccionables desde la cabecera. La preferencia se conserva en `localStorage` y cambia también el color de la barra del navegador.
- **Fase 2 guiada:** cada fragmento tiene una tarjeta con su selector de norma dentro. Las respuestas permanecen sin corregir hasta pulsar **«Comprobar todo»**. Las asociaciones con grupos solapados se comprueban contra su objetivo exacto.
- **Fase 2 a ciegas:** se marcan letras o puntos `+`, se pulsa **«Añadir cambio»** y se elige la norma en esa tarjeta. Se pueden añadir, quitar o modificar cambios y también marcar fragmentos no contiguos.
- La corrección es **conjunta**: se señalan respuestas incorrectas o pendientes sin borrar las elecciones del alumno; no se avanza si faltan cambios o sobran asociaciones erróneas. Las normas fijas siguen separadas del filtrado.
- En móviles, el selector de fragmentos se desplaza horizontalmente para no partir grupos de letras.


## Confirmación visual de aciertos (piloto 1.2)

- Al pulsar «Comprobar todo» y **acertar todos los cambios**, aparece un aviso «¡Todas las normas correctas!» y una animación breve de confeti decorativa, sin bloquear la navegación. No se muestra confeti en correcciones incompletas ni al reintentar. Se respeta `prefers-reduced-motion` (sin animación cuando el usuario solicita movimiento reducido).
- Cuando una palabra contiene pérdida de -m final de acusativo, la opción **«Pérdida fija de -m final» aparece al comienzo de las normas del desplegable**, tras el texto inicial «Selecciona una norma…». Para las palabras sin este fenómeno, la opción no aparece. El filtrado de las 20 normas seleccionables permanece inalterado.

## Ampliación de vocabulario: segundo lote de 100 fichas

- El banco pasa de **52 a 152 palabras**, sin eliminar ni modificar ninguna ficha del primer lote.
- Se han incorporado **100 entradas de las diez tandas** del Excel; cada una lleva asignadas las letras o grupos exactos, subtipos de norma cuando procede, explicación y referencia a fila.
- El lote aporta ejemplos de 17 normas; las 20 siguen representadas acumuladamente.
- `data/batches/2026-11-12-100.json`: manifiesto de las 100 incorporaciones y huella de integridad del banco anterior.
- `docs/LOTE_100.md`: relación completa de las nuevas fichas y cuadro de cobertura.
- `tests/batch-100.test.mjs`: pruebas de conservación del primer lote, modo guiado/a ciegas, filtros, grupos y acumulación de datos.

El nombre `data/pilot.json` se conserva por compatibilidad con la PWA instalada; el contenido ya es el banco acumulado. Se incrementa la versión de caché offline para que las instalaciones reciban las palabras nuevas.

## Ampliación III: 100 fichas adicionales (252 en total)

- Incorporadas otras **100 entradas patrimoniales** de las diez tandas del Excel, sin repetir las anteriores.
- Refuerzo de palatalización en grupos `-ni-`, `-gn-`, `-mn-`, `-nn-`, `-ct-`, `-li-`, `-di-`, `-ti-`, `pl-`, además de simplificaciones, diptongaciones, abertura y `-CUL-`.
- No se fuerzan como patrimoniales los ejemplos de grafías griegas catalogados como cultismos: siguen siendo ejemplos de referencia de la norma, no fichas nuevas del sorteo.
- `data/batches/2026-11-12-100-tercero.json`: trazabilidad del lote y huella SHA-256 de las 152 palabras anteriores.
- `docs/LOTE_100_TERCERO.md`: 100 nuevas fichas, reglas, subtipos, filas del Excel y cobertura acumulada.
- `tests/batch-100-third.test.mjs`: validación de 100 fichas en ambos modos de corrección conjunta y preservación del banco anterior.
- `tools/build_batch3.py` y `tools/selected_batch_3_rows.py`: especificaciones de anotación manual para preparar este lote desde la extracción del Excel. No se ejecutan en producción.

El archivo `data/pilot.json` conserva su nombre por compatibilidad con el service worker y la web instalada.
