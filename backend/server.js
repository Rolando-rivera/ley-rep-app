const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const pool = require('./db');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const frontendDistDir = path.join(__dirname, '..', 'frontend', 'dist');

app.use(cors());
app.use(express.json());
app.use(express.static(frontendDistDir));

function parseNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isPgError(error) {
  return Boolean(error && typeof error === 'object' && 'code' in error);
}

function sendError(res, error, fallbackMessage = 'Error interno del servidor') {
  console.error(error);
  res.status(500).json({ error: error.message || fallbackMessage });
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(String(password)).digest('hex');
}

async function getEstadoIdByNombre(client, nombreEstado) {
  const result = await client.query(
    'SELECT id_estado FROM estados_declaracion WHERE LOWER(nombre_estado) = LOWER($1) LIMIT 1',
    [nombreEstado],
  );
  return result.rows[0]?.id_estado ?? null;
}

async function createAudit(client, idDeclaracion, idUsuario, accion, detalle) {
  await client.query(
    `INSERT INTO auditoria_eventos (id_declaracion, id_usuario, accion, detalle)
     VALUES ($1, $2, $3, $4)`,
    [idDeclaracion, idUsuario, accion, detalle],
  );
}

async function rebuildValidationArtifacts(client, idDeclaracion) {
  const declResult = await client.query(
    `SELECT d.id_declaracion, d.id_usuario, d.id_categoria, d.anio_periodo, d.mes_periodo,
            d.cantidad_kg, c.nombre_categoria
     FROM declaraciones d
     INNER JOIN categorias_rep c ON c.id_categoria = d.id_categoria
     WHERE d.id_declaracion = $1`,
    [idDeclaracion],
  );

  if (!declResult.rowCount) {
    throw new Error('No se encontró la declaración para recalcular validaciones.');
  }

  const declaracion = declResult.rows[0];
  const rulesResult = await client.query(
    `SELECT id_regla, codigo_regla, nombre_regla, descripcion, valor_min, valor_max, activo
     FROM reglas_validacion
     WHERE activo = TRUE
     ORDER BY id_regla ASC`,
  );

  await client.query('DELETE FROM validaciones_declaracion WHERE id_declaracion = $1', [idDeclaracion]);

  const createdValidations = [];
  const activeRules = rulesResult.rows;

  for (const regla of activeRules) {
    let resultado = 'Observado';
    let detalle = 'La regla no tiene motor automatizado específico.';

    if (regla.codigo_regla === 'RV-001') {
      const minOk = regla.valor_min === null || Number(declaracion.cantidad_kg) >= Number(regla.valor_min);
      const maxOk = regla.valor_max === null || Number(declaracion.cantidad_kg) <= Number(regla.valor_max);
      resultado = minOk && maxOk ? 'Cumple' : 'No cumple';
      detalle = minOk && maxOk
        ? 'La cantidad declarada cumple con el rango permitido.'
        : 'La cantidad declarada no cumple con el rango permitido.';
    } else if (regla.codigo_regla === 'RV-002') {
      const meta = await client.query(
        `SELECT id_meta
         FROM metas_anuales
         WHERE id_categoria = $1 AND anio = $2
         LIMIT 1`,
        [declaracion.id_categoria, declaracion.anio_periodo],
      );
      resultado = meta.rowCount ? 'Cumple' : 'No cumple';
      detalle = meta.rowCount
        ? 'La categoría cuenta con meta anual parametrizada.'
        : 'La categoría no tiene meta anual definida para el período.';
    } else if (regla.codigo_regla === 'RV-003') {
      const duplicates = await client.query(
        `SELECT COUNT(*)::int AS total
         FROM declaraciones
         WHERE id_usuario = $1
           AND id_categoria = $2
           AND anio_periodo = $3
           AND mes_periodo = $4
           AND id_declaracion <> $5`,
        [
          declaracion.id_usuario,
          declaracion.id_categoria,
          declaracion.anio_periodo,
          declaracion.mes_periodo,
          declaracion.id_declaracion,
        ],
      );
      const duplicated = duplicates.rows[0].total > 0;
      resultado = duplicated ? 'No cumple' : 'Cumple';
      detalle = duplicated
        ? 'Existe otra declaración para el mismo productor, categoría y período.'
        : 'No existen duplicidades en el período.';
    }

    const inserted = await client.query(
      `INSERT INTO validaciones_declaracion (id_declaracion, id_regla, resultado, detalle)
       VALUES ($1, $2, $3, $4)
       RETURNING id_validacion, id_regla, resultado, detalle`,
      [idDeclaracion, regla.id_regla, resultado, detalle],
    );

    const validation = inserted.rows[0];
    createdValidations.push({ ...validation, codigo_regla: regla.codigo_regla, nombre_regla: regla.nombre_regla });

    if (resultado !== 'Cumple') {
      let nivel = resultado === 'No cumple' ? 'Alta' : 'Media';
      if (regla.codigo_regla === 'RV-002') nivel = 'Media';

      await client.query(
        `INSERT INTO alertas_preventivas (id_validacion, nivel_alerta, mensaje)
         VALUES ($1, $2, $3)`,
        [validation.id_validacion, nivel, `${regla.nombre_regla}: ${detalle}`],
      );
    }
  }

  return createdValidations;
}


app.post('/api/login', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '').trim();

  if (!email || !password) {
    return res.status(400).json({ error: 'Debe ingresar correo y contraseña.' });
  }

  try {
    const result = await pool.query(
      `SELECT u.id_usuario, u.nombre, u.email, u.id_rol, u.activo, u.password_hash, r.nombre_rol
       FROM usuarios u
       INNER JOIN roles r ON r.id_rol = u.id_rol
       WHERE LOWER(u.email) = LOWER($1)
       LIMIT 1`,
      [email],
    );

    if (!result.rowCount) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const user = result.rows[0];

    if (!user.activo) {
      return res.status(403).json({ error: 'La cuenta se encuentra inactiva.' });
    }

    if (user.password_hash !== hashPassword(password)) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    res.json({
      user: {
        id_usuario: user.id_usuario,
        nombre: user.nombre,
        email: user.email,
        id_rol: user.id_rol,
        nombre_rol: user.nombre_rol,
      },
    });
  } catch (error) {
    sendError(res, error, 'No fue posible iniciar sesión.');
  }
});

app.get('/api/health', async (_, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: 'error', database: 'disconnected', error: error.message });
  }
});

app.get('/api/catalogos', async (_, res) => {
  try {
    const [roles, estados, categorias, reglas] = await Promise.all([
      pool.query('SELECT id_rol, nombre_rol FROM roles ORDER BY id_rol ASC'),
      pool.query('SELECT id_estado, nombre_estado, descripcion FROM estados_declaracion ORDER BY id_estado ASC'),
      pool.query('SELECT id_categoria, nombre_categoria, descripcion, activo FROM categorias_rep ORDER BY id_categoria ASC'),
      pool.query('SELECT id_regla, codigo_regla, nombre_regla, activo FROM reglas_validacion ORDER BY id_regla ASC'),
    ]);

    res.json({
      roles: roles.rows,
      estados: estados.rows,
      categorias: categorias.rows,
      reglas: reglas.rows,
    });
  } catch (error) {
    sendError(res, error, 'No fue posible cargar los catálogos.');
  }
});

app.get('/api/resumen', async (_, res) => {
  try {
    const [usuarios, declaraciones, pendientes, alertas, categorias, reglas] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS total FROM usuarios WHERE activo = TRUE'),
      pool.query('SELECT COUNT(*)::int AS total FROM declaraciones'),
      pool.query(`SELECT COUNT(*)::int AS total
                  FROM declaraciones d
                  INNER JOIN estados_declaracion e ON e.id_estado = d.id_estado
                  WHERE LOWER(e.nombre_estado) = 'pendiente'`),
      pool.query('SELECT COUNT(*)::int AS total FROM alertas_preventivas WHERE atendida = FALSE'),
      pool.query('SELECT COUNT(*)::int AS total FROM categorias_rep WHERE activo = TRUE'),
      pool.query('SELECT COUNT(*)::int AS total FROM reglas_validacion WHERE activo = TRUE'),
    ]);

    res.json({
      usuarios: usuarios.rows[0].total,
      declaraciones: declaraciones.rows[0].total,
      pendientes: pendientes.rows[0].total,
      alertas: alertas.rows[0].total,
      categorias: categorias.rows[0].total,
      reglas: reglas.rows[0].total,
    });
  } catch (error) {
    sendError(res, error, 'No fue posible calcular el resumen del sistema.');
  }
});

app.get('/api/usuarios', async (_, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id_usuario, u.nombre, u.email, u.id_rol, u.activo, u.fecha_creacion, r.nombre_rol
       FROM usuarios u
       INNER JOIN roles r ON r.id_rol = u.id_rol
       ORDER BY u.id_usuario ASC`,
    );
    res.json(result.rows);
  } catch (error) {
    sendError(res, error, 'No fue posible listar los usuarios.');
  }
});

app.post('/api/usuarios', async (req, res) => {
  const { nombre, email, id_rol, activo, password } = req.body;

  if (!nombre || !email || !id_rol) {
    return res.status(400).json({ error: 'Nombre, correo y rol son obligatorios.' });
  }

  const passwordHash = hashPassword(password && String(password).trim() ? password : 'demo123');

  try {
    const result = await pool.query(
      `INSERT INTO usuarios (nombre, email, id_rol, activo, password_hash)
       VALUES ($1, $2, $3, COALESCE($4, TRUE), $5)
       RETURNING id_usuario, nombre, email, id_rol, activo, fecha_creacion`,
      [nombre.trim(), email.trim().toLowerCase(), parseNumber(id_rol), activo, passwordHash],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (isPgError(error) && error.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un usuario con ese correo electrónico.' });
    }
    sendError(res, error, 'No fue posible crear el usuario.');
  }
});

app.put('/api/usuarios/:id', async (req, res) => {
  const id = parseNumber(req.params.id);
  const { nombre, email, id_rol, activo, password } = req.body;

  if (!id || !nombre || !email || !id_rol) {
    return res.status(400).json({ error: 'Debe enviar nombre, correo y rol válidos.' });
  }

  const passwordHash = password && String(password).trim() ? hashPassword(password) : null;

  try {
    const result = await pool.query(
      `UPDATE usuarios
       SET nombre = $1,
           email = $2,
           id_rol = $3,
           activo = COALESCE($4, activo),
           password_hash = COALESCE($5, password_hash)
       WHERE id_usuario = $6
       RETURNING id_usuario, nombre, email, id_rol, activo, fecha_creacion`,
      [nombre.trim(), email.trim().toLowerCase(), parseNumber(id_rol), activo, passwordHash, id],
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: 'No se encontró el usuario solicitado.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    if (isPgError(error) && error.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un usuario con ese correo electrónico.' });
    }
    sendError(res, error, 'No fue posible actualizar el usuario.');
  }
});

app.delete('/api/usuarios/:id', async (req, res) => {
  const id = parseNumber(req.params.id);

  if (!id) {
    return res.status(400).json({ error: 'Debe indicar un usuario válido.' });
  }

  try {
    const declaraciones = await pool.query(
      'SELECT COUNT(*)::int AS total FROM declaraciones WHERE id_usuario = $1',
      [id],
    );

    if (declaraciones.rows[0].total > 0) {
      return res.status(409).json({ error: 'No es posible eliminar el usuario porque tiene declaraciones asociadas.' });
    }

    const result = await pool.query('DELETE FROM usuarios WHERE id_usuario = $1 RETURNING id_usuario', [id]);

    if (!result.rowCount) {
      return res.status(404).json({ error: 'No se encontró el usuario solicitado.' });
    }

    res.status(204).send();
  } catch (error) {
    sendError(res, error, 'No fue posible eliminar el usuario.');
  }
});

app.get('/api/categorias', async (_, res) => {
  try {
    const result = await pool.query(
      `SELECT id_categoria, nombre_categoria, descripcion, activo
       FROM categorias_rep
       ORDER BY id_categoria ASC`,
    );
    res.json(result.rows);
  } catch (error) {
    sendError(res, error, 'No fue posible listar las categorías.');
  }
});

app.post('/api/categorias', async (req, res) => {
  const { nombre_categoria, descripcion, activo } = req.body;

  if (!nombre_categoria) {
    return res.status(400).json({ error: 'El nombre de la categoría es obligatorio.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO categorias_rep (nombre_categoria, descripcion, activo)
       VALUES ($1, $2, COALESCE($3, TRUE))
       RETURNING *`,
      [nombre_categoria.trim(), descripcion?.trim() || null, activo],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (isPgError(error) && error.code === '23505') {
      return res.status(409).json({ error: 'Ya existe una categoría con ese nombre.' });
    }
    sendError(res, error, 'No fue posible crear la categoría.');
  }
});

app.put('/api/categorias/:id', async (req, res) => {
  const id = parseNumber(req.params.id);
  const { nombre_categoria, descripcion, activo } = req.body;

  if (!id || !nombre_categoria) {
    return res.status(400).json({ error: 'Debe enviar una categoría válida.' });
  }

  try {
    const result = await pool.query(
      `UPDATE categorias_rep
       SET nombre_categoria = $1,
           descripcion = $2,
           activo = COALESCE($3, activo)
       WHERE id_categoria = $4
       RETURNING *`,
      [nombre_categoria.trim(), descripcion?.trim() || null, activo, id],
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: 'No se encontró la categoría indicada.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    if (isPgError(error) && error.code === '23505') {
      return res.status(409).json({ error: 'Ya existe una categoría con ese nombre.' });
    }
    sendError(res, error, 'No fue posible actualizar la categoría.');
  }
});

app.delete('/api/categorias/:id', async (req, res) => {
  const id = parseNumber(req.params.id);

  if (!id) {
    return res.status(400).json({ error: 'Debe indicar una categoría válida.' });
  }

  try {
    const refs = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS total FROM declaraciones WHERE id_categoria = $1', [id]),
      pool.query('SELECT COUNT(*)::int AS total FROM metas_anuales WHERE id_categoria = $1', [id]),
    ]);

    const totalRefs = refs[0].rows[0].total + refs[1].rows[0].total;
    if (totalRefs > 0) {
      return res.status(409).json({ error: 'No es posible eliminar la categoría porque tiene datos asociados.' });
    }

    const result = await pool.query('DELETE FROM categorias_rep WHERE id_categoria = $1 RETURNING id_categoria', [id]);

    if (!result.rowCount) {
      return res.status(404).json({ error: 'No se encontró la categoría indicada.' });
    }

    res.status(204).send();
  } catch (error) {
    sendError(res, error, 'No fue posible eliminar la categoría.');
  }
});

app.get('/api/metas', async (_, res) => {
  try {
    const result = await pool.query(
      `SELECT m.id_meta, m.id_categoria, c.nombre_categoria, m.anio, m.porcentaje_meta
       FROM metas_anuales m
       INNER JOIN categorias_rep c ON c.id_categoria = m.id_categoria
       ORDER BY m.anio DESC, m.id_meta ASC`,
    );
    res.json(result.rows);
  } catch (error) {
    sendError(res, error, 'No fue posible listar las metas anuales.');
  }
});

app.post('/api/metas', async (req, res) => {
  const { id_categoria, anio, porcentaje_meta } = req.body;

  if (!id_categoria || !anio || porcentaje_meta === undefined || porcentaje_meta === null) {
    return res.status(400).json({ error: 'Debe indicar categoría, año y porcentaje meta.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO metas_anuales (id_categoria, anio, porcentaje_meta)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [parseNumber(id_categoria), parseNumber(anio), parseNumber(porcentaje_meta)],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (isPgError(error) && error.code === '23505') {
      return res.status(409).json({ error: 'Ya existe una meta anual para esa categoría y año.' });
    }
    sendError(res, error, 'No fue posible crear la meta anual.');
  }
});

app.put('/api/metas/:id', async (req, res) => {
  const id = parseNumber(req.params.id);
  const { id_categoria, anio, porcentaje_meta } = req.body;

  if (!id || !id_categoria || !anio || porcentaje_meta === undefined || porcentaje_meta === null) {
    return res.status(400).json({ error: 'Debe enviar una meta válida.' });
  }

  try {
    const result = await pool.query(
      `UPDATE metas_anuales
       SET id_categoria = $1,
           anio = $2,
           porcentaje_meta = $3
       WHERE id_meta = $4
       RETURNING *`,
      [parseNumber(id_categoria), parseNumber(anio), parseNumber(porcentaje_meta), id],
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: 'No se encontró la meta anual indicada.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    if (isPgError(error) && error.code === '23505') {
      return res.status(409).json({ error: 'Ya existe una meta anual para esa categoría y año.' });
    }
    sendError(res, error, 'No fue posible actualizar la meta anual.');
  }
});

app.delete('/api/metas/:id', async (req, res) => {
  const id = parseNumber(req.params.id);

  if (!id) {
    return res.status(400).json({ error: 'Debe indicar una meta válida.' });
  }

  try {
    const result = await pool.query('DELETE FROM metas_anuales WHERE id_meta = $1 RETURNING id_meta', [id]);

    if (!result.rowCount) {
      return res.status(404).json({ error: 'No se encontró la meta anual indicada.' });
    }

    res.status(204).send();
  } catch (error) {
    sendError(res, error, 'No fue posible eliminar la meta anual.');
  }
});

app.get('/api/reglas', async (_, res) => {
  try {
    const result = await pool.query(
      `SELECT id_regla, codigo_regla, nombre_regla, descripcion, valor_min, valor_max, activo
       FROM reglas_validacion
       ORDER BY id_regla ASC`,
    );
    res.json(result.rows);
  } catch (error) {
    sendError(res, error, 'No fue posible listar las reglas de validación.');
  }
});

app.post('/api/reglas', async (req, res) => {
  const { codigo_regla, nombre_regla, descripcion, valor_min, valor_max, activo } = req.body;

  if (!codigo_regla || !nombre_regla || !descripcion) {
    return res.status(400).json({ error: 'Código, nombre y descripción son obligatorios.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO reglas_validacion (codigo_regla, nombre_regla, descripcion, valor_min, valor_max, activo)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, TRUE))
       RETURNING *`,
      [
        codigo_regla.trim().toUpperCase(),
        nombre_regla.trim(),
        descripcion.trim(),
        parseNumber(valor_min),
        parseNumber(valor_max),
        activo,
      ],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (isPgError(error) && error.code === '23505') {
      return res.status(409).json({ error: 'Ya existe una regla con ese código.' });
    }
    sendError(res, error, 'No fue posible crear la regla de validación.');
  }
});

app.put('/api/reglas/:id', async (req, res) => {
  const id = parseNumber(req.params.id);
  const { codigo_regla, nombre_regla, descripcion, valor_min, valor_max, activo } = req.body;

  if (!id || !codigo_regla || !nombre_regla || !descripcion) {
    return res.status(400).json({ error: 'Debe enviar una regla válida.' });
  }

  try {
    const result = await pool.query(
      `UPDATE reglas_validacion
       SET codigo_regla = $1,
           nombre_regla = $2,
           descripcion = $3,
           valor_min = $4,
           valor_max = $5,
           activo = COALESCE($6, activo)
       WHERE id_regla = $7
       RETURNING *`,
      [
        codigo_regla.trim().toUpperCase(),
        nombre_regla.trim(),
        descripcion.trim(),
        parseNumber(valor_min),
        parseNumber(valor_max),
        activo,
        id,
      ],
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: 'No se encontró la regla indicada.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    if (isPgError(error) && error.code === '23505') {
      return res.status(409).json({ error: 'Ya existe una regla con ese código.' });
    }
    sendError(res, error, 'No fue posible actualizar la regla de validación.');
  }
});

app.delete('/api/reglas/:id', async (req, res) => {
  const id = parseNumber(req.params.id);

  if (!id) {
    return res.status(400).json({ error: 'Debe indicar una regla válida.' });
  }

  try {
    const refs = await pool.query('SELECT COUNT(*)::int AS total FROM validaciones_declaracion WHERE id_regla = $1', [id]);
    if (refs.rows[0].total > 0) {
      return res.status(409).json({ error: 'No es posible eliminar la regla porque tiene validaciones asociadas.' });
    }

    const result = await pool.query('DELETE FROM reglas_validacion WHERE id_regla = $1 RETURNING id_regla', [id]);

    if (!result.rowCount) {
      return res.status(404).json({ error: 'No se encontró la regla indicada.' });
    }

    res.status(204).send();
  } catch (error) {
    sendError(res, error, 'No fue posible eliminar la regla de validación.');
  }
});

app.get('/api/declaraciones', async (req, res) => {
  const usuario = parseNumber(req.query.usuario);

  try {
    const params = [];
    const filters = [];

    if (usuario) {
      params.push(usuario);
      filters.push(`d.id_usuario = $${params.length}`);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT d.id_declaracion, d.id_usuario, u.nombre AS usuario_nombre, u.email AS usuario_email,
              d.id_categoria, c.nombre_categoria, d.id_estado, e.nombre_estado,
              d.anio_periodo, d.mes_periodo, d.cantidad_kg, d.fecha_declaracion, d.observacion
       FROM declaraciones d
       INNER JOIN usuarios u ON u.id_usuario = d.id_usuario
       INNER JOIN categorias_rep c ON c.id_categoria = d.id_categoria
       INNER JOIN estados_declaracion e ON e.id_estado = d.id_estado
       ${whereClause}
       ORDER BY d.fecha_declaracion DESC, d.id_declaracion DESC`,
      params,
    );

    res.json(result.rows);
  } catch (error) {
    sendError(res, error, 'No fue posible listar las declaraciones.');
  }
});

app.post('/api/declaraciones', async (req, res) => {
  const { id_usuario, id_categoria, anio_periodo, mes_periodo, cantidad_kg, observacion } = req.body;

  if (!id_usuario || !id_categoria || !anio_periodo || !mes_periodo || cantidad_kg === undefined || cantidad_kg === null) {
    return res.status(400).json({ error: 'Debe completar usuario, categoría, período y cantidad.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const pendingEstado = await getEstadoIdByNombre(client, 'Pendiente');
    const inserted = await client.query(
      `INSERT INTO declaraciones (id_usuario, id_categoria, id_estado, anio_periodo, mes_periodo, cantidad_kg, observacion)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        parseNumber(id_usuario),
        parseNumber(id_categoria),
        pendingEstado,
        parseNumber(anio_periodo),
        parseNumber(mes_periodo),
        parseNumber(cantidad_kg),
        observacion?.trim() || null,
      ],
    );

    const declaracion = inserted.rows[0];
    await rebuildValidationArtifacts(client, declaracion.id_declaracion);
    await createAudit(client, declaracion.id_declaracion, declaracion.id_usuario, 'Registrar declaración', 'Se registró una nueva declaración REP y se ejecutaron validaciones automáticas.');

    await client.query('COMMIT');
    res.status(201).json(declaracion);
  } catch (error) {
    await client.query('ROLLBACK');
    if (isPgError(error) && error.code === '23505') {
      return res.status(409).json({ error: 'Ya existe una declaración para ese productor, categoría y período.' });
    }
    sendError(res, error, 'No fue posible registrar la declaración.');
  } finally {
    client.release();
  }
});

app.put('/api/declaraciones/:id', async (req, res) => {
  const id = parseNumber(req.params.id);
  const { id_usuario, id_categoria, anio_periodo, mes_periodo, cantidad_kg, observacion } = req.body;

  if (!id || !id_usuario || !id_categoria || !anio_periodo || !mes_periodo || cantidad_kg === undefined || cantidad_kg === null) {
    return res.status(400).json({ error: 'Debe enviar una declaración válida.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const pendingEstado = await getEstadoIdByNombre(client, 'Pendiente');
    const updated = await client.query(
      `UPDATE declaraciones
       SET id_usuario = $1,
           id_categoria = $2,
           id_estado = $3,
           anio_periodo = $4,
           mes_periodo = $5,
           cantidad_kg = $6,
           observacion = $7,
           fecha_declaracion = CURRENT_TIMESTAMP
       WHERE id_declaracion = $8
       RETURNING *`,
      [
        parseNumber(id_usuario),
        parseNumber(id_categoria),
        pendingEstado,
        parseNumber(anio_periodo),
        parseNumber(mes_periodo),
        parseNumber(cantidad_kg),
        observacion?.trim() || null,
        id,
      ],
    );

    if (!updated.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No se encontró la declaración solicitada.' });
    }

    const declaracion = updated.rows[0];
    await rebuildValidationArtifacts(client, declaracion.id_declaracion);
    await createAudit(client, declaracion.id_declaracion, declaracion.id_usuario, 'Editar declaración', 'La declaración fue actualizada y las validaciones se recalcularon.');

    await client.query('COMMIT');
    res.json(declaracion);
  } catch (error) {
    await client.query('ROLLBACK');
    if (isPgError(error) && error.code === '23505') {
      return res.status(409).json({ error: 'Ya existe una declaración para ese productor, categoría y período.' });
    }
    sendError(res, error, 'No fue posible actualizar la declaración.');
  } finally {
    client.release();
  }
});

app.delete('/api/declaraciones/:id', async (req, res) => {
  const id = parseNumber(req.params.id);

  if (!id) {
    return res.status(400).json({ error: 'Debe indicar una declaración válida.' });
  }

  try {
    const result = await pool.query('DELETE FROM declaraciones WHERE id_declaracion = $1 RETURNING id_declaracion', [id]);

    if (!result.rowCount) {
      return res.status(404).json({ error: 'No se encontró la declaración solicitada.' });
    }

    res.status(204).send();
  } catch (error) {
    sendError(res, error, 'No fue posible eliminar la declaración.');
  }
});

app.put('/api/declaraciones/:id/estado', async (req, res) => {
  const id = parseNumber(req.params.id);
  const { accion } = req.body;

  if (!id || !accion || !['validar', 'rechazar'].includes(String(accion).toLowerCase())) {
    return res.status(400).json({ error: 'Debe indicar una acción válida: validar o rechazar.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const declResult = await client.query(
      'SELECT id_declaracion, id_usuario FROM declaraciones WHERE id_declaracion = $1',
      [id],
    );

    if (!declResult.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No se encontró la declaración solicitada.' });
    }

    if (String(accion).toLowerCase() === 'validar') {
      const failing = await client.query(
        `SELECT COUNT(*)::int AS total
         FROM validaciones_declaracion
         WHERE id_declaracion = $1 AND resultado = 'No cumple'`,
        [id],
      );

      if (failing.rows[0].total > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'No es posible validar la declaración porque existen reglas incumplidas.' });
      }
    }

    const targetEstado = await getEstadoIdByNombre(client, String(accion).toLowerCase() === 'validar' ? 'Validada' : 'Rechazada');
    const updated = await client.query(
      `UPDATE declaraciones
       SET id_estado = $1
       WHERE id_declaracion = $2
       RETURNING *`,
      [targetEstado, id],
    );

    const declaration = declResult.rows[0];
    const detail = String(accion).toLowerCase() === 'validar'
      ? 'La declaración fue validada por el gestor.'
      : 'La declaración fue rechazada por el gestor.';

    await createAudit(
      client,
      declaration.id_declaracion,
      declaration.id_usuario,
      String(accion).toLowerCase() === 'validar' ? 'Validar declaración' : 'Rechazar declaración',
      detail,
    );

    await client.query('COMMIT');
    res.json(updated.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    sendError(res, error, 'No fue posible actualizar el estado de la declaración.');
  } finally {
    client.release();
  }
});

app.get('/api/validaciones', async (_, res) => {
  try {
    const result = await pool.query(
      `SELECT v.id_validacion, v.id_declaracion, v.id_regla, r.codigo_regla, r.nombre_regla,
              v.resultado, v.detalle, v.fecha_validacion
       FROM validaciones_declaracion v
       INNER JOIN reglas_validacion r ON r.id_regla = v.id_regla
       ORDER BY v.fecha_validacion DESC, v.id_validacion DESC`,
    );
    res.json(result.rows);
  } catch (error) {
    sendError(res, error, 'No fue posible listar las validaciones.');
  }
});

app.get('/api/alertas', async (_, res) => {
  try {
    const result = await pool.query(
      `SELECT a.id_alerta, a.id_validacion, a.nivel_alerta, a.mensaje, a.atendida, a.fecha_alerta,
              v.id_declaracion, r.codigo_regla, r.nombre_regla
       FROM alertas_preventivas a
       INNER JOIN validaciones_declaracion v ON v.id_validacion = a.id_validacion
       INNER JOIN reglas_validacion r ON r.id_regla = v.id_regla
       ORDER BY a.atendida ASC, a.fecha_alerta DESC`,
    );
    res.json(result.rows);
  } catch (error) {
    sendError(res, error, 'No fue posible listar las alertas preventivas.');
  }
});

app.put('/api/alertas/:id/atender', async (req, res) => {
  const id = parseNumber(req.params.id);
  const { atendida } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Debe indicar una alerta válida.' });
  }

  try {
    const result = await pool.query(
      `UPDATE alertas_preventivas
       SET atendida = COALESCE($1, TRUE)
       WHERE id_alerta = $2
       RETURNING *`,
      [atendida, id],
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: 'No se encontró la alerta indicada.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    sendError(res, error, 'No fue posible actualizar la alerta preventiva.');
  }
});

app.get('/api/auditoria', async (_, res) => {
  try {
    const result = await pool.query(
      `SELECT a.id_evento, a.id_declaracion, a.id_usuario, u.nombre AS usuario_nombre,
              a.accion, a.detalle, a.fecha_evento
       FROM auditoria_eventos a
       INNER JOIN usuarios u ON u.id_usuario = a.id_usuario
       ORDER BY a.fecha_evento DESC, a.id_evento DESC`,
    );
    res.json(result.rows);
  } catch (error) {
    sendError(res, error, 'No fue posible listar la auditoría de eventos.');
  }
});


const hasFrontendBuild = fs.existsSync(path.join(frontendDistDir, 'index.html'));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  if (!hasFrontendBuild) {
    return res.status(503).send('Frontend Vue 3 + Vite no compilado. Ejecuta `cd frontend && npm install && npm run build` o inicia `npm run dev` en frontend para desarrollo local.');

  return res.sendFile(path.join(frontendDistDir, 'index.html'));
}
});

app.listen(PORT, () => {
  console.log(`Ley REP app escuchando en puerto ${PORT}`);
});
