// Libros de ejemplo para las pruebas: un EPUB y un PDF mínimos, generados aquí (no hay archivos binarios en el repositorio).
import zlib from "node:zlib";

const crc32 = (() => {
  const t = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  return buf => { let c = 0xFFFFFFFF; for (const b of buf) c = t[(c ^ b) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
})();
// Un ZIP con los archivos dados ([nombre, contenido, comprimir])
export function zip(archivos) {
  const partes = [], central = []; let pos = 0;
  for (const [nombre, contenido, comprimir = true] of archivos) {
    const datos = Buffer.from(contenido), n = Buffer.from(nombre), cuerpo = comprimir ? zlib.deflateRawSync(datos) : datos;
    const cab = Buffer.alloc(30); cab.writeUInt32LE(0x04034b50, 0); cab.writeUInt16LE(20, 4); cab.writeUInt16LE(comprimir ? 8 : 0, 8);
    cab.writeUInt32LE(crc32(datos), 14); cab.writeUInt32LE(cuerpo.length, 18); cab.writeUInt32LE(datos.length, 22); cab.writeUInt16LE(n.length, 26);
    const dir = Buffer.alloc(46); dir.writeUInt32LE(0x02014b50, 0); dir.writeUInt16LE(20, 4); dir.writeUInt16LE(20, 6); dir.writeUInt16LE(comprimir ? 8 : 0, 10);
    dir.writeUInt32LE(crc32(datos), 16); dir.writeUInt32LE(cuerpo.length, 20); dir.writeUInt32LE(datos.length, 24); dir.writeUInt16LE(n.length, 28); dir.writeUInt32LE(pos, 42);
    partes.push(cab, n, cuerpo); central.push(dir, n); pos += 30 + n.length + cuerpo.length;
  }
  const dirTam = central.reduce((s, b) => s + b.length, 0), fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(archivos.length, 8); fin.writeUInt16LE(archivos.length, 10); fin.writeUInt32LE(dirTam, 12); fin.writeUInt32LE(pos, 16);
  return Buffer.concat([...partes, ...central, fin]);
}

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAYAAAC56t6BAAAAFElEQVR42mNkYGD4z8DAwMDEAAUADigBA//ATXQAAAAASUVORK5CYII=", "base64");
const capitulo = (titulo, cuerpo) => `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>${titulo}</title>
<style>p { color: red; position: fixed }</style><script>window.PIRATEADO = true;</script></head>
<body><h1 id="inicio">${titulo}</h1>${cuerpo}</body></html>`;

// Un EPUB 3 con tres capítulos, portada, índice, una imagen, un enlace interno y contenido hostil que no debe llegar a la página
export function epubDeEjemplo({ titulo = "Meditaciones de prueba", autor = "Marco Aurelio" } = {}) {
  const parrafos = n => Array.from({ length: n }, (_, i) => `<p>Párrafo ${i + 1} del capítulo. La felicidad de tu vida depende de la calidad de tus pensamientos.</p>`).join("");
  return zip([
    ["mimetype", "application/epub+zip", false],
    ["META-INF/container.xml", `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/libro.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`],
    ["OEBPS/libro.opf", `<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id">
      <metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">prueba</dc:identifier><dc:title>${titulo}</dc:title><dc:creator>${autor}</dc:creator><dc:language>es</dc:language></metadata>
      <manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="portada" href="img/portada.png" media-type="image/png" properties="cover-image"/>
        <item id="c1" href="texto/uno.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="texto/dos.xhtml" media-type="application/xhtml+xml"/><item id="c3" href="texto/tres.xhtml" media-type="application/xhtml+xml"/></manifest>
      <spine><itemref idref="c1"/><itemref idref="c2"/><itemref idref="c3"/></spine></package>`],
    ["OEBPS/nav.xhtml", `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><body><nav epub:type="toc"><ol>
      <li><a href="texto/uno.xhtml">Libro primero</a></li><li><a href="texto/dos.xhtml">Libro segundo</a><ol><li><a href="texto/dos.xhtml#final">El final del segundo</a></li></ol></li><li><a href="texto/tres.xhtml">Libro tercero</a></li></ol></nav></body></html>`],
    ["OEBPS/img/portada.png", PNG, false],
    ["OEBPS/texto/uno.xhtml", capitulo("Libro primero", `<p onclick="window.PIRATEADO=true" style="position:fixed">De mi abuelo Vero aprendí el buen carácter y la serenidad.</p>
      <p><img src="../img/portada.png" alt="Una imagen" onerror="window.PIRATEADO=true"/></p><p><a href="dos.xhtml#final">Ir al final del segundo</a> · <a href="javascript:window.PIRATEADO=true">trampa</a> · <a href="https://example.com/">fuera</a></p>
      <iframe src="https://example.com/"></iframe><form><input name="x"/></form>${parrafos(40)}`)],
    ["OEBPS/texto/dos.xhtml", capitulo("Libro segundo", `${parrafos(30)}<p id="final">Este es el final del segundo libro.</p>${parrafos(20)}`)],
    ["OEBPS/texto/tres.xhtml", capitulo("Libro tercero", parrafos(10))],
  ]);
}

// Un PDF de varias páginas con texto (Helvetica), título y autor
export function pdfDeEjemplo({ titulo = "Manual de prueba", autor = "Epicteto", paginas = 3 } = {}) {
  const objetos = [];                                   // objetos[i] = cuerpo del objeto i+1
  const texto = n => `BT /F1 24 Tf 72 720 Td (Pagina ${n} del manual) Tj 0 -40 Td /F1 14 Tf (No son las cosas las que nos perturban.) Tj ET`;
  objetos[0] = "<< /Type /Catalog /Pages 2 0 R >>";
  objetos[2] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objetos[3] = `<< /Title (${titulo}) /Author (${autor}) >>`;
  const hijos = [];
  for (let i = 0; i < paginas; i++) {
    const c = texto(i + 1), pag = objetos.length + 1;
    objetos.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${pag + 1} 0 R >>`);
    objetos.push(`<< /Length ${c.length} >>\nstream\n${c}\nendstream`);
    hijos.push(pag + " 0 R");
  }
  objetos[1] = `<< /Type /Pages /Kids [${hijos.join(" ")}] /Count ${paginas} >>`;
  let pdf = "%PDF-1.4\n"; const pos = [];
  objetos.forEach((o, i) => { pos.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n` + pos.map(p => String(p).padStart(10, "0") + " 00000 n \n").join("");
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R /Info 4 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}
