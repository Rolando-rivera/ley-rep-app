<template>
  <div>
      <template v-if="!isAuthenticated">
        <div class="login-shell">
          <section class="login-card">
            <div class="login-copy">
              <p class="eyebrow text">Acceso a la demo</p>
              <h1>Plataforma Ley REP</h1>
              <p class="page-copy">
                Inicia sesión con un usuario genérico para mostrar los perfiles solicitados en la evaluación.
              </p>
            </div>

            <form class="grid-form login-form" @submit.prevent="login">
              <div class="field full">
                <label>Correo</label>
                <input v-model="loginForm.email" type="email" placeholder="admin@leyrep.cl" required />
              </div>
              <div class="field full">
                <label>Contraseña</label>
                <input v-model="loginForm.password" type="password" placeholder="admin123" required />
              </div>
              <div class="actions full">
                <button class="primary-btn" type="submit">Iniciar sesión</button>
              </div>
            </form>

            <div class="demo-users">
              <article class="demo-user" v-for="item in demoUsers" :key="item.email">
                <strong>{{ item.rol }}</strong>
                <span>{{ item.email }}</span>
                <code>{{ item.password }}</code>
                <button class="secondary-btn small" type="button" @click="useDemoUser(item)">Usar este acceso</button>
              </article>
            </div>

            <p v-if="feedback.message" class="feedback" :class="feedback.type">{{ feedback.message }}</p>
          </section>
        </div>
      </template>

      <div v-else class="layout-shell">
        <aside class="sidebar">
          <div>
            <p class="eyebrow">Proyecto de título</p>
            <h1>Plataforma Ley REP</h1>
            <p class="sidebar-copy">
              Sistema web de trazabilidad digital para declaraciones REP, reglas automáticas, alertas preventivas y auditoría de eventos.
            </p>
          </div>

          <div class="status-box user-box">
            <div>
              <strong>Sesión activa</strong>
              <span class="ok">{{ currentUser.nombre }}</span>
            </div>
            <div class="muted-row">{{ currentUser.nombre_rol }} · {{ currentUser.email }}</div>
            <button class="ghost-btn" type="button" @click="logout">Cerrar sesión</button>
          </div>

          <div class="menu-stack">
            <button
              v-for="view in availableViews"
              :key="view.id"
              class="menu-btn"
              :class="{ active: currentView === view.id }"
              @click="currentView = view.id"
            >
              <span>{{ view.label }}</span>
              <small>{{ view.description }}</small>
            </button>
          </div>

          <div class="status-box">
            <div>
              <strong>Backend</strong>
              <span :class="health.status === 'ok' ? 'ok' : 'error'">
                {{ health.status === 'ok' ? 'Conectado' : 'Sin conexión' }}
              </span>
            </div>
            <div class="muted-row">{{ apiUrl }}</div>
          </div>
        </aside>

        <main class="content-area">
          <header class="page-header">
            <div>
              <p class="eyebrow text">Vista activa</p>
              <h2>{{ currentViewMeta.label }}</h2>
              <p class="page-copy">{{ currentViewMeta.summary }}</p>
            </div>
            <div class="header-actions">
              <div class="session-pill">{{ currentUser.nombre_rol }}</div>
              <button class="ghost-btn" type="button" @click="loadAll">Recargar datos</button>
            </div>
          </header>

          <p v-if="feedback.message" class="feedback" :class="feedback.type">{{ feedback.message }}</p>

          <section class="metrics-grid">
            <article class="metric-card">
              <span>Usuarios activos</span>
              <strong>{{ summary.usuarios }}</strong>
            </article>
            <article class="metric-card">
              <span>Declaraciones</span>
              <strong>{{ summary.declaraciones }}</strong>
            </article>
            <article class="metric-card">
              <span>Pendientes</span>
              <strong>{{ summary.pendientes }}</strong>
            </article>
            <article class="metric-card warning">
              <span>Alertas abiertas</span>
              <strong>{{ summary.alertas }}</strong>
            </article>
          </section>

          <section v-if="currentView === 'resumen'" class="section-stack">
            <article class="card">
              <div class="card-head">
                <div>
                  <h3>Arquitectura aplicada</h3>
                  <p>
                    Frontend web con Vue 3 servido desde Express, backend Node.js con API REST y persistencia en PostgreSQL desplegado en Render.
                  </p>
                </div>
              </div>
              <div class="two-col-text">
                <div>
                  <h4>Qué resuelve</h4>
                  <p>
                    Permite registrar declaraciones REP, ejecutar reglas automáticas, generar alertas preventivas y dejar trazabilidad de auditoría para cada operación relevante.
                  </p>
                </div>
                <div>
                  <h4>Qué puedes mostrar en la evaluación</h4>
                  <p>
                    CRUD de declaraciones, categorías REP, metas anuales, reglas de validación y usuarios, más un flujo operativo de validación y seguimiento para el perfil gestor.
                  </p>
                </div>
              </div>
            </article>

            <article class="card">
              <div class="card-head">
                <div>
                  <h3>Últimos eventos de auditoría</h3>
                  <p>Registro cronológico de acciones ejecutadas sobre la plataforma.</p>
                </div>
              </div>
              <div class="table-wrap">
                <table class="data-table" v-if="auditoria.length">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Acción</th>
                      <th>Usuario</th>
                      <th>Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="item in auditoria.slice(0, 8)" :key="item.id_evento">
                      <td>{{ formatDate(item.fecha_evento) }}</td>
                      <td>{{ item.accion }}</td>
                      <td>{{ item.usuario_nombre }}</td>
                      <td>{{ item.detalle }}</td>
                    </tr>
                  </tbody>
                </table>
                <div v-else class="empty-state">No hay eventos de auditoría registrados.</div>
              </div>
            </article>
          </section>

          <section v-if="currentView === 'productor'" class="section-stack">
            <article class="card">
              <div class="card-head">
                <div>
                  <h3>Registro de declaraciones REP</h3>
                  <p>
                    Formulario CRUD completo para el perfil productor. Al guardar, el sistema recalcula validaciones y deja la declaración en estado pendiente.
                  </p>
                </div>
              </div>

              <form class="grid-form" @submit.prevent="saveDeclaracion">
                <div class="field">
                  <label>Productor</label>
                  <select v-model="declaracionForm.id_usuario" :disabled="isProductor" required>
                    <option value="">Seleccione un productor</option>
                    <option v-for="item in productorUsers" :key="item.id_usuario" :value="String(item.id_usuario)">
                      {{ item.nombre }}
                    </option>
                  </select>
                </div>
                <div class="field">
                  <label>Categoría REP</label>
                  <select v-model="declaracionForm.id_categoria" required>
                    <option value="">Seleccione una categoría</option>
                    <option v-for="item in categoriasActivas" :key="item.id_categoria" :value="String(item.id_categoria)">
                      {{ item.nombre_categoria }}
                    </option>
                  </select>
                </div>
                <div class="field">
                  <label>Año</label>
                  <input v-model="declaracionForm.anio_periodo" type="number" min="2020" required />
                </div>
                <div class="field">
                  <label>Mes</label>
                  <select v-model="declaracionForm.mes_periodo" required>
                    <option value="">Seleccione mes</option>
                    <option v-for="mes in meses" :key="mes.value" :value="String(mes.value)">{{ mes.label }}</option>
                  </select>
                </div>
                <div class="field">
                  <label>Cantidad (kg)</label>
                  <input v-model="declaracionForm.cantidad_kg" type="number" min="0" step="0.01" required />
                </div>
                <div class="field full">
                  <label>Observación</label>
                  <textarea v-model="declaracionForm.observacion" placeholder="Detalle breve de la declaración"></textarea>
                </div>
                <div class="actions full">
                  <button class="primary-btn" type="submit">
                    {{ declaracionForm.id_declaracion ? 'Actualizar declaración' : 'Guardar declaración' }}
                  </button>
                  <button class="secondary-btn" type="button" @click="resetDeclaracionForm">Limpiar</button>
                </div>
              </form>
            </article>

            <article class="card">
              <div class="card-head wrap">
                <div>
                  <h3>Declaraciones registradas</h3>
                  <p>Listado principal del proceso con estado actual y edición directa.</p>
                </div>
                <input class="search-input" v-model="searchDeclaraciones" type="search" placeholder="Buscar por usuario, categoría o estado" />
              </div>
              <div class="table-wrap">
                <table class="data-table" v-if="filteredDeclaraciones.length">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Productor</th>
                      <th>Categoría</th>
                      <th>Período</th>
                      <th>Cantidad</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="item in filteredDeclaraciones" :key="item.id_declaracion">
                      <td>#{{ item.id_declaracion }}</td>
                      <td>{{ item.usuario_nombre }}</td>
                      <td>{{ item.nombre_categoria }}</td>
                      <td>{{ item.mes_periodo }}/{{ item.anio_periodo }}</td>
                      <td>{{ formatKg(item.cantidad_kg) }}</td>
                      <td><span class="badge" :class="badgeClass(item.nombre_estado)">{{ item.nombre_estado }}</span></td>
                      <td>
                        <div class="table-actions">
                          <button class="secondary-btn small" type="button" @click="editDeclaracion(item)">Editar</button>
                          <button class="danger-btn small" type="button" @click="deleteDeclaracion(item.id_declaracion)">Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div v-else class="empty-state">No hay declaraciones registradas.</div>
              </div>
            </article>
          </section>

          <section v-if="currentView === 'gestor'" class="section-stack">
            <article class="card">
              <div class="card-head wrap">
                <div>
                  <h3>Validación operativa</h3>
                  <p>El gestor puede aprobar o rechazar declaraciones una vez revisadas las reglas automáticas.</p>
                </div>
              </div>
              <div class="table-wrap">
                <table class="data-table" v-if="declaraciones.length">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Productor</th>
                      <th>Categoría</th>
                      <th>Estado</th>
                      <th>Fecha</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="item in declaraciones" :key="item.id_declaracion">
                      <td>#{{ item.id_declaracion }}</td>
                      <td>{{ item.usuario_nombre }}</td>
                      <td>{{ item.nombre_categoria }}</td>
                      <td><span class="badge" :class="badgeClass(item.nombre_estado)">{{ item.nombre_estado }}</span></td>
                      <td>{{ formatDate(item.fecha_declaracion) }}</td>
                      <td>
                        <div class="table-actions">
                          <button class="primary-btn small" type="button" @click="changeEstado(item.id_declaracion, 'validar')">Validar</button>
                          <button class="danger-btn small" type="button" @click="changeEstado(item.id_declaracion, 'rechazar')">Rechazar</button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </article>

            <article class="card split-card">
              <div>
                <div class="card-head"><div><h3>Validaciones automáticas</h3><p>Resultado de las reglas aplicadas por el sistema.</p></div></div>
                <div class="table-wrap compact">
                  <table class="data-table" v-if="validaciones.length">
                    <thead>
                      <tr>
                        <th>Declaración</th>
                        <th>Regla</th>
                        <th>Resultado</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="item in validaciones.slice(0, 10)" :key="item.id_validacion">
                        <td>#{{ item.id_declaracion }}</td>
                        <td>{{ item.codigo_regla }} - {{ item.nombre_regla }}</td>
                        <td><span class="badge" :class="badgeValidation(item.resultado)">{{ item.resultado }}</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div>
                <div class="card-head"><div><h3>Alertas preventivas</h3><p>Alertas derivadas de reglas que requieren atención.</p></div></div>
                <div class="table-wrap compact">
                  <table class="data-table" v-if="alertas.length">
                    <thead>
                      <tr>
                        <th>Nivel</th>
                        <th>Mensaje</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="item in alertas.slice(0, 10)" :key="item.id_alerta">
                        <td><span class="badge" :class="alertBadge(item.nivel_alerta)">{{ item.nivel_alerta }}</span></td>
                        <td>{{ item.mensaje }}</td>
                        <td>
                          <button class="secondary-btn small" type="button" @click="markAlerta(item.id_alerta, true)">
                            {{ item.atendida ? 'Atendida' : 'Marcar atendida' }}
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <div v-else class="empty-state">No existen alertas abiertas.</div>
                </div>
              </div>
            </article>
          </section>

          <section v-if="currentView === 'admin'" class="section-stack">
            <article class="card">
              <div class="card-head"><div><h3>CRUD de categorías REP</h3><p>Permite mantener el catálogo principal del dominio.</p></div></div>
              <form class="grid-form" @submit.prevent="saveCategoria">
                <div class="field">
                  <label>Nombre categoría</label>
                  <input v-model="categoriaForm.nombre_categoria" type="text" required />
                </div>
                <div class="field switch-field">
                  <label>Activa</label>
                  <input v-model="categoriaForm.activo" type="checkbox" />
                </div>
                <div class="field full">
                  <label>Descripción</label>
                  <textarea v-model="categoriaForm.descripcion"></textarea>
                </div>
                <div class="actions full">
                  <button class="primary-btn" type="submit">{{ categoriaForm.id_categoria ? 'Actualizar categoría' : 'Crear categoría' }}</button>
                  <button class="secondary-btn" type="button" @click="resetCategoriaForm">Limpiar</button>
                </div>
              </form>
              <div class="table-wrap top-gap">
                <table class="data-table" v-if="categorias.length">
                  <thead><tr><th>ID</th><th>Nombre</th><th>Activa</th><th>Acciones</th></tr></thead>
                  <tbody>
                    <tr v-for="item in categorias" :key="item.id_categoria">
                      <td>#{{ item.id_categoria }}</td>
                      <td>{{ item.nombre_categoria }}</td>
                      <td>{{ item.activo ? 'Sí' : 'No' }}</td>
                      <td>
                        <div class="table-actions">
                          <button class="secondary-btn small" type="button" @click="editCategoria(item)">Editar</button>
                          <button class="danger-btn small" type="button" @click="deleteCategoria(item.id_categoria)">Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </article>

            <article class="card">
              <div class="card-head"><div><h3>CRUD de metas anuales</h3><p>Parámetros de cumplimiento por categoría y año.</p></div></div>
              <form class="grid-form" @submit.prevent="saveMeta">
                <div class="field">
                  <label>Categoría</label>
                  <select v-model="metaForm.id_categoria" required>
                    <option value="">Seleccione</option>
                    <option v-for="item in categoriasActivas" :key="item.id_categoria" :value="String(item.id_categoria)">{{ item.nombre_categoria }}</option>
                  </select>
                </div>
                <div class="field">
                  <label>Año</label>
                  <input v-model="metaForm.anio" type="number" min="2020" required />
                </div>
                <div class="field">
                  <label>% Meta</label>
                  <input v-model="metaForm.porcentaje_meta" type="number" min="0" max="100" step="0.01" required />
                </div>
                <div class="actions full">
                  <button class="primary-btn" type="submit">{{ metaForm.id_meta ? 'Actualizar meta' : 'Crear meta' }}</button>
                  <button class="secondary-btn" type="button" @click="resetMetaForm">Limpiar</button>
                </div>
              </form>
              <div class="table-wrap top-gap">
                <table class="data-table" v-if="metas.length">
                  <thead><tr><th>ID</th><th>Categoría</th><th>Año</th><th>%</th><th>Acciones</th></tr></thead>
                  <tbody>
                    <tr v-for="item in metas" :key="item.id_meta">
                      <td>#{{ item.id_meta }}</td>
                      <td>{{ item.nombre_categoria }}</td>
                      <td>{{ item.anio }}</td>
                      <td>{{ item.porcentaje_meta }}%</td>
                      <td>
                        <div class="table-actions">
                          <button class="secondary-btn small" type="button" @click="editMeta(item)">Editar</button>
                          <button class="danger-btn small" type="button" @click="deleteMeta(item.id_meta)">Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </article>

            <article class="card">
              <div class="card-head"><div><h3>CRUD de reglas de validación</h3><p>Permite mantener la lógica parametrizable del motor de reglas.</p></div></div>
              <form class="grid-form" @submit.prevent="saveRegla">
                <div class="field">
                  <label>Código</label>
                  <input v-model="reglaForm.codigo_regla" type="text" required />
                </div>
                <div class="field">
                  <label>Nombre regla</label>
                  <input v-model="reglaForm.nombre_regla" type="text" required />
                </div>
                <div class="field">
                  <label>Valor mínimo</label>
                  <input v-model="reglaForm.valor_min" type="number" step="0.01" />
                </div>
                <div class="field">
                  <label>Valor máximo</label>
                  <input v-model="reglaForm.valor_max" type="number" step="0.01" />
                </div>
                <div class="field switch-field">
                  <label>Activa</label>
                  <input v-model="reglaForm.activo" type="checkbox" />
                </div>
                <div class="field full">
                  <label>Descripción</label>
                  <textarea v-model="reglaForm.descripcion" required></textarea>
                </div>
                <div class="actions full">
                  <button class="primary-btn" type="submit">{{ reglaForm.id_regla ? 'Actualizar regla' : 'Crear regla' }}</button>
                  <button class="secondary-btn" type="button" @click="resetReglaForm">Limpiar</button>
                </div>
              </form>
              <div class="table-wrap top-gap">
                <table class="data-table" v-if="reglas.length">
                  <thead><tr><th>Código</th><th>Nombre</th><th>Activa</th><th>Acciones</th></tr></thead>
                  <tbody>
                    <tr v-for="item in reglas" :key="item.id_regla">
                      <td>{{ item.codigo_regla }}</td>
                      <td>{{ item.nombre_regla }}</td>
                      <td>{{ item.activo ? 'Sí' : 'No' }}</td>
                      <td>
                        <div class="table-actions">
                          <button class="secondary-btn small" type="button" @click="editRegla(item)">Editar</button>
                          <button class="danger-btn small" type="button" @click="deleteRegla(item.id_regla)">Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </article>

            <article class="card">
              <div class="card-head"><div><h3>Gestión de cuentas de usuario</h3><p>Formulario funcional de perfiles y cuentas, exigido por la pauta.</p></div></div>
              <form class="grid-form" @submit.prevent="saveUsuario">
                <div class="field">
                  <label>Nombre</label>
                  <input v-model="usuarioForm.nombre" type="text" required />
                </div>
                <div class="field">
                  <label>Correo</label>
                  <input v-model="usuarioForm.email" type="email" required />
                </div>
                <div class="field">
                  <label>Rol</label>
                  <select v-model="usuarioForm.id_rol" required>
                    <option value="">Seleccione</option>
                    <option v-for="item in roles" :key="item.id_rol" :value="String(item.id_rol)">{{ item.nombre_rol }}</option>
                  </select>
                </div>
                <div class="field">
                  <label>Contraseña {{ usuarioForm.id_usuario ? '(dejar en blanco para mantener)' : '' }}</label>
                  <input v-model="usuarioForm.password" type="text" placeholder="demo123" />
                </div>
                <div class="field switch-field">
                  <label>Activo</label>
                  <input v-model="usuarioForm.activo" type="checkbox" />
                </div>
                <div class="actions full">
                  <button class="primary-btn" type="submit">{{ usuarioForm.id_usuario ? 'Actualizar usuario' : 'Crear usuario' }}</button>
                  <button class="secondary-btn" type="button" @click="resetUsuarioForm">Limpiar</button>
                </div>
              </form>
              <div class="table-wrap top-gap">
                <table class="data-table" v-if="usuarios.length">
                  <thead><tr><th>ID</th><th>Nombre</th><th>Correo</th><th>Rol</th><th>Acciones</th></tr></thead>
                  <tbody>
                    <tr v-for="item in usuarios" :key="item.id_usuario">
                      <td>#{{ item.id_usuario }}</td>
                      <td>{{ item.nombre }}</td>
                      <td>{{ item.email }}</td>
                      <td>{{ item.nombre_rol }}</td>
                      <td>
                        <div class="table-actions">
                          <button class="secondary-btn small" type="button" @click="editUsuario(item)">Editar</button>
                          <button class="danger-btn small" type="button" @click="deleteUsuario(item.id_usuario)">Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        </main>
      </div>
    
  </div>
</template>

<script>
export default {
  data() {
    return {
      apiUrl: import.meta.env.VITE_API_URL || window.location.origin,
      isAuthenticated: false,
      currentUser: null,
      loginForm: { email: 'admin@leyrep.cl', password: 'admin123' },
      demoUsers: [
        { rol: 'Administrador', email: 'admin@leyrep.cl', password: 'admin123' },
        { rol: 'Gestor', email: 'gestor@leyrep.cl', password: 'gestor123' },
        { rol: 'Productor', email: 'productor@leyrep.cl', password: 'productor123' },
      ],
      health: { status: 'unknown' },
      currentView: 'resumen',
      views: [
        {
          id: 'resumen',
          label: 'Resumen ejecutivo',
          description: 'Indicadores, arquitectura y trazabilidad.',
          summary: 'Panel principal para explicar rápidamente la solución, sus métricas y sus últimas acciones registradas.',
        },
        {
          id: 'productor',
          label: 'Perfil productor',
          description: 'CRUD de declaraciones REP.',
          summary: 'Módulo para registrar, editar y eliminar declaraciones REP asociadas a productores y categorías del sistema.',
        },
        {
          id: 'gestor',
          label: 'Perfil gestor',
          description: 'Validación, alertas y seguimiento.',
          summary: 'Panel operativo para revisar reglas automáticas, atender alertas y aprobar o rechazar declaraciones.',
        },
        {
          id: 'admin',
          label: 'Perfil administrador',
          description: 'Catálogos, metas, reglas y usuarios.',
          summary: 'Sección de mantenimiento del dominio con formularios CRUD para categorías, metas anuales, reglas de validación y cuentas.',
        },
      ],
      meses: [
        { value: 1, label: 'Enero' },
        { value: 2, label: 'Febrero' },
        { value: 3, label: 'Marzo' },
        { value: 4, label: 'Abril' },
        { value: 5, label: 'Mayo' },
        { value: 6, label: 'Junio' },
        { value: 7, label: 'Julio' },
        { value: 8, label: 'Agosto' },
        { value: 9, label: 'Septiembre' },
        { value: 10, label: 'Octubre' },
        { value: 11, label: 'Noviembre' },
        { value: 12, label: 'Diciembre' },
      ],
      feedback: { message: '', type: 'success' },
      summary: {
        usuarios: 0,
        declaraciones: 0,
        pendientes: 0,
        alertas: 0,
        categorias: 0,
        reglas: 0,
      },
      roles: [],
      estados: [],
      categorias: [],
      metas: [],
      reglas: [],
      usuarios: [],
      declaraciones: [],
      validaciones: [],
      alertas: [],
      auditoria: [],
      searchDeclaraciones: '',
      declaracionForm: null,
      categoriaForm: null,
      metaForm: null,
      reglaForm: null,
      usuarioForm: null,
    };
  },
  computed: {
    isAdmin() {
      return this.currentUser?.nombre_rol === 'Administrador';
    },
    isGestor() {
      return this.currentUser?.nombre_rol === 'Gestor';
    },
    isProductor() {
      return this.currentUser?.nombre_rol === 'Productor';
    },
    availableViews() {
      const map = {
        Administrador: ['resumen', 'productor', 'gestor', 'admin'],
        Gestor: ['resumen', 'gestor'],
        Productor: ['resumen', 'productor'],
      };
      const allowed = this.currentUser ? map[this.currentUser.nombre_rol] || ['resumen'] : [];
      return this.views.filter((item) => allowed.includes(item.id));
    },
    currentViewMeta() {
      return this.availableViews.find((item) => item.id === this.currentView) || this.availableViews[0] || this.views[0];
    },
    categoriasActivas() {
      return this.categorias.filter((item) => item.activo);
    },
    productorUsers() {
      const users = this.usuarios.filter((item) => item.nombre_rol === 'Productor' && item.activo);
      return this.isProductor ? users.filter((item) => item.id_usuario === this.currentUser.id_usuario) : users;
    },
    filteredDeclaraciones() {
      const base = this.isProductor
        ? this.declaraciones.filter((item) => item.id_usuario === this.currentUser.id_usuario)
        : this.declaraciones;
      const term = this.searchDeclaraciones.trim().toLowerCase();
      if (!term) return base;
      return base.filter((item) =>
        [
          item.usuario_nombre,
          item.nombre_categoria,
          item.nombre_estado,
          String(item.id_declaracion),
          String(item.anio_periodo),
          String(item.mes_periodo),
        ]
          .join(' ')
          .toLowerCase()
          .includes(term),
      );
    },
  },
  methods: {
    newDeclaracionForm() {
      return {
        id_declaracion: null,
        id_usuario: this.isProductor ? String(this.currentUser.id_usuario) : '',
        id_categoria: '',
        anio_periodo: new Date().getFullYear(),
        mes_periodo: '',
        cantidad_kg: '',
        observacion: '',
      };
    },
    newCategoriaForm() {
      return {
        id_categoria: null,
        nombre_categoria: '',
        descripcion: '',
        activo: true,
      };
    },
    newMetaForm() {
      return {
        id_meta: null,
        id_categoria: '',
        anio: new Date().getFullYear(),
        porcentaje_meta: '',
      };
    },
    newReglaForm() {
      return {
        id_regla: null,
        codigo_regla: '',
        nombre_regla: '',
        descripcion: '',
        valor_min: '',
        valor_max: '',
        activo: true,
      };
    },
    newUsuarioForm() {
      return {
        id_usuario: null,
        nombre: '',
        email: '',
        id_rol: '',
        password: '',
        activo: true,
      };
    },
    roleHomeView() {
      if (this.isAdmin) return 'admin';
      if (this.isGestor) return 'gestor';
      if (this.isProductor) return 'productor';
      return 'resumen';
    },
    ensureCurrentView() {
      if (!this.availableViews.some((item) => item.id === this.currentView)) {
        this.currentView = this.roleHomeView();
      }
    },
    persistSession() {
      if (this.currentUser) {
        localStorage.setItem('leyrep_session', JSON.stringify(this.currentUser));
      }
    },
    restoreSession() {
      try {
        const raw = localStorage.getItem('leyrep_session');
        if (!raw) return false;
        this.currentUser = JSON.parse(raw);
        this.isAuthenticated = true;
        this.currentView = this.roleHomeView();
        return true;
      } catch (error) {
        localStorage.removeItem('leyrep_session');
        return false;
      }
    },
    async login() {
      try {
        const response = await this.api('/api/login', {
          method: 'POST',
          body: JSON.stringify(this.loginForm),
        });
        this.currentUser = response.user;
        this.isAuthenticated = true;
        this.currentView = this.roleHomeView();
        this.persistSession();
        this.resetDeclaracionForm();
        await this.checkHealth();
        await this.loadAll();
        this.notify(`Bienvenido, ${this.currentUser.nombre}.`);
      } catch (error) {
        this.notify(error.message || 'No fue posible iniciar sesión.', 'error');
      }
    },
    useDemoUser(item) {
      this.loginForm = { email: item.email, password: item.password };
    },
    logout() {
      this.isAuthenticated = false;
      this.currentUser = null;
      this.currentView = 'resumen';
      this.summary = { usuarios: 0, declaraciones: 0, pendientes: 0, alertas: 0, categorias: 0, reglas: 0 };
      this.roles = [];
      this.estados = [];
      this.categorias = [];
      this.metas = [];
      this.reglas = [];
      this.usuarios = [];
      this.declaraciones = [];
      this.validaciones = [];
      this.alertas = [];
      this.auditoria = [];
      this.searchDeclaraciones = '';
      localStorage.removeItem('leyrep_session');
      this.loginForm = { email: 'admin@leyrep.cl', password: 'admin123' };
      this.resetDeclaracionForm();
      this.resetCategoriaForm();
      this.resetMetaForm();
      this.resetReglaForm();
      this.resetUsuarioForm();
      this.notify('Sesión cerrada.');
    },
    notify(message, type = 'success') {
      this.feedback = { message, type };
      window.clearTimeout(this.feedbackTimer);
      this.feedbackTimer = window.setTimeout(() => {
        this.feedback.message = '';
      }, 5000);
    },
    async api(path, options = {}) {
      const headers = new Headers(options.headers || {});
      if (options.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
      const response = await fetch(`${this.apiUrl}${path}`, { ...options, headers });
      if (!response.ok) {
        let message = `Error ${response.status}`;
        try {
          const data = await response.json();
          message = data.error || message;
        } catch (error) {
          const text = await response.text();
          if (text) message = text;
        }
        throw new Error(message);
      }
      if (response.status === 204) return null;
      return response.json();
    },
    badgeClass(estado) {
      const normalized = String(estado || '').toLowerCase();
      if (normalized.includes('valid')) return 'validated';
      if (normalized.includes('rech')) return 'rejected';
      return 'pending';
    },
    badgeValidation(resultado) {
      const normalized = String(resultado || '').toLowerCase();
      if (normalized.includes('cumple')) return 'validated';
      if (normalized.includes('no cumple')) return 'rejected';
      return 'warning';
    },
    alertBadge(nivel) {
      const normalized = String(nivel || '').toLowerCase();
      if (normalized.includes('alta')) return 'rejected';
      if (normalized.includes('media')) return 'pending';
      return 'validated';
    },
    formatKg(value) {
      return `${Number(value || 0).toLocaleString('es-CL', { maximumFractionDigits: 2 })} kg`;
    },
    formatDate(value) {
      if (!value) return '-';
      return new Date(value).toLocaleString('es-CL');
    },
    async checkHealth() {
      try {
        this.health = await this.api('/api/health');
      } catch (error) {
        this.health = { status: 'error' };
      }
    },
    async loadAll() {
      if (!this.isAuthenticated) return;
      try {
        const [catalogos, summary, usuarios, categorias, metas, reglas, declaraciones, validaciones, alertas, auditoria] = await Promise.all([
          this.api('/api/catalogos'),
          this.api('/api/resumen'),
          this.api('/api/usuarios'),
          this.api('/api/categorias'),
          this.api('/api/metas'),
          this.api('/api/reglas'),
          this.api('/api/declaraciones'),
          this.api('/api/validaciones'),
          this.api('/api/alertas'),
          this.api('/api/auditoria'),
        ]);

        this.roles = catalogos.roles;
        this.estados = catalogos.estados;
        this.summary = summary;
        this.usuarios = usuarios;
        this.categorias = categorias;
        this.metas = metas;
        this.reglas = reglas;
        this.declaraciones = declaraciones;
        this.validaciones = validaciones;
        this.alertas = alertas;
        this.auditoria = auditoria;
        this.ensureCurrentView();
      } catch (error) {
        this.notify(error.message || 'No fue posible cargar los datos del sistema.', 'error');
      }
    },
    resetDeclaracionForm() {
      this.declaracionForm = this.newDeclaracionForm();
    },
    resetCategoriaForm() {
      this.categoriaForm = this.newCategoriaForm();
    },
    resetMetaForm() {
      this.metaForm = this.newMetaForm();
    },
    resetReglaForm() {
      this.reglaForm = this.newReglaForm();
    },
    resetUsuarioForm() {
      this.usuarioForm = this.newUsuarioForm();
    },
    editDeclaracion(item) {
      this.declaracionForm = {
        id_declaracion: item.id_declaracion,
        id_usuario: String(item.id_usuario),
        id_categoria: String(item.id_categoria),
        anio_periodo: item.anio_periodo,
        mes_periodo: String(item.mes_periodo),
        cantidad_kg: item.cantidad_kg,
        observacion: item.observacion || '',
      };
      this.currentView = 'productor';
      this.notify(`Editando la declaración #${item.id_declaracion}.`);
    },
    async saveDeclaracion() {
      try {
        const payload = {
          id_usuario: this.isProductor ? Number(this.currentUser.id_usuario) : Number(this.declaracionForm.id_usuario),
          id_categoria: Number(this.declaracionForm.id_categoria),
          anio_periodo: Number(this.declaracionForm.anio_periodo),
          mes_periodo: Number(this.declaracionForm.mes_periodo),
          cantidad_kg: Number(this.declaracionForm.cantidad_kg),
          observacion: this.declaracionForm.observacion,
        };

        if (this.declaracionForm.id_declaracion) {
          await this.api(`/api/declaraciones/${this.declaracionForm.id_declaracion}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          });
          this.notify('La declaración fue actualizada correctamente.');
        } else {
          await this.api('/api/declaraciones', { method: 'POST', body: JSON.stringify(payload) });
          this.notify('La declaración fue registrada correctamente.');
        }

        this.resetDeclaracionForm();
        await this.loadAll();
      } catch (error) {
        this.notify(error.message || 'No fue posible guardar la declaración.', 'error');
      }
    },
    async deleteDeclaracion(id) {
      if (!window.confirm(`¿Deseas eliminar la declaración #${id}?`)) return;
      try {
        await this.api(`/api/declaraciones/${id}`, { method: 'DELETE' });
        this.notify(`La declaración #${id} fue eliminada.`);
        if (this.declaracionForm.id_declaracion === id) this.resetDeclaracionForm();
        await this.loadAll();
      } catch (error) {
        this.notify(error.message || 'No fue posible eliminar la declaración.', 'error');
      }
    },
    async changeEstado(id, accion) {
      try {
        await this.api(`/api/declaraciones/${id}/estado`, {
          method: 'PUT',
          body: JSON.stringify({ accion }),
        });
        this.notify(`La declaración #${id} fue ${accion === 'validar' ? 'validada' : 'rechazada'} correctamente.`);
        await this.loadAll();
      } catch (error) {
        this.notify(error.message || 'No fue posible cambiar el estado de la declaración.', 'error');
      }
    },
    async markAlerta(id, atendida) {
      try {
        await this.api(`/api/alertas/${id}/atender`, {
          method: 'PUT',
          body: JSON.stringify({ atendida }),
        });
        this.notify(`La alerta #${id} fue actualizada.`);
        await this.loadAll();
      } catch (error) {
        this.notify(error.message || 'No fue posible actualizar la alerta.', 'error');
      }
    },
    editCategoria(item) {
      this.categoriaForm = {
        id_categoria: item.id_categoria,
        nombre_categoria: item.nombre_categoria,
        descripcion: item.descripcion || '',
        activo: item.activo,
      };
      this.currentView = 'admin';
      this.notify(`Editando la categoría #${item.id_categoria}.`);
    },
    async saveCategoria() {
      try {
        const payload = {
          nombre_categoria: this.categoriaForm.nombre_categoria,
          descripcion: this.categoriaForm.descripcion,
          activo: this.categoriaForm.activo,
        };
        if (this.categoriaForm.id_categoria) {
          await this.api(`/api/categorias/${this.categoriaForm.id_categoria}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          });
          this.notify('La categoría fue actualizada correctamente.');
        } else {
          await this.api('/api/categorias', { method: 'POST', body: JSON.stringify(payload) });
          this.notify('La categoría fue creada correctamente.');
        }
        this.resetCategoriaForm();
        await this.loadAll();
      } catch (error) {
        this.notify(error.message || 'No fue posible guardar la categoría.', 'error');
      }
    },
    async deleteCategoria(id) {
      if (!window.confirm(`¿Deseas eliminar la categoría #${id}?`)) return;
      try {
        await this.api(`/api/categorias/${id}`, { method: 'DELETE' });
        this.notify(`La categoría #${id} fue eliminada.`);
        if (this.categoriaForm.id_categoria === id) this.resetCategoriaForm();
        await this.loadAll();
      } catch (error) {
        this.notify(error.message || 'No fue posible eliminar la categoría.', 'error');
      }
    },
    editMeta(item) {
      this.metaForm = {
        id_meta: item.id_meta,
        id_categoria: String(item.id_categoria),
        anio: item.anio,
        porcentaje_meta: item.porcentaje_meta,
      };
      this.currentView = 'admin';
      this.notify(`Editando la meta #${item.id_meta}.`);
    },
    async saveMeta() {
      try {
        const payload = {
          id_categoria: Number(this.metaForm.id_categoria),
          anio: Number(this.metaForm.anio),
          porcentaje_meta: Number(this.metaForm.porcentaje_meta),
        };
        if (this.metaForm.id_meta) {
          await this.api(`/api/metas/${this.metaForm.id_meta}`, { method: 'PUT', body: JSON.stringify(payload) });
          this.notify('La meta anual fue actualizada correctamente.');
        } else {
          await this.api('/api/metas', { method: 'POST', body: JSON.stringify(payload) });
          this.notify('La meta anual fue creada correctamente.');
        }
        this.resetMetaForm();
        await this.loadAll();
      } catch (error) {
        this.notify(error.message || 'No fue posible guardar la meta anual.', 'error');
      }
    },
    async deleteMeta(id) {
      if (!window.confirm(`¿Deseas eliminar la meta #${id}?`)) return;
      try {
        await this.api(`/api/metas/${id}`, { method: 'DELETE' });
        this.notify(`La meta #${id} fue eliminada.`);
        if (this.metaForm.id_meta === id) this.resetMetaForm();
        await this.loadAll();
      } catch (error) {
        this.notify(error.message || 'No fue posible eliminar la meta anual.', 'error');
      }
    },
    editRegla(item) {
      this.reglaForm = {
        id_regla: item.id_regla,
        codigo_regla: item.codigo_regla,
        nombre_regla: item.nombre_regla,
        descripcion: item.descripcion,
        valor_min: item.valor_min ?? '',
        valor_max: item.valor_max ?? '',
        activo: item.activo,
      };
      this.currentView = 'admin';
      this.notify(`Editando la regla ${item.codigo_regla}.`);
    },
    async saveRegla() {
      try {
        const payload = {
          codigo_regla: this.reglaForm.codigo_regla,
          nombre_regla: this.reglaForm.nombre_regla,
          descripcion: this.reglaForm.descripcion,
          valor_min: this.reglaForm.valor_min === '' ? null : Number(this.reglaForm.valor_min),
          valor_max: this.reglaForm.valor_max === '' ? null : Number(this.reglaForm.valor_max),
          activo: this.reglaForm.activo,
        };
        if (this.reglaForm.id_regla) {
          await this.api(`/api/reglas/${this.reglaForm.id_regla}`, { method: 'PUT', body: JSON.stringify(payload) });
          this.notify('La regla de validación fue actualizada.');
        } else {
          await this.api('/api/reglas', { method: 'POST', body: JSON.stringify(payload) });
          this.notify('La regla de validación fue creada.');
        }
        this.resetReglaForm();
        await this.loadAll();
      } catch (error) {
        this.notify(error.message || 'No fue posible guardar la regla.', 'error');
      }
    },
    async deleteRegla(id) {
      if (!window.confirm(`¿Deseas eliminar la regla #${id}?`)) return;
      try {
        await this.api(`/api/reglas/${id}`, { method: 'DELETE' });
        this.notify(`La regla #${id} fue eliminada.`);
        if (this.reglaForm.id_regla === id) this.resetReglaForm();
        await this.loadAll();
      } catch (error) {
        this.notify(error.message || 'No fue posible eliminar la regla.', 'error');
      }
    },
    editUsuario(item) {
      this.usuarioForm = {
        id_usuario: item.id_usuario,
        nombre: item.nombre,
        email: item.email,
        id_rol: String(item.id_rol),
        password: '',
        activo: item.activo,
      };
      this.currentView = 'admin';
      this.notify(`Editando el usuario #${item.id_usuario}.`);
    },
    async saveUsuario() {
      try {
        const payload = {
          nombre: this.usuarioForm.nombre,
          email: this.usuarioForm.email,
          id_rol: Number(this.usuarioForm.id_rol),
          password: this.usuarioForm.password,
          activo: this.usuarioForm.activo,
        };
        if (this.usuarioForm.id_usuario) {
          await this.api(`/api/usuarios/${this.usuarioForm.id_usuario}`, { method: 'PUT', body: JSON.stringify(payload) });
          this.notify('El usuario fue actualizado correctamente.');
        } else {
          await this.api('/api/usuarios', { method: 'POST', body: JSON.stringify(payload) });
          this.notify('El usuario fue creado correctamente.');
        }
        this.resetUsuarioForm();
        await this.loadAll();
      } catch (error) {
        this.notify(error.message || 'No fue posible guardar el usuario.', 'error');
      }
    },
    async deleteUsuario(id) {
      if (!window.confirm(`¿Deseas eliminar el usuario #${id}?`)) return;
      try {
        await this.api(`/api/usuarios/${id}`, { method: 'DELETE' });
        this.notify(`El usuario #${id} fue eliminado.`);
        if (this.usuarioForm.id_usuario === id) this.resetUsuarioForm();
        await this.loadAll();
      } catch (error) {
        this.notify(error.message || 'No fue posible eliminar el usuario.', 'error');
      }
    },
  },
  async mounted() {
    this.resetDeclaracionForm();
    this.resetCategoriaForm();
    this.resetMetaForm();
    this.resetReglaForm();
    this.resetUsuarioForm();
    await this.checkHealth();
    if (this.restoreSession()) {
      await this.loadAll();
    }
  },
};

</script>
