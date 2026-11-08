# Control de Aspirantes · UNES

Aplicación local para **cargar, actualizar y reportar** los datos de aspirantes por núcleo de la Universidad Nacional Experimental de la Seguridad.

Los datos del archivo `REPORTE PROCESO I 2027 CARLOS R.pdf` ya están cargados en la aplicación y los totales coinciden exactamente con el reporte original:

| Indicador | Total |
|---|---:|
| Núcleos | 36 |
| Pre-inscritos | 32.470 |
| Convocados | 5.144 |
| Asistencia | 1.415 |
| Femenino | 719 |
| Masculino | 696 |

---

## Requisitos

- **Node.js 18 o superior** (no requiere instalar dependencias ni paquetes adicionales).
- Windows, macOS o Linux. En Windows se incluye `iniciar.bat`.

## Cómo iniciar

### Modo local (con servidor Node)

1. Haz doble clic en **`iniciar.bat`**.
2. El servidor arranca en `http://127.0.0.1:3000` y abre el navegador automáticamente.
3. Para detenerlo, cierra la ventana de la consola o presiona `Ctrl + C`.

También puedes iniciarlo desde una terminal:

```bash
npm start
# o directamente
node server.js
```

Si el puerto 3000 está ocupado:

```bat
set PORT=3001 && npm start
```

### Despliegue en Vercel (sitio estático)

La aplicación incluye `vercel.json` y funciona como **sitio estático sin servidor Node**. Los datos se guardan en `localStorage` del navegador, por lo que no persisten entre sesiones si se borran los datos del sitio.

1. Sube el repositorio a GitHub.
2. Importa el proyecto en [Vercel](https://vercel.com) (no necesita configuración adicional: `vercel.json` ya define las rutas).
3. La app se desplegará como estática: `index.html`, `app.js`, `styles.css` y `venezuela.svg`.

> El modo local persiste datos en `data/datos.json` con respaldos automáticos. El modo estático en Vercel guarda en `localStorage` (solo en tu navegador).

---

## Qué puedes hacer

La aplicación se organiza en **cinco pestañas**:

| Pestaña | Contenido |
|---|---|
| **Resumen** | Indicadores generales (KPIs), núcleos con mayor asistencia y distribución por sexo. |
| **Pruebas por sexo** | Resultados de Prueba Psicológica, Física y Médica con aprobados/rechazados discriminados por **femenino y masculino**, más porcentaje de aprobación. |
| **Núcleos** | Tabla editable de 21 columnas con los núcleos y todas las cifras de seguimiento, por semana o en vista General. |
| **Mapa de Venezuela** | Mapa político con convocados por estado (incluye **Esequibo** como territorio en reclamación), listado, leyenda y detalle de núcleos por estado al hacer clic. |
| **Validación** | Inconsistencias detectadas en la vista actual (totales por sexo, asistencia y pruebas). |

### Semana y vista General

Cada registro lleva un campo `semana`. La barra superior permite elegir **General** (agrega todas las semanas por núcleo, solo lectura) o una semana específica (editable). Usa el botón **Nueva semana** para crear semanas vacías o copiando una existente.

### Editar los datos
- Haz clic directamente sobre el **nombre del núcleo** o cualquiera de las **cifras** de la tabla.
- También puedes usar el **lápiz** de cada fila para abrir la ficha completa del núcleo y editar todos los campos a la vez.
- Los cambios se guardan **automáticamente** (verás el indicador «Guardando…» / «Guardado» arriba).
- Las tarjetas, los gráficos, el mapa y los totales se recalculan al instante.

### Columnas de seguimiento (discriminadas por sexo)
Además de las cifras originales, cada núcleo tiene:

| Columna | Descripción |
|---|---|
| **Formalizados** | Total de aspirantes formalizados (editable por semana). |
| **Prueba Psicológica** | Aprobados y rechazados, separados en femenino y masculino (4 campos). |
| **Prueba Física** | Aprobados y rechazados, separados en femenino y masculino (4 campos). |
| **Prueba Médica** | Aprobados y rechazados, separados en femenino y masculino (4 campos). |

Los campos nuevos se inicializan en `0` y no modifican los totales originales del reporte.

### Agregar, duplicar y eliminar núcleos
- **Agregar núcleo**: botón superior de la tabla.
- **Duplicar** o **eliminar** una fila: botones que aparecen al pasar el cursor sobre la fila.

### Buscar, filtrar y ordenar
- Buscador por nombre de núcleo.
- Interruptor **«Solo con alertas»** para ver únicamente las filas con inconsistencias.
- Haz clic en los encabezados para ordenar por cualquier columna.

### Importar datos
Abre **Importar** y pega la tabla desde Excel/Google Sheets o carga un archivo **CSV, TSV o JSON**.

Se reconocen las columnas `SEMANA`, `NÚCLEO`, `PRE-INSCRITOS`, `CONVOCADOS`, `ASISTENCIA`, `FORMALIZADOS`, las pruebas `PSICOLÓGICA`, `FÍSICA` y `MÉDICA` con `APROBADOS` / `RECHAZADOS` separados en **F** (femenino) y **M** (masculino), y `FEMENINO` / `MASCULINO`.

Formato nuevo (sin encabezados, en este orden por defecto):

```
19 columnas (sin semana):
NÚCLEO;PRE-INSCRITOS;CONVOCADOS;ASISTENCIA;FORMALIZADOS;
PSICO_APR_F;PSICO_APR_M;PSICO_REC_F;PSICO_REC_M;
FÍSICA_APR_F;FÍSICA_APR_M;FÍSICA_REC_F;FÍSICA_REC_M;
MÉDICA_APR_F;MÉDICA_APR_M;MÉDICA_REC_F;MÉDICA_REC_M;
FEMENINO;MASCULINO
AMAZONAS;220;34;4;0;0;0;0;0;0;0;0;0;0;0;0;0;3;1

20 columnas (con semana):
SEMANA;NÚCLEO;... (mismas 19 columnas anteriores)
1;AMAZONAS;220;34;4;0;0;0;0;0;0;0;0;0;0;0;0;3;1
```

Los archivos antiguos de **6 columnas** (`NÚCLEO;PRE-INSCRITOS;CONVOCADOS;ASISTENCIA;FEMENINO;MASCULINO`) siguen funcionando: las columnas nuevas se cargan en `0`. El formato antiguo de **13 columnas** (una sola columna por prueba, sin separar sexo) ya no se admite; usa el formato de 19 o 20 columnas. Si el archivo trae encabezados, se reconocen por nombre aunque cambie el orden.

Dos modos de importación:

| Modo | Comportamiento |
|---|---|
| **Actualizar coincidentes y agregar nuevos** | Compara por nombre de núcleo **y semana**: actualiza las cifras de los existentes y agrega los nuevos. |
| **Reemplazar todos los datos** | Borra la tabla actual (todas las semanas) y deja únicamente lo importado. |

La vista previa valida cada fila antes de importar (nombres vacíos, números inválidos o núcleos repetidos para la misma semana). Si hay errores, la importación se bloquea para evitar datos incorrectos.

> **Consejo:** al exportar a CSV desde Excel, guárdalo como **«CSV UTF-8»** para conservar las tildes.

### Exportar e imprimir
- **CSV**: archivo compatible con Excel (separador `;`, UTF-8 con BOM). Incluye la columna `SEMANA` y todos los campos discriminados por sexo. Soporta `?semana=N` o `?semana=general`.
- **JSON**: copia completa de los datos, metadatos, semanas, totales y alertas.
- **Imprimir reporte**: genera una versión limpia en A4 horizontal con el título, la institución, el proceso, la fecha, la tabla completa (incluidos los grupos de pruebas), los totales y las notas de validación. Si estás en otra pestaña, la impresión cambia automáticamente a **Núcleos**.


### Datos del reporte
Haz clic en las etiquetas del proceso o de la fecha (arriba) para editar:

- Institución
- Título del reporte
- Proceso
- Fecha

### Respaldos
- Antes de cada cambio se guarda una copia en `data/respaldos` (máximo una cada 30 minutos; se conservan las últimas 40).
- Desde **«Ver respaldos»** (pie de página) puedes restaurar cualquiera de las copias.

---

## Estructura del proyecto

```
Proyecto predeterminado/
├── vercel.json           Despliegue estático en Vercel (sin servidor Node)
├── iniciar.bat           Lanzador para Windows
├── package.json
├── server.js             Servidor HTTP + API + persistencia (sin dependencias)
├── data/
│   ├── datos.json        Datos actuales (36 núcleos, semana 1, campos por sexo)
│   └── respaldos/        Copias automáticas (se crea al primer cambio)
└── public/
    ├── index.html        5 pestañas: Resumen, Pruebas por sexo, Núcleos, Mapa, Validación
    ├── styles.css
    ├── app.js            Lógica de la SPA + modo localStorage para Vercel
    ├── venezuela.svg     Mapa político por estados + Esequibo (uso sin conexión)
    └── assets/
        └── unes.png      Logo institucional (uso sin conexión)
```

## Formato de `data/datos.json`

```json
{
  "version": 1,
  "meta": {
    "institucion": "UNIVERSIDAD NACIONAL EXPERIMENTAL DE LA SEGURIDAD",
    "titulo": "Reporte numérico general de las y los aspirantes que iniciaron exámenes de admisión",
    "proceso": "PROCESO ENERO I-2027",
    "fecha": "2026-11-06",
    "actualizado": "2026-11-07T20:00:00"
  },
  "nucleos": [
    {
      "id": "n1",
      "semana": 1,
      "nucleo": "AMAZONAS",
      "preinscritos": 220,
      "convocados": 34,
      "asistencia": 4,
      "formalizados": 0,
      "psico_aprobados_f": 0,
      "psico_aprobados_m": 0,
      "psico_rechazados_f": 0,
      "psico_rechazados_m": 0,
      "fisico_aprobados_f": 0,
      "fisico_aprobados_m": 0,
      "fisico_rechazados_f": 0,
      "fisico_rechazados_m": 0,
      "medico_aprobados_f": 0,
      "medico_aprobados_m": 0,
      "medico_rechazados_f": 0,
      "medico_rechazados_m": 0,
      "femenino": 3,
      "masculino": 1
    }
  ]
}
```

Todas las cifras son números enteros mayores o iguales a 0. Si un archivo antiguo no trae los campos nuevos, se cargan automáticamente en `0`.

## Mapa de Venezuela

El mapa agrupa los núcleos por estado a partir de su nombre. Las subregiones se asignan así:

| Nombre del núcleo | Estado |
|---|---|
| MIRANDA - BARLOVENTO, MIRANDA - EJE METROPOLITANO, MIRANDA - EL LLANITO, MIRANDA - GUARENAS-GUATIRE y MIRANDA - VALLES DEL TUY | Miranda |
| EL JUNQUITO, HELICOIDE y SAN PEDRO | Distrito Capital |
| CARMEN DE URIA | La Guaira |
| TINAQUILLO | Cojedes |

Además se muestra el **Esequibo** como territorio en reclamación (relleno con trama amarilla), sin núcleos ni cifras asociadas.

El color de cada estado representa su cantidad de convocados y el panel lateral muestra el listado ordenado. Los núcleos cuyo nombre no permita identificar un estado aparecen señalados al final del listado.


## API (opcional)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/estado` | Datos, totales y alertas |
| POST | `/api/nucleos` | Crear núcleo |
| PUT | `/api/nucleos/:id` | Actualizar núcleo |
| DELETE | `/api/nucleos/:id` | Eliminar núcleo |
| PUT | `/api/meta` | Actualizar datos del reporte |
| POST | `/api/importar` | Importar filas (`fusionar` o `reemplazar`) |
| POST | `/api/semanas` | Crear una semana nueva (vacía o copiando otra) |
| GET | `/api/exportar.csv` | Descargar CSV |
| GET | `/api/exportar.json` | Descargar JSON |
| GET | `/api/respaldos` | Listar respaldos |
| POST | `/api/respaldos/restaurar` | Restaurar un respaldo |

---

## Validaciones del reporte original

La aplicación marca automáticamente las filas donde:

- Femenino + Masculino no coincide con la Asistencia.
- La Asistencia supera a los Convocados.
- Los Convocados superan a los Pre-inscritos.
- Los Formalizados superan la Asistencia.
- Los evaluados de una prueba (Aprobados + Rechazados) superan la Asistencia.

Al cargar el PDF se detectaron **4 inconsistencias** que ya venían en el documento original (no se modificaron los valores; solo se señalan):

| Núcleo | Inconsistencia |
|---|---|
| MIRANDA - BARLOVENTO | Femenino (104) + Masculino (44) = 148, pero la asistencia es 144. |
| MIRANDA - EJE METROPOLITANO | Femenino (0) + Masculino (0) = 0, pero la asistencia es 4. |
| FALCÓN | La asistencia (104) supera a los convocados (103). |
| PORTUGUESA | La asistencia (25) supera a los convocados (23). |

Puedes corregirlas desde la tabla cuando tengas la información oficial; las alertas desaparecerán automáticamente.

---

## Solución de problemas

- **«No se encontró Node.js»**: instala Node.js 18+ desde <https://nodejs.org> y vuelve a ejecutar `iniciar.bat`.
- **«El puerto 3000 ya está en uso»**: cierra la otra instancia o inicia con otro puerto (`set PORT=3001 && npm start`).
- **Las tildes se ven mal al importar un CSV**: guarda el archivo como **CSV UTF-8**.
- **¿Dónde están mis datos?**: en `data/datos.json`. Puedes copiarlo para llevar un registro manual; la app también crea respaldos automáticos.
