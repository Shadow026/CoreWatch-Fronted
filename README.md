# CoreWatch - Sistema de Monitoreo de Computadoras

CoreWatch es una aplicación web para monitorear computadoras conectadas a una base de datos PostgreSQL. El sistema permite visualizar el estado de los equipos, revisar métricas de rendimiento, detectar alertas, generar reportes y administrar el acceso mediante usuarios con roles.

## Características principales

- Inicio de sesión con usuarios almacenados en PostgreSQL.
- Control de acceso según rol de usuario.
- Dashboard general con resumen del sistema.
- Monitoreo de CPU, RAM, disco y temperatura.
- Detección de equipos activos e inactivos.
- Clasificación de equipos como saludables, en advertencia o críticos.
- Centro de alertas con estado activo/resuelto.
- Limpieza de alertas sin eliminarlas de la base de datos.
- Reportes de salud, rendimiento, alertas y diagnóstico de hardware.
- Gráficas globales e individuales por computadora.
- Configuración de intervalos de actualización y umbrales.
- Backend desplegable en Railway.
- Frontend estático compatible con GitHub Pages, Netlify o Vercel.

## Tecnologías utilizadas

### Frontend

- HTML5
- CSS3
- JavaScript
- Chart.js
- Font Awesome

### Backend

- Node.js
- Express.js
- PostgreSQL
- pg
- dotenv
- cors

## Estructura del proyecto

```text
monitoreo-computadoras/
│
├── backend/
│   ├── database.js
│   ├── monitoreo.js
│   ├── monitoreoController.js
│   ├── server.js
│   ├── package.json
│   ├── package-lock.json
│   └── .env
│
├── css/
│   └── styles.css
│
├── js/
│   └── main.js
│
├── index.html
└── README.md
