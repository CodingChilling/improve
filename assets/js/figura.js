// La figura del perfil: un Hombre o una Mujer de Vitruvio dibujados para Ascenso (no es una copia de la lámina de
// Leonardo, sino un boceto propio en la misma pose: brazos en cruz y en alto, piernas juntas y abiertas, dentro de un
// círculo y un cuadrado).
//
// - Las zonas del cuerpo (cabeza, pecho, brazos, manos, abdomen, piernas) se iluminan según lo cumplido.
// - El círculo es el anillo de progreso hacia el siguiente nivel; el cuadrado, el de los objetivos.
// - La lámina se va completando con los años: cada etapa de 10 niveles añade una capa de detalle (rostro, marcas de
//   proporción, músculos, sombreados, notas en escritura especular…). La capa de la etapa en curso se va trazando a
//   medida que se avanza dentro de ella.
"use strict";
window.AscensoFigura=(()=>{
  const C={x:200,y:220,r:140}, SQ={x:80,y:120,l:240};           // círculo (centro en el ombligo) y cuadrado
  const espejo=pts=>pts.map(([x,y])=>[400-x,y]);
  const linea=pts=>"M"+pts.map(p=>p.map(v=>+v.toFixed(1)).join(" ")).join(" L");
  // Curva suave que pasa por los puntos (Catmull-Rom convertida a Bézier)
  function curva(pts,cerrada=false){
    const P=cerrada?[pts[pts.length-1],...pts,pts[0],pts[1]]:[pts[0],...pts,pts[pts.length-1]];
    let d="M"+pts[0].join(" ");
    for(let i=1;i<P.length-2;i++){
      const [p0,p1,p2,p3]=[P[i-1],P[i],P[i+1],P[i+2]];
      const c1=[p1[0]+(p2[0]-p0[0])/6,p1[1]+(p2[1]-p0[1])/6], c2=[p2[0]-(p3[0]-p1[0])/6,p2[1]-(p3[1]-p1[1])/6];
      d+=` C${c1.map(v=>+v.toFixed(1)).join(" ")} ${c2.map(v=>+v.toFixed(1)).join(" ")} ${p2.map(v=>+v.toFixed(1)).join(" ")}`;
    }
    return cerrada?d+" Z":d;
  }
  const par=(f,pts)=>f(pts)+" "+f(espejo(pts));

  // ---- Las dos figuras (lado izquierdo; el derecho es su espejo) ----
  const CUERPOS={
    hombre:{
      brazo:[[168,159],[132,160],[100,161],[84,161]], brazoBajo:[[84,169],[102,169],[132,170],[164,180]],
      tronco:[[164,180],[166,198],[171,222],[170,244],[172,270],[180,300],[180,322],[186,350]],
      pieExt:[[186,350],[174,361],[192,361],[194,352]], piernaInt:[[194,352],[195,322],[195,300],[198,262],[200,252]],
      cuello:[[193,150],[192,158],[168,159]],
      pecho:[[166,182],[234,182],[232,213],[168,213]], abdomen:[[168,213],[232,213],[228,246],[172,246]],
      pelo:"M187 126 C186 112 214 112 213 126 M190 118 C193 114 197 113 200 116 M200 116 C204 112 209 114 211 119",
    },
    mujer:{
      brazo:[[171,160],[134,160],[101,161],[85,161]], brazoBajo:[[85,168],[103,168],[134,169],[167,181]],
      tronco:[[167,181],[169,198],[179,224],[168,246],[171,272],[180,300],[181,322],[187,350]],
      pieExt:[[187,350],[176,360],[192,360],[194,351]], piernaInt:[[194,351],[195,322],[196,300],[198,262],[200,253]],
      cuello:[[194,150],[193,158],[171,160]],
      pecho:[[168,183],[232,183],[230,212],[170,212]], abdomen:[[170,212],[230,212],[233,247],[167,247]],
      pelo:"M187 127 C185 110 215 110 213 127 C216 140 218 160 222 172 M187 127 C184 140 182 160 178 172 M190 116 C195 112 205 112 210 116",
      busto:"M176 197 C182 207 194 207 198 198 M202 198 C206 207 218 207 224 197",
    },
  };
  // Segunda postura (brazos en alto y piernas abiertas), solo trazo
  const POSE2={
    brazoAlto:[[168,158],[126,147],[87,134]], brazoAltoBajo:[[89,141],[128,154],[166,168]],
    piernaAbierta:[[173,250],[161,300],[149,351]], piernaAbiertaInt:[[196,253],[171,305],[159,353]],
    manoAlta:[[87,134],[82,135],[84,141],[89,141]], pieAbierto:[[149,351],[140,359],[158,360],[159,353]],
  };

  // Contorno completo (lado izquierdo + espejo) en un solo trazo
  function contorno(b){
    const izq=[...b.cuello.slice(0,2),...b.brazo,[79,165],...b.brazoBajo,...b.tronco.slice(1),...b.pieExt.slice(1),...b.piernaInt.slice(1)];
    const der=espejo(izq).reverse();
    return curva([...izq,...der.slice(1)],true);
  }
  // Zonas: franjas que se recortan con la silueta, así el brillo sigue la forma del cuerpo
  const ZONAS_RECT={
    cabeza:[[180,112,40,40]], pecho:[[158,152,84,61]], abdomen:[[158,213,84,37]],
    brazos:[[86,150,74,34],[240,150,74,34]], manos:[[60,150,28,30],[312,150,28,30]], piernas:[[150,250,100,115]],
  };
  const zonas=()=>Object.fromEntries(Object.entries(ZONAS_RECT).map(([k,rs])=>[k,rs.map(([x,y,w,h])=>`<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`).join("")]));

  // ---- Las 12 capas de detalle (una por etapa) ----
  function capas(b,figura){
    const ticks=[], hatch=[], cruz=[];
    for(let i=0;i<=8;i++){ const x=SQ.x+i*SQ.l/8; ticks.push(`M${x} ${SQ.y+SQ.l} L${x} ${SQ.y+SQ.l+(i%2?5:9)}`); const y=SQ.y+i*SQ.l/8; ticks.push(`M${SQ.x} ${y} L${SQ.x-(i%2?5:9)} ${y}`); }
    for(let y=186;y<=244;y+=6) hatch.push(`M${226+(y>212?2:0)} ${y} L${232+(y>212?2:0)} ${y-5}`);
    for(let y=262;y<=344;y+=7) hatch.push(`M${210} ${y} L${216} ${y-5}`);
    for(let x=104;x<=156;x+=7) hatch.push(`M${x} ${171} L${x+4} ${167}`);
    for(let y=186;y<=244;y+=6) cruz.push(`M${170} ${y} L${176} ${y+5}`);
    for(let y=262;y<=344;y+=7) cruz.push(`M${181} ${y} L${187} ${y+5}`, `M${213} ${y} L${219} ${y+5}`);
    const nota=(y,t,tam=6.2)=>`<text x="${400-SQ.x}" y="${y}" transform="translate(400 0) scale(-1 1)" font-size="${tam}" text-anchor="end">${t}</text>`;
    return [
      // 1 · El boceto: contorno de la figura
      null,
      // 2 · La segunda postura
      `<path d="${par(curva,POSE2.brazoAlto)} ${par(curva,POSE2.brazoAltoBajo)} ${par(curva,POSE2.piernaAbierta)} ${par(curva,POSE2.piernaAbiertaInt)} ${par(curva,POSE2.manoAlta)} ${par(curva,POSE2.pieAbierto)}"/>`,
      // 3 · Rostro y cabello
      `<path d="M194 134 L197 134 M203 134 L206 134 M200 135 L199 141 L201.5 142 M196.5 146 C198.5 147.3 201.5 147.3 203.5 146 ${b.pelo}"/>`,
      // 4 · Marcas de proporción en el cuadrado
      `<path d="${ticks.join(" ")}"/>`,
      // 5 · Músculos de pecho y abdomen
      `<path d="${figura==="mujer"?CUERPOS.mujer.busto:"M178 194 C186 204 196 202 199 195 M201 195 C204 202 214 204 222 194"} M200 212 L200 241 M187 222 L213 222 M188 232 L212 232 M200 226.5 m-1.4 0 a1.4 1.4 0 1 0 2.8 0 a1.4 1.4 0 1 0 -2.8 0"/>`,
      // 6 · Rodillas, codos y dedos
      `<path d="M183 296 C186 302 192 302 194 296 M206 296 C208 302 214 302 217 296 M124 163 C126 166 126 168 124 170 M276 163 C274 166 274 168 276 170 M76 163 L72 162 M76 166 L71 166 M76 169 L72 170 M324 163 L328 162 M324 166 L329 166 M324 169 L328 170"/>`,
      // 7 · Sombreado
      `<path d="${hatch.join(" ")}"/>`,
      // 8 · Notas en escritura especular, como en los cuadernos de Leonardo
      `<g class="vf-nota">${nota(98,"el cuerpo es medida de todas las cosas")}${nota(106,"cuatro dedos hacen un palmo, cuatro palmos un pie")}${nota(384,"tanto abre el hombre los brazos cuanto es su altura")}${nota(392,"paso a paso se sube la montaña")}</g>`,
      // 9 · Líneas guía: pecho, ingle y rodillas
      `<path class="vf-guia" d="M${SQ.x} 182 L${SQ.x+SQ.l} 182 M${SQ.x} 240 L${SQ.x+SQ.l} 240 M${SQ.x} 300 L${SQ.x+SQ.l} 300"/>`,
      // 10 · Compás: diagonales y centro
      `<path class="vf-guia" d="M${SQ.x} ${SQ.y} L${SQ.x+SQ.l} ${SQ.y+SQ.l} M${SQ.x+SQ.l} ${SQ.y} L${SQ.x} ${SQ.y+SQ.l} M${C.x-6} ${C.y} L${C.x+6} ${C.y} M${C.x} ${C.y-6} L${C.x} ${C.y+6}"/>`,
      // 11 · Sombreado cruzado
      `<path d="${cruz.join(" ")}"/>`,
      // 12 · Doble trazo y firma
      `<path d="M${C.x} ${C.y-C.r-4} a${C.r+4} ${C.r+4} 0 1 0 0.01 0 M${SQ.x-4} ${SQ.y-4} h${SQ.l+8} v${SQ.l+8} h${-SQ.l-8} Z"/><text class="vf-firma" x="${SQ.x+SQ.l-4}" y="${SQ.y+SQ.l-6}" text-anchor="end" font-size="9">Ascenso</text>`,
    ];
  }

  let serie=0;
  // figura: "hombre" | "mujer"; etapa 1–12; avance (0–1) dentro de la etapa; nivel (0–1) hacia el siguiente nivel;
  // objetivos (0–1 o null); brillo: {zona: 0–1}; zonaActiva: la seleccionada
  function svg({figura="hombre", etapa=1, avance=0, nivel=0, objetivos=null, brillo={}, zonaActiva=null, titulo="Figura de Vitruvio"}={}){
    const b=CUERPOS[figura]||CUERPOS.hombre, z=zonas(), L=capas(b,figura), id="vf"+(++serie);
    const zonasSvg=Object.entries(z).map(([k,s])=>`<g class="vf-zona${k===zonaActiva?" on":""}" data-zona="${k}" style="--b:${Math.max(0,Math.min(1,brillo[k]||0)).toFixed(3)}">${s}</g>`).join("");
    const capasSvg=L.map((c,i)=>{
      if(!c) return "";
      const n=i+1;
      if(n<=etapa) return `<g class="vf-capa" data-capa="${n}">${c}</g>`;
      if(n===etapa+1&&avance>0){
        // La capa siguiente se va trazando dentro de la etapa
        const trazo=c.replace(/<path /g,`<path pathLength="1" stroke-dasharray="${avance.toFixed(3)} 1" `);
        return `<g class="vf-capa vf-nueva" data-capa="${n}" style="opacity:${(0.35+0.65*avance).toFixed(3)}">${trazo}</g>`;
      }
      return "";
    }).join("");
    return `<svg class="vitruvio" viewBox="40 74 320 330" role="img" aria-label="${titulo}">
      <rect class="vf-papel" x="40" y="74" width="320" height="330" rx="10"/>
      <defs><clipPath id="${id}c"><path d="${contorno(b)}"/><ellipse cx="200" cy="135" rx="13.5" ry="16.5"/></clipPath>
        <filter id="${id}f" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="2.2"/></filter></defs>
      <g class="vf-zonas" clip-path="url(#${id}c)"><g filter="url(#${id}f)">${zonasSvg}</g></g>
      <circle class="vf-circulo" cx="${C.x}" cy="${C.y}" r="${C.r}"/>
      <rect class="vf-cuadrado" x="${SQ.x}" y="${SQ.y}" width="${SQ.l}" height="${SQ.l}"/>
      <circle class="vf-anillo" cx="${C.x}" cy="${C.y}" r="${C.r}" pathLength="1" stroke-dasharray="${Math.max(0,Math.min(1,nivel)).toFixed(4)} 1" transform="rotate(-90 ${C.x} ${C.y})"/>
      ${objetivos==null?"":`<path class="vf-anillo vf-obj" d="M${SQ.x+SQ.l/2} ${SQ.y} h${SQ.l/2} v${SQ.l} h${-SQ.l} v${-SQ.l} Z" pathLength="1" stroke-dasharray="${Math.max(0,Math.min(1,objetivos)).toFixed(4)} 1"/>`}
      <g class="vf-trazo">
        <ellipse cx="200" cy="135" rx="13.5" ry="16.5"/>
        <path d="${contorno(b)}"/>
        ${capasSvg}
      </g>
    </svg>`;
  }
  return {svg, ZONAS:["cabeza","pecho","brazos","manos","abdomen","piernas"]};
})();
