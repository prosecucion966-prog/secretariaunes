'use strict';

/* =========================================================
   Control de Aspirantes · UNES
   ========================================================= */

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

const fmt = new Intl.NumberFormat('es-VE');
const fmt1 = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const CAMPOS = [
  'preinscritos',
  'convocados',
  'asistencia',
  'formalizados',
  'capacidad',
  'psico_aprobados_f',
  'psico_aprobados_m',
  'psico_rechazados_f',
  'psico_rechazados_m',
  'fisico_aprobados_f',
  'fisico_aprobados_m',
  'fisico_rechazados_f',
  'fisico_rechazados_m',
  'medico_aprobados_f',
  'medico_aprobados_m',
  'medico_rechazados_f',
  'medico_rechazados_m',
  'femenino',
  'masculino'
];

const ETIQUETAS = {
  nucleo: 'Núcleo',
  semana: 'Semana',
  preinscritos: 'Pre-inscritos',
  convocados: 'Convocados',
  asistencia: 'Asistencia',
  formalizados: 'Formalizados',
  capacidad: 'Capacidad',
  psico_aprobados_f: 'Psicológica · aprobados femenino',
  psico_aprobados_m: 'Psicológica · aprobados masculino',
  psico_rechazados_f: 'Psicológica · rechazados femenino',
  psico_rechazados_m: 'Psicológica · rechazados masculino',
  fisico_aprobados_f: 'Física · aprobados femenino',
  fisico_aprobados_m: 'Física · aprobados masculino',
  fisico_rechazados_f: 'Física · rechazados femenino',
  fisico_rechazados_m: 'Física · rechazados masculino',
  medico_aprobados_f: 'Médica · aprobados femenino',
  medico_aprobados_m: 'Médica · aprobados masculino',
  medico_rechazados_f: 'Médica · rechazados femenino',
  medico_rechazados_m: 'Médica · rechazados masculino',
  femenino: 'Femenino',
  masculino: 'Masculino'
};

const ETIQUETAS_CORTAS = {
  preinscritos: 'Pre-ins.',
  convocados: 'Conv.',
  asistencia: 'Asist.',
  formalizados: 'Formal.',
  capacidad: 'Cap.',
  psico_aprobados_f: 'Psi. A F',
  psico_aprobados_m: 'Psi. A M',
  psico_rechazados_f: 'Psi. R F',
  psico_rechazados_m: 'Psi. R M',
  fisico_aprobados_f: 'Fís. A F',
  fisico_aprobados_m: 'Fís. A M',
  fisico_rechazados_f: 'Fís. R F',
  fisico_rechazados_m: 'Fís. R M',
  medico_aprobados_f: 'Méd. A F',
  medico_aprobados_m: 'Méd. A M',
  medico_rechazados_f: 'Méd. R F',
  medico_rechazados_m: 'Méd. R M',
  femenino: 'Fem.',
  masculino: 'Masc.'
};

const COLORES = {
  femenino: '#db2777',
  masculino: '#2563eb',
  sinClasificar: '#cbd5e1'
};

const PRUEBAS = [
  { clave: 'psico', nombre: 'Psicológica', clase: 'psico', color: '#7c3aed' },
  { clave: 'fisico', nombre: 'Física', clase: 'fisico', color: '#047857' },
  { clave: 'medico', nombre: 'Médica', clase: 'medico', color: '#1d4ed8' }
];

const ESTADOS_VE = [
  'Amazonas', 'Anzoátegui', 'Apure', 'Aragua', 'Barinas', 'Bolívar', 'Carabobo',
  'Cojedes', 'Delta Amacuro', 'Distrito Capital', 'Falcón', 'Guárico', 'La Guaira',
  'Lara', 'Mérida', 'Miranda', 'Monagas', 'Nueva Esparta', 'Portuguesa', 'Sucre',
  'Táchira', 'Trujillo', 'Yaracuy', 'Zulia'
];
const ESTADOS_NORMALIZADOS = new Map(ESTADOS_VE.map((nombreEstado) => [norm(nombreEstado), nombreEstado]));

let estado = { meta: {}, nucleos: [], semanas: [1], resumen: {}, alertas: [] };
const vista = { q: '', soloAlertas: false, orden: { campo: 'nucleo', dir: 1 }, semana: 'general' };
let importacion = { filas: [], errores: [], meta: null, columnas: null, formato: null, semana: 1 };
let panelActivo = 'resumen';
let panelAntesImpresion = null;
let nucleoEditandoId = null;
let mapaCargado = false;
let mapaPromesa = null;
let mapaDatos = null;
let mapaPathActivo = null;
let mapaEstadoActivo = null;

const pendientes = new Map();
const cadenas = new Map();
let temporizadorCalculos = null;
let temporizadorBusqueda = null;
let temporizadorImportar = null;

/* ---------------------------------------------------------
   Utilidades
   --------------------------------------------------------- */

function esc(valor) {
  return String(valor == null ? '' : valor).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function norm(valor) {
  return String(valor == null ? '' : valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function leerNumero(valor) {
  if (valor === null || valor === undefined || valor === '') return 0;
  let s = String(valor).trim().replace(/\s/g, '');
  if (s === '') return 0;
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  if (/^\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, '');
  if (!/^\d+$/.test(s)) return NaN;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : NaN;
}

function fechaLegible(iso) {
  if (!iso) return 'Sin fecha';
  const partes = String(iso).split('-');
  if (partes.length !== 3) return iso;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function selloLegible(iso) {
  if (!iso) return '';
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  return fecha.toLocaleString('es-VE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

/* =========================================================
   Modo localStorage (despliegue estático en Vercel)
   Cuando no hay servidor Node, los datos se guardan en
   el navegador con las mismas operaciones de la API.
   ========================================================= */

const LOCAL_KEY = 'unes-aspirantes-v1';

function estadoVacio() {
  return {
    meta: {
      institucion: 'Universidad Nacional Experimental de la Seguridad',
      titulo: 'Reporte de aspirantes',
      proceso: 'Sin proceso',
      fecha: '',
      actualizado: ''
    },
    nucleos: []
  };
}

function calcularResumenLocalStore(nucleos) {
  const t = {
    nucleos: new Set(nucleos.map((f) => norm(f.nucleo))).size,
    registros: nucleos.length,
    semanas: new Set(nucleos.map((f) => Number(f.semana) || 1)).size
  };
  for (const campo of CAMPOS) t[campo] = 0;
  for (const fila of nucleos) {
    for (const campo of CAMPOS) t[campo] += Number(fila[campo]) || 0;
  }
  const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
  t.pctConvocados = pct(t.convocados, t.preinscritos);
  t.pctAsistencia = pct(t.asistencia, t.convocados);
  t.pctFormalizados = pct(t.formalizados, t.convocados);
  t.pctFemenino = pct(t.femenino, t.asistencia);
  t.pctMasculino = pct(t.masculino, t.asistencia);
  for (const prueba of PRUEBAS) {
    const c = prueba.clave;
    t[`${c}_aprobados`] = t[`${c}_aprobados_f`] + t[`${c}_aprobados_m`];
    t[`${c}_rechazados`] = t[`${c}_rechazados_f`] + t[`${c}_rechazados_m`];
    t[`${c}_evaluados_f`] = t[`${c}_aprobados_f`] + t[`${c}_rechazados_f`];
    t[`${c}_evaluados_m`] = t[`${c}_aprobados_m`] + t[`${c}_rechazados_m`];
    t[`${c}_evaluados`] = t[`${c}_evaluados_f`] + t[`${c}_evaluados_m`];
    t[`pct${prueba.clase.charAt(0).toUpperCase()}${prueba.clase.slice(1)}Aprobados`] =
      pct(t[`${c}_aprobados`], t[`${c}_evaluados`]);
  }
  return t;
}

function calcularAlertasLocalStore(nucleos) {
  const alertas = [];
  for (const fila of nucleos) {
    const semana = Number(fila.semana) || null;
    const prefijo = semana ? `Semana ${semana} · ` : '';
    const suma = (Number(fila.femenino) || 0) + (Number(fila.masculino) || 0);
    if (suma !== Number(fila.asistencia)) {
      alertas.push({ id: fila.id, nucleo: fila.nucleo, semana, tipo: 'descuadre',
        mensaje: `${prefijo}Femenino (${fila.femenino}) + Masculino (${fila.masculino}) = ${suma}, pero la asistencia registrada es ${fila.asistencia}.` });
    }
    if (Number(fila.asistencia) > Number(fila.convocados)) {
      alertas.push({ id: fila.id, nucleo: fila.nucleo, semana, tipo: 'asistencia',
        mensaje: `${prefijo}La asistencia (${fila.asistencia}) supera a los convocados (${fila.convocados}).` });
    }
    if (Number(fila.convocados) > Number(fila.preinscritos)) {
      alertas.push({ id: fila.id, nucleo: fila.nucleo, semana, tipo: 'convocados',
        mensaje: `${prefijo}Los convocados (${fila.convocados}) superan a los pre-inscritos (${fila.preinscritos}).` });
    }
    if (Number(fila.formalizados) > Number(fila.asistencia)) {
      alertas.push({ id: fila.id, nucleo: fila.nucleo, semana, tipo: 'formalizados',
        mensaje: `${prefijo}Los formalizados (${fila.formalizados}) superan la asistencia (${fila.asistencia}).` });
    }
    for (const prueba of PRUEBAS) {
      const c = prueba.clave;
      const apF = Number(fila[`${c}_aprobados_f`]) || 0;
      const apM = Number(fila[`${c}_aprobados_m`]) || 0;
      const reF = Number(fila[`${c}_rechazados_f`]) || 0;
      const reM = Number(fila[`${c}_rechazados_m`]) || 0;
      const evF = apF + reF;
      const evM = apM + reM;
      const evaluados = evF + evM;
      if (evaluados > Number(fila.asistencia)) {
        alertas.push({ id: fila.id, nucleo: fila.nucleo, semana, tipo: c,
          mensaje: `${prefijo}La prueba ${prueba.nombre.toLowerCase()} registra ${evaluados} evaluados, más que la asistencia (${fila.asistencia}).` });
      }
      if (evF > Number(fila.femenino)) {
        alertas.push({ id: fila.id, nucleo: fila.nucleo, semana, tipo: `${c}-f`,
          mensaje: `${prefijo}La prueba ${prueba.nombre.toLowerCase()} registra ${evF} evaluadas femeninas, más que el total femenino (${fila.femenino}).` });
      }
      if (evM > Number(fila.masculino)) {
        alertas.push({ id: fila.id, nucleo: fila.nucleo, semana, tipo: `${c}-m`,
          mensaje: `${prefijo}La prueba ${prueba.nombre.toLowerCase()} registra ${evM} evaluados masculinos, más que el total masculino (${fila.masculino}).` });
      }
    }
  }
  return alertas;
}

function localLeer() {
  try {
    const bruto = localStorage.getItem(LOCAL_KEY);
    if (bruto) {
      const estado = JSON.parse(bruto);
      if (estado && Array.isArray(estado.nucleos)) return estado;
    }
  } catch (e) { /* ignora errores de almacenamiento */ }
  const vacio = estadoVacio();
  localGuardar(vacio);
  return vacio;
}

function localGuardar(estado) {
  try {
    const copia = { ...estado, meta: { ...estado.meta, actualizado: new Date().toISOString() } };
    localStorage.setItem(LOCAL_KEY, JSON.stringify(copia));
  } catch (e) { /* ignora errores de almacenamiento */ }
}

function exportarArchivo(contenido, nombre, tipo) {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function apiLocal(ruta, opciones = {}) {
  const metodo = (opciones.method || 'GET').toUpperCase();
  const cuerpo = opciones.body;
  const estado = localLeer();
  const nucleos = estado.nucleos.map((n) => ({ ...n }));

  /* GET /api/estado */
  if (ruta === '/api/estado' && metodo === 'GET') {
    const resultado = {
      meta: estado.meta,
      nucleos,
      semanas: Array.from(new Set(nucleos.map((r) => Number(r.semana) || 1))).sort((a, b) => a - b),
      resumen: calcularResumenLocalStore(nucleos),
      alertas: calcularAlertasLocalStore(nucleos)
    };
    return resultado;
  }

  /* GET /api/meta */
  if (ruta === '/api/meta' && metodo === 'GET') {
    return { meta: estado.meta };
  }

  /* PUT /api/meta */
  if (ruta === '/api/meta' && metodo === 'PUT') {
    const nuevo = { ...estado.meta };
    for (const clave of ['institucion', 'titulo', 'proceso', 'fecha']) {
      if (cuerpo[clave] !== undefined) nuevo[clave] = String(cuerpo[clave] == null ? '' : cuerpo[clave]).trim();
    }
    nuevo.actualizado = new Date().toISOString();
    localGuardar({ ...estado, meta: nuevo });
    return { ok: true, meta: nuevo };
  }

  /* POST /api/nucleos */
  if (ruta === '/api/nucleos' && metodo === 'POST') {
    const semana = Number(cuerpo.semana) || 1;
    const fila = { id: crypto.randomUUID(), semana, nucleo: String(cuerpo.nucleo || '').trim() };
    for (const c of CAMPOS) fila[c] = Number(cuerpo[c]) || 0;
    localGuardar({ ...estado, nucleos: [...nucleos, fila] });
    return { ok: true, nucleo: fila };
  }

  /* PUT /api/nucleos/:id */
  if (ruta.match(/^\/api\/nucleos\//) && metodo === 'PUT') {
    const id = decodeURIComponent(ruta.split('/').pop());
    const indice = nucleos.findIndex((r) => r.id === id);
    if (indice === -1) throw new Error('Núcleo no encontrado.');
    const fila = { ...nucleos[indice] };
    if (cuerpo.semana !== undefined) fila.semana = Number(cuerpo.semana) || fila.semana;
    if (cuerpo.nucleo !== undefined) fila.nucleo = String(cuerpo.nucleo).trim();
    for (const c of CAMPOS) {
      if (cuerpo[c] !== undefined) fila[c] = Number(cuerpo[c]) || 0;
    }
    nucleos[indice] = fila;
    localGuardar({ ...estado, nucleos });
    return { ok: true, nucleo: fila };
  }

  /* DELETE /api/nucleos/:id */
  if (ruta.match(/^\/api\/nucleos\//) && metodo === 'DELETE') {
    const id = decodeURIComponent(ruta.split('/').pop());
    const nuevos = nucleos.filter((r) => r.id !== id);
    localGuardar({ ...estado, nucleos: nuevos });
    return { ok: true, meta: estado.meta };
  }

  /* POST /api/importar */
  if (ruta === '/api/importar' && metodo === 'POST') {
    const modo = cuerpo.modo === 'reemplazar' ? 'reemplazar' : 'fusionar';
    const filas = Array.isArray(cuerpo.filas) ? cuerpo.filas : [];
    let agregados = 0, actualizados = 0;
    let base = modo === 'reemplazar' ? [] : nucleos;
    for (const f of filas) {
      const clave = `${norm(f.nucleo)}|${Number(f.semana) || 1}`;
      const existente = base.find((r) => `${norm(r.nucleo)}|${Number(r.semana) || 1}` === clave);
      const fila = { id: crypto.randomUUID(), semana: Number(f.semana) || 1, nucleo: f.nucleo };
      for (const c of CAMPOS) fila[c] = Number(f[c]) || 0;
      if (existente) {
        Object.assign(existente, fila);
        existente.id = existente.id;
        actualizados += 1;
      } else {
        base.push(fila);
        agregados += 1;
      }
    }
    localGuardar({ ...estado, nucleos: base });
    return { ok: true, agregados, actualizados };
  }

  /* POST /api/semanas */
  if (ruta === '/api/semanas' && metodo === 'POST') {
    const semana = Number(cuerpo.semana) || 1;
    if (nucleos.some((r) => Number(r.semana) === semana)) throw new Error(`La semana ${semana} ya existe.`);
    const nombres = Array.from(new Set(nucleos.map((r) => r.nucleo)));
    const nuevas = nombres.map((nombre) => {
      const fila = { id: crypto.randomUUID(), semana, nucleo: nombre };
      for (const c of CAMPOS) fila[c] = 0;
      return fila;
    });
    localGuardar({ ...estado, nucleos: [...nucleos, ...nuevas] });
    return { ok: true, semana, creados: nuevas.length };
  }

  /* GET /api/respaldos */
  if (ruta === '/api/respaldos' && metodo === 'GET') {
    return { respaldos: [] };
  }

  /* POST /api/respaldos/restaurar */
  if (ruta === '/api/respaldos/restaurar' && metodo === 'POST') {
    return { ok: true };
  }

  throw new Error(`Ruta no soportada en modo local: ${ruta}`);
}

async function api(ruta, opciones = {}) {
  try {
    return await apiRemoto(ruta, opciones);
  } catch (error) {
    /* Fallback a localStorage cuando no hay servidor (Vercel estático) */
    return await apiLocal(ruta, opciones);
  }
}

async function apiRemoto(ruta, opciones = {}) {
  const config = { method: opciones.method || 'GET' };
  if (opciones.body !== undefined) {
    config.headers = { 'Content-Type': 'application/json' };
    config.body = JSON.stringify(opciones.body);
  }
  const respuesta = await fetch(ruta, config);
  let datos = null;
  try {
    datos = await respuesta.json();
  } catch (e) {
    /* respuesta sin JSON */
  }
  if (!respuesta.ok) {
    const error = new Error((datos && datos.error) || `Error ${respuesta.status}`);
    error.detalle = datos && datos.errores ? datos.errores : null;
    throw error;
  }
  return datos;
}

/* ---------------------------------------------------------
   Semanas y filas de trabajo
   --------------------------------------------------------- */

function semanasDisponibles() {
  return Array.from(new Set(estado.nucleos.map((r) => Number(r.semana) || 1))).sort((a, b) => a - b);
}

function ultimaSemana() {
  const lista = semanasDisponibles();
  return lista.length ? lista[lista.length - 1] : 1;
}

function esGeneral() {
  return vista.semana === 'general';
}

function filasSemana(numero = vista.semana) {
  return estado.nucleos.filter((r) => Number(r.semana) === Number(numero));
}

function agregarPorNucleo(filas) {
  const mapa = new Map();
  for (const fila of filas) {
    const clave = norm(fila.nucleo);
    if (!mapa.has(clave)) {
      const base = {
        id: `g:${clave}`,
        semana: 'general',
        nucleo: fila.nucleo,
        __general: true
      };
      for (const campo of CAMPOS) base[campo] = 0;
      mapa.set(clave, base);
    }
    const destino = mapa.get(clave);
    destino.nucleo = destino.nucleo || fila.nucleo;
    for (const campo of CAMPOS) destino[campo] += Number(fila[campo]) || 0;
  }
  return Array.from(mapa.values()).sort((a, b) => a.nucleo.localeCompare(b.nucleo, 'es'));
}

function filasBase() {
  return esGeneral() ? agregarPorNucleo(estado.nucleos) : filasSemana();
}

function etiquetaSemana(valor = vista.semana) {
  return valor === 'general' ? 'General' : `Semana ${valor}`;
}

/* ---------------------------------------------------------
   Cálculos
   --------------------------------------------------------- */

function calcularResumenLocal(nucleos = filasBase()) {
  const t = {
    nucleos: new Set(nucleos.map((f) => norm(f.nucleo))).size,
    registros: nucleos.length
  };
  for (const campo of CAMPOS) t[campo] = 0;
  for (const fila of nucleos) {
    for (const campo of CAMPOS) t[campo] += Number(fila[campo]) || 0;
  }
  const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
  t.pctConvocados = pct(t.convocados, t.preinscritos);
  t.pctAsistencia = pct(t.asistencia, t.convocados);
  t.pctFormalizados = pct(t.formalizados, t.convocados);
  t.pctFemenino = pct(t.femenino, t.asistencia);
  t.pctMasculino = pct(t.masculino, t.asistencia);

  for (const prueba of PRUEBAS) {
    const c = prueba.clave;
    t[`${c}_aprobados`] = t[`${c}_aprobados_f`] + t[`${c}_aprobados_m`];
    t[`${c}_rechazados`] = t[`${c}_rechazados_f`] + t[`${c}_rechazados_m`];
    t[`${c}_evaluados_f`] = t[`${c}_aprobados_f`] + t[`${c}_rechazados_f`];
    t[`${c}_evaluados_m`] = t[`${c}_aprobados_m`] + t[`${c}_rechazados_m`];
    t[`${c}_evaluados`] = t[`${c}_evaluados_f`] + t[`${c}_evaluados_m`];
    t[`pct${prueba.clase.charAt(0).toUpperCase()}${prueba.clase.slice(1)}Aprobados`] =
      pct(t[`${c}_aprobados`], t[`${c}_evaluados`]);
  }
  return t;
}

function calcularAlertasLocal(nucleos = filasBase()) {
  const alertas = [];
  for (const fila of nucleos) {
    const semana = Number(fila.semana) || null;
    const prefijo = semana ? `Semana ${semana} · ` : '';
    const suma = (Number(fila.femenino) || 0) + (Number(fila.masculino) || 0);
    if (suma !== Number(fila.asistencia)) {
      alertas.push({
        id: fila.id,
        nucleo: fila.nucleo,
        tipo: 'descuadre',
        mensaje: `${prefijo}Femenino (${fila.femenino}) + Masculino (${fila.masculino}) = ${suma}, pero la asistencia registrada es ${fila.asistencia}.`
      });
    }
    if (Number(fila.asistencia) > Number(fila.convocados)) {
      alertas.push({
        id: fila.id,
        nucleo: fila.nucleo,
        tipo: 'asistencia',
        mensaje: `${prefijo}La asistencia (${fila.asistencia}) supera a los convocados (${fila.convocados}).`
      });
    }
    if (Number(fila.convocados) > Number(fila.preinscritos)) {
      alertas.push({
        id: fila.id,
        nucleo: fila.nucleo,
        tipo: 'convocados',
        mensaje: `${prefijo}Los convocados (${fila.convocados}) superan a los pre-inscritos (${fila.preinscritos}).`
      });
    }
    if (Number(fila.formalizados) > Number(fila.asistencia)) {
      alertas.push({
        id: fila.id,
        nucleo: fila.nucleo,
        tipo: 'formalizados',
        mensaje: `${prefijo}Los formalizados (${fila.formalizados}) superan la asistencia (${fila.asistencia}).`
      });
    }

    for (const prueba of PRUEBAS) {
      const c = prueba.clave;
      const apF = Number(fila[`${c}_aprobados_f`]) || 0;
      const apM = Number(fila[`${c}_aprobados_m`]) || 0;
      const reF = Number(fila[`${c}_rechazados_f`]) || 0;
      const reM = Number(fila[`${c}_rechazados_m`]) || 0;
      const evF = apF + reF;
      const evM = apM + reM;
      const evaluados = evF + evM;
      if (evaluados > Number(fila.asistencia)) {
        alertas.push({
          id: fila.id,
          nucleo: fila.nucleo,
          tipo: c,
          mensaje: `${prefijo}La prueba ${prueba.nombre.toLowerCase()} registra ${evaluados} evaluados (${apF + apM} aprobados + ${reF + reM} rechazados), más que la asistencia (${fila.asistencia}).`
        });
      }
      if (evF > Number(fila.femenino)) {
        alertas.push({
          id: fila.id,
          nucleo: fila.nucleo,
          tipo: `${c}-f`,
          mensaje: `${prefijo}La prueba ${prueba.nombre.toLowerCase()} registra ${evF} evaluadas femeninas, más que el total femenino (${fila.femenino}).`
        });
      }
      if (evM > Number(fila.masculino)) {
        alertas.push({
          id: fila.id,
          nucleo: fila.nucleo,
          tipo: `${c}-m`,
          mensaje: `${prefijo}La prueba ${prueba.nombre.toLowerCase()} registra ${evM} evaluados masculinos, más que el total masculino (${fila.masculino}).`
        });
      }
    }
  }
  return alertas;
}

function alertasPorId(nucleos = filasBase()) {
  const mapa = new Map();
  for (const alerta of calcularAlertasLocal(nucleos)) {
    if (!mapa.has(alerta.id)) mapa.set(alerta.id, []);
    mapa.get(alerta.id).push(alerta);
  }
  return mapa;
}

/* ---------------------------------------------------------
   Render: metadatos
   --------------------------------------------------------- */

function renderMeta() {
  const meta = estado.meta || {};
  $('#brandSub').textContent = meta.institucion || 'Universidad Nacional Experimental de la Seguridad';
  $('#chipProceso').textContent = meta.proceso || 'Sin proceso';
  $('#chipFecha').textContent = fechaLegible(meta.fecha);
  $('#impTitulo').textContent = meta.titulo || 'Reporte de aspirantes';
  $('#impInstitucion').textContent = meta.institucion || '';
  $('#impProceso').textContent = [
    meta.proceso,
    meta.fecha ? `Fecha: ${fechaLegible(meta.fecha)}` : '',
    etiquetaSemana()
  ].filter(Boolean).join(' · ');
  document.title = `Control de Aspirantes · ${meta.proceso || 'UNES'}`;
  actualizarSello();
}

function actualizarSello() {
  const sello = selloLegible(estado.meta && estado.meta.actualizado);
  $('#pieEstado').innerHTML = sello
    ? `Datos guardados en <code>data/datos.json</code> · Actualizado ${esc(sello)}`
    : 'Datos guardados en <code>data/datos.json</code>';
}

/* ---------------------------------------------------------
   Render: semanas
   --------------------------------------------------------- */

function renderSemanas() {
  const select = $('#filtroSemana');
  if (!select) return;
  const semanas = semanasDisponibles();
  select.innerHTML = `
    <option value="general">General · todas las semanas</option>
    ${semanas.map((numero) => `<option value="${numero}">Semana ${numero}</option>`).join('')}
  `;
  select.value = String(vista.semana);
  const t = calcularResumenLocal();
  const nota = $('#semanaNota');
  if (nota) {
    nota.textContent = esGeneral()
      ? `${fmt.format(t.registros)} registro(s) · ${fmt.format(t.nucleos)} núcleo(s) · ${fmt.format(t.semanas)} semana(s)`
      : `${fmt.format(t.nucleos)} núcleo(s) en la semana ${vista.semana}`;
  }
  const btn = $('#btnAgregar');
  if (btn) btn.disabled = false;
}

/* ---------------------------------------------------------
   Render: indicadores
   --------------------------------------------------------- */

function renderKPIs() {
  const t = calcularResumenLocal();
  const tarjetas = [
    {
      etiqueta: 'Núcleos',
      valor: fmt.format(t.nucleos),
      sub: esGeneral() ? 'Núcleos únicos en todas las semanas' : `Núcleos de la semana ${vista.semana}`,
      color: '#16325c'
    },
    {
      etiqueta: 'Pre-inscritos',
      valor: fmt.format(t.preinscritos),
      sub: 'Base de la convocatoria',
      color: '#4f46e5'
    },
    {
      etiqueta: 'Convocados',
      valor: fmt.format(t.convocados),
      sub: `<strong>${fmt1.format(t.pctConvocados)}%</strong> de los pre-inscritos`,
      color: '#0891b2'
    },
    {
      etiqueta: 'Asistencia',
      valor: fmt.format(t.asistencia),
      sub: `<strong>${fmt1.format(t.pctAsistencia)}%</strong> de los convocados`,
      color: '#0d9488'
    },
    {
      etiqueta: 'Formalizados',
      valor: fmt.format(t.formalizados),
      sub: `<strong>${fmt1.format(t.pctFormalizados)}%</strong> de los convocados`,
      color: '#7c3aed'
    },
    {
      etiqueta: 'Femenino',
      valor: fmt.format(t.femenino),
      sub: `<strong>${fmt1.format(t.pctFemenino)}%</strong> de las asistencias`,
      color: COLORES.femenino
    },
    {
      etiqueta: 'Masculino',
      valor: fmt.format(t.masculino),
      sub: `<strong>${fmt1.format(t.pctMasculino)}%</strong> de las asistencias`,
      color: COLORES.masculino
    }
  ];

  $('#kpis').innerHTML = tarjetas.map((tarjeta) => `
    <article class="kpi" style="--kpi-color:${tarjeta.color}">
      <p class="kpi-etiqueta">${esc(tarjeta.etiqueta)}</p>
      <p class="kpi-valor">${tarjeta.valor}</p>
      <p class="kpi-sub">${tarjeta.sub}</p>
    </article>
  `).join('');
}

function renderPruebas() {
  const t = calcularResumenLocal();
  $('#pruebasResumen').innerHTML = PRUEBAS.map((prueba) => {
    const c = prueba.clave;
    const aprobados = t[`${c}_aprobados`];
    const rechazados = t[`${c}_rechazados`];
    const evaluados = t[`${c}_evaluados`];
    const pct = t[`pct${prueba.clase.charAt(0).toUpperCase()}${prueba.clase.slice(1)}Aprobados`];
    return `
      <article class="prueba prueba-${prueba.clase}" style="--prueba-color:${prueba.color}">
        <header class="prueba-head">
          <h3>Prueba ${esc(prueba.nombre)}</h3>
          <span class="prueba-pct">${fmt1.format(pct)}%</span>
        </header>
        <div class="prueba-barra" role="img" aria-label="${esc(prueba.nombre)}: ${fmt1.format(pct)}% de aprobación">
          <span style="width:${Math.max(0, Math.min(100, pct))}%"></span>
        </div>
        <dl class="prueba-datos">
          <div><dt>Aprobados</dt><dd>${fmt.format(aprobados)}</dd></div>
          <div><dt>Rechazados</dt><dd>${fmt.format(rechazados)}</dd></div>
          <div><dt>Evaluados</dt><dd>${fmt.format(evaluados)}</dd></div>
        </dl>
        <table class="prueba-sexo">
          <thead>
            <tr>
              <th scope="col">Discriminación por sexo</th>
              <th scope="col">Femenino</th>
              <th scope="col">Masculino</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Aprobados</th>
              <td>${fmt.format(t[`${c}_aprobados_f`])}</td>
              <td>${fmt.format(t[`${c}_aprobados_m`])}</td>
            </tr>
            <tr>
              <th scope="row">Rechazados</th>
              <td>${fmt.format(t[`${c}_rechazados_f`])}</td>
              <td>${fmt.format(t[`${c}_rechazados_m`])}</td>
            </tr>
            <tr class="prueba-sexo-total">
              <th scope="row">Evaluados</th>
              <td>${fmt.format(t[`${c}_evaluados_f`])}</td>
              <td>${fmt.format(t[`${c}_evaluados_m`])}</td>
            </tr>
          </tbody>
        </table>
      </article>
    `;
  }).join('');
}

/* ---------------------------------------------------------
   Render: capacidad
   --------------------------------------------------------- */

function renderCapacidad() {
  const filas = filasBase().slice().sort((a, b) => a.nucleo.localeCompare(b.nucleo, 'es'));
  const cuerpo = $('#cuerpoCapacidad');
  if (!cuerpo) return;

  let totalCapacidad = 0;
  let totalAprobF = 0;
  let totalAprobM = 0;

  const html = filas.map((fila) => {
    const aprobF = (Number(fila.psico_aprobados_f) || 0) + (Number(fila.fisico_aprobados_f) || 0) + (Number(fila.medico_aprobados_f) || 0);
    const aprobM = (Number(fila.psico_aprobados_m) || 0) + (Number(fila.fisico_aprobados_m) || 0) + (Number(fila.medico_aprobados_m) || 0);
    const totalAprob = aprobF + aprobM;
    const capacidad = Number(fila.capacidad) || 0;
    const restante = capacidad - totalAprob;
    totalCapacidad += capacidad;
    totalAprobF += aprobF;
    totalAprobM += aprobM;
    const clase = restante < 0 ? 'fila-alerta' : restante === 0 ? 'fila-limite' : '';
    return `
      <tr data-id="${esc(fila.id)}" class="${clase}">
        <td>
          <div class="celda-nucleo">
            <input type="text" data-id="${esc(fila.id)}" data-campo="nucleo" value="${esc(fila.nucleo)}" maxlength="100" ${esGeneral() ? 'disabled' : ''} aria-label="Nombre del núcleo">
            ${esGeneral() ? '<span class="badge-general" title="Vista general: selecciona una semana para editar">General</span>' : ''}
          </div>
        </td>
        <td class="celda-centro">${esc(fila.semana)}</td>
        <td class="celda-num">
          <input type="number" inputmode="numeric" min="0" step="1" data-id="${esc(fila.id)}" data-campo="capacidad" value="${capacidad}" aria-label="Capacidad de ${esc(fila.nucleo)}" ${esGeneral() ? 'disabled' : ''}>
        </td>
        <td class="celda-num grupo-psico">${fmt.format(aprobF)}</td>
        <td class="celda-num grupo-psico">${fmt.format(aprobM)}</td>
        <td class="celda-num celda-restante ${restante < 0 ? 'restante-negativo' : restante === 0 ? 'restante-cero' : 'restante-ok'}">${fmt.format(restante)}</td>
        <td class="no-print"></td>
      </tr>
    `;
  }).join('');

  cuerpo.innerHTML = html;

  const restanteTotal = totalCapacidad - (totalAprobF + totalAprobM);
  $('#pieCapacidad').innerHTML = `
    <tr>
      <td>TOTALES · ${fmt.format(filas.length)} núcleo(s)${esGeneral() ? ' · General' : ` · Semana ${vista.semana}`}</td>
      <td></td>
      <td class="celda-num"><strong>${fmt.format(totalCapacidad)}</strong></td>
      <td class="celda-num"><strong>${fmt.format(totalAprobF)}</strong></td>
      <td class="celda-num"><strong>${fmt.format(totalAprobM)}</strong></td>
      <td class="celda-num celda-restante ${restanteTotal < 0 ? 'restante-negativo' : restanteTotal === 0 ? 'restante-cero' : 'restante-ok'}"><strong>${fmt.format(restanteTotal)}</strong></td>
      <td></td>
    </tr>
  `;

  $('#capacidadTotales').innerHTML = `
    <div><strong>${fmt.format(totalCapacidad)}</strong><span>capacidad total</span></div>
    <div><strong>${fmt.format(totalAprobF + totalAprobM)}</strong><span>aprobados (3 pruebas)</span></div>
    <div><strong>${fmt.format(restanteTotal)}</strong><span>cupo restante</span></div>
  `;
}

/* ---------------------------------------------------------
   Render: análisis
   --------------------------------------------------------- */

function renderInsights() {
  const filas = filasBase();
  const t = calcularResumenLocal(filas);

  const top = filas
    .slice()
    .sort((a, b) => b.asistencia - a.asistencia || a.nucleo.localeCompare(b.nucleo, 'es'))
    .slice(0, 8);

  const maximo = top.length ? Math.max(1, top[0].asistencia) : 1;
  $('#topNucleos').innerHTML = top.length
    ? top.map((fila) => {
      const ancho = Math.max(2, (Number(fila.asistencia) / maximo) * 100);
      const porcentaje = t.asistencia > 0 ? (Number(fila.asistencia) / t.asistencia) * 100 : 0;
      return `
        <div class="barra" title="${esc(fila.nucleo)}: ${fmt.format(fila.asistencia)} asistencias">
          <span class="barra-nombre">${esc(fila.nucleo)}</span>
          <span class="barra-pista"><span class="barra-relleno" style="width:${ancho}%"></span></span>
          <span class="barra-valor">${fmt.format(fila.asistencia)}<small>${fmt1.format(porcentaje)}%</small></span>
        </div>
      `;
    }).join('')
    : '<p class="vacio">Sin datos para mostrar.</p>';

  const femenino = Number(t.femenino) || 0;
  const masculino = Number(t.masculino) || 0;
  const clasificadas = femenino + masculino;
  const base = Math.max(Number(t.asistencia) || 0, clasificadas);
  const sinClasificar = Math.max(0, base - clasificadas);

  const donut = $('#donut');
  if (base > 0) {
    const gradosFem = (femenino / base) * 360;
    const gradosMas = (masculino / base) * 360;
    donut.style.background = `conic-gradient(${COLORES.femenino} 0deg ${gradosFem}deg, ${COLORES.masculino} ${gradosFem}deg ${gradosFem + gradosMas}deg, ${COLORES.sinClasificar} ${gradosFem + gradosMas}deg 360deg)`;
  } else {
    donut.style.background = '#e2e8f0';
  }

  $('#donutTotal').textContent = fmt.format(t.asistencia);

  const leyenda = [
    { etiqueta: 'Femenino', valor: femenino, color: COLORES.femenino },
    { etiqueta: 'Masculino', valor: masculino, color: COLORES.masculino }
  ];
  if (sinClasificar > 0) {
    leyenda.push({ etiqueta: 'Sin clasificar', valor: sinClasificar, color: COLORES.sinClasificar });
  }

  $('#leyendaDonut').innerHTML = leyenda.map((item) => {
    const pct = base > 0 ? (item.valor / base) * 100 : 0;
    return `
      <li>
        <span class="punto-color" style="--c:${item.color}"></span>
        <span>${esc(item.etiqueta)}</span>
        <span class="valor">${fmt.format(item.valor)}<small>${fmt1.format(pct)}%</small></span>
      </li>
    `;
  }).join('');
}

/* ---------------------------------------------------------
   Render: tabla
   --------------------------------------------------------- */

function porcentajeAsistencia(fila) {
  if (!fila.convocados) return null;
  return (Number(fila.asistencia) / Number(fila.convocados)) * 100;
}

const GRUPOS_CELDAS = {
  psico_aprobados_f: 'grupo-psico inicio-grupo',
  psico_aprobados_m: 'grupo-psico',
  psico_rechazados_f: 'grupo-psico',
  psico_rechazados_m: 'grupo-psico fin-grupo',
  fisico_aprobados_f: 'grupo-fisico inicio-grupo',
  fisico_aprobados_m: 'grupo-fisico',
  fisico_rechazados_f: 'grupo-fisico',
  fisico_rechazados_m: 'grupo-fisico fin-grupo',
  medico_aprobados_f: 'grupo-medico inicio-grupo',
  medico_aprobados_m: 'grupo-medico',
  medico_rechazados_f: 'grupo-medico',
  medico_rechazados_m: 'grupo-medico fin-grupo'
};

function renderTabla() {
  const mapaAlertas = alertasPorId();
  const consulta = norm(vista.q);
  const general = esGeneral();

  let filas = filasBase().filter((fila) => {
    if (consulta && !norm(fila.nucleo).includes(consulta)) return false;
    if (vista.soloAlertas && !mapaAlertas.has(fila.id)) return false;
    return true;
  });

  const { campo, dir } = vista.orden;
  filas = filas.slice().sort((a, b) => {
    if (campo === 'nucleo') {
      return a.nucleo.localeCompare(b.nucleo, 'es') * dir;
    }
    const diferencia = (Number(a[campo]) || 0) - (Number(b[campo]) || 0);
    return (diferencia * dir) || a.nucleo.localeCompare(b.nucleo, 'es');
  });

  const cuerpo = $('#cuerpoTabla');
  if (!filas.length) {
    cuerpo.innerHTML = `
      <tr class="fila-vacia">
        <td colspan="21">No hay núcleos que coincidan con el filtro actual.</td>
      </tr>
    `;
  } else {
    cuerpo.innerHTML = filas.map((fila) => {
      const alertas = mapaAlertas.get(fila.id) || [];
      const pct = porcentajeAsistencia(fila);
      const titulo = alertas.map((a) => a.mensaje).join(' ');
      const clases = ['fila'];
      if (alertas.length) clases.push('fila-alerta');
      if (general) clases.push('fila-general');
      return `
        <tr data-id="${esc(fila.id)}" class="${clases.join(' ')}">
          <td>
            <div class="celda-nucleo">
              ${alertas.length ? `<span class="punto-alerta" title="${esc(titulo)}" aria-label="Revisar: ${esc(titulo)}">!</span>` : ''}
              <input type="text" data-id="${esc(fila.id)}" data-campo="nucleo" value="${esc(fila.nucleo)}" maxlength="100" aria-label="Nombre del núcleo" title="${esc(fila.nucleo)}" ${general ? 'disabled' : ''}>
              ${general ? '<span class="badge-general" title="Vista general: selecciona una semana para editar">General</span>' : ''}
            </div>
          </td>
          ${CAMPOS.map((campoFila) => `
            <td class="${GRUPOS_CELDAS[campoFila] || ''}">
              <input type="number" inputmode="numeric" min="0" step="1" data-id="${esc(fila.id)}" data-campo="${campoFila}" value="${Number(fila[campoFila]) || 0}" aria-label="${ETIQUETAS[campoFila]} de ${esc(fila.nucleo)}" ${general ? 'disabled' : ''}>
            </td>
          `).join('')}
          <td class="celda-pct">${pct === null ? '—' : fmt1.format(pct) + '%'}</td>
          <td class="celda-acciones no-print">
            ${general ? '<span class="acciones-nota">Semana</span>' : `
              <button class="btn-accion" type="button" data-accion="editar" data-id="${esc(fila.id)}" title="Editar núcleo" aria-label="Editar ${esc(fila.nucleo)}">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z"></path><path d="m13.5 6.5 4 4"></path></svg>
              </button>
              <button class="btn-accion" type="button" data-accion="duplicar" data-id="${esc(fila.id)}" title="Duplicar núcleo" aria-label="Duplicar ${esc(fila.nucleo)}">
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"></rect><path d="M5 15V5a2 2 0 0 1 2-2h8"></path></svg>
              </button>
              <button class="btn-accion peligro" type="button" data-accion="eliminar" data-id="${esc(fila.id)}" title="Eliminar núcleo" aria-label="Eliminar ${esc(fila.nucleo)}">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M9 7V4h6v3"></path></svg>
              </button>
            `}
          </td>
        </tr>
      `;
    }).join('');
  }

  const totales = calcularResumenLocal(filas);
  const filtrada = filas.length !== filasBase().length;
  $('#pieTabla').innerHTML = `
    <tr>
      <td>TOTALES${filtrada ? ' (FILTRO)' : ''} · ${fmt.format(filas.length)}${general ? ' · General' : ` · Semana ${vista.semana}`}</td>
      <td>${fmt.format(totales.preinscritos)}</td>
      <td>${fmt.format(totales.convocados)}</td>
      <td>${fmt.format(totales.asistencia)}</td>
      <td>${fmt.format(totales.formalizados)}</td>
      <td class="grupo-psico inicio-grupo">${fmt.format(totales.psico_aprobados_f)}</td>
      <td class="grupo-psico">${fmt.format(totales.psico_aprobados_m)}</td>
      <td class="grupo-psico">${fmt.format(totales.psico_rechazados_f)}</td>
      <td class="grupo-psico fin-grupo">${fmt.format(totales.psico_rechazados_m)}</td>
      <td class="grupo-fisico inicio-grupo">${fmt.format(totales.fisico_aprobados_f)}</td>
      <td class="grupo-fisico">${fmt.format(totales.fisico_aprobados_m)}</td>
      <td class="grupo-fisico">${fmt.format(totales.fisico_rechazados_f)}</td>
      <td class="grupo-fisico fin-grupo">${fmt.format(totales.fisico_rechazados_m)}</td>
      <td class="grupo-medico inicio-grupo">${fmt.format(totales.medico_aprobados_f)}</td>
      <td class="grupo-medico">${fmt.format(totales.medico_aprobados_m)}</td>
      <td class="grupo-medico">${fmt.format(totales.medico_rechazados_f)}</td>
      <td class="grupo-medico fin-grupo">${fmt.format(totales.medico_rechazados_m)}</td>
      <td>${fmt.format(totales.femenino)}</td>
      <td>${fmt.format(totales.masculino)}</td>
      <td class="celda-pct">${totales.convocados > 0 ? fmt1.format(totales.pctAsistencia) + '%' : '—'}</td>
      <td class="no-print"></td>
    </tr>
  `;

  const base = filasBase().length;
  $('#contador').textContent = filtrada
    ? `${fmt.format(filas.length)} de ${fmt.format(base)} núcleos`
    : `${fmt.format(base)} núcleos`;

  $$('#tablaDatos thead th').forEach((th) => th.removeAttribute('aria-sort'));
  const botonOrden = $(`#tablaDatos thead button[data-orden="${campo}"]`);
  if (botonOrden) {
    botonOrden.closest('th').setAttribute('aria-sort', dir === 1 ? 'ascending' : 'descending');
  }
}

function actualizarFilaUI(id) {
  const fila = estado.nucleos.find((r) => r.id === id);
  const tr = document.querySelector(`#cuerpoTabla tr[data-id="${id}"]`);
  if (!fila || !tr) return;

  const alertas = alertasPorId().get(id) || [];
  tr.classList.toggle('fila-alerta', alertas.length > 0);

  let punto = tr.querySelector('.punto-alerta');
  if (alertas.length && !punto) {
    punto = document.createElement('span');
    punto.className = 'punto-alerta';
    punto.textContent = '!';
    tr.querySelector('.celda-nucleo').prepend(punto);
  } else if (!alertas.length && punto) {
    punto.remove();
  }
  if (punto) {
    const titulo = alertas.map((a) => a.mensaje).join(' ');
    punto.title = titulo;
    punto.setAttribute('aria-label', 'Revisar: ' + titulo);
  }

  const celdaPct = tr.querySelector('.celda-pct');
  if (celdaPct) {
    const pct = porcentajeAsistencia(fila);
    celdaPct.textContent = pct === null ? '—' : fmt1.format(pct) + '%';
  }
}

/* ---------------------------------------------------------
   Render: alertas
   --------------------------------------------------------- */

function renderAlertas() {
  const alertas = calcularAlertasLocal();
  const contenedor = $('#alertas');
  const contenedorValidacion = $('#alertasDetalle');
  const notas = $('#notasImpresion');

  if (!alertas.length) {
    const vacio = `
      <div class="alerta-ok">Sin inconsistencias: femenino + masculino coincide con la asistencia y las pruebas están dentro de los totales.</div>
    `;
    if (contenedor) contenedor.innerHTML = vacio;
    if (contenedorValidacion) contenedorValidacion.innerHTML = vacio;
    notas.innerHTML = '';
    return;
  }

  const porNucleo = new Map();
  for (const alerta of alertas) {
    if (!porNucleo.has(alerta.id)) porNucleo.set(alerta.id, { nucleo: alerta.nucleo, mensajes: [] });
    porNucleo.get(alerta.id).mensajes.push(alerta.mensaje);
  }

  const detalle = `
    <details class="alerta-detalle">
      <summary>
        <span class="alerta-icono">!</span>
        <span class="alerta-texto"><strong>${fmt.format(alertas.length)}</strong> ${alertas.length === 1 ? 'inconsistencia detectada' : 'inconsistencias detectadas'} en ${fmt.format(porNucleo.size)} ${porNucleo.size === 1 ? 'núcleo' : 'núcleos'}. Revisa las filas marcadas.</span>
        <span class="alerta-accion"><span class="cuando-cerrado">Ver detalle</span><span class="cuando-abierto">Ocultar</span></span>
      </summary>
      <ul class="alerta-lista">
        ${Array.from(porNucleo.entries()).map(([id, item]) => `
          <li>
            <button type="button" data-ir="${esc(id)}">${esc(item.nucleo)}</button>
            <span>${esc(item.mensajes.join(' '))}</span>
          </li>
        `).join('')}
      </ul>
    </details>
  `;
  if (contenedor) contenedor.innerHTML = detalle;
  if (contenedorValidacion) contenedorValidacion.innerHTML = detalle;

  notas.innerHTML = `
    <h3>Notas de validación</h3>
    <ul>
      ${Array.from(porNucleo.entries()).map(([, item]) => `<li><strong>${esc(item.nucleo)}:</strong> ${esc(item.mensajes.join(' '))}</li>`).join('')}
    </ul>
  `;
}

function renderResumenAlertas() {
  const alertas = calcularAlertasLocal();
  const contenedor = $('#resumenAlertas');
  const boton = $('#btnVerAlertas');
  if (!alertas.length) {
    contenedor.innerHTML = '<div class="alerta-ok">Sin inconsistencias: los totales de sexo, asistencia y pruebas coinciden con los datos registrados.</div>';
    boton.disabled = true;
    return;
  }
  const nucleos = new Set(alertas.map((alerta) => alerta.id)).size;
  contenedor.innerHTML = `
    <div class="resumen-alerta">
      <span class="alerta-icono">!</span>
      <div>
        <strong>${fmt.format(alertas.length)}</strong> ${alertas.length === 1 ? 'inconsistencia detectada' : 'inconsistencias detectadas'} en ${fmt.format(nucleos)} ${nucleos === 1 ? 'núcleo' : 'núcleos'}.
        <small>Revisa el detalle y corrige las filas marcadas en la pestaña Núcleos.</small>
      </div>
    </div>
  `;
  boton.disabled = false;
}

/* ---------------------------------------------------------
   Render general
   --------------------------------------------------------- */

function renderTodo() {
  renderMeta();
  renderSemanas();
  renderKPIs();
  renderInsights();
  renderPruebas();
  renderTabla();
  renderCapacidad();
  renderAlertas();
  renderResumenAlertas();
  actualizarMapa();
}

function programarCalculos() {
  if (temporizadorCalculos) clearTimeout(temporizadorCalculos);
  temporizadorCalculos = setTimeout(() => {
    renderKPIs();
    renderInsights();
    renderPruebas();
    renderAlertas();
    renderResumenAlertas();
    actualizarMapa();
    if (!esGeneral()) estado.nucleos.forEach((fila) => actualizarFilaUI(fila.id));
  }, 120);
}

/* ---------------------------------------------------------
   Mapa de Venezuela
   --------------------------------------------------------- */

function estadoDeNucleo(nombre) {
  const clave = norm(nombre);
  if (clave.includes('miranda')) return 'Miranda';
  if (clave.includes('bolivar')) return 'Bolívar';
  if (clave.includes('zulia')) return 'Zulia';
  if (clave.includes('carmen de uria')) return 'La Guaira';
  if (clave.includes('el junquito') || clave.includes('helicoide') || clave.includes('san pedro') || clave.includes('caracas')) return 'Distrito Capital';
  if (clave.includes('tinaquillo')) return 'Cojedes';
  if (clave.includes('la guaira') || clave.includes('vargas')) return 'La Guaira';
  for (const [normalizado, nombreEstado] of ESTADOS_NORMALIZADOS) {
    if (clave === normalizado || clave.includes(normalizado)) return nombreEstado;
  }
  return null;
}

function datosMapa(filas = filasBase()) {
  const porEstado = new Map(ESTADOS_VE.map((nombreEstado) => [nombreEstado, {
    estado: nombreEstado,
    nucleos: [],
    preinscritos: 0,
    convocados: 0,
    asistencia: 0,
    formalizados: 0,
    femenino: 0,
    masculino: 0
  }]));
  const sinEstado = [];
  for (const fila of filas) {
    const nombreEstado = estadoDeNucleo(fila.nucleo);
    if (!nombreEstado || !porEstado.has(nombreEstado)) {
      sinEstado.push(fila);
      continue;
    }
    const item = porEstado.get(nombreEstado);
    item.nucleos.push(fila);
    item.preinscritos += Number(fila.preinscritos) || 0;
    item.convocados += Number(fila.convocados) || 0;
    item.asistencia += Number(fila.asistencia) || 0;
    item.formalizados += Number(fila.formalizados) || 0;
    item.femenino += Number(fila.femenino) || 0;
    item.masculino += Number(fila.masculino) || 0;
  }
  const lista = Array.from(porEstado.values());
  const max = Math.max(1, ...lista.map((item) => item.convocados));
  return { lista, sinEstado, max };
}

function colorMapa(valor, max) {
  if (!valor) return '#eef2f7';
  const paleta = ['#dbeafe', '#93c5fd', '#60a5fa', '#3b82f6', '#1d4ed8', '#16325c'];
  const indice = Math.min(paleta.length - 1, Math.floor((valor / Math.max(1, max)) * paleta.length));
  return paleta[indice];
}

async function cargarMapa() {
  if (mapaCargado) return true;
  if (mapaPromesa) return mapaPromesa;
  mapaPromesa = (async () => {
    try {
      const respuesta = await fetch('venezuela.svg');
      if (!respuesta.ok) throw new Error('No se pudo cargar el mapa.');
      const svg = await respuesta.text();
      $('#mapaVenezuela').innerHTML = svg;
      mapaCargado = true;
      conectarMapa();
      return true;
    } catch (error) {
      $('#mapaVenezuela').innerHTML = `<p class="vacio">No se pudo cargar el mapa. ${esc(error.message)}</p>`;
      return false;
    } finally {
      mapaPromesa = null;
    }
  })();
  return mapaPromesa;
}

function conectarMapa() {
  const contenedor = $('#mapaVenezuela');
  if (!contenedor || contenedor.dataset.conectado === '1') return;
  contenedor.dataset.conectado = '1';
  contenedor.addEventListener('pointermove', (evento) => {
    const path = evento.target.closest('.mapa-estado');
    if (!path) {
      ocultarTooltipMapa();
      return;
    }
    mostrarTooltipMapa(path, evento);
  });
  contenedor.addEventListener('pointerleave', ocultarTooltipMapa);
  contenedor.addEventListener('focusin', (evento) => {
    const path = evento.target.closest('.mapa-estado');
    if (path) mostrarTooltipMapa(path, null);
  });
  contenedor.addEventListener('focusout', (evento) => {
    if (evento.target.closest('.mapa-estado')) ocultarTooltipMapa();
  });
  contenedor.addEventListener('click', (evento) => {
    const path = evento.target.closest('.mapa-estado');
    if (!path) return;
    mostrarDetalleEstado(path.dataset.estado);
  });
  contenedor.addEventListener('keydown', (evento) => {
    if (evento.key !== 'Enter' && evento.key !== ' ') return;
    const path = evento.target.closest('.mapa-estado');
    if (!path) return;
    evento.preventDefault();
    mostrarDetalleEstado(path.dataset.estado);
  });
}

function mostrarTooltipMapa(path, evento) {
  if (!mapaDatos) return;
  const nombre = path.dataset.estado;
  const item = mapaDatos.lista.find((estadoMapa) => estadoMapa.estado === nombre);
  const tooltip = $('#mapaTooltip');
  if (nombre === 'Esequibo') {
    tooltip.innerHTML = `
      <strong>Esequibo</strong>
      <span>Territorio en reclamación</span>
      <small>No forma parte de los núcleos registrados</small>
    `;
  } else if (!item) {
    return;
  } else {
    tooltip.innerHTML = `
      <strong>${esc(nombre)}</strong>
      <span>${fmt.format(item.convocados)} convocados</span>
      <small>${fmt.format(item.asistencia)} asistencias · ${fmt.format(item.nucleos.length)} núcleo(s)</small>
    `;
  }
  tooltip.hidden = false;
  if (evento) {
    tooltip.style.left = `${evento.clientX + 14}px`;
    tooltip.style.top = `${evento.clientY + 14}px`;
  } else {
    const rect = path.getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2}px`;
    tooltip.style.top = `${rect.top}px`;
  }
  mapaPathActivo = path;
}

function ocultarTooltipMapa() {
  const tooltip = $('#mapaTooltip');
  if (tooltip) tooltip.hidden = true;
  mapaPathActivo = null;
}

function mostrarDetalleEstado(nombre) {
  if (!mapaDatos) return;
  mapaEstadoActivo = nombre;
  const detalle = $('#mapaDetalle');
  if (!detalle) return;
  detalle.hidden = false;

  if (nombre === 'Esequibo') {
    detalle.innerHTML = `
      <div class="mapa-detalle-head">
        <div>
          <h3>Esequibo</h3>
          <p>Territorio en reclamación · no forma parte de los núcleos registrados.</p>
        </div>
        <button class="btn-icono" type="button" data-cerrar-detalle aria-label="Cerrar detalle">✕</button>
      </div>
      <p class="vacio">La Guayana Esequiba se muestra como referencia histórica y geográfica; no tiene núcleos ni cifras asociadas en este reporte.</p>
    `;
    conectarCierreDetalle();
    return;
  }

  const item = mapaDatos.lista.find((estadoMapa) => estadoMapa.estado === nombre);
  if (!item) {
    detalle.innerHTML = '';
    detalle.hidden = true;
    return;
  }
  const filas = item.nucleos
    .slice()
    .sort((a, b) => a.nucleo.localeCompare(b.nucleo, 'es'));
  detalle.innerHTML = `
    <div class="mapa-detalle-head">
      <div>
        <h3>${esc(nombre)}</h3>
        <p>${fmt.format(filas.length)} núcleo(s) · ${fmt.format(item.convocados)} convocados · ${fmt.format(item.asistencia)} asistencias</p>
      </div>
      <button class="btn-icono" type="button" data-cerrar-detalle aria-label="Cerrar detalle">✕</button>
    </div>
    ${filas.length ? `
      <div class="mapa-detalle-tabla">
        <table class="mini-tabla">
          <thead>
            <tr><th>Núcleo</th><th>Conv.</th><th>Asist.</th><th>Formal.</th><th>Fem.</th><th>Masc.</th></tr>
          </thead>
          <tbody>
            ${filas.map((fila) => `
              <tr>
                <td>${esc(fila.nucleo)}</td>
                <td>${fmt.format(fila.convocados)}</td>
                <td>${fmt.format(fila.asistencia)}</td>
                <td>${fmt.format(fila.formalizados)}</td>
                <td>${fmt.format(fila.femenino)}</td>
                <td>${fmt.format(fila.masculino)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : '<p class="vacio">Este estado no tiene núcleos registrados.</p>'}
  `;
  conectarCierreDetalle();
}

function conectarCierreDetalle() {
  const boton = $('#mapaDetalle [data-cerrar-detalle]');
  if (boton) {
    boton.addEventListener('click', () => {
      const detalle = $('#mapaDetalle');
      detalle.hidden = true;
      detalle.innerHTML = '';
      mapaEstadoActivo = null;
    });
  }
}

async function actualizarMapa() {
  const listo = await cargarMapa();
  if (!listo) return;
  const { lista, sinEstado, max } = datosMapa();
  mapaDatos = { lista, sinEstado, max };
  const conNucleos = lista.filter((item) => item.nucleos.length > 0);
  const totalConvocados = lista.reduce((total, item) => total + item.convocados, 0);
  const totalAsistencia = lista.reduce((total, item) => total + item.asistencia, 0);

  $('#mapaTotales').innerHTML = `
    <div><strong>${fmt.format(totalConvocados)}</strong><span>convocados</span></div>
    <div><strong>${fmt.format(conNucleos.length)}</strong><span>estados con núcleos</span></div>
    <div><strong>${fmt.format(totalAsistencia)}</strong><span>asistencias</span></div>
  `;
  $('#mapaContador').textContent = `${fmt.format(conNucleos.length)} de ${fmt.format(ESTADOS_VE.length)} estados`;

  const paths = $$('#mapaVenezuela .mapa-estado');
  for (const path of paths) {
    if (path.dataset.estado === 'Esequibo') {
      path.style.fill = '';
      path.classList.add('mapa-esequibo');
      const primero = !document.querySelector('#mapa-esequibo .mapa-estado[tabindex]');
      if (primero) {
        path.setAttribute('tabindex', '0');
        path.setAttribute('aria-label', 'Esequibo: territorio en reclamación');
      } else {
        path.setAttribute('aria-hidden', 'true');
      }
      const titulo = path.querySelector('title');
      if (titulo) titulo.textContent = 'Esequibo: territorio en reclamación';
      continue;
    }
    const item = lista.find((estadoMapa) => estadoMapa.estado === path.dataset.estado);
    const valor = item ? item.convocados : 0;
    path.style.fill = colorMapa(valor, max);
    path.classList.toggle('con-datos', valor > 0);
    path.dataset.valor = String(valor);
    path.setAttribute('tabindex', '0');
    path.setAttribute('aria-label', item ? `${item.estado}: ${fmt.format(valor)} convocados` : `${path.dataset.estado}: sin datos`);
    const titulo = path.querySelector('title');
    if (titulo) {
      titulo.textContent = item
        ? `${item.estado}: ${fmt.format(valor)} convocados · ${fmt.format(item.asistencia)} asistencias`
        : `${path.dataset.estado}: sin núcleos registrados`;
    }
  }

  const etiquetas = $$('#mapaVenezuela .mapa-etiqueta');
  for (const etiqueta of etiquetas) {
    if (etiqueta.dataset.estado === 'Esequibo') {
      etiqueta.textContent = 'Esequibo';
      continue;
    }
    const item = lista.find((estadoMapa) => estadoMapa.estado === etiqueta.dataset.estado);
    etiqueta.textContent = item && item.convocados > 0 ? fmt.format(item.convocados) : '';
  }

  const pasos = [0, 0.2, 0.4, 0.6, 0.8, 1];
  $('#mapaLeyenda').innerHTML = `
    <span class="mapa-leyenda-titulo">Convocados</span>
    <span class="mapa-leyenda-escala">
      ${pasos.slice(0, -1).map((paso, indice) => {
        const desde = Math.round(max * paso);
        const hasta = Math.round(max * pasos[indice + 1]);
        return `<span class="mapa-leyenda-paso"><i style="background:${colorMapa(Math.max(1, desde), max)}"></i>${indice === 0 ? '0' : fmt.format(desde)}–${fmt.format(hasta)}</span>`;
      }).join('')}
    </span>
    <span class="mapa-leyenda-sin"><i style="background:#eef2f7"></i>Sin datos</span>
    <span class="mapa-leyenda-sin"><i class="muestra-esequibo"></i>Esequibo (en reclamación)</span>
  `;

  const ordenada = lista.slice().sort((a, b) => b.convocados - a.convocados || a.estado.localeCompare(b.estado, 'es'));
  $('#mapaLista').innerHTML = ordenada.map((item) => {
    const pct = max > 0 ? (item.convocados / max) * 100 : 0;
    return `
      <button class="mapa-fila ${item.convocados ? 'con-datos' : 'sin-datos'} ${mapaEstadoActivo === item.estado ? 'activo' : ''}" type="button" data-estado="${esc(item.estado)}">
        <span class="mapa-color" style="--c:${colorMapa(item.convocados, max)}"></span>
        <span class="mapa-nombre">${esc(item.estado)}<small>${fmt.format(item.nucleos.length)} núcleo(s)</small></span>
        <span class="mapa-valor">${fmt.format(item.convocados)}<small>conv.</small></span>
        <span class="mapa-barra"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></span>
      </button>
    `;
  }).join('');

  if (sinEstado.length) {
    $('#mapaLista').innerHTML += `
      <div class="mapa-sin-estado">
        <strong>${fmt.format(sinEstado.length)} núcleo(s) sin estado identificado</strong>
        <span>${sinEstado.map((fila) => esc(fila.nucleo)).join(' · ')}</span>
      </div>
    `;
  }

  if (mapaEstadoActivo) mostrarDetalleEstado(mapaEstadoActivo);
}

function conectarListaMapa() {
  const lista = $('#mapaLista');
  if (!lista) return;
  lista.addEventListener('click', (evento) => {
    const boton = evento.target.closest('button[data-estado]');
    if (!boton) return;
    mostrarDetalleEstado(boton.dataset.estado);
  });
}

/* ---------------------------------------------------------
   Pestañas
   --------------------------------------------------------- */

function mostrarPanel(nombre) {
  panelActivo = nombre;
  $$('.tab').forEach((tab) => {
    const activo = tab.dataset.tab === nombre;
    tab.classList.toggle('activo', activo);
    tab.setAttribute('aria-selected', activo ? 'true' : 'false');
    tab.tabIndex = activo ? 0 : -1;
  });
  $$('.tab-panel').forEach((panel) => {
    panel.hidden = panel.dataset.panel !== nombre;
  });
  if (nombre === 'mapa') actualizarMapa();
  if (nombre === 'pruebas') renderPruebas();
  if (nombre === 'resumen') {
    renderKPIs();
    renderInsights();
  }
  if (nombre === 'validacion') {
    renderResumenAlertas();
    renderAlertas();
  }
  if (nombre === 'capacidad') {
    renderCapacidad();
  }
}

function conectarTabs() {
  const tabs = $('#tabs');
  tabs.addEventListener('click', (evento) => {
    const tab = evento.target.closest('button[data-tab]');
    if (!tab) return;
    mostrarPanel(tab.dataset.tab);
  });
  tabs.addEventListener('keydown', (evento) => {
    if (evento.key !== 'ArrowRight' && evento.key !== 'ArrowLeft') return;
    const lista = $$('.tab');
    const actual = lista.findIndex((tab) => tab.dataset.tab === panelActivo);
    const siguiente = evento.key === 'ArrowRight'
      ? (actual + 1) % lista.length
      : (actual - 1 + lista.length) % lista.length;
    lista[siguiente].focus();
    mostrarPanel(lista[siguiente].dataset.tab);
    evento.preventDefault();
  });
  $('#btnVerAlertas').addEventListener('click', () => {
    mostrarPanel('nucleos');
    vista.soloAlertas = true;
    $('#soloAlertas').checked = true;
    renderTabla();
  });
}

function conectarImpresion() {
  window.addEventListener('beforeprint', () => {
    if (panelActivo !== 'nucleos') {
      panelAntesImpresion = panelActivo;
      mostrarPanel('nucleos');
    }
  });
  window.addEventListener('afterprint', () => {
    if (panelAntesImpresion) {
      mostrarPanel(panelAntesImpresion);
      panelAntesImpresion = null;
    }
  });
}

/* ---------------------------------------------------------
   Semanas: selector y creación
   --------------------------------------------------------- */

function conectarSemanas() {
  $('#filtroSemana').addEventListener('change', (evento) => {
    const valor = evento.target.value;
    vista.semana = valor === 'general' ? 'general' : Number(valor);
    renderTodo();
  });

  const dialogo = $('#dlgSemana');
  const formulario = $('#formSemana');
  conectarDialogo(dialogo);

  const abrir = () => {
    formulario.reset();
    $('#errorSemana').textContent = '';
    const semanas = semanasDisponibles();
    const siguiente = semanas.length ? Math.max(...semanas) + 1 : 1;
    formulario.elements.semana.value = siguiente;
    const select = formulario.elements.copiarDe;
    select.innerHTML = `
      <option value="">Semana vacía (todas las cifras en 0)</option>
      ${semanas.map((numero) => `<option value="${numero}">Copiar cifras de la semana ${numero}</option>`).join('')}
    `;
    select.value = semanas.length ? String(semanas[semanas.length - 1]) : '';
    dialogo.showModal();
    setTimeout(() => formulario.elements.semana.focus(), 40);
  };

  $('#btnNuevaSemana').addEventListener('click', abrir);

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const datos = new FormData(formulario);
    const semana = Number(datos.get('semana'));
    const copiarDe = datos.get('copiarDe') ? Number(datos.get('copiarDe')) : null;
    const error = $('#errorSemana');
    error.textContent = '';
    if (!Number.isInteger(semana) || semana < 1 || semana > 999) {
      error.textContent = 'Escribe un número de semana entre 1 y 999.';
      formulario.elements.semana.focus();
      return;
    }
    try {
      const respuesta = await api('/api/semanas', {
        method: 'POST',
        body: { semana, copiarDe, copiar: Boolean(copiarDe) }
      });
      dialogo.close();
      estado = respuesta.estado;
      vista.semana = respuesta.semana;
      toast(`Semana ${respuesta.semana} creada con ${fmt.format(respuesta.creados)} núcleo(s).`);
      renderTodo();
    } catch (err) {
      error.textContent = err.message || 'No se pudo crear la semana.';
    }
  });
}

/* ---------------------------------------------------------
   Guardado automático
   --------------------------------------------------------- */

function marcarGuardado(valor) {
  const contenedor = $('#saveState');
  contenedor.dataset.estado = valor;
  const texto = $('span', contenedor);
  if (texto) {
    texto.textContent = valor === 'guardando' ? 'Guardando…' : valor === 'error' ? 'Error al guardar' : 'Guardado';
  }
}

function programarGuardado(id, campo) {
  const fila = estado.nucleos.find((r) => r.id === id);
  if (!fila || esGeneral()) return;

  const pendiente = pendientes.get(id) || { timer: null, cambios: {} };
  if (pendiente.timer) clearTimeout(pendiente.timer);
  pendiente.cambios[campo] = fila[campo];
  pendiente.timer = setTimeout(() => {
    pendientes.delete(id);
    enviarCambios(id, pendiente.cambios);
  }, 600);
  pendientes.set(id, pendiente);
  marcarGuardado('guardando');
}

function enviarCambios(id, cambios) {
  const anterior = cadenas.get(id) || Promise.resolve();
  const tarea = anterior.catch(() => {}).then(async () => {
    const respuesta = await api(`/api/nucleos/${encodeURIComponent(id)}`, { method: 'PUT', body: cambios });
    const fila = estado.nucleos.find((r) => r.id === id);
    if (fila && respuesta.nucleo) Object.assign(fila, respuesta.nucleo);
    if (respuesta.meta) estado.meta = respuesta.meta;
    marcarGuardado('guardado');
    actualizarSello();
  });
  cadenas.set(id, tarea);
  tarea.catch(async (error) => {
    marcarGuardado('error');
    toast(error.message || 'No se pudo guardar el cambio.', 'error');
    await recargar();
  });
  return tarea;
}

function cancelarPendientes() {
  for (const pendiente of pendientes.values()) {
    if (pendiente.timer) clearTimeout(pendiente.timer);
  }
  pendientes.clear();
}

function cancelarPendiente(id) {
  const pendiente = pendientes.get(id);
  if (pendiente && pendiente.timer) clearTimeout(pendiente.timer);
  pendientes.delete(id);
}

function limpiarFiltros() {
  vista.q = '';
  vista.soloAlertas = false;
  $('#buscar').value = '';
  $('#soloAlertas').checked = false;
}

/* ---------------------------------------------------------
   Recarga
   --------------------------------------------------------- */

async function recargar() {
  cancelarPendientes();
  const datos = await api('/api/estado');
  estado = datos;
  renderTodo();
}

/* ---------------------------------------------------------
   Toasts
   --------------------------------------------------------- */

function toast(mensaje, tipo = 'ok') {
  const contenedor = $('#toasts');
  const elemento = document.createElement('div');
  elemento.className = `toast toast-${tipo}`;
  elemento.textContent = mensaje;
  contenedor.appendChild(elemento);
  setTimeout(() => {
    elemento.classList.add('saliendo');
    setTimeout(() => elemento.remove(), 260);
  }, 3400);
}

/* ---------------------------------------------------------
   Edición en línea
   --------------------------------------------------------- */

function conectarTabla() {
  const cuerpo = $('#cuerpoTabla');

  cuerpo.addEventListener('input', (evento) => {
    const input = evento.target;
    if (input.tagName !== 'INPUT' || !input.dataset.id || !input.dataset.campo) return;
    if (esGeneral()) return;
    const fila = estado.nucleos.find((r) => r.id === input.dataset.id);
    if (!fila) return;

    if (input.dataset.campo === 'nucleo') {
      fila.nucleo = input.value;
    } else {
      const numero = leerNumero(input.value);
      if (Number.isNaN(numero)) {
        programarCalculos();
        return;
      }
      fila[input.dataset.campo] = numero;
    }

    programarCalculos();
    programarGuardado(input.dataset.id, input.dataset.campo);
  });

  cuerpo.addEventListener('focusin', (evento) => {
    const input = evento.target;
    if (input.tagName === 'INPUT' && input.dataset.campo) {
      input.dataset.previo = input.value;
    }
  });

  cuerpo.addEventListener('focusout', (evento) => {
    const input = evento.target;
    if (input.tagName !== 'INPUT' || !input.dataset.campo) return;
    if (esGeneral()) return;
    const fila = estado.nucleos.find((r) => r.id === input.dataset.id);
    if (!fila) return;

    if (input.dataset.campo === 'nucleo') {
      const limpio = input.value.trim();
      if (!limpio) {
        input.value = input.dataset.previo || '';
        fila.nucleo = input.value;
        toast('El nombre del núcleo no puede quedar vacío.', 'error');
      } else if (limpio !== input.value) {
        input.value = limpio;
        fila.nucleo = limpio;
      }
      programarCalculos();
      programarGuardado(fila.id, 'nucleo');
    } else if (input.value.trim() === '') {
      input.value = '0';
      fila[input.dataset.campo] = 0;
      programarCalculos();
    } else if (Number.isNaN(leerNumero(input.value))) {
      input.value = String(fila[input.dataset.campo]);
      toast('Solo se permiten números enteros mayores o iguales a 0.', 'error');
      programarCalculos();
    }
  });

  cuerpo.addEventListener('click', async (evento) => {
    const boton = evento.target.closest('button[data-accion]');
    if (!boton) return;
    const fila = estado.nucleos.find((r) => r.id === boton.dataset.id);
    if (!fila) return;

    if (boton.dataset.accion === 'editar') {
      abrirDialogoNucleo(fila);
      return;
    }

    if (boton.dataset.accion === 'eliminar') {
      const confirmado = confirm(`¿Eliminar el núcleo "${fila.nucleo}" de la semana ${fila.semana}?\n\nEsta acción no se puede deshacer.`);
      if (!confirmado) return;
      cancelarPendiente(fila.id);
      try {
        await api(`/api/nucleos/${encodeURIComponent(fila.id)}`, { method: 'DELETE' });
        toast('Núcleo eliminado.', 'info');
        await recargar();
      } catch (error) {
        toast(error.message || 'No se pudo eliminar.', 'error');
      }
    }

    if (boton.dataset.accion === 'duplicar') {
      const cuerpoNuevo = {
        semana: fila.semana,
        nucleo: `${fila.nucleo.slice(0, 92)} (copia)`
      };
      for (const campo of CAMPOS) cuerpoNuevo[campo] = fila[campo];
      try {
        const respuesta = await api('/api/nucleos', { method: 'POST', body: cuerpoNuevo });
        toast('Núcleo duplicado.', 'info');
        limpiarFiltros();
        await recargar();
        const nueva = document.querySelector(`#cuerpoTabla tr[data-id="${respuesta.nucleo.id}"]`);
        if (nueva) {
          nueva.classList.add('recien');
          nueva.scrollIntoView({ block: 'center', behavior: 'smooth' });
          setTimeout(() => nueva.classList.remove('recien'), 1600);
        }
      } catch (error) {
        toast(error.message || 'No se pudo duplicar.', 'error');
      }
    }
  });

  $('#tablaDatos').addEventListener('click', (evento) => {
    const boton = evento.target.closest('button[data-orden]');
    if (!boton) return;
    const campo = boton.dataset.orden;
    if (vista.orden.campo === campo) {
      vista.orden.dir *= -1;
    } else {
      vista.orden = { campo, dir: campo === 'nucleo' ? 1 : -1 };
    }
    renderTabla();
  });
}

/* ---------------------------------------------------------
   Edición inline: capacidad
   --------------------------------------------------------- */

function conectarCapacidad() {
  const cuerpo = $('#cuerpoCapacidad');

  cuerpo.addEventListener('input', (evento) => {
    const input = evento.target;
    if (input.tagName !== 'INPUT' || !input.dataset.id || !input.dataset.campo) return;
    if (esGeneral()) return;
    const fila = estado.nucleos.find((r) => r.id === input.dataset.id);
    if (!fila) return;

    const numero = leerNumero(input.value);
    if (Number.isNaN(numero)) {
      renderCapacidad();
      return;
    }
    fila.capacidad = numero;

    renderCapacidad();
    programarGuardado(input.dataset.id, 'capacidad');
  });

  cuerpo.addEventListener('focusin', (evento) => {
    const input = evento.target;
    if (input.tagName === 'INPUT' && input.dataset.campo) {
      input.dataset.previo = input.value;
    }
  });

  cuerpo.addEventListener('focusout', (evento) => {
    const input = evento.target;
    if (input.tagName !== 'INPUT' || !input.dataset.campo) return;
    if (esGeneral()) return;
    const fila = estado.nucleos.find((r) => r.id === input.dataset.id);
    if (!fila) return;

    if (input.value.trim() === '') {
      input.value = '0';
      fila.capacidad = 0;
      renderCapacidad();
    } else if (Number.isNaN(leerNumero(input.value))) {
      input.value = String(fila.capacidad);
      toast('Solo se permiten números enteros mayores o iguales a 0.', 'error');
      renderCapacidad();
    }
  });

  $('#tablaCapacidad').addEventListener('click', (evento) => {
    const boton = evento.target.closest('button[data-orden]');
    if (!boton) return;
    const campo = boton.dataset.orden;
    if (vista.orden.campo === campo) {
      vista.orden.dir *= -1;
    } else {
      vista.orden = { campo, dir: campo === 'nucleo' ? 1 : -1 };
    }
    renderCapacidad();
  });
}

/* ---------------------------------------------------------
   Búsqueda y filtros
   --------------------------------------------------------- */

function conectarFiltros() {
  $('#buscar').addEventListener('input', (evento) => {
    const valor = evento.target.value;
    if (temporizadorBusqueda) clearTimeout(temporizadorBusqueda);
    temporizadorBusqueda = setTimeout(() => {
      vista.q = valor;
      renderTabla();
    }, 120);
  });

  $('#soloAlertas').addEventListener('change', (evento) => {
    vista.soloAlertas = evento.target.checked;
    renderTabla();
  });

  const irANucleo = (evento) => {
    const boton = evento.target.closest('button[data-ir]');
    if (!boton) return;
    const fila = filasBase().find((r) => r.id === boton.dataset.ir);
    if (!fila) return;
    mostrarPanel('nucleos');
    vista.q = fila.nucleo;
    vista.soloAlertas = false;
    $('#buscar').value = fila.nucleo;
    $('#soloAlertas').checked = false;
    renderTabla();
    const tr = document.querySelector(`#cuerpoTabla tr[data-id="${fila.id}"]`);
    if (tr) {
      tr.classList.add('recien');
      tr.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setTimeout(() => tr.classList.remove('recien'), 1600);
    }
  };
  const alertasNucleos = $('#alertas');
  const alertasValidacion = $('#alertasDetalle');
  if (alertasNucleos) alertasNucleos.addEventListener('click', irANucleo);
  if (alertasValidacion) alertasValidacion.addEventListener('click', irANucleo);
}

/* ---------------------------------------------------------
   Diálogos
   --------------------------------------------------------- */

function conectarDialogo(dialogo) {
  $$('[data-cerrar]', dialogo).forEach((boton) => {
    boton.addEventListener('click', () => dialogo.close());
  });
  dialogo.addEventListener('click', (evento) => {
    if (evento.target === dialogo) dialogo.close();
  });
}

function abrirDialogoNucleo(fila) {
  const dialogo = $('#dlgNucleo');
  const formulario = $('#formNucleo');
  formulario.reset();
  $('#errorNucleo').textContent = '';
  nucleoEditandoId = fila ? fila.id : null;
  $('#tituloNucleo').textContent = fila ? 'Editar núcleo' : 'Agregar núcleo';
  $('#btnGuardarNucleo').textContent = fila ? 'Guardar cambios' : 'Agregar núcleo';
  formulario.elements.nucleo.value = fila ? fila.nucleo || '' : '';
  formulario.elements.semana.value = fila ? fila.semana : (esGeneral() ? ultimaSemana() : vista.semana);
  for (const campo of CAMPOS) {
    formulario.elements[campo].value = fila ? Number(fila[campo]) || 0 : 0;
  }
  dialogo.showModal();
  setTimeout(() => formulario.elements.nucleo.focus(), 40);
}

function conectarAgregar() {
  const dialogo = $('#dlgNucleo');
  const formulario = $('#formNucleo');
  conectarDialogo(dialogo);

  $('#btnAgregar').addEventListener('click', () => abrirDialogoNucleo(null));

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const datos = new FormData(formulario);
    const cuerpo = {
      nucleo: String(datos.get('nucleo') || '').trim(),
      semana: Number(datos.get('semana'))
    };
    for (const campo of CAMPOS) cuerpo[campo] = datos.get(campo);
    const error = $('#errorNucleo');
    error.textContent = '';

    if (!cuerpo.nucleo) {
      error.textContent = 'Escribe el nombre del núcleo.';
      formulario.elements.nucleo.focus();
      return;
    }
    if (!Number.isInteger(cuerpo.semana) || cuerpo.semana < 1 || cuerpo.semana > 999) {
      error.textContent = 'La semana debe ser un número entero entre 1 y 999.';
      formulario.elements.semana.focus();
      return;
    }

    const editando = nucleoEditandoId;
    try {
      const respuesta = editando
        ? await api(`/api/nucleos/${encodeURIComponent(editando)}`, { method: 'PUT', body: cuerpo })
        : await api('/api/nucleos', { method: 'POST', body: cuerpo });
      dialogo.close();
      toast(editando
        ? `Núcleo "${respuesta.nucleo.nucleo}" actualizado.`
        : `Núcleo "${respuesta.nucleo.nucleo}" agregado.`);
      limpiarFiltros();
      vista.semana = respuesta.nucleo.semana;
      await recargar();
      const tr = document.querySelector(`#cuerpoTabla tr[data-id="${respuesta.nucleo.id}"]`);
      if (tr) {
        tr.classList.add('recien');
        tr.scrollIntoView({ block: 'center', behavior: 'smooth' });
        setTimeout(() => tr.classList.remove('recien'), 1600);
      }
    } catch (err) {
      error.textContent = err.message || (editando ? 'No se pudo actualizar el núcleo.' : 'No se pudo agregar el núcleo.');
    }
  });
}

function conectarMeta() {
  const dialogo = $('#dlgMeta');
  const formulario = $('#formMeta');
  conectarDialogo(dialogo);

  const abrir = () => {
    const meta = estado.meta || {};
    formulario.elements.institucion.value = meta.institucion || '';
    formulario.elements.titulo.value = meta.titulo || '';
    formulario.elements.proceso.value = meta.proceso || '';
    formulario.elements.fecha.value = meta.fecha || '';
    $('#errorMeta').textContent = '';
    dialogo.showModal();
  };

  $('#chipProceso').addEventListener('click', abrir);
  $('#chipFecha').addEventListener('click', abrir);

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const datos = new FormData(formulario);
    const cuerpo = {};
    for (const [clave, valor] of datos.entries()) cuerpo[clave] = valor;
    try {
      const respuesta = await api('/api/meta', { method: 'PUT', body: cuerpo });
      estado.meta = respuesta.meta;
      renderMeta();
      dialogo.close();
      toast('Datos del reporte actualizados.');
    } catch (err) {
      $('#errorMeta').textContent = err.message || 'No se pudieron guardar los datos.';
    }
  });
}

/* ---------------------------------------------------------
   Importación
   --------------------------------------------------------- */

function dividirLinea(linea, delimitador) {
  const celdas = [];
  let actual = '';
  let entreComillas = false;

  for (let i = 0; i < linea.length; i += 1) {
    const caracter = linea[i];
    if (entreComillas) {
      if (caracter === '"') {
        if (linea[i + 1] === '"') {
          actual += '"';
          i += 1;
        } else {
          entreComillas = false;
        }
      } else {
        actual += caracter;
      }
    } else if (caracter === '"') {
      entreComillas = true;
    } else if (caracter === delimitador) {
      celdas.push(actual);
      actual = '';
    } else {
      actual += caracter;
    }
  }
  celdas.push(actual);
  return celdas.map((celda) => celda.trim());
}

function detectarDelimitador(linea) {
  if (linea.includes('\t')) return '\t';
  if (linea.includes(';')) return ';';
  return ',';
}

const ORDEN_6 = { nucleo: 0, preinscritos: 1, convocados: 2, asistencia: 3, femenino: 4, masculino: 5 };

const ORDEN_19 = {
  nucleo: 0,
  preinscritos: 1,
  convocados: 2,
  asistencia: 3,
  formalizados: 4,
  psico_aprobados_f: 5,
  psico_aprobados_m: 6,
  psico_rechazados_f: 7,
  psico_rechazados_m: 8,
  fisico_aprobados_f: 9,
  fisico_aprobados_m: 10,
  fisico_rechazados_f: 11,
  fisico_rechazados_m: 12,
  medico_aprobados_f: 13,
  medico_aprobados_m: 14,
  medico_rechazados_f: 15,
  medico_rechazados_m: 16,
  femenino: 17,
  masculino: 18
};

const ORDEN_20 = {
  semana: 0,
  nucleo: 1,
  preinscritos: 2,
  convocados: 3,
  asistencia: 4,
  formalizados: 5,
  psico_aprobados_f: 6,
  psico_aprobados_m: 7,
  psico_rechazados_f: 8,
  psico_rechazados_m: 9,
  fisico_aprobados_f: 10,
  fisico_aprobados_m: 11,
  fisico_rechazados_f: 12,
  fisico_rechazados_m: 13,
  medico_aprobados_f: 14,
  medico_aprobados_m: 15,
  medico_rechazados_f: 16,
  medico_rechazados_m: 17,
  femenino: 18,
  masculino: 19
};

function mapearCabecera(celda) {
  const clave = norm(celda);
  if (!clave) return null;
  if (clave.includes('semana')) return 'semana';
  if (clave.includes('nucleo') || clave === 'nombre' || clave.includes('centro')) return 'nucleo';
  if (clave.includes('preinscri') || clave.includes('pre inscri')) return 'preinscritos';
  if (clave.includes('convocad')) return 'convocados';
  if (clave.includes('asistencia') || clave === 'asistieron') return 'asistencia';
  if (clave.includes('formaliz')) return 'formalizados';

  const esPsico = clave.includes('psico') || clave.includes('psicolog');
  const esFisico = clave.includes('fisic');
  const esMedico = clave.includes('medic');
  const aprobado = clave.includes('aprob');
  const rechazado = clave.includes('rechaz') || clave.includes('reprob');
  let sexo = null;
  if (clave.includes('femenin') || clave.includes(' fem ') || clave.includes('mujer') || clave.includes('♀')) sexo = 'f';
  if (clave.includes('masculin') || clave.includes(' masc ') || clave.includes('hombre') || clave.includes('♂')) sexo = 'm';
  const prefijo = clave.startsWith('f ') || clave.endsWith(' f') ? 'f' : null;
  if (!sexo && prefijo) sexo = prefijo;
  const sufijoM = clave.endsWith(' m') ? 'm' : null;
  if (!sexo && sufijoM) sexo = sufijoM;

  if (esPsico && aprobado && sexo) return `psico_aprobados_${sexo}`;
  if (esPsico && rechazado && sexo) return `psico_rechazados_${sexo}`;
  if (esFisico && aprobado && sexo) return `fisico_aprobados_${sexo}`;
  if (esFisico && rechazado && sexo) return `fisico_rechazados_${sexo}`;
  if (esMedico && aprobado && sexo) return `medico_aprobados_${sexo}`;
  if (esMedico && rechazado && sexo) return `medico_rechazados_${sexo}`;
  if (clave.includes('femenin')) return 'femenino';
  if (clave.includes('masculin')) return 'masculino';
  return null;
}

function analizarDelimitado(texto) {
  const lineas = texto.split(/\r?\n/).filter((linea) => linea.trim() !== '');
  const resultado = { filas: [], errores: [], meta: null, columnas: null, formato: 'tabla', semana: importacion.semana };
  if (!lineas.length) return resultado;

  const delimitador = detectarDelimitador(lineas[0]);
  const primera = dividirLinea(lineas[0], delimitador);
  const mapeo = primera.map(mapearCabecera);
  const reconocidas = mapeo.filter(Boolean).length;
  const tieneCabecera = reconocidas >= 2 || mapeo[0] === 'nucleo';

  let indices;
  let inicio;
  if (tieneCabecera) {
    indices = {};
    mapeo.forEach((campo, posicion) => {
      if (campo && indices[campo] === undefined) indices[campo] = posicion;
    });
    inicio = 1;
  } else {
    if (primera.length >= 20) indices = ORDEN_20;
    else if (primera.length >= 19) indices = ORDEN_19;
    else if (primera.length >= 13) {
      resultado.errores.push('El formato antiguo de 13 columnas ya no se admite: las pruebas deben venir discriminadas por femenino y masculino. Usa el formato de 19 o 20 columnas.');
      return resultado;
    } else {
      indices = ORDEN_6;
    }
    inicio = 0;
  }
  resultado.columnas = indices;

  for (let i = inicio; i < lineas.length; i += 1) {
    const celdas = dividirLinea(lineas[i], delimitador);
    const nombre = String(celdas[indices.nucleo] == null ? '' : celdas[indices.nucleo]).trim();
    if (norm(nombre) === 'totales' || norm(nombre) === 'total') continue;
    const fila = { nucleo: nombre };
    const posicionSemana = indices.semana;
    fila.semana = posicionSemana === undefined ? null : leerNumero(celdas[posicionSemana]);
    for (const campo of CAMPOS) {
      const posicion = indices[campo];
      const bruto = posicion === undefined ? '' : celdas[posicion];
      fila[campo] = leerNumero(bruto);
    }
    fila.__linea = i + 1;
    resultado.filas.push(fila);
  }

  return resultado;
}

function analizarJSON(texto) {
  const resultado = { filas: [], errores: [], meta: null, columnas: null, formato: 'json', semana: importacion.semana };
  const datos = JSON.parse(texto);
  let lista = null;
  if (Array.isArray(datos)) lista = datos;
  else if (datos && Array.isArray(datos.nucleos)) lista = datos.nucleos;
  else if (datos && Array.isArray(datos.filas)) lista = datos.filas;

  if (!lista) throw new Error('El JSON no contiene una lista de núcleos.');

  resultado.meta = datos && !Array.isArray(datos) && datos.meta ? datos.meta : null;
  lista.forEach((fila, i) => {
    const objeto = fila && typeof fila === 'object' ? fila : {};
    const nueva = {
      nucleo: String(objeto.nucleo == null ? (objeto.nombre == null ? '' : objeto.nombre) : objeto.nucleo).trim(),
      semana: objeto.semana === undefined ? null : leerNumero(objeto.semana),
      __linea: i + 1
    };
    for (const campo of CAMPOS) nueva[campo] = leerNumero(objeto[campo]);
    resultado.filas.push(nueva);
  });
  return resultado;
}

function validarImportacion(resultado) {
  const vistos = new Set();
  const semanaBase = Number(importacion.semana) || 1;
  for (const fila of resultado.filas) {
    const problemas = [];
    if (!fila.nucleo) problemas.push('sin nombre de núcleo');
    const semana = fila.semana === null || fila.semana === undefined ? semanaBase : fila.semana;
    if (!Number.isInteger(semana) || semana < 1 || semana > 999) {
      problemas.push('semana inválida');
    }
    fila.semana = semana;
    for (const campo of CAMPOS) {
      if (!Number.isFinite(fila[campo])) problemas.push(`${ETIQUETAS[campo].toLowerCase()} no es un número válido`);
    }
    if (fila.nucleo) {
      const clave = `${norm(fila.nucleo)}|${semana}`;
      if (vistos.has(clave)) problemas.push('núcleo repetido en el archivo para la misma semana');
      vistos.add(clave);
    }
    fila.__error = problemas.length > 0;
    if (problemas.length) {
      resultado.errores.push(`Fila ${fila.__linea}: ${problemas.join(', ')}.`);
    }
  }
  return resultado;
}

function procesarImportacion(texto) {
  const limpio = String(texto || '').replace(/^\uFEFF/, '').trim();
  let resultado = { filas: [], errores: [], meta: null, columnas: null, formato: null, semana: importacion.semana };

  if (limpio) {
    try {
      if (limpio[0] === '{' || limpio[0] === '[') {
        resultado = analizarJSON(limpio);
      } else {
        resultado = analizarDelimitado(limpio);
      }
      if (!resultado.filas.length && !resultado.errores.length) {
        resultado.errores.push('No se encontraron filas de datos para importar.');
      } else if (resultado.filas.length) {
        validarImportacion(resultado);
      }
    } catch (error) {
      resultado.errores.push(error.message || 'No se pudo interpretar el contenido.');
    }
  }

  importacion = resultado;
  renderPreview();
}

function renderPreview() {
  const { filas, errores, columnas, formato } = importacion;
  const validas = filas.filter((fila) => !fila.__error);
  const resumen = $('#resumenImportar');
  const preview = $('#previewImportar');
  const boton = $('#btnConfirmarImportar');

  if (!filas.length) {
    resumen.textContent = 'Sin datos';
    preview.innerHTML = '<p class="vacio">Pega los datos o carga un archivo para ver la vista previa.</p>';
    boton.disabled = true;
    return;
  }

  resumen.textContent = `${fmt.format(validas.length)} válida(s)${errores.length ? ` · ${fmt.format(errores.length)} error(es)` : ''}`;
  boton.disabled = validas.length === 0 || errores.length > 0;

  const nombresColumnas = columnas
    ? Object.keys(columnas)
      .sort((a, b) => columnas[a] - columnas[b])
      .map((campo) => (campo === 'semana' ? 'SEMANA' : ETIQUETAS[campo].toUpperCase()))
      .join(' · ')
    : '';

  const filasVisibles = validas.slice(0, 6);
  const tabla = filasVisibles.length
    ? `
      <table class="mini-tabla mini-tabla-importar">
        <thead>
          <tr>
            <th>Sem.</th>
            <th>Núcleo</th>
            ${CAMPOS.map((campo) => `<th>${ETIQUETAS_CORTAS[campo]}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${filasVisibles.map((fila) => `
            <tr>
              <td>${fmt.format(fila.semana)}</td>
              <td>${esc(fila.nucleo)}</td>
              ${CAMPOS.map((campo) => `<td>${Number.isFinite(fila[campo]) ? fmt.format(fila[campo]) : '—'}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${validas.length > filasVisibles.length ? `<p class="vacio">+ ${fmt.format(validas.length - filasVisibles.length)} fila(s) más…</p>` : ''}
    `
    : '<p class="vacio">No hay filas válidas.</p>';

  const listaErrores = errores.length
    ? `
      <ul class="lista-errores">
        ${errores.slice(0, 6).map((mensaje) => `<li>${esc(mensaje)}</li>`).join('')}
        ${errores.length > 6 ? `<li>+ ${fmt.format(errores.length - 6)} error(es) más…</li>` : ''}
      </ul>
    `
    : '';

  preview.innerHTML = `
    ${formato === 'json' ? '<p class="vacio" style="text-align:left;padding:0 0 8px">Origen: JSON</p>' : ''}
    ${nombresColumnas ? `<p class="vacio" style="text-align:left;padding:0 0 8px">Columnas detectadas: ${esc(nombresColumnas)}</p>` : ''}
    ${tabla}
    ${listaErrores}
  `;
}

function conectarImportar() {
  const dialogo = $('#dlgImportar');
  const formulario = $('#formImportar');
  const area = $('#textoImportar');
  const semana = $('#semanaImportar');
  conectarDialogo(dialogo);

  const abrir = () => {
    formulario.reset();
    area.value = '';
    $('#errorImportar').textContent = '';
    importacion = { filas: [], errores: [], meta: null, columnas: null, formato: null, semana: esGeneral() ? ultimaSemana() : vista.semana };
    semana.value = importacion.semana;
    renderPreview();
    dialogo.showModal();
    setTimeout(() => area.focus(), 40);
  };

  $('#btnImportar').addEventListener('click', abrir);

  const reprocesar = () => {
    importacion.semana = Number(semana.value) || 1;
    if (area.value.trim()) procesarImportacion(area.value);
    else renderPreview();
  };

  semana.addEventListener('change', reprocesar);

  area.addEventListener('input', () => {
    $('#errorImportar').textContent = '';
    if (temporizadorImportar) clearTimeout(temporizadorImportar);
    temporizadorImportar = setTimeout(() => {
      importacion.semana = Number(semana.value) || 1;
      procesarImportacion(area.value);
    }, 250);
  });

  $('#archivoImportar').addEventListener('change', async (evento) => {
    const archivo = evento.target.files && evento.target.files[0];
    if (!archivo) return;
    try {
      const buffer = await archivo.arrayBuffer();
      let texto;
      try {
        texto = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      } catch (e) {
        texto = new TextDecoder('windows-1252').decode(buffer);
      }
      area.value = texto;
      importacion.semana = Number(semana.value) || 1;
      procesarImportacion(texto);
    } catch (error) {
      $('#errorImportar').textContent = 'No se pudo leer el archivo.';
    }
    evento.target.value = '';
  });

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (temporizadorImportar) {
      clearTimeout(temporizadorImportar);
      importacion.semana = Number(semana.value) || 1;
      procesarImportacion(area.value);
    }
    const modo = new FormData(formulario).get('modo') || 'fusionar';
    const error = $('#errorImportar');
    error.textContent = '';

    const semanaBase = Number(semana.value) || 1;
    const filas = importacion.filas
      .filter((fila) => !fila.__error)
      .map((fila) => {
        const limpia = { nucleo: fila.nucleo, semana: fila.semana || semanaBase };
        for (const campo of CAMPOS) limpia[campo] = fila[campo];
        return limpia;
      });

    if (!filas.length) {
      error.textContent = 'No hay filas válidas para importar.';
      return;
    }

    if (modo === 'reemplazar') {
      const confirmado = confirm('Se reemplazarán TODOS los datos actuales (todas las semanas) por los importados.\n\n¿Deseas continuar?');
      if (!confirmado) return;
    }

    const boton = $('#btnConfirmarImportar');
    boton.disabled = true;
    boton.textContent = 'Importando…';

    try {
      const respuesta = await api('/api/importar', {
        method: 'POST',
        body: { modo, filas, meta: importacion.meta, semana: semanaBase }
      });
      dialogo.close();
      toast(`Importación completada: ${fmt.format(respuesta.agregados)} agregados y ${fmt.format(respuesta.actualizados)} actualizados.`);
      if (respuesta.errores && respuesta.errores.length) {
        toast(`${respuesta.errores.length} fila(s) fueron ignoradas por errores.`, 'error');
      }
      limpiarFiltros();
      await recargar();
    } catch (err) {
      error.textContent = err.message || 'No se pudo completar la importación.';
      if (err.detalle && err.detalle.length) {
        error.textContent += ' ' + err.detalle.slice(0, 3).join(' ');
      }
    } finally {
      boton.disabled = false;
      boton.textContent = 'Importar';
    }
  });
}

/* ---------------------------------------------------------
   Exportar e imprimir
   --------------------------------------------------------- */

function conectarExportar() {
  $('#btnExportarCSV').addEventListener('click', () => {
    window.location.href = `/api/exportar.csv?semana=${encodeURIComponent(vista.semana)}`;
  });

  $('#btnExportarJSON').addEventListener('click', () => {
    window.location.href = `/api/exportar.json?semana=${encodeURIComponent(vista.semana)}`;
  });

  $('#btnImprimir').addEventListener('click', () => {
    limpiarFiltros();
    vista.orden = { campo: 'nucleo', dir: 1 };
    renderTabla();
    if (panelActivo !== 'nucleos') {
      panelAntesImpresion = panelActivo;
      mostrarPanel('nucleos');
    }
    setTimeout(() => window.print(), 80);
  });
}

/* ---------------------------------------------------------
   Respaldos
   --------------------------------------------------------- */

function conectarRespaldos() {
  const dialogo = $('#dlgRespaldos');
  const lista = $('#listaRespaldos');
  conectarDialogo(dialogo);

  $('#btnRespaldos').addEventListener('click', async () => {
    lista.innerHTML = '<p class="vacio">Cargando respaldos…</p>';
    dialogo.showModal();
    try {
      const respuesta = await api('/api/respaldos');
      if (!respuesta.respaldos.length) {
        lista.innerHTML = '<p class="vacio">Todavía no hay respaldos. Se crearán al guardar cambios.</p>';
        return;
      }
      lista.innerHTML = respuesta.respaldos.map((respaldo) => `
        <div class="respaldo">
          <div>
            <strong>${esc(selloLegible(respaldo.fecha))}</strong>
            <small>${esc(respaldo.archivo)} · ${fmt1.format(respaldo.bytes / 1024)} KB</small>
          </div>
          <button class="btn" type="button" data-restaurar="${esc(respaldo.archivo)}">Restaurar</button>
        </div>
      `).join('');
    } catch (error) {
      lista.innerHTML = `<p class="vacio">${esc(error.message)}</p>`;
    }
  });

  lista.addEventListener('click', async (evento) => {
    const boton = evento.target.closest('button[data-restaurar]');
    if (!boton) return;
    const confirmado = confirm('Se reemplazarán los datos actuales con este respaldo.\n\n¿Deseas continuar?');
    if (!confirmado) return;
    boton.disabled = true;
    try {
      await api('/api/respaldos/restaurar', { method: 'POST', body: { archivo: boton.dataset.restaurar } });
      dialogo.close();
      limpiarFiltros();
      toast('Respaldo restaurado.');
      await recargar();
    } catch (error) {
      toast(error.message || 'No se pudo restaurar el respaldo.', 'error');
      boton.disabled = false;
    }
  });
}

/* ---------------------------------------------------------
   Inicio
   --------------------------------------------------------- */

function conectarTodo() {
  conectarTabs();
  conectarSemanas();
  conectarTabla();
  conectarCapacidad();
  conectarFiltros();
  conectarAgregar();
  conectarMeta();
  conectarImportar();
  conectarExportar();
  conectarRespaldos();
  conectarImpresion();
  conectarListaMapa();
}

async function iniciar() {
  conectarTodo();
  try {
    estado = await api('/api/estado');
    vista.semana = ultimaSemana();
    renderTodo();
  } catch (error) {
    toast('No se pudieron cargar los datos. Verifica que el servidor esté activo.', 'error');
    $('#kpis').innerHTML = `<article class="kpi"><p class="kpi-etiqueta">Sin conexión</p><p class="kpi-sub">${esc(error.message)}</p></article>`;
  }
}

iniciar();
