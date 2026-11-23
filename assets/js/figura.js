// La figura del perfil: un Hombre o una Mujer de Vitruvio dibujados para Ascenso. No es una copia de la lámina de
// Leonardo, sino un dibujo propio con el mismo canon: ocho cabezas de alto, tanto de brazos abiertos como de altura,
// el ombligo en el centro del círculo y el pubis en el centro del cuadrado; y la segunda postura (brazos en alto y
// piernas abiertas) tocando el círculo.
//
// Acabado de lámina de cuaderno: papel con grano y viñeta, tinta sepia con algo de temblor de pluma y peso de línea,
// aguada de sanguina y sombreado a plumilla que sigue las sombras (luz desde arriba a la izquierda).
//
// - Las zonas del cuerpo (cabeza, pecho, brazos, manos, abdomen, piernas) se iluminan, como una aguada, según lo cumplido.
// - El círculo es el anillo de progreso hacia el siguiente nivel; el cuadrado, el de los objetivos.
// - La lámina se completa con los años: cada etapa de 10 niveles añade una capa (segunda postura, rostro y cabello,
//   proporciones, anatomía, manos y pies, sombreado, notas en escritura especular, líneas guía, compás, sombreado
//   cruzado y el acabado final). La capa de la etapa en curso se va trazando a medida que se avanza dentro de ella.
//
// Los estilos van aquí (con los colores del tema claro como valor por defecto) para que la figura se vea igual dentro
// de la página y como imagen suelta al exportar un resumen; estilos.css solo cambia los colores del tema oscuro.
"use strict";
window.AscensoFigura=(()=>{
  const C={x:200,y:220,r:140}, SQ={x:80,y:120,l:240};           // círculo (centro en el ombligo) y cuadrado
  const f1=v=>+v.toFixed(1);
  const espejo=pts=>pts.map(([x,y])=>[400-x,y]);
  // Curva suave que pasa por los puntos (Catmull-Rom convertida a Bézier)
  function curva(pts,cerrada=false){
    const P=cerrada?[pts[pts.length-1],...pts,pts[0],pts[1]]:[pts[0],...pts,pts[pts.length-1]];
    let d="M"+pts[0].map(f1).join(" ");
    for(let i=1;i<P.length-2;i++){
      const [p0,p1,p2,p3]=[P[i-1],P[i],P[i+1],P[i+2]];
      const c1=[p1[0]+(p2[0]-p0[0])/6,p1[1]+(p2[1]-p0[1])/6], c2=[p2[0]-(p3[0]-p1[0])/6,p2[1]-(p3[1]-p1[1])/6];
      d+=` C${c1.map(f1).join(" ")} ${c2.map(f1).join(" ")} ${p2.map(f1).join(" ")}`;
    }
    return cerrada?d+" Z":d;
  }
  // Un trazo (en coordenadas del lado izquierdo) y su reflejo
  const par=d=>d+" "+reflejar(d);
  function reflejar(d){
    // Refleja una ruta con solo M, L, C, Q y A absolutas (x → 400 − x; en A, el sentido del barrido se invierte)
    return d.replace(/([MLCQA])([^MLCQAZ]*)/g,(m,cmd,args)=>{
      const n=args.trim().split(/[\s,]+/).filter(Boolean).map(Number);
      if(cmd==="A"){ const out=[]; for(let i=0;i<n.length;i+=7) out.push(n[i],n[i+1],n[i+2],n[i+3],1-n[i+4],f1(400-n[i+5]),n[i+6]); return "A"+out.join(" "); }
      return cmd+n.map((v,i)=>i%2===0?f1(400-v):v).join(" ");
    });
  }
  // Generador pseudoaleatorio con semilla: el sombreado es siempre el mismo trazo a trazo
  function azar(semilla){ let s=semilla>>>0||1; return ()=>((s=Math.imul(s^(s>>>15),2246822507)^Math.imul(s^(s>>>13),3266489909))>>>0)/4294967296; }

  // ---------------------------------------------------------------- los cuerpos (lado izquierdo; el derecho es su espejo)
  // Medidas del canon (altura 240: de 120 a 360): cabeza 1/8, hombros 1/4, mano 1/10, codo a la punta de los dedos 1/5,
  // rodilla a 1/4 del suelo. Lado izquierdo del dibujo, de arriba abajo; el derecho es su espejo.
  const CUERPOS={
    hombre:{
      cuello:[[193.2,147.8],[192.8,152.6],[191.2,155.6]],
      trapecio:[[186.4,157.4],[181.4,158.4]],
      brazoArriba:[[176.4,158.4],[171.6,157.8],[166.4,158.2],[160.6,159.4],[154.4,159.8],[146,159.4],[138,159.6],[131.4,159.9],[125.4,158.8],[119.4,158.6],[113,159.4],[107.4,160.4],[104.2,159.6],[100.6,158.6],[97.2,158.2],[95,158.6],[95.4,159.4],[92.4,160.3],[88,161.2],[84.4,161.9],[81.8,162.6]],
      punta:[80.1,163.6],
      brazoAbajo:[[81.6,165],[85.6,166.2],[90.4,167],[95.4,167.6],[100,168],[104,167.8],[107.6,167.2],[112.4,168.2],[118.6,169.4],[125,169.6],[130.4,168.8],[136,169.4],[143,170.2],[150,170.6],[156.6,171],[162.4,171.8],[167.6,173.4],[172.6,175.8]],
      tronco:[[174.8,180.2],[174.6,186],[175.4,194],[176.8,202],[178.2,210],[178.6,216],[178.2,222],[177.2,229],[176.2,236],[175.8,243]],
      piernaFuera:[[176,251],[176.6,261],[177.6,272],[179,283],[180.6,292],[181.4,298],[180.8,304],[179.6,311],[179.2,318],[180,327],[182,336],[184,343],[184.8,348]],
      pie:[[183.8,352],[183,355.6],[184,358.8],[187.4,360.5],[191.6,360.9],[195.4,360.4],[197.4,358.4]],
      piernaDentro:[[197.6,354.6],[197,350],[197.2,344],[198,334],[198.6,322],[198.2,311],[198.8,302],[198.2,293],[198.6,282],[199.2,270],[199.7,259],[200,252]],
      cabeza:[[200,150.6],[196,149.9],[192.4,147.5],[189.8,143.8],[188.3,139.6],[187.4,134],[187.6,128.6],[189.6,123.6],[193.6,120.4],[200,119.4]],
      hombro:[178,164], cadera:[187.5,246],
    },
    mujer:{
      cuello:[[194,147.6],[193.8,152.8],[192.8,155.8]],
      trapecio:[[188.4,157.8],[183.6,159]],
      brazoArriba:[[179,159.2],[174.6,158.8],[169.6,159.2],[164,160.2],[157,160.6],[149,160.4],[141,160.6],[134,160.9],[127.4,160.2],[121,160],[114.6,160.6],[108.6,161.4],[105.2,160.8],[101.8,159.8],[98.4,159.4],[96.4,159.8],[96.8,160.5],[93.4,161.2],[89,161.8],[85.4,162.4],[82.6,163]],
      punta:[81,163.9],
      brazoAbajo:[[82.6,165.2],[86.4,166.2],[91,166.8],[95.6,167.3],[100.2,167.6],[104.4,167.4],[108.4,166.8],[113.4,167.6],[119.6,168.6],[126,168.6],[131,168],[137,168.6],[144,169.2],[151,169.6],[157.6,170],[163,170.8],[167.8,172.8],[172.6,175.6]],
      tronco:[[175,179.6],[175.2,185],[175.6,191.4],[177.2,198],[179.6,205],[181,212],[180.4,219],[178,226],[175,233],[173.4,240],[173,247]],
      piernaFuera:[[173.4,255],[174.4,265],[176,276],[178.4,287],[180.4,295],[181,300],[180.6,306],[179.8,313],[179.6,320],[180.4,329],[182.2,337],[184,344],[184.8,348.6]],
      pie:[[184,352.4],[183.4,355.6],[184.4,358.6],[187.6,359.9],[191.6,360.2],[195,359.8],[197,358]],
      piernaDentro:[[197.2,354.6],[196.8,350],[197,344],[197.8,334],[198.4,322],[198,311],[198.8,302],[198.2,293],[198.8,282],[199.4,270],[199.8,260],[200,253.5]],
      cabeza:[[200,150.2],[196.4,149.6],[193,147.4],[190.4,143.8],[188.8,139.4],[187.9,134],[188.1,128.6],[190,123.8],[194,120.6],[200,119.6]],
      hombro:[180,164], cadera:[186.5,247],
    },
  };
  // El cabello: borde de la cara (desde el centro de la frente) y borde de fuera con mechones (hasta la coronilla)
  function mechones(cx,cy,rx,ry,hasta,n,amp){
    const out=[];
    for(let i=0;i<=n*4;i++){ const t=i/(n*4), th=t*hasta*Math.PI/180, b=amp*Math.abs(Math.sin(t*Math.PI*n));
      out.push([cx-(rx+b)*Math.sin(th), cy-(ry+b)*Math.cos(th)]); }
    return out.reverse();         // de abajo a la coronilla
  }
  CUERPOS.hombre.peloDentro=[[200,125.8],[195.8,125.5],[191.6,126.7],[189.2,129.3],[188.5,132.6],[188.3,135.8]];
  CUERPOS.hombre.peloPunta=[[187.6,138.4],[186.4,136.6],[185.4,139.6],[184.6,136.8]];
  CUERPOS.hombre.peloFuera=mechones(200,133.4,15.4,18,102,5,0.75).slice(1);
  CUERPOS.hombre.oreja="M188.2 134.8 C186.4 134.2 185.7 136.6 186 138.6 C186.3 140.6 187.3 141.6 188.5 141.3";
  CUERPOS.mujer.peloDentro=[[200,125],[196,124.7],[191.4,126.1],[188.8,129.4],[188,134.4],[188.2,141],[189.2,146.6],[189.8,152],[189.4,158],[188,164]];
  CUERPOS.mujer.peloPunta=[[186.4,168.6],[184.4,166.2],[182.6,169.8],[180.6,167]];
  CUERPOS.mujer.peloFuera=[[180.4,161.6],[181.6,156.4],[180.6,150.6],[181.8,144.4],[181.6,137.4],[183.2,128.6],[186.6,121.4],[192.2,116.7],[200,115.2]];
  CUERPOS.mujer.oreja="";
  // Contorno del cuerpo (sin la cabeza): de un lado del cuello al otro dando la vuelta a la figura
  function ladoIzq(b){ return [...b.cuello,...b.trapecio,...b.brazoArriba,b.punta,...b.brazoAbajo,...b.tronco,...b.piernaFuera,...b.pie,...b.piernaDentro]; }
  const cuerpo=b=>{ const iz=ladoIzq(b); return curva([...iz,...espejo(iz).reverse().slice(1)]); };
  const silueta=b=>cuerpo(b)+" Z";
  const cabeza=b=>curva([...b.cabeza,...espejo(b.cabeza).reverse().slice(1)],true);
  const pelo=b=>{ const iz=[...b.peloDentro,...b.peloPunta,...b.peloFuera]; return curva([...iz,...espejo(iz).reverse().slice(1,-1)],true); };

  // La segunda postura: los mismos miembros girados desde el hombro y la cadera, hasta tocar el círculo
  function giro(px,py,grados,escala){ return `translate(${px} ${py}) rotate(${grados}) scale(${escala}) translate(${-px} ${-py})`; }
  function brazoSuelto(b){ return curva([[b.hombro[0]+2,b.hombro[1]-6],...b.brazoArriba,b.punta,...b.brazoAbajo,[b.hombro[0]-4,b.hombro[1]+12]]); }
  function piernaAbierta(b){
    // El pie de perfil, hacia fuera: al girar la pierna queda apoyado sobre el círculo
    const tob=b.piernaFuera[b.piernaFuera.length-1], dentro=b.piernaDentro.slice(3);
    const [tx,ty]=tob, pie=[[tx-4.8,ty+3.4],[tx-11.8,ty+6.6],[tx-18.2,ty+9.2],[tx-21.4,ty+10.8],[tx-20.6,ty+12.6],[tx-14.8,ty+13.2],[tx-4.8,ty+13.4],[tx+5.2,ty+13.2],[tx+10.8,ty+12],[tx+12.6,ty+8],[tx+12.4,ty+3]];
    return curva([[b.cadera[0]-17.5,b.cadera[1]-4],...b.piernaFuera,...pie,...dentro]);
  }

  // ---------------------------------------------------------------- zonas: aguadas que siguen la forma del cuerpo
  const ZONAS_FORMA={
    cabeza:[[200,136,14,16]], pecho:[[200,186,26,18]], abdomen:[[200,226,23,19]],
    brazos:[[140,164,33,6.5],[260,164,33,6.5]], manos:[[93,164,13,5],[307,164,13,5]], piernas:[[189.5,300,12,56],[210.5,300,12,56]],
  };
  const elipses=l=>l.map(([x,y,rx,ry])=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}"/>`).join("");

  // ---------------------------------------------------------------- sombreado a plumilla
  // Rayado a mano: líneas paralelas (ángulo en grados) partidas en trazos cortos, con pequeñas variaciones de
  // separación, inclinación y largo, como hechas a plumilla. Cubren un rectángulo; la máscara decide dónde se ven.
  function trama(x0,y0,x1,y1,paso,angulo,semilla){
    const r=azar(semilla), a=angulo*Math.PI/180, cx=(x0+x1)/2, cy=(y0+y1)/2, R=Math.hypot(x1-x0,y1-y0)/2, out=[];
    for(let t=-R;t<=R;t+=paso*(0.8+r()*0.4)){
      let u=-R*(0.85+r()*0.15);
      const fin=R*(0.85+r()*0.15);
      while(u<fin){
        const largo=6+r()*10, b=a+(r()-0.5)*0.07, dx=Math.cos(b), dy=Math.sin(b), nx=-Math.sin(a), ny=Math.cos(a), o=(r()-0.5)*0.5;
        const x=cx+nx*(t+o)+Math.cos(a)*u, y=cy+ny*(t+o)+Math.sin(a)*u;
        out.push(`M${f1(x)} ${f1(y)}l${f1(dx*largo)} ${f1(dy*largo)}`);
        u+=largo+0.4+r()*1.4;
      }
    }
    return out.join("");
  }
  // El rayado solo se genera dentro de la caja de cada zona de sombra (más un margen para el difuminado)
  const hechos=new Map();
  function rayado(d,paso,angulo,semilla){
    const k=semilla+"|"+angulo; if(hechos.has(k)) return hechos.get(k);
    const t=d.split(/(?=M)/).filter(x=>x.trim()).map((sub,i)=>{
      const n=sub.match(/-?\d+(\.\d+)?/g).map(Number), xs=n.filter((_,k)=>k%2===0), ys=n.filter((_,k)=>k%2===1);
      return trama(Math.min(...xs)-5,Math.min(...ys)-5,Math.max(...xs)+5,Math.max(...ys)+5,paso,angulo,semilla+i*101);
    }).join("");
    hechos.set(k,t); return t;
  }
  // Dónde cae la sombra (luz desde arriba a la izquierda). Las máscaras se difuminan: el rayado se desvanece hacia la luz
  const SOMBRA={
    hombre:"M214 176 C222 178 227 186 226 200 C225 216 226 232 225 250 L214 250 C216 234 215 220 213 206 C212 192 213 182 214 176 Z"
      +" M226 166 L302 166 L302 172 L226 175 Z M98 167 L174 167 L174 175 L98 172 Z"
      +" M210 254 L224 254 C226 280 224 320 218 350 L208 350 C210 320 212 282 210 254 Z M194 256 L206 256 L205 352 L195 352 Z"
      +" M191 150 C196 155 204 155 209 150 L209 158 L191 158 Z"
      +" M180 188 C186 193 195 194 199 189 L199 196 L180 196 Z M201 189 C205 194 214 193 220 188 L220 196 L201 196 Z",
    mujer:"M218 176 C224 180 226 188 224 200 C222 210 226 230 228 250 L216 250 C218 232 215 218 214 206 C213 192 214 182 218 176 Z"
      +" M226 166 L302 166 L302 172 L226 175 Z M98 167 L174 167 L174 175 L98 172 Z"
      +" M211 256 L226 256 C228 282 224 320 218 350 L208 350 C210 320 213 284 211 256 Z M194 258 L206 258 L205 352 L195 352 Z"
      +" M191 150 C196 155 204 155 209 150 L209 158 L191 158 Z"
      +" M178 192 C184 198 194 200 198 194 L198 200 L178 200 Z M202 194 C206 200 216 198 222 192 L222 200 L202 200 Z",
  };
  const SOMBRA_HONDA="M220 180 C225 186 226 196 225 210 C224 226 225 240 224 250 L219 250 C220 236 220 222 219 208 C218 196 218 186 220 180 Z"
    +" M196 262 L204 262 L203 348 L197 348 Z M170 170 L178 170 L178 182 L170 182 Z M222 170 L230 170 L230 182 L222 182 Z"
    +"";

  // ---------------------------------------------------------------- los detalles de cada etapa
  // El rostro: lo de un lado (ceja y ojo, se refleja) y lo del centro (nariz, boca, barbilla)
  const OJO="M192.2 136 C193.4 134.5 195.8 134.5 197.1 135.9 M192.7 136.3 C193.9 137.2 195.8 137.1 196.8 136.2";
  const IRIS=`<circle cx="194.7" cy="135.9" r="0.78"/><circle cx="205.3" cy="135.9" r="0.78"/>`;
  const ROSTRO={
    hombre:{lado:`M191.4 133.3 C193.4 132.3 196 132.4 197.7 133.5 ${OJO} M198.6 136.6 C198.4 139 197.8 140.6 197.3 141.4`,
      centro:"M196.8 141.6 C197.6 142.8 199 142.5 200 142.9 C201 142.5 202.4 142.8 203.2 141.6 M196.4 145.4 C198 144.8 199 145.2 200 145 C201 145.2 202 144.8 203.6 145.4 M197.9 147 C199.2 147.6 200.8 147.6 202.1 147 M198.4 149.1 C199.4 149.5 200.6 149.5 201.6 149.1"},
    mujer:{lado:`M191.8 133 C193.6 131.6 196 131.6 197.5 132.8 ${OJO} M198.7 136.8 C198.5 139 198 140.6 197.6 141.3`,
      centro:"M197.2 141.6 C198 142.6 199.2 142.4 200 142.7 C200.8 142.4 202 142.6 202.8 141.6 M196.8 145.2 C198.2 144.5 199.2 145 200 144.8 C200.8 145 201.8 144.5 203.2 145.2 M197.6 146.6 C199 147.8 201 147.8 202.4 146.6"},
  };
  const PELO={
    hombre:"M199 116.6 C195.2 117.8 191.8 120.2 190 124.4 C189.4 126 189.2 127.6 189.4 129 M196 117.2 C191.6 119 188.2 122.6 186.8 127.4 C186.2 130 186.4 132.6 187.2 134.6"
      +" M192.4 118.6 C188.4 121.4 185.8 125.6 185.2 130.6 C185 133.4 185.4 135.8 186.4 137.6 M188.8 121 C186.6 124 185.4 127.6 185.2 131.4 M185.6 139.2 C184.9 138.3 185.1 137 186.1 136.6",
    mujer:"M200 115.6 L200 124.2 M198.4 116 C192.6 118 188.8 124 187.6 132 C186.6 139 187.8 144 186.6 150 C185.6 155 186.6 160 185 165"
      +" M195.4 116.8 C190.4 120.2 186.8 127.6 185.8 136 C185 142 186.4 147 185 153 C184 158 184.8 162 183 166.6"
      +" M191.4 118.8 C186.8 124 184.6 131 184 138.6 C183.6 144 184.8 149 183.4 155 C182.4 159.6 183 163.6 181.6 167.6"
      +" M187.2 122.6 C184.2 127.6 182.8 134 182.6 140.4 C182.6 145 183.4 149.6 182.2 154.4 C181.4 158 181.8 160.6 181 163.4",
  };
  const ANATOMIA={
    hombre:"M199 159.2 C195.6 158.8 192.4 158.2 188.8 158.6 C185.6 159 182.8 159.6 180.2 160.2 M198.8 157.8 L200 159.4 M192.4 147.6 C194.6 151.2 196.8 154.6 198.4 157.6"
      +" M199.4 186.2 C196 190.6 190.6 192.4 184.6 191.4 C181 190.8 178.4 188.8 176.8 186 M177.6 172.6 C180.6 170.2 183.4 166.4 185 162.6 M186.2 184.6 C186.6 185.3 187.4 185.3 187.8 184.6"
      +" M200 192 L200 214 M190.6 194.8 C190 204 190.6 214 192.2 224 C193.6 231 196 236.6 199.2 241.6 M192.4 206.4 C194.6 207 196.8 206.8 199.2 206.4"
      +" M199 219 C199.4 221.2 200.6 221.2 201 219 M177.4 195.4 C179.4 197.4 180.6 200.4 181 204 M178.8 226 C183.6 231 189 237 194.6 243.4"
      +" M171.6 159 C167.6 161.2 164.4 164.4 162.6 168.6 M129.6 160.6 C125 162.4 120 162.8 113.6 162.4",
    mujer:"M199 159.4 C195.8 159 193 158.6 189.6 159 C186.6 159.4 184 160 181.6 160.6 M198.8 158 L200 159.6 M193.2 147.8 C195.2 151.4 197.2 154.6 198.6 157.8"
      +" M177.2 185.4 C177.6 192.8 182.4 197.8 188.4 197.6 C192.8 197.4 196 194.4 197.2 190.4 M187.2 191.6 C187.6 192.3 188.4 192.3 188.8 191.6"
      +" M200 204 L200 212 M199 219 C199.4 221.2 200.6 221.2 201 219 M178.8 230 C183.2 235.6 188.6 241.4 194.6 246.4 M178.6 172.4 C181 170 183.2 166.8 184.6 163.4"
      +" M173.4 159.6 C169.6 161.6 166.6 164.6 165 168.4 M130.6 161.6 C126 163.2 121.4 163.6 115.4 163.2",
  };
  const MANOS_PIES="M186.4 291.6 C188.6 289.4 192.2 289.4 194 291.8 M186 297.4 C187.4 300.6 191.6 301.2 193.8 298.4 M196.4 284 C194.6 288 194.2 291 195 294"
    +" M190.8 304 C190.4 314 190.8 326 192 340 M197.6 309 C195.8 314 195.6 320 196.4 326 M184.6 344.6 C185.6 343.4 187 343.6 187.4 345.2"
    +" M187.2 357.6 L187 360.4 M190 357.9 L189.9 360.8 M192.8 357.9 L192.9 360.7 M195.4 357.4 L195.7 360.2"
    +" M131.2 163.4 C130.2 164.6 130.2 165.8 131 166.6 M107.8 161.2 C107.2 163 107.2 165 107.8 166.8"
    +" M96.4 162.2 C92.4 162.2 88.4 162.6 84.2 163.4 M96.8 163.9 C92.8 164.1 88.8 164.4 84.6 164.9 M97.4 165.6 C93.8 165.8 90.4 166.1 86.6 166.4"
    +" M105.6 161.2 C103.4 162.6 100.6 163 98 162.6";

  // Notas en escritura especular, como en los cuadernos: x es donde acaba la línea (se lee al revés)
  const nota=(x,y,t,tam=4.8)=>`<text x="${f1(400-x)}" y="${y}" transform="translate(400 0) scale(-1 1)" font-size="${tam}">${t}</text>`;

  // Las doce capas: [lugar, contenido]. lugar: "debajo" (geometría), "pose2", "sombra", "detalle" (sobre el contorno)
  function capas(b,figura,id){
    const ticks=[], numeros=[];
    for(let i=0;i<=32;i++){ const x=SQ.x+i*SQ.l/32, y=SQ.y+i*SQ.l/32, largo=i%4?2.2:i%8?4:6.5;
      ticks.push(`M${f1(x)} ${SQ.y+SQ.l+1.5}L${f1(x)} ${f1(SQ.y+SQ.l+1.5+largo)}`, `M${SQ.x-1.5} ${f1(y)}L${f1(SQ.x-1.5-largo)} ${f1(y)}`); }
    const ROMANOS=["I","II","III","IV","V","VI","VII","VIII"];
    for(let i=0;i<8;i++) numeros.push(`<text x="${SQ.x-9}" y="${f1(SQ.y+(i+0.5)*SQ.l/8+1.6)}" font-size="4.4" text-anchor="end">${ROMANOS[i]}</text>`);
    const sombra=(d,cl,mascara)=>`<g clip-path="url(#${id}c)"><g mask="url(#${id}${mascara})"><path class="${cl}" d="${d}"/></g></g>`;
    const tramaA=rayado(SOMBRA[figura],2,45,figura==="mujer"?11:7), tramaB=rayado(SOMBRA_HONDA,2.1,-40,figura==="mujer"?23:19);
    const brazo=giro(b.hombro[0],b.hombro[1],18,0.945), brazoD=giro(400-b.hombro[0],b.hombro[1],-18,0.945);
    const pierna=giro(b.cadera[0],b.cadera[1],22,0.965), piernaD=giro(400-b.cadera[0],b.cadera[1],-22,0.965);
    const a=brazoSuelto(b), p=piernaAbierta(b);
    return [
      // 1 · El dibujo: contorno, cabello y la geometría (siempre)
      null,
      // 2 · La segunda postura: brazos en alto y piernas abiertas, tocando el círculo
      ["pose2",`<path transform="${brazo}" d="${a}"/><path transform="${brazoD}" d="${reflejar(a)}"/><path transform="${pierna}" d="${p}"/><path transform="${piernaD}" d="${reflejar(p)}"/>`],
      // 3 · Rostro y cabello
      ["detalle",`<path class="vf-fino" d="${par(ROSTRO[figura].lado)} ${ROSTRO[figura].centro} ${par(PELO[figura])}"/><g class="vf-iris">${IRIS}</g>`],
      // 4 · Las proporciones: el cuadrado dividido en cabezas (I–VIII), palmos y dedos
      ["debajo",`<path class="vf-medida" d="${ticks.join("")}"/><g class="vf-numeros">${numeros.join("")}</g>`],
      // 5 · Anatomía: clavículas, pecho, abdomen, ombligo, ingles
      ["detalle",`<path class="vf-fino" d="${par(ANATOMIA[figura])}"/>`],
      // 6 · Rodillas, tobillos, dedos de manos y pies, codos y muñecas
      ["detalle",`<path class="vf-fino" d="${par(MANOS_PIES)}"/>`],
      // 7 · Sombreado a plumilla
      ["sombra",sombra(tramaA,"vf-trama","s1")],
      // 8 · Notas en escritura especular
      ["detalle",`<g class="vf-nota">${nota(134,88,"el cuerpo es medida de todas las cosas")}${nota(134,94.5,"cuatro dedos hacen un palmo")}${nota(352,385,"tanto abre el cuerpo los brazos cuanto es su altura")}${nota(352,391.5,"paso a paso se sube la montaña")}</g>`],
      // 9 · Líneas guía: barbilla, pecho, pubis, rodillas y el eje
      ["debajo",`<path class="vf-guia" d="M${SQ.x} 150.6 L${SQ.x+SQ.l} 150.6 M${SQ.x} 180 L${SQ.x+SQ.l} 180 M${SQ.x} 240 L${SQ.x+SQ.l} 240 M${SQ.x} 300 L${SQ.x+SQ.l} 300 M200 ${SQ.y} L200 ${SQ.y+SQ.l}"/>`],
      // 10 · El compás: diagonales, centros y los arcos que barren los brazos y las piernas
      ["debajo",`<path class="vf-guia" d="M${SQ.x} ${SQ.y} L${SQ.x+SQ.l} ${SQ.y+SQ.l} M${SQ.x+SQ.l} ${SQ.y} L${SQ.x} ${SQ.y+SQ.l}"/>`
        +`<path class="vf-compas" d="${par(`M${b.hombro[0]-96} ${b.hombro[1]} A96 96 0 0 1 ${f1(b.hombro[0]-96*Math.cos(0.42))} ${f1(b.hombro[1]-96*Math.sin(0.42))} M${b.cadera[0]-3} 360 A114 114 0 0 1 ${f1(b.cadera[0]-114*Math.sin(0.44))} ${f1(b.cadera[1]+114*Math.cos(0.44))}`)} M${C.x-5} ${C.y} L${C.x+5} ${C.y} M${C.x} ${C.y-5} L${C.x} ${C.y+5} M200 236 L200 244 M196 240 L204 240"/>`],
      // 11 · Sombreado cruzado en lo más hondo
      ["sombra",sombra(tramaB,"vf-trama vf-cruzada","s2")],
      // 12 · El acabado: doble trazo del compás, marco, firma y sello
      ["debajo",`<path class="vf-geo vf-doble" d="M${C.x} ${C.y-C.r-1.3} A${C.r+1.3} ${C.r+1.3} 0 1 0 ${C.x+0.01} ${C.y-C.r-1.3}"/>`
        +`<rect class="vf-marco" x="46" y="80" width="308" height="318" rx="4"/>`
        +`<g class="vf-sello"><circle cx="61" cy="384" r="7.6"/><circle cx="61" cy="384" r="6"/><text x="61" y="387.2" text-anchor="middle" font-size="8.4">A</text></g>`
        +`<g class="vf-firma"><text x="72" y="387" font-size="7.4">Ascenso</text></g>`],
    ];
  }

  // ---------------------------------------------------------------- estilos (tema claro por defecto)
  const ESTILO=`.vitruvio .vf-papel{fill:var(--vf-papel,#f2e8d3)}
.vitruvio .vf-grano{fill:var(--vf-grano,#7a5a36)}
.vitruvio .vf-vineta{stop-color:var(--vf-vineta,#8a6236)}
.vitruvio .vf-geo{fill:none;stroke:var(--vf-tinta,#5a3a20);stroke-width:.75;opacity:.78;stroke-linecap:round}
.vitruvio .vf-doble{stroke-width:.35;opacity:.45}
.vitruvio .vf-marco{fill:none;stroke:var(--vf-tinta,#5a3a20);stroke-width:.35;opacity:.45}
.vitruvio .vf-trazo{fill:none;stroke:var(--vf-tinta,#5a3a20);stroke-width:.85;stroke-linecap:round;stroke-linejoin:round}
.vitruvio .vf-eco{stroke-width:.4;opacity:.38}
.vitruvio .vf-pelo{stroke-width:.6}
.vitruvio .vf-cabello{fill:var(--vf-papel,#f2e8d3);fill-opacity:.94}
.vitruvio .vf-tinte{fill:rgb(var(--vf-tono-pelo,128,88,52));opacity:.13}
.vitruvio .vf-pose2 path{fill:none;stroke:var(--vf-tinta,#5a3a20);stroke-width:.75;opacity:.72;stroke-linecap:round;stroke-linejoin:round}
.vitruvio .vf-fino{fill:none;stroke:var(--vf-tinta,#5a3a20);stroke-width:.42;stroke-linecap:round;opacity:.72}
.vitruvio .vf-iris{fill:var(--vf-tinta,#5a3a20);opacity:.62}
.vitruvio .vf-trama{fill:none;stroke:var(--vf-tinta,#5a3a20);stroke-width:.3;opacity:.6;stroke-linecap:round}
.vitruvio .vf-cruzada{opacity:.5}
.vitruvio .vf-medida{fill:none;stroke:var(--vf-tinta,#5a3a20);stroke-width:.4;opacity:.6}
.vitruvio .vf-numeros text,.vitruvio .vf-nota text,.vitruvio .vf-firma text{fill:var(--vf-tinta,#5a3a20);font-family:var(--serif,Georgia),Georgia,serif;font-style:italic}
.vitruvio .vf-numeros text{opacity:.6;font-style:normal}
.vitruvio .vf-nota text{opacity:.75}
.vitruvio .vf-guia{fill:none;stroke:var(--vf-guia,#a4855f);stroke-width:.4;stroke-dasharray:2.4 1.8;opacity:.8}
.vitruvio .vf-compas{fill:none;stroke:var(--vf-guia,#a4855f);stroke-width:.45;opacity:.85}
.vitruvio .vf-carne{fill:rgb(var(--vf-carne,214,174,128));opacity:var(--vf-carne-o,.34)}
.vitruvio .vf-zona{fill:rgba(var(--vf-zona,178,74,44),calc(var(--b) * var(--vf-zona-o,.4)))}
.vitruvio .vf-sel{fill:none;stroke:var(--vf-oro,#b07d2a);stroke-width:1;stroke-dasharray:2.2 1.6}
.vitruvio .vf-sello circle{fill:none;stroke:rgb(var(--vf-zona,178,74,44));stroke-width:.7;opacity:.8}
.vitruvio .vf-sello text{fill:rgb(var(--vf-zona,178,74,44));font-family:var(--serif,Georgia),Georgia,serif;font-weight:700;opacity:.85}
.vitruvio .vf-anillo{fill:none;stroke:var(--vf-oro,#b07d2a);stroke-width:2;stroke-linecap:round}
.vitruvio .vf-perla{fill:var(--vf-oro,#b07d2a);stroke:var(--vf-papel,#f2e8d3);stroke-width:1}`;
  if(typeof document!=="undefined"&&document.head&&!document.getElementById("vf-estilo")){
    const s=document.createElement("style"); s.id="vf-estilo"; s.textContent=ESTILO; document.head.appendChild(s);
  }

  // Punto del perímetro del cuadrado a una fracción del recorrido (desde el centro de arriba, en el sentido del reloj)
  function enCuadrado(t){
    const l=SQ.l, d=((t%1)+1)%1*4*l;
    const tramos=[[SQ.x+l/2,SQ.y,1,0,l/2],[SQ.x+l,SQ.y,0,1,l],[SQ.x+l,SQ.y+l,-1,0,l],[SQ.x,SQ.y+l,0,-1,l],[SQ.x,SQ.y,1,0,l/2]];
    let r=d; for(const [x,y,dx,dy,lg] of tramos){ if(r<=lg) return [x+dx*r,y+dy*r]; r-=lg; }
    return [SQ.x+l/2,SQ.y];
  }

  let serie=0;
  // figura: "hombre" | "mujer"; etapa 1–12; avance (0–1) dentro de la etapa; nivel (0–1) hacia el siguiente nivel;
  // objetivos (0–1 o null); brillo: {zona: 0–1}; zonaActiva: la seleccionada; exportar: lleva sus estilos dentro
  function svg({figura="hombre", etapa=1, avance=0, nivel=0, objetivos=null, brillo={}, zonaActiva=null, titulo="Figura de Vitruvio", exportar=false}={}){
    if(!CUERPOS[figura]) figura="hombre";
    const b=CUERPOS[figura], id="vf"+(++serie), L=capas(b,figura,id);
    const sil=silueta(b), cab=cabeza(b), pel=pelo(b);
    // Cada capa ya alcanzada, y la siguiente a medio trazar
    const lugares={debajo:"",pose2:"",sombra:"",detalle:""};
    L.forEach((c,i)=>{
      if(!c) return;
      const n=i+1, [lugar,html]=c;
      if(n<=etapa) lugares[lugar]+=`<g data-capa="${n}">${html}</g>`;
      else if(n===etapa+1&&avance>0){
        const trazo=html.replace(/<path /g,`<path pathLength="1" stroke-dasharray="${avance.toFixed(3)} 1" `);
        lugares[lugar]+=`<g data-capa="${n}" class="vf-nueva" opacity="${(0.3+0.7*avance).toFixed(3)}">${trazo}</g>`;
      }
    });
    const zonasSvg=Object.entries(ZONAS_FORMA).map(([k,l])=>`<g class="vf-zona${k===zonaActiva?" on":""}" data-zona="${k}" style="--b:${Math.max(0,Math.min(1,brillo[k]||0)).toFixed(3)}">${elipses(l)}</g>`).join("");
    const sel=zonaActiva&&ZONAS_FORMA[zonaActiva]?`<g clip-path="url(#${id}c)" class="vf-sel">${elipses(ZONAS_FORMA[zonaActiva])}</g>`:"";
    const p=Math.max(0,Math.min(1,nivel)), ang=-Math.PI/2+p*2*Math.PI;
    const anillo=`<circle class="vf-anillo" cx="${C.x}" cy="${C.y}" r="${C.r}" pathLength="1" stroke-dasharray="${p.toFixed(4)} 1" transform="rotate(-90 ${C.x} ${C.y})"${p<0.004?' stroke-opacity="0"':""}/>`
      +(p>0.004&&p<0.996?`<circle class="vf-perla" cx="${f1(C.x+C.r*Math.cos(ang))}" cy="${f1(C.y+C.r*Math.sin(ang))}" r="2.6"/>`:"");
    let obj="";
    if(objetivos!=null){
      const o=Math.max(0,Math.min(1,objetivos)), [ox,oy]=enCuadrado(o);
      // Sin progreso no se pinta nada (el extremo redondo de un trazo vacío dejaría un punto sobre la cabeza)
      obj=`<path class="vf-anillo vf-obj" d="M${SQ.x+SQ.l/2} ${SQ.y} h${SQ.l/2} v${SQ.l} h${-SQ.l} v${-SQ.l} Z" pathLength="1" stroke-dasharray="${o.toFixed(4)} 1"${o<0.004?' stroke-opacity="0"':""}/>`
        +(o>0.004&&o<0.996?`<circle class="vf-perla" cx="${f1(ox)}" cy="${f1(oy)}" r="2.3"/>`:"");
    }
    // Las esquinas del cuadrado se pasan un poco, como en un dibujo de taller
    const geo=`<circle class="vf-geo" cx="${C.x}" cy="${C.y}" r="${C.r}"/>`
      +`<path class="vf-geo" d="M${SQ.x-5} ${SQ.y} L${SQ.x+SQ.l+5} ${SQ.y} M${SQ.x-5} ${SQ.y+SQ.l} L${SQ.x+SQ.l+5} ${SQ.y+SQ.l} M${SQ.x} ${SQ.y-5} L${SQ.x} ${SQ.y+SQ.l+5} M${SQ.x+SQ.l} ${SQ.y-5} L${SQ.x+SQ.l} ${SQ.y+SQ.l+5}"/>`;
    const contorno=cuerpo(b)+" "+cab;
    return `<svg class="vitruvio" viewBox="40 74 320 330"${exportar?` xmlns="http://www.w3.org/2000/svg" width="640" height="660"`:""} role="img" aria-label="${titulo}">
      ${exportar?`<style>${ESTILO}</style>`:""}
      <defs>
        <clipPath id="${id}c"><path d="${sil}"/><path d="${cab}"/></clipPath>
        <radialGradient id="${id}v" cx="50%" cy="46%" r="72%"><stop offset="55%" class="vf-vineta" stop-opacity="0"/><stop offset="100%" class="vf-vineta" stop-opacity=".22"/></radialGradient>
        <filter id="${id}g" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.6 1.05"/><feComposite in="SourceGraphic" operator="in"/></filter>
        <filter id="${id}m" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".018" numOctaves="3" seed="9"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.25"/><feComposite in="SourceGraphic" operator="in"/></filter>
        <filter id="${id}p" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".06" numOctaves="2" seed="2"/><feDisplacementMap in="SourceGraphic" scale="1.3" xChannelSelector="R" yChannelSelector="G"/></filter>
        <filter id="${id}w" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="5.5" result="b"/><feTurbulence type="fractalNoise" baseFrequency=".04" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .7 .45"/><feComposite in="b" operator="in"/></filter>
        <filter id="${id}d"><feGaussianBlur stdDeviation="5"/></filter>
        <mask id="${id}s1" maskUnits="userSpaceOnUse" x="40" y="74" width="320" height="330"><path d="${SOMBRA[figura]}" fill="#fff" filter="url(#${id}d)"/></mask>
        <mask id="${id}s2" maskUnits="userSpaceOnUse" x="40" y="74" width="320" height="330"><path d="${SOMBRA_HONDA}" fill="#fff" filter="url(#${id}d)"/></mask>
        <mask id="${id}2" maskUnits="userSpaceOnUse" x="40" y="74" width="320" height="330"><rect x="40" y="74" width="320" height="330" fill="#fff"/><path d="${sil}" fill="#000" stroke="#000" stroke-width="2.4"/><path d="${cab} ${pel}" fill="#000" stroke="#000" stroke-width="2.4"/></mask>
      </defs>
      <rect class="vf-papel" x="40" y="74" width="320" height="330" rx="10"/>
      <rect class="vf-grano" x="40" y="74" width="320" height="330" rx="10" filter="url(#${id}m)" opacity=".07"/>
      <rect class="vf-grano" x="40" y="74" width="320" height="330" rx="10" filter="url(#${id}g)" opacity=".16"/>
      <rect x="40" y="74" width="320" height="330" rx="10" fill="url(#${id}v)"/>
      ${lugares.debajo}
      <g filter="url(#${id}p)">${geo}</g>
      <g clip-path="url(#${id}c)"><path class="vf-carne" d="${sil} ${cab}" filter="url(#${id}w)"/><g class="vf-zonas" filter="url(#${id}w)">${zonasSvg}</g></g>
      ${sel}
      <g class="vf-pose2" mask="url(#${id}2)">${lugares.pose2}</g>
      ${lugares.sombra}
      <g filter="url(#${id}p)">
        <path class="vf-trazo" d="${contorno}"/>
        <path class="vf-trazo vf-eco" transform="translate(.45 .5)" d="${contorno}"/>
        <path class="vf-cabello" d="${pel}"/><path class="vf-tinte" d="${pel}" filter="url(#${id}w)"/><path class="vf-trazo vf-pelo" d="${pel}"/>${b.oreja?`<path class="vf-trazo vf-pelo" d="${par(b.oreja)}"/>`:""}
      </g>
      ${lugares.detalle}
      ${anillo}${obj}
    </svg>`;
  }
  return {svg, ESTILO, ZONAS:["cabeza","pecho","brazos","manos","abdomen","piernas"]};
})();
