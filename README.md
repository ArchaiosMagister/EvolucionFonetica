# Evolutio · Evolución fonética (Latín → castellano)

Webapp autónoma para practicar las **20 normas oficiales de evolución fonética PAU** facilitadas por el docente. Repositorio distinto de VocabulaLatinaGraecaque y GeneradorExamenes.

## Prueba la webapp

Web publicada: <https://archaiosmagister.github.io/EvolucionFonetica/> (GitHub Pages).

Se seleccionan las normas, la modalidad (guiada o a ciegas) y el número de tarjetas. Cada tarjeta obliga a acertar el resultado castellano antes de relacionar las transformaciones con posiciones exactas, grupos, tramos discontiguos o lugares de inserción. La **-m final de acusativo** se trabaja como norma fija, nunca como «apócope» seleccionable.

## Inicio local y pruebas

```bash
python3 -m http.server 8000
# Abrir http://localhost:8000
npm test
```

No hay paquetes de producción ni compilación. JavaScript nativo, HTML y CSS compatibles con GitHub Pages. El service worker almacena la web y el banco para lectura sin conexión después de la primera visita. El ámbito PWA es relativo y funciona bajo la ruta `/EvolucionFonetica/`.

## Fuentes y ampliaciones

- `data/pilot.json`: banco acumulado anotado (152 fichas: 52 iniciales y 100 del segundo lote) con referencia a fila y lote del archivo `banco_evolucion_fonetica_con_filtro_didactico.xlsx`.
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
