// ======================================================
// CONFIG API
// ======================================================

const API_URL = 'corewatch-backend-production.up.railway.app';


// ======================================================
// FETCH API
// ======================================================

async function fetchAPI(endpoint, options = {}) {
  try {
    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 5000);

    const response = await fetch(`${API_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      signal: controller.signal,
      ...options
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    backendAvailable = true;

    return await response.json();

  } catch (error) {
    backendAvailable = false;
    console.error(`❌ API Error ${endpoint}:`, error);
    throw error;
  }
}


// ======================================================
// DATOS MOCK
// ======================================================

function getMockData(type) {
  const mock = {
    resumen: {
      total_equipos: 0,
      equipos_activos: 0,
      equipos_inactivos: 0,
      cpu_promedio: 0,
      ram_pct_promedio: 0,
      temperatura_promedio: 0,
      alertas_activas: 0
    },
    estado: [],
    alertas: []
  };

  return mock[type];
}


// ======================================================
// CHARTS
// ======================================================

let cpuChart = null;
let ramChart = null;


// ======================================================
// INIT CHARTS
// ======================================================

function initCharts() {
  if (cpuChart) cpuChart.destroy();
  if (ramChart) ramChart.destroy();

  const cpuCanvas = document.getElementById('cpuChart');
  const ramCanvas = document.getElementById('ramChart');

  if (!cpuCanvas || !ramCanvas) return;

  cpuChart = new Chart(cpuCanvas, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'CPU %',
          data: [],
          borderColor: '#00d4ff',
          backgroundColor: 'rgba(0,212,255,0.1)',
          tension: 0.4
        }
      ]
    }
  });

  ramChart = new Chart(ramCanvas, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'RAM promedio global',
          data: [],
          borderColor: '#00ff99',
          tension: 0.4
        },
        {
          label: 'Referencia 100%',
          data: [],
          borderColor: '#ff4757',
          tension: 0.4
        }
      ]
    }
  });
}
let corewatchAutoRefresh = null;

function iniciarAutoRefresh() {
  if (corewatchAutoRefresh) {
    clearInterval(corewatchAutoRefresh);
  }

  const config = obtenerConfiguracion
    ? obtenerConfiguracion()
    : { intervalo: 10 };

  const intervalo = Number(config.intervalo || 10) * 1000;

  corewatchAutoRefresh = setInterval(async () => {
    try {
      const seccionActiva = document.querySelector('.content-section.active');
      const sectionId = seccionActiva ? seccionActiva.id : 'dashboard';

      const resumen = await fetchAPI('/resumen');
      const estado = await fetchAPI('/estado');
      const alertas = await fetchAPI('/alertas');

      updateStats(resumen, estado);
      actualizarBadgeAlertas(alertas);

      if (sectionId === 'dashboard') {
        renderEstadoRapido(estado);
        await actualizarGraficosGlobales();
      }

      if (sectionId === 'computadoras') {
        renderComputadoras(estado);
      }

      if (sectionId === 'alertas') {
        renderAlertas(alertas);
      }

      if (sectionId === 'reportes') {
        await actualizarResumenReportes();
      }

    } catch (error) {
      console.error('Error en auto-refresh:', error);
    }
  }, intervalo);
}

// ======================================================
// DASHBOARD
// ======================================================

async function loadDashboardData() {
  try {
    let resumen;
    let estado;
    let alertas;

    try {
      resumen = await fetchAPI('/resumen');
      estado = await fetchAPI('/estado');
      alertas = await fetchAPI('/alertas');

    } catch {
      resumen = getMockData('resumen');
      estado = getMockData('estado');
      alertas = getMockData('alertas');
    }

    updateStats(resumen, estado);
    renderComputadoras(estado);
    renderAlertas(alertas);
    renderEstadoRapido(estado);
    actualizarBadgeAlertas(alertas);
    await actualizarGraficosGlobales();

    return {
      resumen,
      estado,
      alertas
    };

  } catch (error) {
    console.error('❌ Error dashboard:', error);
    return null;
  }
}


// ======================================================
// UPDATE STATS
// ======================================================

function updateStats(resumen, estado = []) {
  const cards = document.querySelectorAll('.stat-card');

  if (!cards.length) return;

  const totalEquipos = estado.length || resumen.total_equipos || 0;

  const equiposActivos = estado.filter(e => e.activo).length;

  const equiposInactivos = estado.filter(e => !e.activo).length;

  const equiposCriticos = estado.filter(e =>
    e.activo &&
    (
      Number(e.cpu_pct || 0) >= 90 ||
      Number(e.ram_pct || 0) >= 90 ||
      Number(e.disco_pct || 0) >= 95 ||
      Number(e.temp_cpu || 0) >= 85
    )
  ).length;

  const equiposAdvertencia = estado.filter(e =>
    e.activo &&
    !(
      Number(e.cpu_pct || 0) >= 90 ||
      Number(e.ram_pct || 0) >= 90 ||
      Number(e.disco_pct || 0) >= 95 ||
      Number(e.temp_cpu || 0) >= 85
    ) &&
    (
      Number(e.cpu_pct || 0) >= 80 ||
      Number(e.ram_pct || 0) >= 85 ||
      Number(e.disco_pct || 0) >= 90 ||
      Number(e.temp_cpu || 0) >= 75
    )
  ).length;

  const equiposSaludables = estado.filter(e =>
    e.activo &&
    Number(e.cpu_pct || 0) < 80 &&
    Number(e.ram_pct || 0) < 85 &&
    Number(e.disco_pct || 0) < 90 &&
    Number(e.temp_cpu || 0) < 75
  ).length;

  if (cards[0]) {
    const val = cards[0].querySelector('.stat-value');
    if (val) val.textContent = equiposActivos;
  }

  if (cards[1]) {
    const val = cards[1].querySelector('.stat-value');
    if (val) val.textContent = equiposSaludables;
  }

  if (cards[2]) {
    const val = cards[2].querySelector('.stat-value');
    if (val) val.textContent = equiposAdvertencia + equiposCriticos;
  }

  if (cards[3]) {
    const val = cards[3].querySelector('.stat-value');
    if (val) val.textContent = equiposInactivos;
  }
}

// ======================================================
// BADGE ALERTAS
// ======================================================

function actualizarBadgeAlertas(alertas) {
  const badge = document.querySelector('.badge');

  if (!badge) return;

  const total = Array.isArray(alertas)
    ? alertas.filter(a => !a.resuelta).length
    : 0;

  badge.textContent = total;
  badge.style.display = total > 0 ? 'inline-block' : 'none';
}

function obtenerSituacionEquipo(equipo) {
  if (!equipo.activo) {
    return {
      texto: 'Fuera de línea',
      clase: 'offline'
    };
  }

  const cpu = Number(equipo.cpu_pct || 0);
  const ram = Number(equipo.ram_pct || 0);
  const disco = Number(equipo.disco_pct || 0);
  const temp = Number(equipo.temp_cpu || 0);

  if (
    cpu >= 90 ||
    ram >= 90 ||
    disco >= 95 ||
    temp >= 85
  ) {
    return {
      texto: 'Crítico',
      clase: 'critical'
    };
  }

  if (
    cpu >= 80 ||
    ram >= 85 ||
    disco >= 90 ||
    temp >= 75
  ) {
    return {
      texto: 'Advertencia',
      clase: 'warning'
    };
  }

  return {
    texto: 'Saludable',
    clase: 'healthy'
  };
}


function obtenerDetalleSituacion(equipo) {
  const problemas = [];

  const cpu = Number(equipo.cpu_pct || 0);
  const ram = Number(equipo.ram_pct || 0);
  const disco = Number(equipo.disco_pct || 0);
  const temp = Number(equipo.temp_cpu || 0);

  if (!equipo.activo) {
    return 'Sin métricas recientes';
  }

  if (cpu >= 90) problemas.push('CPU crítica');
  else if (cpu >= 80) problemas.push('CPU alta');

  if (ram >= 90) problemas.push('RAM crítica');
  else if (ram >= 85) problemas.push('RAM alta');

  if (disco >= 95) problemas.push('Disco crítico');
  else if (disco >= 90) problemas.push('Disco alto');

  if (temp >= 85) problemas.push('Temperatura crítica');
  else if (temp >= 75) problemas.push('Temperatura alta');

  return problemas.length > 0
    ? problemas.join(', ')
    : 'Sin problemas detectados';
}
// ======================================================
// RENDER COMPUTADORAS
// ======================================================

function renderComputadoras(equipos) {
  const container = document.querySelector('.computers-grid');

  if (!container) return;

  container.innerHTML = '';

  if (!equipos || equipos.length === 0) {
    container.innerHTML = `
      <p class="no-data">No hay computadoras disponibles</p>
    `;

    return;
  }

  equipos.forEach(equipo => {
    const situacion = obtenerSituacionEquipo(equipo);
    const detalleSituacion = obtenerDetalleSituacion(equipo);
    const html = `
      <div
        class="computer-row"
        data-equipo-id="${equipo.equipo_id}"
      >

        <div class="computer-info">
          <h4>${equipo.nombre}</h4>
          <p>${equipo.ip || 'Sin IP'}</p>
        </div>

        <div class="computer-metrics">

          <div class="metric">
            <span class="label">CPU</span>
            <span class="value">
              ${Number(equipo.cpu_pct || 0).toFixed(1)}%
            </span>
          </div>

          <div class="metric">
            <span class="label">RAM</span>
            <span class="value">
              ${Number(equipo.ram_pct || 0).toFixed(1)}%
            </span>
          </div>

          <div class="metric">
            <span class="label">DISCO</span>
            <span class="value">
              ${Number(equipo.disco_pct || 0).toFixed(1)}%
            </span>
          </div>

          <div class="metric">
            <span class="label">TEMP</span>
            <span class="value">
              ${Number(equipo.temp_cpu || 0).toFixed(1)}°C
            </span>
          </div>

        </div>

       <div class="computer-bottom">

        <div class="computer-status ${equipo.activo ? 'active' : 'inactive'}">
          <span class="status-indicator"></span>
          ${equipo.activo ? 'Activo' : 'Inactivo'}
        </div>

        <div class="computer-situation situation-${situacion.clase}">
          <span>${situacion.texto}</span>
          <small>${detalleSituacion}</small>
        </div>

        <button
          class="btn-small"
          onclick="verDetallesComputadora('${equipo.equipo_id}')"
        >
          Ver Detalles
        </button>

      </div>

      </div>
    `;

    container.insertAdjacentHTML('beforeend', html);
  });
}


// ======================================================
// ESTADO RÁPIDO DASHBOARD
// ======================================================

function renderEstadoRapido(equipos) {
  const container = document.querySelector('.status-list');

  if (!container) return;

  container.innerHTML = '';

  if (!equipos || equipos.length === 0) {
    container.innerHTML = `
      <p class="no-data">Sin datos disponibles</p>
    `;

    return;
  }

  equipos.forEach(equipo => {
    let estadoClase = 'healthy';
    let estadoTexto = 'Saludable';

    if (!equipo.activo) {
      estadoClase = 'offline';
      estadoTexto = 'Fuera de línea';
    } else if (
      Number(equipo.cpu_pct || 0) >= 80 ||
      Number(equipo.ram_pct || 0) >= 85 ||
      Number(equipo.disco_pct || 0) >= 90 ||
      Number(equipo.temp_cpu || 0) >= 75
    ) {
      estadoClase = 'warning';
      estadoTexto = 'Advertencia';
    }

    const hora = equipo.timestamp
      ? new Date(equipo.timestamp).toLocaleString('es-ES')
      : 'Sin fecha';

    const html = `
      <div class="status-item ${estadoClase}">
        <span class="status-indicator"></span>

        <div class="status-info">
          <h4>${equipo.nombre}</h4>
          <p>${estadoTexto} | CPU ${Number(equipo.cpu_pct || 0).toFixed(1)}%</p>
        </div>

        <span class="status-time">${hora}</span>
      </div>
    `;

    container.insertAdjacentHTML('beforeend', html);
  });
}


// ======================================================
// RENDER ALERTAS
// ======================================================

function renderAlertas(alertas) {
  const container = document.querySelector('.alerts-container');

  if (!container) return;

  container.innerHTML = '';
   alertas = Array.isArray(alertas)
  ? alertas.filter(a => !a.resuelta)
  : [];

  actualizarBadgeAlertas(alertas);

  if (!alertas || alertas.length === 0) {
    container.innerHTML = `
      <p class="no-data">
        ✅ No hay alertas activas
      </p>
    `;

    return;
  }

  alertas.forEach(alerta => {
    const fecha = alerta.timestamp
      ? new Date(alerta.timestamp)
      : null;

    const fechaTexto = fecha
      ? fecha.toLocaleDateString('es-ES')
      : 'Sin fecha';

    const horaTexto = fecha
      ? fecha.toLocaleTimeString('es-ES')
      : 'Sin hora';

    const severidad = (alerta.severidad || 'info').toLowerCase();

    const estado = alerta.resuelta ? 'Resuelta' : 'Activa';

    const html = `
      <div class="alert-item alert-${severidad}">

        <div class="alert-header">
          <span class="alert-severity">${severidad}</span>
          <span class="alert-time">${fechaTexto} ${horaTexto}</span>
          <span class="alert-status">${estado}</span>
        </div>

        <div class="alert-content">
          <h4>${alerta.tipo}</h4>

          <p>
            <strong>Computadora:</strong>
            ${alerta.equipo_nombre || alerta.equipo_id}
          </p>

          <p>
            <strong>ID Equipo:</strong>
            ${alerta.equipo_id}
          </p>

          <p>${alerta.descripcion}</p>

          <div class="alert-values">
            <span>
              Actual:
              ${
                alerta.valor_actual !== null && alerta.valor_actual !== undefined
                  ? Number(alerta.valor_actual).toFixed(2)
                  : 'N/A'
              }
            </span>

            <span>
              Umbral:
              ${
                alerta.valor_umbral !== null && alerta.valor_umbral !== undefined
                  ? Number(alerta.valor_umbral).toFixed(2)
                  : 'N/A'
              }
            </span>
          </div>

          <small>
            Emitida: ${fechaTexto} a las ${horaTexto}
          </small>
        </div>

      </div>
    `;

    container.insertAdjacentHTML('beforeend', html);
  });
}


// ======================================================
// CPU CHART
// ======================================================

async function actualizarGraficoCPU(equipoId) {
  if (!equipoId || !cpuChart) return;

  try {
    const datos = await fetchAPI(`/cpu/${equipoId}`);

    if (!datos || datos.length === 0) return;

    datos.sort((a, b) =>
      new Date(a.timestamp) - new Date(b.timestamp)
    );

    cpuChart.data.labels = datos.map(d =>
      new Date(d.timestamp).toLocaleTimeString()
    );

    cpuChart.data.datasets[0].label = `CPU % - ${equipoId}`;

    cpuChart.data.datasets[0].data = datos.map(d =>
      Number(d.cpu_pct || 0)
    );

    cpuChart.update();

  } catch (error) {
    console.error('❌ CPU chart:', error);
  }
}

async function actualizarGraficosGlobales() {
  try {
    const datos = await fetchAPI('/global/historial');

    if (!datos || datos.length === 0) return;

    datos.sort((a, b) =>
      new Date(a.timestamp) - new Date(b.timestamp)
    );

    const labels = datos.map(d =>
      new Date(d.timestamp).toLocaleTimeString('es-ES')
    );

    if (cpuChart) {
      cpuChart.data.labels = labels;
      cpuChart.data.datasets[0].label = 'CPU promedio global';
      cpuChart.data.datasets[0].data = datos.map(d =>
        Number(d.cpu_pct || 0)
      );
      cpuChart.update();
    }

    if (ramChart) {
      ramChart.data.labels = labels;
      ramChart.data.datasets[0].label = 'RAM promedio global';
      ramChart.data.datasets[0].data = datos.map(d =>
        Number(d.ram_pct || 0)
      );

      ramChart.data.datasets[1].label = 'Referencia 100%';
      ramChart.data.datasets[1].data = datos.map(() => 100);

      ramChart.update();
    }

  } catch (error) {
    console.error('Error gráficos globales:', error);
  }
}
// ======================================================
// RAM CHART
// ======================================================

async function actualizarGraficoRAM(equipoId) {
  if (!equipoId || !ramChart) return;

  try {
    const datos = await fetchAPI(`/ram/${equipoId}`);

    if (!datos || datos.length === 0) return;

    datos.sort((a, b) =>
      new Date(a.timestamp) - new Date(b.timestamp)
    );

    ramChart.data.labels = datos.map(d =>
      new Date(d.timestamp).toLocaleTimeString()
    );

    ramChart.data.datasets[0].label = `RAM USADA - ${equipoId}`;
    ramChart.data.datasets[0].data = datos.map(d =>
      Number(d.ram_usada_mb || 0)
    );

    ramChart.data.datasets[1].label = `RAM TOTAL - ${equipoId}`;
    ramChart.data.datasets[1].data = datos.map(d =>
      Number(d.ram_total_mb || 0)
    );

    ramChart.update();

  } catch (error) {
    console.error('❌ RAM chart:', error);
  }
}


// ======================================================
// INIT
// ======================================================

document.addEventListener('DOMContentLoaded', async () => {
  inicializarLogin();

  const sesionActiva = verificarSesion();

  if (!sesionActiva) return;

  await iniciarCoreWatch();
});

async function iniciarCoreWatch() {
  console.log('📊 Inicializando dashboard...');

  initCharts();

  const data = await loadDashboardData();

  if (
    data &&
    data.estado &&
    data.estado.length > 0
  ) {
    await actualizarGraficosGlobales();
  }

  iniciarNavegacion();
  iniciarBuscador();
  inicializarReportes();
  actualizarResumenReportes();
  iniciarConfiguracion();
  iniciarAutoRefresh();

  const logoutBtn = document.querySelector('.btn-logout');

  if (logoutBtn) {
    logoutBtn.addEventListener('click', cerrarSesion);
  }

  console.log('✅ CoreWatch iniciado');
}

// ======================================================
// NAVEGACIÓN ENTRE SECCIONES
// ======================================================

function iniciarNavegacion() {
  const navItems = document.querySelectorAll('.nav-item');

  const contentSections =
    document.querySelectorAll('.content-section');

  const sectionTitles = {
    dashboard: 'Dashboard Principal',
    computadoras: 'Gestión de Computadoras',
    alertas: 'Centro de Alertas',
    reportes: 'Reportes y Análisis',
    configuracion: 'Configuración'
  };

  navItems.forEach(item => {
    item.addEventListener('click', async (e) => {
      e.preventDefault();

      navItems.forEach(nav => {
        nav.classList.remove('active');
      });

      item.classList.add('active');

      const sectionId =
        item.getAttribute('data-section');

      contentSections.forEach(section => {
        section.classList.remove('active');
      });

      const activeSection =
        document.getElementById(sectionId);

      if (activeSection) {
        activeSection.classList.add('active');
      }

      const title =
        document.getElementById('section-title');

      if (title) {
        title.textContent =
          sectionTitles[sectionId] || 'Dashboard';
      }

      if (sectionId === 'computadoras') {
        try {
          const equipos =
            await fetchAPI('/estado');

          renderComputadoras(equipos);

        } catch (error) {
          console.error(
            '❌ Error cargando computadoras:',
            error
          );
        }
      }

      if (sectionId === 'alertas') {
        try {
          const alertas =
            await fetchAPI('/alertas');

          renderAlertas(alertas);

        } catch (error) {
          console.error(
            '❌ Error cargando alertas:',
            error
          );
        }
      }

      if (sectionId === 'reportes') {
        await actualizarResumenReportes();
      }

      if (sectionId === 'dashboard') {
        await loadDashboardData();

        setTimeout(() => {
          if (cpuChart) cpuChart.resize();
          if (ramChart) ramChart.resize();
        }, 100);
      }
    });
  });
}


// ======================================================
// BUSCADOR
// ======================================================

function iniciarBuscador() {
  const searchInput =
    document.querySelector('.search-box input');

  if (!searchInput) return;

  searchInput.addEventListener('input', (e) => {
    const query =
      e.target.value.toLowerCase();

    const rows =
      document.querySelectorAll('.computer-row');

    rows.forEach(row => {
      const text =
        row.innerText.toLowerCase();

      row.style.display =
        text.includes(query)
          ? 'grid'
          : 'none';
    });
  });
}


// ======================================================
// DETALLE DE COMPUTADORA
// ======================================================

async function verDetallesComputadora(equipoId) {
  try {
    const equipo = await fetchAPI(`/equipos/${equipoId}`);
    const estadoLista = await fetchAPI('/estado');

    const estado = estadoLista.find(
      item => item.equipo_id === equipoId
    );

    const detalleExistente =
      document.getElementById('modal-detalle-equipo');

    if (detalleExistente) {
      detalleExistente.remove();
    }

    const fechaUltimoVisto = equipo.ultimo_visto
      ? new Date(equipo.ultimo_visto).toLocaleString('es-ES')
      : 'N/A';

    const fechaMetrica = estado?.timestamp
      ? new Date(estado.timestamp).toLocaleString('es-ES')
      : 'N/A';

    const modal = document.createElement('div');
    modal.id = 'modal-detalle-equipo';

    modal.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-card modal-card-large">
          <div class="modal-header">
            <h2>Detalles del Equipo - ${equipo.nombre || equipoId}</h2>

            <button
              class="modal-close"
              onclick="cerrarDetalleEquipo()"
            >
              ×
            </button>
          </div>

          <div class="modal-info">
            <p><strong>Nombre:</strong> ${equipo.nombre || 'N/A'}</p>
            <p><strong>ID:</strong> ${equipo.equipo_id || equipoId}</p>
            <p><strong>IP:</strong> ${equipo.ip || 'Sin IP'}</p>
            <p><strong>Sistema:</strong> ${equipo.os || 'N/A'} ${equipo.os_version || ''}</p>
            <p><strong>Estado:</strong> ${estado?.activo ? 'Activo' : 'Inactivo'}</p>
            <p><strong>Último visto:</strong> ${fechaUltimoVisto}</p>
            <p><strong>Última métrica:</strong> ${fechaMetrica}</p>
          </div>

          <div class="modal-metrics">
            <div class="modal-metric-box">
              <small>CPU ACTUAL</small>
              <h3>${Number(estado?.cpu_pct || 0).toFixed(1)}%</h3>
            </div>

            <div class="modal-metric-box">
              <small>RAM ACTUAL</small>
              <h3>${Number(estado?.ram_pct || 0).toFixed(1)}%</h3>
            </div>

            <div class="modal-metric-box">
              <small>DISCO ACTUAL</small>
              <h3>${Number(estado?.disco_pct || 0).toFixed(1)}%</h3>
            </div>

            <div class="modal-metric-box">
              <small>TEMP ACTUAL</small>
              <h3>${Number(estado?.temp_cpu || 0).toFixed(1)}°C</h3>
            </div>
          </div>

          <div class="ai-actions">
            <button
              class="btn btn-primary"
              onclick="analizarEquipoIA('${equipoId}')"
            >
              <i class="fas fa-robot"></i>
              Analizar con IA local
            </button>
          </div>

          <div class="detail-charts-grid">
            <div class="chart-container">
              <h3>CPU Individual</h3>
              <canvas id="detalleCpuChart"></canvas>
            </div>

            <div class="chart-container">
              <h3>RAM Individual</h3>
              <canvas id="detalleRamChart"></canvas>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    await cargarGraficosDetalle(equipoId);

  } catch (error) {
    console.error('Error mostrando detalles:', error);
    alert('No se pudieron cargar los detalles del equipo.');
  }
}


function cerrarDetalleEquipo() {
  const modal =
    document.getElementById('modal-detalle-equipo');

  if (modal) {
    modal.remove();
  }
}

// ======================================================
// IA LOCAL - FRONTEND
// ======================================================

async function analizarEquipoIA(equipoId) {
  try {
    abrirModalIA(`
      <div class="ia-loading">
        <i class="fas fa-robot"></i>
        <h3>Analizando equipo...</h3>
        <p>CoreWatch IA está revisando métricas, alertas y procesos.</p>
      </div>
    `);

    const data = await fetchAPI(`/ia/diagnostico/${equipoId}`, {
      method: 'POST',
      body: JSON.stringify({
        pregunta: 'Analiza este equipo y determina si es propenso a fallar.'
      })
    });

    const html = construirDiagnosticoIA(data);

    abrirModalIA(html);

  } catch (error) {
    console.error('Error IA local:', error);

    abrirModalIA(`
      <div class="ia-error">
        <h3>No se pudo generar el diagnóstico</h3>
        <p>Verifica que el backend esté funcionando y que exista el endpoint de IA local.</p>
      </div>
    `);
  }
}


function construirDiagnosticoIA(data) {
  const claseEstado = (data.estado || 'SALUDABLE').toLowerCase();

  return `
    <div class="ia-diagnostico">
      <div class="ia-header-result ia-${claseEstado}">
        <i class="fas fa-robot"></i>
        <div>
          <h2>Diagnóstico IA Local</h2>
          <p>${data.equipo_nombre} (${data.equipo_id})</p>
        </div>
      </div>

      <div class="ia-summary">
        <div>
          <span>Estado</span>
          <strong>${data.estado}</strong>
        </div>

        <div>
          <span>Urgencia</span>
          <strong>${data.nivel_urgencia}</strong>
        </div>

        <div>
          <span>Riesgo</span>
          <strong>${data.puntaje_riesgo}/100</strong>
        </div>
      </div>

      <p class="ia-resumen">${data.resumen}</p>

      <div class="ia-section">
        <h3>Razones del diagnóstico</h3>
        <ul>
          ${data.diagnostico.map(item => `<li>${item}</li>`).join('')}
        </ul>
      </div>

      <div class="ia-section">
        <h3>Componentes en riesgo</h3>
        <ul>
          ${data.componentes_en_riesgo.map(item => `<li>${item}</li>`).join('')}
        </ul>
      </div>

      <div class="ia-section">
        <h3>Posibles causas</h3>
        <ul>
          ${data.posibles_causas.map(item => `<li>${item}</li>`).join('')}
        </ul>
      </div>

      <div class="ia-section">
        <h3>Acciones recomendadas</h3>
        <ol>
          ${data.acciones_recomendadas.map(item => `<li>${item}</li>`).join('')}
        </ol>
      </div>

      <div class="ia-section ia-data">
        <h3>Datos analizados</h3>
        <p>CPU: ${data.datos_analizados.cpu_pct}%</p>
        <p>RAM: ${data.datos_analizados.ram_pct}%</p>
        <p>Disco: ${data.datos_analizados.disco_pct}%</p>
        <p>Temperatura: ${data.datos_analizados.temp_cpu}°C</p>
        <p>Alertas activas: ${data.datos_analizados.alertas_activas}</p>
        <p>Procesos sospechosos: ${data.datos_analizados.procesos_sospechosos}</p>
      </div>
    </div>
  `;
}


function abrirModalIA(contenido) {
  const modalExistente = document.getElementById('modal-ia-local');

  if (modalExistente) {
    modalExistente.remove();
  }

  const modal = document.createElement('div');

  modal.id = 'modal-ia-local';

  modal.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card modal-card-large">

        <div class="modal-header">
          <h2>CoreWatch IA</h2>

          <button
            class="modal-close"
            onclick="cerrarModalIA()"
          >
            ×
          </button>
        </div>

        <div class="ia-content">
          ${contenido}
        </div>

      </div>
    </div>
  `;

  document.body.appendChild(modal);
}


function cerrarModalIA() {
  const modal = document.getElementById('modal-ia-local');

  if (modal) {
    modal.remove();
  }
}

// ======================================================
// REPORTES: VALORES PEQUEÑOS DE TARJETAS
// ======================================================

async function actualizarResumenReportes() {
  try {
    const resumen = await fetchAPI('/resumen');
    const rendimiento = await fetchAPI('/reportes/rendimiento');
    const reporteAlertas = await fetchAPI('/reportes/alertas');
    const hardware = await fetchAPI('/reportes/hardware');

    const reportCards =
      document.querySelectorAll('#reportes .report-card');

    if (reportCards[0]) {
      const valores =
        reportCards[0].querySelectorAll('.report-stat strong');

      if (valores[0]) {
        valores[0].textContent =
          resumen.total_equipos || 0;
      }

      if (valores[1]) {
        valores[1].textContent =
          new Date().toLocaleString('es-ES');
      }
    }

    if (reportCards[1]) {
      const valores =
        reportCards[1].querySelectorAll('.report-stat strong');

      if (valores[0]) {
        valores[0].textContent = '30 días';
      }

      const cpuPromedio = rendimiento.length
        ? rendimiento.reduce((acc, e) =>
            acc + Number(e.cpu_promedio || 0), 0
          ) / rendimiento.length
        : 0;

      if (valores[1]) {
        valores[1].textContent =
          `${cpuPromedio.toFixed(1)}%`;
      }
    }

    if (reportCards[2]) {
      const valores =
        reportCards[2].querySelectorAll('.report-stat strong');

      if (valores[0]) {
        valores[0].textContent =
          reporteAlertas.resumen?.total_alertas || 0;
      }

      if (valores[1]) {
        valores[1].textContent =
          reporteAlertas.resumen?.activas || 0;
      }
    }

    if (reportCards[3]) {
      const valores =
        reportCards[3].querySelectorAll('.report-stat strong');

      if (valores[0]) {
        valores[0].textContent =
          hardware.length || 0;
      }

      const anomalias = hardware.filter(e =>
        e.diagnostico === 'Advertencia' ||
        e.diagnostico === 'Crítico'
      ).length;

      if (valores[1]) {
        valores[1].textContent =
          anomalias;
      }
    }

  } catch (error) {
    console.error(
      'Error actualizando resumen de reportes:',
      error
    );
  }
}


// ======================================================
// REPORTES
// ======================================================

function inicializarReportes() {
  const botonesReporte =
    document.querySelectorAll('#reportes .report-card .btn-small');

  botonesReporte.forEach((boton, index) => {
    boton.addEventListener('click', () => {
      if (index === 0) {
        mostrarReporteSalud();
      }

      if (index === 1) {
        mostrarReporteRendimiento();
      }

      if (index === 2) {
        mostrarReporteAlertas();
      }

      if (index === 3) {
        mostrarReporteHardware();
      }
    });
  });

  const botonExportar =
    document.querySelector('#reportes .section-header .btn-primary');

  if (botonExportar) {
    botonExportar.addEventListener('click', exportarReporteActual);
  }
}


async function mostrarReporteSalud() {
  try {
    const data =
      await fetchAPI('/reportes/salud');

    const resumen = data.resumen;
    const equipos = data.equipos;

    const filas = equipos.map(equipo => {
      const estado = !equipo.activo
        ? 'Fuera de línea'
        : (
            Number(equipo.cpu_pct || 0) >= 80 ||
            Number(equipo.ram_pct || 0) >= 85 ||
            Number(equipo.disco_pct || 0) >= 90 ||
            Number(equipo.temp_cpu || 0) >= 75
          )
          ? 'Advertencia'
          : 'Saludable';

      return `
        <tr>
          <td>${equipo.nombre}</td>
          <td>${equipo.ip || 'Sin IP'}</td>
          <td>${estado}</td>
          <td>${Number(equipo.cpu_pct || 0).toFixed(1)}%</td>
          <td>${Number(equipo.ram_pct || 0).toFixed(1)}%</td>
          <td>${Number(equipo.disco_pct || 0).toFixed(1)}%</td>
          <td>${Number(equipo.temp_cpu || 0).toFixed(1)}°C</td>
        </tr>
      `;
    }).join('');

    abrirModalReporte(`
      <h2>Reporte de Salud del Sistema</h2>

      <div class="report-summary-grid">
        <div><strong>Total equipos</strong><span>${resumen.total_equipos}</span></div>
        <div><strong>Activos</strong><span>${resumen.equipos_activos}</span></div>
        <div><strong>Inactivos</strong><span>${resumen.equipos_inactivos}</span></div>
        <div><strong>Saludables</strong><span>${resumen.saludables}</span></div>
        <div><strong>Advertencia</strong><span>${resumen.advertencia}</span></div>
      </div>

      <table class="report-table">
        <thead>
          <tr>
            <th>Equipo</th>
            <th>IP</th>
            <th>Estado</th>
            <th>CPU</th>
            <th>RAM</th>
            <th>Disco</th>
            <th>Temp</th>
          </tr>
        </thead>

        <tbody>
          ${filas}
        </tbody>
      </table>
    `);

  } catch (error) {
    console.error('Error reporte salud:', error);
    alert('No se pudo cargar el reporte de salud.');
  }
}


async function mostrarReporteRendimiento() {
  try {
    const data =
      await fetchAPI('/reportes/rendimiento');

    const filas = data.map(item => `
      <tr>
        <td>${item.equipo_id}</td>
        <td>${Number(item.cpu_promedio || 0).toFixed(2)}%</td>
        <td>${Number(item.ram_promedio || 0).toFixed(2)}%</td>
        <td>${Number(item.disco_promedio || 0).toFixed(2)}%</td>
        <td>${Number(item.temp_promedio || 0).toFixed(2)}°C</td>
        <td>${item.muestras}</td>
      </tr>
    `).join('');

    abrirModalReporte(`
      <h2>Histórico de Rendimiento</h2>

      <table class="report-table">
        <thead>
          <tr>
            <th>Equipo</th>
            <th>CPU Prom.</th>
            <th>RAM Prom.</th>
            <th>Disco Prom.</th>
            <th>Temp Prom.</th>
            <th>Muestras</th>
          </tr>
        </thead>

        <tbody>
          ${filas}
        </tbody>
      </table>
    `);

  } catch (error) {
    console.error('Error reporte rendimiento:', error);
    alert('No se pudo cargar el reporte de rendimiento.');
  }
}


async function mostrarReporteAlertas() {
  try {
    const data =
      await fetchAPI('/reportes/alertas');

    const resumen = data.resumen;
    const alertas = data.alertas;

    const filas = alertas.map(alerta => {
      const fecha = alerta.timestamp
        ? new Date(alerta.timestamp).toLocaleString('es-ES')
        : 'N/A';

      return `
        <tr>
          <td>${fecha}</td>
          <td>${alerta.equipo_nombre}</td>
          <td>${alerta.tipo}</td>
          <td>${alerta.severidad}</td>
          <td>${alerta.resuelta ? 'Resuelta' : 'Activa'}</td>
        </tr>
      `;
    }).join('');

    abrirModalReporte(`
      <h2>Reporte de Alertas y Eventos</h2>

      <div class="report-summary-grid">
        <div><strong>Total</strong><span>${resumen.total_alertas}</span></div>
        <div><strong>Activas</strong><span>${resumen.activas}</span></div>
        <div><strong>Críticas</strong><span>${resumen.criticas}</span></div>
        <div><strong>Warnings</strong><span>${resumen.warnings}</span></div>
        <div><strong>Info</strong><span>${resumen.infos}</span></div>
      </div>

      <table class="report-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Equipo</th>
            <th>Tipo</th>
            <th>Severidad</th>
            <th>Estado</th>
          </tr>
        </thead>

        <tbody>
          ${filas}
        </tbody>
      </table>
    `);

  } catch (error) {
    console.error('Error reporte alertas:', error);
    alert('No se pudo cargar el reporte de alertas.');
  }
}


async function mostrarReporteHardware() {
  try {
    const data =
      await fetchAPI('/reportes/hardware');

    const filas = data.map(equipo => `
      <tr>
        <td>${equipo.nombre}</td>
        <td>${equipo.ip || 'Sin IP'}</td>
        <td>${equipo.diagnostico}</td>
        <td>${Number(equipo.cpu_promedio || 0).toFixed(2)}%</td>
        <td>${Number(equipo.ram_promedio || 0).toFixed(2)}%</td>
        <td>${Number(equipo.disco_promedio || 0).toFixed(2)}%</td>
        <td>${Number(equipo.temp_promedio || 0).toFixed(2)}°C</td>
        <td>${equipo.total_alertas}</td>
      </tr>
    `).join('');

    abrirModalReporte(`
      <h2>Diagnóstico de Hardware</h2>

      <table class="report-table">
        <thead>
          <tr>
            <th>Equipo</th>
            <th>IP</th>
            <th>Diagnóstico</th>
            <th>CPU</th>
            <th>RAM</th>
            <th>Disco</th>
            <th>Temp</th>
            <th>Alertas</th>
          </tr>
        </thead>

        <tbody>
          ${filas}
        </tbody>
      </table>
    `);

  } catch (error) {
    console.error('Error reporte hardware:', error);
    alert('No se pudo cargar el reporte de hardware.');
  }
}


function abrirModalReporte(contenido) {
  const modalExistente =
    document.getElementById('modal-reporte');

  if (modalExistente) {
    modalExistente.remove();
  }

  const modal =
    document.createElement('div');

  modal.id = 'modal-reporte';

  modal.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-card modal-card-large">

        <div class="modal-header">
          <h2>CoreWatch</h2>

          <div>
            <button
              class="btn-small"
              onclick="imprimirReporteActual()"
            >
              Imprimir / PDF
            </button>

            <button
              class="modal-close"
              onclick="cerrarModalReporte()"
            >
              ×
            </button>
          </div>
        </div>

        <div id="contenido-reporte" class="modal-report-content">
          ${contenido}
        </div>

      </div>
    </div>
  `;

  document.body.appendChild(modal);
}


function cerrarModalReporte() {
  const modal =
    document.getElementById('modal-reporte');

  if (modal) {
    modal.remove();
  }
}


function imprimirReporteActual() {
  const contenido =
    document.getElementById('contenido-reporte');

  if (!contenido) {
    alert('Primero abre un reporte.');
    return;
  }

  const ventana =
    window.open('', '_blank');

  ventana.document.write(`
    <html>
      <head>
        <title>CoreWatch - Reporte</title>

        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 30px;
            color: #111;
          }

          h1, h2 {
            color: #006c8f;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }

          th, td {
            border: 1px solid #ccc;
            padding: 8px;
            font-size: 12px;
            text-align: left;
          }

          th {
            background: #e9f7fb;
          }

          .report-summary-grid {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 10px;
            margin: 20px 0;
          }

          .report-summary-grid div {
            border: 1px solid #ccc;
            padding: 10px;
          }

          .report-summary-grid strong {
            display: block;
            font-size: 12px;
          }

          .report-summary-grid span {
            font-size: 20px;
            font-weight: bold;
          }
        </style>
      </head>

      <body>
        <h1>CoreWatch - Reporte</h1>
        <p>Generado: ${new Date().toLocaleString('es-ES')}</p>

        ${contenido.innerHTML}
      </body>
    </html>
  `);

  ventana.document.close();
  ventana.focus();
  ventana.print();
}


function exportarReporteActual() {
  const contenido =
    document.getElementById('contenido-reporte');

  if (!contenido) {
    alert('Abre primero un reporte con el botón "Ver Reporte" y luego exporta.');
    return;
  }

  imprimirReporteActual();
}

async function cargarGraficosDetalle(equipoId) {
  try {
    const cpuDatos = await fetchAPI(`/cpu/${equipoId}`);
    const ramDatos = await fetchAPI(`/ram/${equipoId}`);

    const cpuCanvas = document.getElementById('detalleCpuChart');
    const ramCanvas = document.getElementById('detalleRamChart');

    if (!cpuCanvas || !ramCanvas) return;

    cpuDatos.sort((a, b) =>
      new Date(a.timestamp) - new Date(b.timestamp)
    );

    ramDatos.sort((a, b) =>
      new Date(a.timestamp) - new Date(b.timestamp)
    );

    new Chart(cpuCanvas, {
      type: 'line',
      data: {
        labels: cpuDatos.map(d =>
          new Date(d.timestamp).toLocaleTimeString('es-ES')
        ),
        datasets: [
          {
            label: `CPU % - ${equipoId}`,
            data: cpuDatos.map(d => Number(d.cpu_pct || 0)),
            borderColor: '#00d4ff',
            backgroundColor: 'rgba(0,212,255,0.1)',
            tension: 0.4
          }
        ]
      }
    });

    new Chart(ramCanvas, {
      type: 'line',
      data: {
        labels: ramDatos.map(d =>
          new Date(d.timestamp).toLocaleTimeString('es-ES')
        ),
        datasets: [
          {
            label: `RAM usada MB - ${equipoId}`,
            data: ramDatos.map(d => Number(d.ram_usada_mb || 0)),
            borderColor: '#00ff99',
            backgroundColor: 'rgba(0,255,153,0.1)',
            tension: 0.4
          },
          {
            label: `RAM total MB - ${equipoId}`,
            data: ramDatos.map(d => Number(d.ram_total_mb || 0)),
            borderColor: '#ff4757',
            backgroundColor: 'rgba(255,71,87,0.1)',
            tension: 0.4
          }
        ]
      }
    });

  } catch (error) {
    console.error('Error cargando gráficos de detalle:', error);
  }
}

// ======================================================
// CONFIGURACIÓN FUNCIONAL
// ======================================================

let intervaloActualizacion = null;

function iniciarConfiguracion() {
  const temaSelect = document.querySelector('#configuracion select');
  const intervaloInput = document.querySelector('#configuracion input[type="number"]');

  const inputsUmbrales = document.querySelectorAll('#configuracion .settings-section:nth-child(2) input');

  const btnGuardar = document.querySelector('.settings-footer .btn-primary');
  const btnRestaurar = document.querySelector('.settings-footer .btn-secondary');

  cargarConfiguracion();

  if (btnGuardar) {
    btnGuardar.addEventListener('click', () => {
      const config = {
        tema: temaSelect?.value || 'Oscuro',
        intervalo: Number(intervaloInput?.value || 30),
        notificaciones: document.querySelector('#configuracion input[type="checkbox"]')?.checked || false,
        cpu: Number(inputsUmbrales[0]?.value || 80),
        ram: Number(inputsUmbrales[1]?.value || 85),
        disco: Number(inputsUmbrales[2]?.value || 90),
        temperatura: Number(inputsUmbrales[3]?.value || 75)
      };

      localStorage.setItem('corewatch_config', JSON.stringify(config));

      aplicarConfiguracion(config);

      alert('Configuración guardada correctamente.');
    });
  }

  if (btnRestaurar) {
    btnRestaurar.addEventListener('click', () => {
      localStorage.removeItem('corewatch_config');
      location.reload();
    });
  }
}

function cargarConfiguracion() {
  const configGuardada = localStorage.getItem('corewatch_config');

  if (!configGuardada) return;

  const config = JSON.parse(configGuardada);

  const temaSelect = document.querySelector('#configuracion select');
  const intervaloInput = document.querySelector('#configuracion input[type="number"]');
  const notificacionesInput = document.querySelector('#configuracion input[type="checkbox"]');
  const inputsUmbrales = document.querySelectorAll('#configuracion .settings-section:nth-child(2) input');

  if (temaSelect) temaSelect.value = config.tema;
  if (intervaloInput) intervaloInput.value = config.intervalo;
  if (notificacionesInput) notificacionesInput.checked = config.notificaciones;

  if (inputsUmbrales[0]) inputsUmbrales[0].value = config.cpu;
  if (inputsUmbrales[1]) inputsUmbrales[1].value = config.ram;
  if (inputsUmbrales[2]) inputsUmbrales[2].value = config.disco;
  if (inputsUmbrales[3]) inputsUmbrales[3].value = config.temperatura;

  aplicarConfiguracion(config);
}

function aplicarConfiguracion(config) {
  if (intervaloActualizacion) {
    clearInterval(intervaloActualizacion);
  }

  intervaloActualizacion = setInterval(() => {
    loadDashboardData();
    actualizarResumenReportes();
  }, config.intervalo * 1000);

  window.corewatchConfig = config;
}

function obtenerConfiguracion() {
  const configGuardada = localStorage.getItem('corewatch_config');

  if (!configGuardada) {
    return {
      tema: 'Oscuro',
      intervalo: 30,
      notificaciones: true,
      cpu: 80,
      ram: 85,
      disco: 90,
      temperatura: 75
    };
  }

  return JSON.parse(configGuardada);
  
}

// ======================================================
// LOGIN Y SESIÓN
// ======================================================

function inicializarLogin() {
  const form = document.getElementById('login-form');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const usuario = document.getElementById('login-usuario').value.trim();
    const password = document.getElementById('login-password').value.trim();
    const errorBox = document.getElementById('login-error');

    try {
      const response = await fetchAPI('/login', {
        method: 'POST',
        body: JSON.stringify({
          usuario,
          password
        })
      });

      localStorage.setItem(
        'corewatch_user',
        JSON.stringify(response.user)
      );

      mostrarApp(response.user);
      await iniciarCoreWatch();

    } catch (error) {
      if (errorBox) {
        errorBox.textContent = 'Usuario o contraseña incorrectos';
      }
    }
  });
}


function verificarSesion() {
  const userStorage = localStorage.getItem('corewatch_user');

  if (!userStorage) {
    mostrarLogin();
    return false;
  }

  const user = JSON.parse(userStorage);

  mostrarApp(user);
  return true;
}


function mostrarLogin() {
  const loginScreen = document.getElementById('login-screen');
  const appContainer = document.getElementById('app-container');

  if (loginScreen) loginScreen.style.display = 'flex';
  if (appContainer) appContainer.style.display = 'none';
}


function obtenerAvatarPorRol(rol) {
  const rolNormalizado = (rol || 'invitado').toLowerCase();

  const avatarPorRol = {
    admin: 'https://api.dicebear.com/9.x/bottts/svg?seed=admin-corewatch',
    supervisor: 'https://api.dicebear.com/9.x/bottts/svg?seed=supervisor-corewatch',
    operador: 'https://api.dicebear.com/9.x/bottts/svg?seed=operador-corewatch',
    analista: 'https://api.dicebear.com/9.x/bottts/svg?seed=analista-corewatch',
    invitado: 'https://api.dicebear.com/9.x/bottts/svg?seed=invitado-corewatch'
  };

  return avatarPorRol[rolNormalizado] || avatarPorRol.invitado;
}


function mostrarApp(user) {
  const loginScreen = document.getElementById('login-screen');
  const appContainer = document.getElementById('app-container');

  if (loginScreen) loginScreen.style.display = 'none';
  if (appContainer) appContainer.style.display = 'flex';

  const nombre = document.getElementById('usuario-nombre');
  const rol = document.getElementById('usuario-rol');
  const avatar = document.querySelector('.user-profile img');

  const rolNormalizado = (user.rol || 'invitado').toLowerCase();

  if (nombre) {
    nombre.textContent = user.usuario;
  }

  if (rol) {
    rol.textContent = rolNormalizado;
  }

  if (avatar) {
    avatar.src = obtenerAvatarPorRol(rolNormalizado);
    avatar.alt = `Avatar ${rolNormalizado}`;
  }

  aplicarPermisosUsuario(rolNormalizado);
}


function aplicarPermisosUsuario(rol) {
  const rolNormalizado = (rol || 'invitado').toLowerCase();

  const permisos = {
    admin: [
      'dashboard',
      'computadoras',
      'alertas',
      'reportes',
      'configuracion'
    ],

    supervisor: [
      'dashboard',
      'computadoras',
      'alertas',
      'reportes'
    ],

    operador: [
      'dashboard',
      'computadoras',
      'alertas'
    ],

    analista: [
      'dashboard',
      'alertas',
      'reportes'
    ],

    invitado: [
      'dashboard'
    ]
  };

  const permitidas = permisos[rolNormalizado] || permisos.invitado;

  document.querySelectorAll('.nav-item').forEach(item => {
    const section = item.getAttribute('data-section');

    item.style.display = permitidas.includes(section)
      ? 'flex'
      : 'none';
  });

  const seccionActiva = document.querySelector('.nav-item.active');
  const seccionActual = seccionActiva?.getAttribute('data-section');

  if (!permitidas.includes(seccionActual)) {
    const primeraPermitida = document.querySelector(
      `.nav-item[data-section="${permitidas[0]}"]`
    );

    if (primeraPermitida) {
      primeraPermitida.click();
    }
  }
}

function cerrarSesion() {

  if (!confirm('¿Deseas cerrar sesión?')) {
    return;
  }

  localStorage.removeItem('corewatch_user');
  localStorage.removeItem('corewatch_config');

  sessionStorage.clear();

  mostrarLogin();

  location.reload();
}

async function limpiarAlertas() {
  const confirmar = confirm(
    '¿Deseas limpiar las alertas visibles? No se eliminarán de la base de datos.'
  );

  if (!confirmar) return;

  try {
    await fetchAPI('/alertas/limpiar', {
      method: 'PUT'
    });

    const alertas = await fetchAPI('/alertas');

    renderAlertas(alertas);
    actualizarBadgeAlertas(alertas);

    alert('Alertas limpiadas correctamente.');

  } catch (error) {
    console.error('Error limpiando alertas:', error);
    alert('No se pudieron limpiar las alertas.');
  }
}

// ======================================================
// EXPONER FUNCIONES GLOBALES
// ======================================================

window.verDetallesComputadora = verDetallesComputadora;
window.cerrarDetalleEquipo = cerrarDetalleEquipo;
window.cerrarModalReporte = cerrarModalReporte;
window.imprimirReporteActual = imprimirReporteActual;
window.exportarReporteActual = exportarReporteActual;
window.cerrarSesion = cerrarSesion;
window.limpiarAlertas = limpiarAlertas;
window.analizarEquipoIA = analizarEquipoIA;
window.cerrarModalIA = cerrarModalIA;