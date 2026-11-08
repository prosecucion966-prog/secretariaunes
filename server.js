'use strict';

const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'datos.json');
const BACKUP_DIR = path.join(DATA_DIR, 'respaldos');
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const MAX_BODY = 8 * 1024 * 1024;

const CAMPOS_NUM = [
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
  preinscritos: 'pre-inscritos',
  convocados: 'convocados',
  asistencia: 'asistencia',
  formalizados: 'formalizados',
  capacidad: 'capacidad',
  psico_aprobados_f: 'psicológica aprobados femenino',
  psico_aprobados_m: 'psicológica aprobados masculino',
  psico_rechazados_f: 'psicológica rechazados femenino',
  psico_rechazados_m: 'psicológica rechazados masculino',
  fisico_aprobados_f: 'física aprobados femenino',
  fisico_aprobados_m: 'física aprobados masculino',
  fisico_rechazados_f: 'física rechazados femenino',
  fisico_rechazados_m: 'física rechazados masculino',
  medico_aprobados_f: 'médica aprobados femenino',
  medico_aprobados_m: 'médica aprobados masculino',
  medico_rechazados_f: 'médica rechazados femenino',
  medico_rechazados_m: 'médica rechazados masculino',
  femenino: 'total femenino',
  masculino: 'total masculino'
};

let estado = null;
let colaGuardado = Promise.resolve();
let ultimoRespaldo = 0;

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

const sello = (d = new Date()) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

const norm = (s) => String(s == null ? '' : s)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

function aEntero(valor) {
  if (valor === null || valor === undefined || valor === '') return 0;
  if (typeof valor === 'number') {
    return Number.isInteger(valor) && valor >= 0 && valor <= 99999999 ? valor : null;
  }
  let s = String(valor).trim().replace(/\s/g, '');
  if (s === '') return 0;
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  if (/^\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, '');
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) && n <= 99999999 ? n : null;
}

function validarSemana(valor, defecto = null) {
  if (valor === undefined || valor === null || valor === '') return defecto;
  const n = aEntero(valor);
  if (n === null || n < 1 || n > 999) return null;
  return n;
}

function semanasDisponibles() {
  const semanas = Array.from(new Set(estado.nucleos.map((r) => Number(r.semana) || 1))).sort((a, b) => a - b);
  return semanas.length ? semanas : [1];
}

function calcularResumen(nucleos) {
  const unicos = new Set(nucleos.map((r) => norm(r.nucleo)));
  const t = {
    nucleos: unicos.size,
    registros: nucleos.length,
    semanas: new Set(nucleos.map((r) => Number(r.semana) || 1)).size
  };
  for (const c of CAMPOS_NUM) t[c] = 0;
  for (const r of nucleos) {
    for (const c of CAMPOS_NUM) t[c] += Number(r[c]) || 0;
  }
  const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
  t.pctConvocados = pct(t.convocados, t.preinscritos);
  t.pctAsistencia = pct(t.asistencia, t.convocados);
  t.pctFormalizados = pct(t.formalizados, t.convocados);
  t.pctFemenino = pct(t.femenino, t.asistencia);
  t.pctMasculino = pct(t.masculino, t.asistencia);

  const pruebas = [
    ['psico', 'Psico'],
    ['fisico', 'Fisico'],
    ['medico', 'Medico']
  ];
  for (const [clave, titulo] of pruebas) {
    t[`${clave}_aprobados`] = t[`${clave}_aprobados_f`] + t[`${clave}_aprobados_m`];
    t[`${clave}_rechazados`] = t[`${clave}_rechazados_f`] + t[`${clave}_rechazados_m`];
    t[`${clave}_evaluados_f`] = t[`${clave}_aprobados_f`] + t[`${clave}_rechazados_f`];
    t[`${clave}_evaluados_m`] = t[`${clave}_aprobados_m`] + t[`${clave}_rechazados_m`];
    t[`${clave}_evaluados`] = t[`${clave}_evaluados_f`] + t[`${clave}_evaluados_m`];
    t[`pct${titulo}Aprobados`] = pct(t[`${clave}_aprobados`], t[`${clave}_evaluados`]);
  }
  return t;
}

function calcularAlertas(nucleos) {
  const alertas = [];
  for (const r of nucleos) {
    const semana = Number(r.semana) || null;
    const prefijo = semana ? `Semana ${semana} · ` : '';
    const suma = (Number(r.femenino) || 0) + (Number(r.masculino) || 0);
    if (suma !== Number(r.asistencia)) {
      alertas.push({
        id: r.id,
        nucleo: r.nucleo,
        semana,
        tipo: 'descuadre',
        mensaje: `${prefijo}Femenino (${r.femenino}) + Masculino (${r.masculino}) = ${suma}, pero la asistencia registrada es ${r.asistencia}.`
      });
    }
    if (Number(r.asistencia) > Number(r.convocados)) {
      alertas.push({
        id: r.id,
        nucleo: r.nucleo,
        semana,
        tipo: 'asistencia',
        mensaje: `${prefijo}La asistencia (${r.asistencia}) supera a los convocados (${r.convocados}).`
      });
    }
    if (Number(r.convocados) > Number(r.preinscritos)) {
      alertas.push({
        id: r.id,
        nucleo: r.nucleo,
        semana,
        tipo: 'convocados',
        mensaje: `${prefijo}Los convocados (${r.convocados}) superan a los pre-inscritos (${r.preinscritos}).`
      });
    }
    if (Number(r.formalizados) > Number(r.asistencia)) {
      alertas.push({
        id: r.id,
        nucleo: r.nucleo,
        semana,
        tipo: 'formalizados',
        mensaje: `${prefijo}Los formalizados (${r.formalizados}) superan la asistencia (${r.asistencia}).`
      });
    }

    const pruebas = [
      ['psico', 'psicológica'],
      ['fisico', 'física'],
      ['medico', 'médica']
    ];
    for (const [tipo, nombre] of pruebas) {
      const apF = Number(r[`${tipo}_aprobados_f`]) || 0;
      const apM = Number(r[`${tipo}_aprobados_m`]) || 0;
      const reF = Number(r[`${tipo}_rechazados_f`]) || 0;
      const reM = Number(r[`${tipo}_rechazados_m`]) || 0;
      const evF = apF + reF;
      const evM = apM + reM;
      const evaluados = evF + evM;
      if (evaluados > Number(r.asistencia)) {
        alertas.push({
          id: r.id,
          nucleo: r.nucleo,
          semana,
          tipo,
          mensaje: `${prefijo}La prueba ${nombre} registra ${evaluados} evaluados (${apF + apM} aprobados + ${reF + reM} rechazados), más que la asistencia (${r.asistencia}).`
        });
      }
      if (evF > Number(r.femenino)) {
        alertas.push({
          id: r.id,
          nucleo: r.nucleo,
          semana,
          tipo: `${tipo}-f`,
          mensaje: `${prefijo}La prueba ${nombre} registra ${evF} evaluadas femeninas, más que el total femenino (${r.femenino}).`
        });
      }
      if (evM > Number(r.masculino)) {
        alertas.push({
          id: r.id,
          nucleo: r.nucleo,
          semana,
          tipo: `${tipo}-m`,
          mensaje: `${prefijo}La prueba ${nombre} registra ${evM} evaluados masculinos, más que el total masculino (${r.masculino}).`
        });
      }
    }
  }
  return alertas;
}

function sanearEstado(bruto) {
  const base = bruto && typeof bruto === 'object' ? bruto : {};
  const meta = base.meta && typeof base.meta === 'object' ? base.meta : {};
  const filas = Array.isArray(base.nucleos) ? base.nucleos : [];
  const nucleos = filas
    .map((f, i) => {
      if (!f || typeof f !== 'object') return null;
      const nombre = String(f.nucleo || f.nombre || '').trim();
      if (!nombre) return null;
      const fila = {
        id: typeof f.id === 'string' && f.id ? f.id : 'n' + (i + 1),
        semana: validarSemana(f.semana, 1) || 1,
        nucleo: nombre.slice(0, 100)
      };
      for (const c of CAMPOS_NUM) {
        const n = aEntero(f[c]);
        fila[c] = n === null ? 0 : n;
      }
      return fila;
    })
    .filter(Boolean);
  return {
    version: 1,
    meta: {
      institucion: String(meta.institucion || 'UNIVERSIDAD NACIONAL EXPERIMENTAL DE LA SEGURIDAD').slice(0, 160),
      titulo: String(meta.titulo || 'Reporte numérico general de las y los aspirantes que iniciaron exámenes de admisión').slice(0, 240),
      proceso: String(meta.proceso || 'PROCESO ENERO I-2027').slice(0, 120),
      fecha: String(meta.fecha || '').slice(0, 10),
      fuente: String(meta.fuente || '').slice(0, 200),
      actualizado: String(meta.actualizado || sello()).slice(0, 30)
    },
    nucleos
  };
}

async function cargarEstado() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  try {
    const bruto = await fsp.readFile(DATA_FILE, 'utf8');
    estado = sanearEstado(JSON.parse(bruto));
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('No se pudo leer data/datos.json:', err.message);
    estado = sanearEstado({});
  }
}

async function respaldar(snapshot, forzar = false) {
  const ahora = Date.now();
  if (!forzar && ahora - ultimoRespaldo < 30 * 60 * 1000) return;
  try {
    await fsp.mkdir(BACKUP_DIR, { recursive: true });
    const nombre = `datos-${sello().replace(/[:T]/g, '-')}.json`;
    await fsp.writeFile(path.join(BACKUP_DIR, nombre), snapshot, 'utf8');
    ultimoRespaldo = ahora;
    const archivos = (await fsp.readdir(BACKUP_DIR))
      .filter((f) => /^datos-.*\.json$/.test(f))
      .sort();
    while (archivos.length > 40) {
      await fsp.unlink(path.join(BACKUP_DIR, archivos.shift())).catch(() => {});
    }
  } catch (err) {
    console.error('No se pudo crear el respaldo:', err.message);
  }
}

function guardar(nuevoEstado) {
  const anterior = estado ? JSON.stringify(estado, null, 2) : null;
  estado = sanearEstado(nuevoEstado);
  estado.meta.actualizado = sello();
  const snapshot = JSON.stringify(estado, null, 2);
  const tarea = colaGuardado.then(async () => {
    if (anterior) await respaldar(anterior);
    await fsp.mkdir(DATA_DIR, { recursive: true });
    const temporal = DATA_FILE + '.tmp';
    await fsp.writeFile(temporal, snapshot, 'utf8');
    await fsp.rename(temporal, DATA_FILE);
  });
  colaGuardado = tarea.catch(() => {});
  return tarea;
}

function existeNombre(nombre, excluirId, semana) {
  const clave = norm(nombre);
  return estado.nucleos.some((r) => r.id !== excluirId && Number(r.semana) === Number(semana) && norm(r.nucleo) === clave);
}

/* ------------------------------------------------------------------ */
/* HTTP                                                                */
/* ------------------------------------------------------------------ */

function responderJSON(res, status, datos) {
  const cuerpo = JSON.stringify(datos);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(cuerpo)
  });
  res.end(cuerpo);
}

function responderTexto(res, status, texto, tipo = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': tipo,
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(texto)
  });
  res.end(texto);
}

function leerCuerpo(req) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const partes = [];
    req.on('data', (trozo) => {
      total += trozo.length;
      if (total > MAX_BODY) {
        reject(Object.assign(new Error('El contenido es demasiado grande.'), { status: 413 }));
        req.destroy();
        return;
      }
      partes.push(trozo);
    });
    req.on('end', () => {
      if (!partes.length) return resolve(null);
      try {
        resolve(JSON.parse(Buffer.concat(partes).toString('utf8')));
      } catch (e) {
        reject(Object.assign(new Error('El JSON enviado no es válido.'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function csvCelda(valor) {
  const s = String(valor == null ? '' : valor);
  return /[";\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function filtrarPorSemana(nucleos, valor) {
  if (valor === null || valor === undefined || valor === '' || valor === 'general') return nucleos;
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < 1) return nucleos;
  return nucleos.filter((r) => Number(r.semana) === numero);
}

function generarCSV(nucleos) {
  const campos = [
    ['preinscritos', 'PRE-INSCRITOS'],
    ['convocados', 'CONVOCADOS'],
    ['asistencia', 'ASISTENCIA'],
    ['formalizados', 'FORMALIZADOS'],
    ['psico_aprobados_f', 'PSICOLÓGICA APROBADOS F'],
    ['psico_aprobados_m', 'PSICOLÓGICA APROBADOS M'],
    ['psico_rechazados_f', 'PSICOLÓGICA RECHAZADOS F'],
    ['psico_rechazados_m', 'PSICOLÓGICA RECHAZADOS M'],
    ['fisico_aprobados_f', 'FÍSICA APROBADOS F'],
    ['fisico_aprobados_m', 'FÍSICA APROBADOS M'],
    ['fisico_rechazados_f', 'FÍSICA RECHAZADOS F'],
    ['fisico_rechazados_m', 'FÍSICA RECHAZADOS M'],
    ['medico_aprobados_f', 'MÉDICA APROBADOS F'],
    ['medico_aprobados_m', 'MÉDICA APROBADOS M'],
    ['medico_rechazados_f', 'MÉDICA RECHAZADOS F'],
    ['medico_rechazados_m', 'MÉDICA RECHAZADOS M'],
    ['femenino', 'TOTAL FEMENINO'],
    ['masculino', 'TOTAL MASCULINO']
  ];
  const lineas = [
    ['SEMANA', 'NÚCLEO', ...campos.map(([, etiqueta]) => etiqueta)].join(';')
  ];
  for (const r of nucleos) {
    lineas.push([r.semana, r.nucleo, ...campos.map(([campo]) => r[campo])].map(csvCelda).join(';'));
  }
  const t = calcularResumen(nucleos);
  lineas.push(['', 'TOTALES', ...campos.map(([campo]) => t[campo])].map(csvCelda).join(';'));
  return '\uFEFF' + lineas.join('\r\n') + '\r\n';
}

function estadoPublico() {
  return {
    meta: estado.meta,
    nucleos: estado.nucleos,
    semanas: semanasDisponibles(),
    resumen: calcularResumen(estado.nucleos),
    alertas: calcularAlertas(estado.nucleos)
  };
}

async function manejarAPI(req, res, ruta, url) {
  /* Estado completo */
  if (ruta === '/api/estado' && req.method === 'GET') {
    return responderJSON(res, 200, estadoPublico());
  }

  /* Exportaciones */
  if (ruta === '/api/exportar.csv' && req.method === 'GET') {
    const nucleos = filtrarPorSemana(estado.nucleos, url.searchParams.get('semana'));
    const csv = generarCSV(nucleos);
    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="reporte-aspirantes.csv"',
      'Content-Length': Buffer.byteLength(csv)
    });
    return res.end(csv);
  }

  if (ruta === '/api/exportar.json' && req.method === 'GET') {
    const nucleos = filtrarPorSemana(estado.nucleos, url.searchParams.get('semana'));
    const cuerpo = JSON.stringify({
      meta: estado.meta,
      semanas: semanasDisponibles(),
      nucleos,
      resumen: calcularResumen(nucleos),
      alertas: calcularAlertas(nucleos)
    }, null, 2);
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': 'attachment; filename="reporte-aspirantes.json"',
      'Content-Length': Buffer.byteLength(cuerpo)
    });
    return res.end(cuerpo);
  }

  /* Metadatos */
  if (ruta === '/api/meta' && req.method === 'PUT') {
    const cuerpo = await leerCuerpo(req);
    if (!cuerpo || typeof cuerpo !== 'object') {
      return responderJSON(res, 400, { error: 'Datos inválidos.' });
    }
    const permitidos = ['institucion', 'titulo', 'proceso', 'fecha'];
    const nuevo = { ...estado.meta };
    for (const clave of permitidos) {
      if (cuerpo[clave] === undefined) continue;
      const valor = String(cuerpo[clave] == null ? '' : cuerpo[clave]).trim();
      if (valor.length > 240) {
        return responderJSON(res, 400, { error: 'El texto es demasiado largo.' });
      }
      nuevo[clave] = valor;
    }
    if (nuevo.fecha && !/^\d{4}-\d{2}-\d{2}$/.test(nuevo.fecha)) {
      return responderJSON(res, 400, { error: 'La fecha debe tener el formato AAAA-MM-DD.' });
    }
    await guardar({ ...estado, meta: nuevo });
    return responderJSON(res, 200, { ok: true, meta: estado.meta, resumen: calcularResumen(estado.nucleos) });
  }

  /* Crear núcleo */
  if (ruta === '/api/nucleos' && req.method === 'POST') {
    const cuerpo = await leerCuerpo(req);
    if (!cuerpo || typeof cuerpo !== 'object') {
      return responderJSON(res, 400, { error: 'Datos inválidos.' });
    }
    const nombre = String(cuerpo.nucleo || '').trim();
    if (!nombre) return responderJSON(res, 400, { error: 'El nombre del núcleo es obligatorio.' });
    if (nombre.length > 100) return responderJSON(res, 400, { error: 'El nombre del núcleo es demasiado largo.' });
    const semana = validarSemana(cuerpo.semana, 1);
    if (semana === null) return responderJSON(res, 400, { error: 'La semana debe ser un número entero entre 1 y 999.' });
    if (existeNombre(nombre, null, semana)) return responderJSON(res, 409, { error: `Ya existe un núcleo con ese nombre en la semana ${semana}.` });

    const fila = { id: crypto.randomUUID(), semana, nucleo: nombre };
    for (const c of CAMPOS_NUM) {
      const n = aEntero(cuerpo[c]);
      if (n === null) {
        return responderJSON(res, 400, { error: `El valor de "${ETIQUETAS[c]}" debe ser un número entero mayor o igual a 0.` });
      }
      fila[c] = n;
    }
    await guardar({ ...estado, nucleos: [...estado.nucleos, fila] });
    return responderJSON(res, 201, { ok: true, nucleo: fila, meta: estado.meta, resumen: calcularResumen(estado.nucleos) });
  }

  /* Actualizar / eliminar núcleo */
  const coincidencia = /^\/api\/nucleos\/([^/]+)$/.exec(ruta);
  if (coincidencia) {
    const id = decodeURIComponent(coincidencia[1]);
    const indice = estado.nucleos.findIndex((r) => r.id === id);
    if (indice === -1) return responderJSON(res, 404, { error: 'Núcleo no encontrado.' });

    if (req.method === 'PUT') {
      const cuerpo = await leerCuerpo(req);
      if (!cuerpo || typeof cuerpo !== 'object') {
        return responderJSON(res, 400, { error: 'Datos inválidos.' });
      }
      const fila = { ...estado.nucleos[indice] };
      if (cuerpo.semana !== undefined) {
        const nuevaSemana = validarSemana(cuerpo.semana, fila.semana);
        if (nuevaSemana === null) {
          return responderJSON(res, 400, { error: 'La semana debe ser un número entero entre 1 y 999.' });
        }
        fila.semana = nuevaSemana;
      }
      if (cuerpo.nucleo !== undefined) {
        const nombre = String(cuerpo.nucleo).trim();
        if (!nombre) return responderJSON(res, 400, { error: 'El nombre del núcleo no puede quedar vacío.' });
        if (nombre.length > 100) return responderJSON(res, 400, { error: 'El nombre del núcleo es demasiado largo.' });
        fila.nucleo = nombre;
      }
      if (existeNombre(fila.nucleo, id, fila.semana)) {
        return responderJSON(res, 409, { error: `Ya existe un núcleo con ese nombre en la semana ${fila.semana}.` });
      }
      for (const c of CAMPOS_NUM) {
        if (cuerpo[c] === undefined) continue;
        const n = aEntero(cuerpo[c]);
        if (n === null) {
          return responderJSON(res, 400, { error: `El valor de "${ETIQUETAS[c]}" debe ser un número entero mayor o igual a 0.` });
        }
        fila[c] = n;
      }
      const nucleos = estado.nucleos.slice();
      nucleos[indice] = fila;
      await guardar({ ...estado, nucleos });
      return responderJSON(res, 200, { ok: true, nucleo: fila, meta: estado.meta, resumen: calcularResumen(estado.nucleos) });
    }

    if (req.method === 'DELETE') {
      const nucleos = estado.nucleos.filter((r) => r.id !== id);
      await guardar({ ...estado, nucleos });
      return responderJSON(res, 200, { ok: true, meta: estado.meta, resumen: calcularResumen(estado.nucleos) });
    }

    return responderJSON(res, 405, { error: 'Método no permitido.' });
  }

  /* Crear una semana nueva */
  if (ruta === '/api/semanas' && req.method === 'POST') {
    const cuerpo = await leerCuerpo(req);
    if (!cuerpo || typeof cuerpo !== 'object') {
      return responderJSON(res, 400, { error: 'Datos inválidos.' });
    }
    const semana = validarSemana(cuerpo.semana, null);
    if (semana === null) {
      return responderJSON(res, 400, { error: 'La semana debe ser un número entero entre 1 y 999.' });
    }
    if (estado.nucleos.some((r) => Number(r.semana) === semana)) {
      return responderJSON(res, 409, { error: `La semana ${semana} ya existe.` });
    }
    const copiarDe = validarSemana(cuerpo.copiarDe, null);
    const fuente = copiarDe ? estado.nucleos.filter((r) => Number(r.semana) === copiarDe) : [];
    const nombres = Array.from(new Set(
      (copiarDe ? fuente : estado.nucleos).map((r) => r.nucleo)
    ));
    if (!nombres.length) {
      return responderJSON(res, 400, { error: 'No hay núcleos registrados para crear la semana.' });
    }
    const nuevas = nombres.map((nombre) => {
      const base = fuente.find((r) => norm(r.nucleo) === norm(nombre));
      const fila = { id: crypto.randomUUID(), semana, nucleo: nombre };
      for (const c of CAMPOS_NUM) {
        fila[c] = base && cuerpo.copiar ? Number(base[c]) || 0 : 0;
      }
      return fila;
    });
    await guardar({ ...estado, nucleos: [...estado.nucleos, ...nuevas] });
    return responderJSON(res, 201, {
      ok: true,
      semana,
      creados: nuevas.length,
      meta: estado.meta,
      estado: estadoPublico()
    });
  }

  /* Importar */
  if (ruta === '/api/importar' && req.method === 'POST') {
    const cuerpo = await leerCuerpo(req);
    if (!cuerpo || typeof cuerpo !== 'object') {
      return responderJSON(res, 400, { error: 'Datos inválidos.' });
    }
    const modo = cuerpo.modo === 'reemplazar' ? 'reemplazar' : 'fusionar';
    const semanaBase = validarSemana(cuerpo.semana, 1);
    if (semanaBase === null) {
      return responderJSON(res, 400, { error: 'La semana de importación debe ser un número entero entre 1 y 999.' });
    }
    const filas = Array.isArray(cuerpo.filas) ? cuerpo.filas : [];
    if (!filas.length) return responderJSON(res, 400, { error: 'No hay filas para importar.' });
    if (filas.length > 5000) return responderJSON(res, 400, { error: 'Se superó el máximo de 5000 filas.' });

    const errores = [];
    const validas = [];
    filas.forEach((f, i) => {
      const numero = i + 1;
      if (!f || typeof f !== 'object') {
        errores.push(`Fila ${numero}: formato inválido.`);
        return;
      }
      const nombre = String(f.nucleo == null ? '' : f.nucleo).trim();
      if (!nombre) {
        errores.push(`Fila ${numero}: falta el nombre del núcleo.`);
        return;
      }
      const semana = validarSemana(f.semana, semanaBase);
      if (semana === null) {
        errores.push(`Fila ${numero}: la semana debe ser un número entero entre 1 y 999.`);
        return;
      }
      const fila = { semana, nucleo: nombre.slice(0, 100) };
      let fallo = null;
      for (const c of CAMPOS_NUM) {
        const n = aEntero(f[c]);
        if (n === null) {
          fallo = `Fila ${numero}: "${ETIQUETAS[c]}" no es un número válido ("${f[c]}").`;
          break;
        }
        fila[c] = n;
      }
      if (fallo) errores.push(fallo);
      else validas.push(fila);
    });

    if (modo === 'reemplazar' && errores.length) {
      return responderJSON(res, 400, {
        error: 'La importación fue cancelada porque hay filas con errores. Corrige el archivo e inténtalo de nuevo.',
        errores
      });
    }

    let nucleos;
    let agregados = 0;
    let actualizados = 0;
    const ignorados = filas.length - validas.length;

    if (modo === 'reemplazar') {
      nucleos = validas.map((f) => ({ id: crypto.randomUUID(), ...f }));
      agregados = nucleos.length;
    } else {
      nucleos = estado.nucleos.map((r) => ({ ...r }));
      for (const f of validas) {
        const clave = `${norm(f.nucleo)}|${f.semana}`;
        const existente = nucleos.find((r) => `${norm(r.nucleo)}|${Number(r.semana) || 1}` === clave);
        if (existente) {
          for (const c of CAMPOS_NUM) existente[c] = f[c];
          actualizados += 1;
        } else {
          nucleos.push({ id: crypto.randomUUID(), ...f });
          agregados += 1;
        }
      }
    }

    const meta = { ...estado.meta };
    if (cuerpo.meta && typeof cuerpo.meta === 'object') {
      for (const clave of ['institucion', 'titulo', 'proceso', 'fecha']) {
        if (cuerpo.meta[clave] === undefined) continue;
        const valor = String(cuerpo.meta[clave] == null ? '' : cuerpo.meta[clave]).trim();
        if (valor) meta[clave] = valor.slice(0, 240);
      }
    }

    await guardar({ ...estado, meta, nucleos });
    return responderJSON(res, 200, {
      ok: true,
      modo,
      agregados,
      actualizados,
      ignorados,
      errores,
      meta: estado.meta,
      resumen: calcularResumen(estado.nucleos),
      alertas: calcularAlertas(estado.nucleos)
    });
  }

  /* Respaldos */
  if (ruta === '/api/respaldos' && req.method === 'GET') {
    try {
      await fsp.mkdir(BACKUP_DIR, { recursive: true });
      const archivos = (await fsp.readdir(BACKUP_DIR)).filter((f) => /^datos-.*\.json$/.test(f)).sort().reverse();
      const lista = [];
      for (const archivo of archivos) {
        const info = await fsp.stat(path.join(BACKUP_DIR, archivo));
        lista.push({ archivo, fecha: info.mtime.toISOString(), bytes: info.size });
      }
      return responderJSON(res, 200, { respaldos: lista });
    } catch (err) {
      return responderJSON(res, 500, { error: 'No se pudieron leer los respaldos.' });
    }
  }

  if (ruta === '/api/respaldos/restaurar' && req.method === 'POST') {
    const cuerpo = await leerCuerpo(req);
    const archivo = String((cuerpo && cuerpo.archivo) || '');
    if (!/^datos-[\w.-]+\.json$/.test(archivo)) {
      return responderJSON(res, 400, { error: 'Nombre de respaldo inválido.' });
    }
    const rutaArchivo = path.resolve(BACKUP_DIR, archivo);
    if (!rutaArchivo.startsWith(path.resolve(BACKUP_DIR) + path.sep)) {
      return responderJSON(res, 400, { error: 'Ruta de respaldo inválida.' });
    }
    try {
      const bruto = await fsp.readFile(rutaArchivo, 'utf8');
      const restaurado = sanearEstado(JSON.parse(bruto));
      await guardar(restaurado);
      return responderJSON(res, 200, { ok: true, estado: estadoPublico() });
    } catch (err) {
      return responderJSON(res, 400, { error: 'No se pudo restaurar el respaldo.' });
    }
  }

  return responderJSON(res, 404, { error: 'Ruta no encontrada.' });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8'
};

async function servirEstatico(res, ruta) {
  let relativa;
  try {
    relativa = decodeURIComponent(ruta);
  } catch (e) {
    return responderTexto(res, 400, 'Solicitud inválida.');
  }
  if (relativa === '/' || relativa === '') relativa = '/index.html';
  const archivo = path.resolve(PUBLIC_DIR, '.' + relativa);
  if (archivo !== PUBLIC_DIR && !archivo.startsWith(PUBLIC_DIR + path.sep)) {
    return responderTexto(res, 403, 'Acceso denegado.');
  }
  try {
    const contenido = await fsp.readFile(archivo);
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(archivo).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'Content-Length': contenido.length
    });
    res.end(contenido);
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'EISDIR') {
      return responderTexto(res, 404, 'Archivo no encontrado.');
    }
    console.error(err);
    return responderTexto(res, 500, 'Error interno.');
  }
}

async function manejar(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const ruta = url.pathname;

  if (ruta === '/favicon.ico') {
    res.writeHead(204);
    return res.end();
  }

  try {
    if (ruta.startsWith('/api/')) {
      return await manejarAPI(req, res, ruta, url);
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return responderTexto(res, 405, 'Método no permitido.');
    }
    return await servirEstatico(res, ruta);
  } catch (err) {
    const status = err && err.status ? err.status : 500;
    if (status >= 500) console.error(err);
    if (res.headersSent) return res.end();
    return responderJSON(res, status, { error: err.message || 'Error interno del servidor.' });
  }
}

/* ------------------------------------------------------------------ */
/* Arranque                                                            */
/* ------------------------------------------------------------------ */

function abrirNavegador(direccion) {
  if (process.env.NO_OPEN === '1') return;
  const comando = process.platform === 'win32'
    ? `start "" "${direccion}"`
    : process.platform === 'darwin'
      ? `open "${direccion}"`
      : `xdg-open "${direccion}"`;
  exec(comando, () => {});
}

(async () => {
  await cargarEstado();
  const servidor = http.createServer(manejar);

  servidor.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\nEl puerto ${PORT} ya está en uso.`);
      console.error(`Cierra la otra instancia o ejecuta: set PORT=3001 && npm start\n`);
      process.exit(1);
    }
    throw err;
  });

  servidor.listen(PORT, HOST, () => {
    const direccion = `http://${HOST}:${PORT}`;
    console.log('');
    console.log('  Control de Aspirantes · UNES');
    console.log('  ---------------------------------------------');
    console.log(`  Servidor activo en ${direccion}`);
    console.log(`  Datos: ${DATA_FILE}`);
    console.log('  Para detener, presiona Ctrl+C');
    console.log('');
    abrirNavegador(direccion);
  });

  const cerrar = async () => {
    try {
      await colaGuardado;
    } catch (e) {
      /* ignorar */
    }
    process.exit(0);
  };
  process.on('SIGINT', cerrar);
  process.on('SIGTERM', cerrar);
})().catch((err) => {
  console.error('No se pudo iniciar la aplicación:', err);
  process.exit(1);
});
