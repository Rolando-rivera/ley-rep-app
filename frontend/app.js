const { createApp } = Vue;

createApp({
  data() {
    return {
      apiUrl: window.location.origin,
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
      const response = await fetch(path, { ...options, headers });
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
}).mount('#app');
