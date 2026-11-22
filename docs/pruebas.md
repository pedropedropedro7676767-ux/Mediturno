# Pruebas funcionales de MediTurno

Llena las columnas **Resultado real** y **Correcta/Fallida** después de probar en tu equipo con MySQL.
Si una prueba falla, corrígela o documenta el motivo.

| # | Prueba | Resultado esperado | Resultado real | Correcta / Fallida |
|---|---|---|---|---|
| 1 | Registrar un paciente con datos válidos | Se guarda en la tabla `usuarios` y puede iniciar sesión | | |
| 2 | Enviar el formulario de registro vacío | Mensaje de validación y no se guarda | | |
| 3 | Registrar un correo que ya existe | Mensaje "Ese correo ya tiene cuenta" | | |
| 4 | Pedir una cita con doctor, fecha y hora libre | Aparece en "Mis citas" como pendiente y en la tabla `citas` | | |
| 5 | Pedir una cita sin motivo | Mensaje "Escribe el motivo de la consulta" | | |
| 6 | Pedir dos veces la misma hora con el mismo doctor | La segunda se rechaza; la hora ya no aparece libre | | |
| 7 | Buscar un doctor por nombre y filtrar por especialidad | Se muestran solo los doctores que coinciden | | |
| 8 | Doctor acepta una cita con nota | Estado "aprobada", el paciente recibe notificación | | |
| 9 | Paciente reprograma su cita | Cambia la fecha/hora y vuelve a "pendiente" | | |
| 10 | Paciente cancela su cita | Pide confirmación; la hora vuelve a estar libre | | |
| 11 | Paciente elimina una cita cancelada | Pide confirmación y elimina solo esa cita | | |
| 12 | Doctor cambia su horario | Los pacientes ven las nuevas horas libres | | |
| 13 | Administrador entra con código del correo | Entra al panel; un código incorrecto se rechaza | | |
| 14 | Administrador da de alta un doctor | Aparece en la lista; el doctor puede iniciar sesión con su contraseña temporal | | |
| 15 | Administrador intenta eliminar un doctor con citas | Mensaje que lo impide y sugiere desactivarlo | | |
| 16 | Paciente intenta entrar a una ruta de administrador | "No tienes permiso para esto" | | |
| 17 | Actualizar la página y reiniciar el servidor | La información sigue en la base de datos | | |
| 18 | Abrir el sistema en un celular | El diseño se adapta y el menú de hamburguesa funciona | | |
| 19 | Registrarse como doctor con todos los datos | Se crea una solicitud (no una cuenta) y el administrador recibe aviso | | |
| 20 | Doctor con solicitud pendiente intenta iniciar sesión | Mensaje "Tu solicitud de doctor sigue en revisión" | | |
| 21 | Administrador aprueba la solicitud del doctor | El doctor ya puede iniciar sesión con la contraseña que eligió | | |
| 22 | Administrador rechaza una solicitud | El doctor ve "solicitud rechazada" y no se crea su cuenta | | |
| 23 | Administrador inicia sesión desde "Ingresar" (tipo Administrador) | Pide código del correo y entra al panel | | |
| 24 | Abrir el sistema desde un celular con la dirección de la red o la publicada | Carga y se puede iniciar sesión | | |
