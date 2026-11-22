# MediTurno · Sistema de citas médicas

**Trabajo final integrador · Desarrollo Web**

- **Integrantes:** _(escribe aquí los nombres del equipo)_
- **Grupo:** _(escribe aquí tu grupo)_
- **Sistema publicado:** _(pega aquí el enlace de la aplicación publicada)_
- **Repositorio:** _(pega aquí el enlace de GitHub)_

## Objetivo
Permitir que los pacientes pidan citas médicas por internet, que los doctores las acepten o rechacen y que el administrador controle la clínica.

## Problema que resuelve
Pedir cita por teléfono genera filas, errores de horario y citas empalmadas. MediTurno muestra solo las horas libres de cada doctor, evita que dos pacientes tomen la misma hora y avisa por correo cuando la cita se acepta.

## Tecnologías
HTML5, CSS3 y JavaScript (navegador) · Node.js (servidor) · MySQL (base de datos, con la librería `mysql2`) · Resend (correos) · API de Claude (chatbot con IA).

## Principales funciones
| Rango | Qué puede hacer |
|---|---|
| **Registro** | Cuentas nuevas: **paciente** (entra de inmediato) o **doctor** (queda en revisión hasta que el administrador lo apruebe) |
| **Inicio de sesión** | Cuentas existentes: paciente, doctor y administrador (con código enviado a su correo) |
| **Paciente** | Registrarse, ver doctores (búsqueda y filtro), pedir cita viendo solo horas libres, reprogramar, cancelar, eliminar citas canceladas, ver notificaciones, cambiar su contraseña |
| **Doctor** | Definir su horario por día, duración de consulta y días bloqueados; aceptar/rechazar citas con nota (también desde el correo); marcarlas como atendidas |
| **Administrador** | Entra con un código enviado a su correo único; da de alta, edita, desactiva y elimina doctores y pacientes; aprueba solicitudes de doctores desde el correo; edita los datos de la clínica; estadísticas; reporte CSV; respaldo; bitácora |
| **Todos** | Chatbot con IA, diseño adaptable a celular, tableta y computadora |

**CRUD:** Create (registro, citas, doctores) · Read (listas, búsquedas, filtros) · Update (citas, perfil, agenda, precios, clínica) · Delete (citas y usuarios, siempre con confirmación).
**Funciones adicionales:** autenticación por rangos, filtros y búsqueda, estadísticas, reporte CSV, respaldo, bitácora, recordatorios y correos automáticos.

## Estructura del proyecto
```
public/            Lo que ve el navegador: index.html, css/estilos.css, js/app.js, imagenes/
servidor/          Servidor Node.js
  servidor.js        Arranque, rutas y archivos estáticos
  configuracion/     entorno.js (variables), db.js (MySQL), inicializar.js (datos básicos)
  rutas/             publicas, citas, doctor, cuenta, admin
  servicios/         correo, ia, acciones, recordatorios
  utilidades.js      Validaciones, seguridad y horarios
database/esquema.sql Estructura de la base de datos
docs/pruebas.md      Pruebas funcionales
```

## Instalación (Windows, la forma fácil)
1. Instala [Node.js](https://nodejs.org) (LTS) y [XAMPP](https://www.apachefriends.org) (en `C:\xampp`).
2. Descomprime el proyecto y haz doble clic en **`INICIAR.bat`**. Enciende MySQL, ejecuta `npm install` la primera vez, crea la base de datos y las tablas leyendo `database/esquema.sql`, e inicia el servidor.

Detalles en `LEEME_PRIMERO.txt`. Instalación manual: `npm install`, copiar `.env.example` como `.env`, encender MySQL y `npm start`.

## Configuración (variables de entorno)
Todo se configura en `.env` (nunca se sube a GitHub). Las más importantes: `DB_HOST`, `DB_USUARIO`, `DB_CONTRASENA`, `DB_NOMBRE`, `SECRETO` y `ADMIN_EMAIL`. `RESEND_API_KEY` y `ANTHROPIC_API_KEY` son opcionales: sin ellas, los correos salen en la terminal y el chatbot responde en modo básico.

## Iniciar el servidor
```
npm start
```
Abre `http://localhost:3000`. La primera vez se crean la base de datos, los datos básicos y las cuentas de prueba.

### Abrirlo desde un celular (mismo Wi-Fi)
Al arrancar, la terminal muestra una línea como `Desde el celular (mismo Wi-Fi): http://192.168.1.50:3000`. Escribe esa dirección en el navegador del celular. Si no abre, ejecuta `PERMITIR_CELULAR.bat` como administrador (una sola vez).

### Publicarlo en internet
GitHub Pages no ejecuta servidor, así que se publica **todo junto** (página + servidor) en un hosting para Node.js, por ejemplo Render, con una base MySQL en la nube (por ejemplo Aiven o TiDB Cloud). Pasos:
1. Sube el proyecto a GitHub (el `.env` no se sube).
2. En el hosting crea un *Web Service* desde el repositorio: *Build command* `npm install`, *Start command* `npm start`.
3. En *Environment* del hosting escribe las mismas variables del `.env`: `DB_HOST`, `DB_PORT`, `DB_USUARIO`, `DB_CONTRASENA`, `DB_NOMBRE`, `DB_SSL=true` si la base lo exige, `SECRETO`, `ADMIN_EMAIL` y `URL_PUBLICA` (la dirección que te dé el hosting).
4. El servidor crea las tablas solo al arrancar. Abre el enlace del hosting desde cualquier celular.

## Cuentas de prueba (ficticias)
- Paciente: `paciente@mediturno.test` / `Paciente123*`
- Doctora: `laura@mediturno.test` / `Doctor123*`
- Administrador: en *Ingresar* elige "Administrador", escribe el correo definido en `ADMIN_EMAIL` y el código llega a ese correo (sin llave de correo, aparece en la terminal).
- Doctor nuevo: se registra como doctor, el administrador lo aprueba en *Administración → Solicitudes* y después inicia sesión con su contraseña.

## Seguridad básica
Contraseñas guardadas con hash (scrypt) · consultas con parámetros (contra inyección SQL) · validaciones en el navegador y en el servidor · permisos por rango en cada ruta · confirmación antes de eliminar · mensajes de error sin datos internos · enlaces de correo firmados y de confirmación.

## Uso de inteligencia artificial
Se utilizó IA (Claude) como apoyo para desarrollar, depurar y documentar el proyecto, y el sistema incluye un chatbot con IA. El equipo revisó y comprende el código incorporado.

## Evidencia gráfica
_(agrega aquí capturas del sistema funcionando)_
