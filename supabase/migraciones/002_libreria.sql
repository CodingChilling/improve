-- Ascenso: librería.
-- Para proyectos que ya ejecutaron 001_inicial.sql cuando el tope era de 16 MB: sube a 50 MB el tamaño máximo
-- por archivo, para que quepan los libros (cifrados, como todo lo demás). Se puede ejecutar más de una vez.
-- Los libros, la lectura y los subrayados viajan en la tabla «cambios» de siempre: no hacen falta tablas nuevas.
update storage.buckets set file_size_limit = 52428800 where id = 'adjuntos';
