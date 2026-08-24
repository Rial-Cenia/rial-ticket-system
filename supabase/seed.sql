insert into public."Ticket" (title, description, type, status, platform, "createdByName")
values
  ('Ajustar catálogo de temporada', 'Revisar el orden de las prendas destacadas para la nueva campaña.', 'MEJORA', 'EN_PROGRESO', 'NESTOR', 'Equipo Operaciones'),
  ('Validar cambios antes de producción', 'Revisar en staging la nueva versión antes de liberarla.', 'REQUERIMIENTO', 'EN_STAGING', 'ATOM', 'Equipo QA'),
  ('Error al descargar imágenes', 'La descarga masiva termina con error al procesar más de cincuenta imágenes.', 'BUG', 'PENDIENTE', null, 'María Operaciones'),
  ('Duda sobre permisos', 'Confirmar quién puede aprobar imágenes antes de publicarlas.', 'DUDA', 'EN_ESPERA', 'DYLAN', 'Equipo Comercial');
