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
    // Refleja una ruta con M, L, C, Q y A (x → 400 − x) y sus versiones relativas (dx → −dx); en A, el barrido se invierte
    return d.replace(/([MLCQAmlcqa])([^MLCQAZmlcqaz]*)/g,(m,cmd,args)=>{
      const n=args.trim().split(/[\s,]+/).filter(Boolean).map(Number), rel=cmd===cmd.toLowerCase(), x=v=>rel?f1(-v):f1(400-v);
      if(cmd==="A"||cmd==="a"){ const out=[]; for(let i=0;i<n.length;i+=7) out.push(n[i],n[i+1],n[i+2],n[i+3],1-n[i+4],x(n[i+5]),n[i+6]); return cmd+out.join(" "); }
      return cmd+n.map((v,i)=>i%2===0?x(v):v).join(" ");
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
      brazoArriba:[[176.4,158.4],[171.6,157.8],[166.4,158.2],[160.6,159.4],[154.4,159.8],[146,159.4],[138,159.6],[131.4,159.9],[125.4,158.8],[119.4,158.6],[113,159.4],[107.4,160.4],[104.2,159.6],[100.6,158.6],[97.2,158.2],[95,158.6],[95.4,159.4],[92.4,160.3],[88,160.8],[84.6,161.2],[82,161.8],[80.6,162.6]],
      punta:[80,163.9],
      brazoAbajo:[[80.6,165.1],[82.6,165.9],[86.4,166.5],[90.4,167],[95.4,167.6],[100,168],[104,167.8],[107.6,167.2],[112.4,168.2],[118.6,169.4],[125,169.6],[130.4,168.8],[136,169.4],[143,170.2],[150,170.6],[156.6,171],[162.4,171.8],[167.6,173.4],[172.6,175.8]],
      tronco:[[174.8,180.2],[174.6,186],[175.4,194],[176.8,202],[178.2,210],[178.6,216],[178.2,222],[177.2,229],[176.2,236],[175.8,243]],
      piernaFuera:[[176,251],[176.6,261],[177.6,272],[179,283],[180.6,292],[181.4,298],[180.8,304],[179.6,311],[179.2,318],[180,327],[182,336],[184,343],[184.8,348]],
      pie:[[183.4,351.6],[180.8,354.4],[178.6,357],[178.6,359.2],[181,360.2],[185,360.5],[189.4,360.5],[193.4,360.2],[196.8,358.8]],
      piernaDentro:[[197.6,354.6],[197,350],[197.2,344],[198,334],[198.6,322],[198.2,311],[198.8,302],[198.2,293],[198.6,282],[199.2,270],[199.7,259],[200,252]],
      cabeza:[[200,150.6],[196,149.9],[192.4,147.5],[189.8,143.8],[188.3,139.6],[187.4,134],[187.6,128.6],[189.6,123.6],[193.6,120.4],[200,119.4]],
      hombro:[178,164], cadera:[187.5,246],
    },
    mujer:{
      cuello:[[194,147.6],[193.8,152.8],[192.8,155.8]],
      trapecio:[[188.4,157.8],[183.6,159]],
      brazoArriba:[[179,159.2],[174.6,158.8],[169.6,159.2],[164,160.2],[157,160.6],[149,160.4],[141,160.6],[134,160.9],[127.4,160.2],[121,160],[114.6,160.6],[108.6,161.4],[105.2,160.8],[101.8,159.8],[98.4,159.4],[96.4,159.8],[96.8,160.5],[93.4,161.2],[89,161.6],[85.6,162],[83,162.5],[81.6,163.2]],
      punta:[81,164.3],
      brazoAbajo:[[81.6,165.4],[83.6,166.1],[87.4,166.5],[91,166.8],[95.6,167.3],[100.2,167.6],[104.4,167.4],[108.4,166.8],[113.4,167.6],[119.6,168.6],[126,168.6],[131,168],[137,168.6],[144,169.2],[151,169.6],[157.6,170],[163,170.8],[167.8,172.8],[172.6,175.6]],
      tronco:[[175,179.6],[175.2,185],[175.6,191.4],[177.2,198],[179.6,205],[181,212],[180.4,219],[178,226],[175,233],[173.4,240],[173,247]],
      piernaFuera:[[173.4,255],[174.4,265],[176,276],[178.4,287],[180.4,295],[181,300],[180.6,306],[179.8,313],[179.6,320],[180.4,329],[182.2,337],[184,344],[184.8,348.6]],
      pie:[[183.6,352],[181.4,354.6],[179.4,357.2],[179.4,359.2],[181.8,360.1],[185.6,360.4],[189.6,360.4],[193.4,360],[196.6,358.6]],
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
  CUERPOS.mujer.peloPunta=[[186.8,167.4],[184.4,169.6],[181.6,168.6]];
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
    const r=azar(semilla), a=angulo*Math.PI/180, cx=(x0+x1)/2, cy=(y0+y1)/2, R=Math.hypot(x1-x0,y1-y0)/2, out=[[],[],[]];
    for(let t=-R;t<=R;t+=paso*(0.8+r()*0.4)){
      let u=-R*(0.85+r()*0.15);
      const fin=R*(0.85+r()*0.15);
      while(u<fin){
        const largo=6+r()*10, b=a+(r()-0.5)*0.07, dx=Math.cos(b), dy=Math.sin(b), nx=-Math.sin(a), ny=Math.cos(a), o=(r()-0.5)*0.5;
        const x=cx+nx*(t+o)+Math.cos(a)*u, y=cy+ny*(t+o)+Math.sin(a)*u;
        out[Math.floor(r()*3)].push(`M${f1(x)} ${f1(y)}l${f1(dx*largo)} ${f1(dy*largo)}`);
        u+=largo+0.4+r()*1.4;
      }
    }
    return out.map(l=>l.join(""));
  }
  // El rayado solo se genera dentro de la caja de cada zona de sombra (más un margen para el difuminado)
  const hechos=new Map();
  function rayado(d,paso,angulo,semilla){
    const k=semilla+"|"+angulo; if(hechos.has(k)) return hechos.get(k);
    const t=["","",""];
    d.split(/(?=M)/).filter(x=>x.trim()).forEach((sub,i)=>{
      const n=sub.match(/-?\d+(\.\d+)?/g).map(Number), xs=n.filter((_,k)=>k%2===0), ys=n.filter((_,k)=>k%2===1);
      trama(Math.min(...xs)-5,Math.min(...ys)-5,Math.max(...xs)+5,Math.max(...ys)+5,paso,angulo,semilla+i*101).forEach((x,k)=>{ t[k]+=x; });
    });
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
  const elipseR=(x,y,rx,ry)=>`M${f1(x-rx)} ${y} A${rx} ${ry} 0 1 0 ${f1(x+rx)} ${y} A${rx} ${ry} 0 1 0 ${f1(x-rx)} ${y} Z`;
  // El rostro, con líneas finas y tono: párpados, iris con brillo, cejas pelo a pelo, nariz, labios. «lado» se refleja.
  function cejas(figura){
    const out=[], hombre=figura==="hombre";
    for(let i=0;i<11;i++){
      const t=i/10, x=191.2+t*6.6, y=133.5-(hombre?0.9:1.5)*Math.sin(Math.PI*(0.2+t*0.75))+(hombre?0:0.2), l=hombre?1.5-t*0.5:1.2-t*0.4;
      out.push(`M${f1(x)} ${f1(y+0.4)}l${f1(-l*0.75)} ${f1(-l*0.45)}`);
    }
    return out.join("");
  }
  const ROSTRO={
    hombre:{
      fuerte:"M192 136.1 C193.1 134.5 195.7 134.2 197.3 135.7 M196.5 145.55 C197.8 145.85 199 145.95 200 145.85",
      lado:"M192.6 134.9 C193.9 133.7 196 133.6 197.1 134.6 M192.7 136.5 C193.9 137.3 195.8 137.3 196.9 136.4 M198.5 136.8 C198.3 138.6 197.9 140.2 197.4 141.2"
        +" M197.2 141.3 C196.4 142.3 196.8 143.3 198 143.2 M198.6 143 C199 143.3 199.4 143.3 199.7 143.1 M199.4 143.6 L199.5 144.5"
        +" M196.4 145.4 C197.6 145 198.6 144.5 199.3 144.7 C199.6 144.8 199.8 144.7 200 144.55 M197.6 146.5 C198.5 147.3 199.3 147.5 200 147.5 M187.2 136.4 C186.6 137.4 186.8 139 187.6 139.8",
      tono:elipseR(194.6,134.4,3.4,1.6)+" "+elipseR(194.7,137.6,2.6,.8),
      tonoCentro:"M201.4 136.6 C201.8 139 202.4 140.8 202.8 142.4 L201.8 142.6 C201.4 141 200.8 139 200.6 136.6 Z "+elipseR(200,143.7,2.2,.6)+" "+elipseR(200,148.3,2.4,.7)+" "+elipseR(207.4,141.6,2.6,4.2)+" M193 149.4 C196 152.2 204 152.2 207 149.4 L207 153 C204 155.4 196 155.4 193 153 Z",
      luz:elipseR(197,128,5,2.5)+" "+elipseR(199.6,138.6,.8,2.6)+" "+elipseR(192.4,139.8,2.4,1.5)+" "+elipseR(199.4,149.2,1.7,.8),
    },
    mujer:{
      fuerte:"M192 136 C193.1 134.3 195.8 134 197.3 135.6 M196.7 145.4 C197.9 145.7 199 145.8 200 145.7",
      lado:"M192.6 134.7 C193.9 133.4 196 133.3 197.1 134.4 M192.7 136.4 C193.9 137.2 195.8 137.2 196.9 136.3 M198.6 137 C198.5 138.8 198.1 140.3 197.7 141.2"
        +" M197.5 141.3 C196.8 142.2 197.2 143.1 198.2 143 M198.7 142.8 C199.1 143.1 199.4 143.1 199.7 142.9 M199.4 143.5 L199.5 144.4"
        +" M196.6 145.2 C197.8 144.6 198.7 144.2 199.3 144.4 C199.6 144.5 199.8 144.4 200 144.3 M197.2 146.4 C198.2 147.8 199.2 148.1 200 148.1"
        +" M192.3 135.3 l-.7 -.7 M192.9 134.8 l-.6 -.8 M193.6 134.5 l-.4 -.8",
      tono:elipseR(194.6,134.3,3.4,1.5)+" "+elipseR(194.7,137.5,2.4,.7),
      tonoCentro:"M201.4 137 C201.8 139.2 202.2 140.8 202.6 142.2 L201.7 142.4 C201.3 141 200.8 139.2 200.6 137 Z "+elipseR(200,143.5,2,.55)+" "+elipseR(200,149,2.2,.6)+" "+elipseR(207,141.8,2.4,4)+" M193.4 149.2 C196.2 151.8 203.8 151.8 206.6 149.2 L206.6 152.6 C203.8 155 196.2 155 193.4 152.6 Z",
      luz:elipseR(197,128.2,5,2.4)+" "+elipseR(199.6,138.8,.7,2.4)+" "+elipseR(192.6,140,2.4,1.5)+" "+elipseR(199.4,149.6,1.6,.7)+" "+elipseR(198.6,146.8,1.2,.45),
    },
  };
  const IRIS=(x,y)=>`<circle class="vf-iris" cx="${x}" cy="${y}" r="0.98"/><circle class="vf-pupila" cx="${x}" cy="${y}" r="0.44"/><circle class="vf-brillo" cx="${f1(x-0.32)}" cy="${f1(y-0.36)}" r="0.22"/>`;
  // El cabello hebra a hebra: el hombre, ondas que bajan desde la coronilla; la mujer, raya al medio y melena ondulada
  function hebras(figura){
    const out=[];
    if(figura==="hombre"){
      for(let k=0;k<=13;k++){
        const f=k/13, pts=[];
        for(let g=3+f*5; g<=100-f*14; g+=6){
          const th=g*Math.PI/180, r=12.9+f*2.6+0.5*Math.sin(g*0.17+k*1.7);
          pts.push([200-r*Math.sin(th), 133.4-r*1.17*Math.cos(th)]);
        }
        if(pts.length>2) out.push(curva(pts));
      }
      for(let k=0;k<4;k++) out.push(curva([[198.4-k*2.4,126.2],[197-k*2.8,122.4],[195.2-k*3.2,119]]));
      out.push("M185.6 139.4 C184.8 138.4 185 137 186.1 136.6 M187.4 138.2 C186.8 137.4 187 136.4 187.8 136.2");
    }else{
      // Cada hebra se interpola entre la que sigue el nacimiento del pelo (dentro) y la que sigue el borde (fuera)
      const dentro=[[200,124.4],[195.6,124.7],[191.2,126.3],[188.8,129.6],[188.2,134.8],[188.4,140.6]];
      const fuera=[[200,115.8],[194.6,116.4],[189,118.8],[185,123.6],[182.8,130.4],[181.9,138.2]];
      const r=azar(31);
      for(let k=0;k<=15;k++){
        const f=Math.min(1,Math.max(0,k/15+(r()-0.5)*0.05)), pts=dentro.map(([x,y],i)=>[x+(fuera[i][0]-x)*f, y+(fuera[i][1]-y)*f]);
        const fin=154+r()*12, desde=r()<0.35?1:0;
        for(let y=145;y<=fin;y+=4) pts.push([188.8-f*7.8-(y-140)*0.05+0.7*Math.sin((y-140)/4.6+f*0.5),y]);
        out.push(curva(pts.slice(desde)));
      }
    }
    return out.join(" ");
  }

  // Anatomía «del natural»: los músculos se sugieren con sombras y luces suaves (lado izquierdo; se reflejan), y solo
  // quedan unas pocas líneas finas y partidas, como en un estudio a la sanguina
  const elip=(x,y,rx,ry)=>`M${x-rx} ${y} A${rx} ${ry} 0 1 0 ${x+rx} ${y} A${rx} ${ry} 0 1 0 ${x-rx} ${y} Z`;
  const ANATOMIA={
    hombre:{
      sombra:"M181 161.6 C186 160.6 192 160.6 198.6 161.6 L198.6 163 C192 162.2 186 162.4 181 163.4 Z"
        +" M177 186.8 C181 191.6 189 194.2 199 190.6 L199 193.4 C189 197 181 194.6 176.6 189 Z"
        +" M184.4 162.4 C182.6 166.6 180.6 170 177.8 173.2 L176.8 172.6 C179.4 169.4 181.4 166 183.2 162.2 Z"
        +" M190.4 196 C189.8 205 190.4 214 191.8 223 C193 230 195.4 236 198.6 241.4 L197.6 242 C194.2 236.6 191.8 230.4 190.6 223 C189.2 214 188.8 205 189.4 196 Z"
        +" M191.4 206 C194 206.8 196.6 206.6 199.2 206 L199.2 207.2 C196.6 207.8 194 208 191.4 207.2 Z M191.8 196.6 C194.2 197.4 196.8 197.2 199.2 196.6 L199.2 197.8 C196.8 198.4 194.2 198.6 191.8 197.8 Z"
        +" M178.6 227 C183.4 232 188.6 237.6 194.4 243.6 L193.4 244.4 C187.6 238.6 182.4 233 177.6 228 Z"
        +" M176.2 194 C177.8 195 179 196.4 179.6 198 L179 198.4 C178.2 197 177 195.8 175.8 195 Z M177 199.8 C178.6 200.8 179.8 202.2 180.4 203.8 L179.8 204.2 C179 202.8 177.8 201.6 176.6 200.8 Z"
        +" M170.4 159.6 C166.6 161.6 163.8 164.6 162.2 168.6 L161.2 168.2 C162.8 164 165.6 160.8 169.6 158.8 Z"
        +" M128.8 161.4 C124.4 163 119.6 163.4 113.8 163 L113.8 164 C119.6 164.4 124.6 164 129 162.4 Z"
        +" M184.6 300 C186.8 303.2 191.2 303.6 194.2 300.4 L194.2 302.2 C191 305.4 186.8 305 184.4 301.6 Z"
        +" M196.8 282 C194.4 287 194 291 195 294.6 L194 295 C192.8 291.2 193.2 286.6 195.8 281.6 Z"
        +" M195.6 306 C194 314 193.8 322 194.8 330 L194 330.2 C192.8 322 193 314 194.8 306 Z "+elip(185.8,345,1.4,1.8),
      centro:"M199.4 166 L200.6 166 L200.6 188 L199.4 188 Z M199.5 196 L200.5 196 L200.5 216 L199.5 216 Z "+elip(200,220,0.9,1.4),
      luz:elip(187,178,7,4.5)+" "+elip(170,161,5,2.2)+" "+elip(145,161.6,12,1.4)+" "+elip(118,161,8,1.2)+" "+elip(194.6,212,3,12)+" "+elip(186.4,272,5,16)+" "+elip(190,295,3.2,3.6)+" "+elip(189.4,322,3,12),
      lineas:"M199 159.4 C196 159 193.4 158.6 190.4 158.8 M186.6 159.2 C184.6 159.4 182.6 159.8 180.6 160.2 M197.6 189.6 C194 191.6 189.6 192.4 185 191.6 M199 219 C199.4 221.2 200.6 221.2 201 219",
    },
    mujer:{
      sombra:"M182 162 C187 161.2 192.6 161.2 198.6 162 L198.6 163.2 C192.6 162.6 187 162.6 182 163.6 Z"
        +" M177.4 191 C179.4 197 185 200.4 191.6 199.6 C194.6 199.2 196.8 197.6 197.8 195 L198 197.4 C196.8 200 194.4 201.6 191.6 202 C184.6 202.6 178.6 199 176.6 192.4 Z"
        +" M180.6 206 C182.6 212 182.6 220 180.4 228 L179.2 227.6 C181.2 220 181.2 212 179.4 206.4 Z"
        +" M179.2 231 C183.6 236.6 188.6 241.8 194.4 246.4 L193.6 247.2 C187.6 242.8 182.4 237.6 178 232 Z"
        +" M172.6 160.2 C169 162 166.4 164.8 165 168.6 L164 168.2 C165.4 164.2 168 161.2 171.8 159.4 Z"
        +" M130 162.2 C125.8 163.6 121.2 164 115.6 163.6 L115.6 164.6 C121.2 165 126 164.6 130.2 163.2 Z"
        +" M184.6 300.4 C186.8 303.4 191.2 303.8 194.2 300.8 L194.2 302.6 C191 305.6 186.8 305.2 184.4 302 Z"
        +" M196.6 283 C194.6 287.6 194.2 291.2 195 294.6 L194 295 C193 291.4 193.4 287 195.6 282.6 Z"
        +" M195.6 306 C194 314 193.8 322 194.8 330 L194 330.2 C192.8 322 193 314 194.8 306 Z "+elip(185.8,345.2,1.3,1.7),
      centro:"M199.6 204 L200.4 204 L200.4 214 L199.6 214 Z "+elip(200,220,0.9,1.4),
      luz:elip(187.4,187,7.4,6)+" "+elip(172,161.4,4.4,2)+" "+elip(146,162,11,1.3)+" "+elip(119,161.6,7,1.1)+" "+elip(195,214,4,9)+" "+elip(185.6,274,6,16)+" "+elip(190,295.6,3.2,3.6)+" "+elip(189.4,322,3,12),
      lineas:"M199 159.6 C196.2 159.2 193.6 158.9 190.8 159 M187 159.4 C185.2 159.6 183.4 160 181.6 160.4 M178 191.4 C179.6 196.6 184.4 199.6 189.8 199.4 M199 219 C199.4 221.2 200.6 221.2 201 219",
    },
  };
  // Manos y pies: dedos con nudillos y uñas, el pulgar, los dedos de los pies, tobillos, tendones; y rodillas, codos y muñecas
  const MANOS_PIES={
    lineas:"M186.4 291.6 C188.6 289.4 192.2 289.4 194 291.8 M186 297.4 C187.4 300.6 191.6 301.2 193.8 298.4"
      +" M183.8 343.4 C185.2 342.6 186.8 343.2 187.2 345 M195.6 341.8 C196.4 341.2 197 341.6 197.2 342.6"
      +" M189 350.4 C188.2 352.6 187.2 354.6 186 356.6 M192.2 350.8 C191.8 353 191.4 355 190.8 357"
      +" M182.4 357.4 C181.9 358.4 181.8 359.4 182 360.1 M185.2 357.8 C184.9 358.8 184.9 359.7 185.1 360.4 M188.2 358 C188 359 188.1 359.8 188.3 360.4 M191.6 357.8 C191.6 358.8 191.8 359.6 192 360.2"
      +" M194.6 358.4 C193.8 358.7 193.7 359.5 194.3 359.9 M189.9 359.1 C189.5 359.4 189.5 359.9 189.9 360.1 M186.6 359.1 C186.2 359.4 186.2 359.9 186.6 360.1"
      +" M131.2 163.4 C130.2 164.6 130.2 165.8 131 166.6 M107.8 161.2 C107.2 163 107.2 165 107.8 166.8"
      +" M96.2 162.1 C92.2 162.2 87.8 162.6 83.4 163.2 M96.6 163.8 C92.6 164 88.2 164.3 82.4 164.5 M97.2 165.5 C93.6 165.7 90.2 165.9 86.6 166.1"
      +" M91.4 160.9 C91.1 161.4 91.1 161.9 91.3 162.3 M86.8 161.7 C86.5 162.2 86.5 162.7 86.7 163.1 M91 163.4 C90.8 163.8 90.8 164.2 91 164.6 M86.6 163.9 C86.4 164.3 86.4 164.7 86.6 165.1 M91.6 165.1 C91.4 165.5 91.4 166 91.6 166.3"
      +" M84.2 161.9 C83.4 162.2 83.2 162.7 83.6 163.1 M82.4 163.4 C81.7 163.6 81.5 164.1 81.9 164.5 M84.4 164.9 C83.7 165.2 83.6 165.6 84 166"
      +" M105 160.7 C102.6 161.9 99.6 162.3 96.6 161.8 M96.6 158 C95.9 158.3 95.8 158.9 96.3 159.3 M101.2 159.2 C100.9 159.7 100.9 160.2 101.1 160.6",
    tono:"M96.2 162.5 C92.2 162.6 87.8 163 83.4 163.6 L83.4 164.2 C87.8 163.6 92.2 163.2 96.2 163.1 Z M96.6 164.2 C92.6 164.4 88.2 164.7 82.4 164.9 L82.6 165.4 C88.2 165.2 92.6 164.9 96.6 164.8 Z"
      +" M105 161.2 C102.6 162.4 99.6 162.8 96.6 162.3 L96.6 163 C99.6 163.4 102.6 163 105 161.8 Z"
      +" M182.6 357.6 L183 357.6 L182.6 360.2 L182.2 360.2 Z M185.4 358 L185.8 358 L185.6 360.4 L185.2 360.4 Z M188.4 358.2 L188.8 358.2 L188.7 360.4 L188.3 360.4 Z M191.8 358 L192.2 358 L192.3 360.2 L191.9 360.2 Z",
  };

  // Estudio al margen: una cabeza de perfil con el rostro dividido en tres partes iguales
  const ESTUDIO={
    trazo:"M300 87.2 C305 87 309.4 89.6 310.8 94 C312 98 311.4 102.2 309 105 C307.6 106.6 306.6 108.6 306.4 111 L306.6 116"
      +" M300 87.2 C295.4 87.4 292.2 89.6 291.2 92.6 C290.4 94.8 290 96.6 289.8 98.4 C289.4 99.8 288.6 101.2 287.2 102.8 C286.8 103.4 287.2 104 288.2 104.2"
      +" C288.8 104.4 288.8 105 288.4 105.4 C288.8 105.8 289.4 106 289.2 106.6 C288.8 107.2 288.8 107.8 289.4 108.4 C289.8 109.4 289.8 110.4 291 111"
      +" C293.4 111.6 296.4 111.2 298.6 109.8 M295.6 112.2 L295 116.4",
    fino:"M300.2 100.6 C301.4 99.8 302.6 100.4 302.6 101.8 C302.6 103.2 301.4 103.8 300.4 103.2 M290.8 99.4 C291.6 99 292.4 99.2 292.8 99.8 M289 106 L291 106.1"
      +" M293 89.4 C297 90 301 92 304 95.4 M292.4 91 C296 92 299.6 94.2 302 97",
    guias:"M284 92.4 L314 92.4 M284 98.6 L314 98.6 M284 104.2 L314 104.2 M284 111 L314 111",
  };
  // Sello de lacre con el lema alrededor
  const sello=(id,x,y)=>`<g class="vf-sello"><path class="vf-lacre" style="fill:url(#${id}cera)" d="${elipseR(x,y,8.6,8.3)}" filter="url(#${id}sl)"/>`
    +`<circle class="vf-sello-aro" cx="${x}" cy="${y}" r="6.6"/><path id="${id}la" d="M${x-5.4} ${y} A5.4 5.4 0 1 1 ${x+5.4} ${y} A5.4 5.4 0 1 1 ${x-5.4} ${y}" fill="none"/>`
    +`<text class="vf-sello-lema" font-size="1.9"><textPath href="#${id}la">ASCENSO · PASO A PASO · ASCENSO ·</textPath></text>`
    +`<text class="vf-sello-letra" x="${x}" y="${y+2.6}" text-anchor="middle" font-size="7.4">A</text></g>`;

  // Notas en escritura especular, como en los cuadernos: x es donde acaba la línea (se lee al revés)
  const nota=(x,y,t,tam=4.8)=>`<text x="${f1(400-x)}" y="${y}" transform="translate(400 0) scale(-1 1)" font-size="${tam}">${t}</text>`;

  // Las doce capas: [lugar, contenido]. lugar: "debajo" (geometría), "pose2", "sombra", "detalle" (sobre el contorno)
  function capas(b,figura,id,pel){
    const ticks=[], numeros=[];
    for(let i=0;i<=32;i++){ const x=SQ.x+i*SQ.l/32, y=SQ.y+i*SQ.l/32, largo=i%4?2.2:i%8?4:6.5;
      ticks.push(`M${f1(x)} ${SQ.y+SQ.l+1.5}L${f1(x)} ${f1(SQ.y+SQ.l+1.5+largo)}`, `M${SQ.x-1.5} ${f1(y)}L${f1(SQ.x-1.5-largo)} ${f1(y)}`); }
    const ROMANOS=["I","II","III","IV","V","VI","VII","VIII"];
    for(let i=0;i<8;i++) numeros.push(`<text x="${SQ.x-9}" y="${f1(SQ.y+(i+0.5)*SQ.l/8+1.6)}" font-size="4.4" text-anchor="end">${ROMANOS[i]}</text>`);
    const sombra=(d,cl,mascara)=>`<g clip-path="url(#${id}c)"><g mask="url(#${id}${mascara})">${d.map((x,k)=>`<path class="${cl} vf-tinta${k}" d="${x}"/>`).join("")}</g></g>`;
    const tramaA=rayado(SOMBRA[figura],2,45,figura==="mujer"?11:7), tramaB=rayado(SOMBRA_HONDA,2.1,-40,figura==="mujer"?23:19);
    const brazo=giro(b.hombro[0],b.hombro[1],18,0.945), brazoD=giro(400-b.hombro[0],b.hombro[1],-18,0.945);
    const pierna=giro(b.cadera[0],b.cadera[1],22,0.965), piernaD=giro(400-b.cadera[0],b.cadera[1],-22,0.965);
    const a=brazoSuelto(b), p=piernaAbierta(b);
    return [
      // 1 · El dibujo: contorno, cabello y la geometría (siempre)
      null,
      // 2 · La segunda postura: brazos en alto y piernas abiertas, tocando el círculo
      ["pose2",(()=>{
        const miembros=[[brazo,a],[brazoD,reflejar(a)],[pierna,p],[piernaD,reflejar(p)]];
        return miembros.map(([t,d])=>`<path class="vf-p2-carne" transform="${t}" d="${d}"/><path class="vf-p2-sombra" transform="${t}" d="${d}" filter="url(#${id}vs)"/>`).join("")
          +miembros.map(([t,d])=>`<path class="vf-p2-linea" transform="${t}" d="${d}"/>`).join("");
      })()],
      // 3 · Rostro y cabello
      ["detalle",`<g clip-path="url(#${id}c)"><path class="vf-t-sombra vf-t-cara" d="${par(ROSTRO[figura].tono)} ${ROSTRO[figura].tonoCentro}" filter="url(#${id}t)"/><path class="vf-t-luz" d="${ROSTRO[figura].luz}" filter="url(#${id}t)"/></g>`
        +`<g class="vf-cabellera" clip-path="url(#${id}h)"><path class="vf-hebras" d="${par(hebras(figura))}"/></g>`
        +`<path class="vf-fino" d="${par(ROSTRO[figura].lado)}"/><path class="vf-fino vf-ojo" d="${par(ROSTRO[figura].fuerte)}"/><path class="vf-ceja" d="${par(cejas(figura))}"/>${IRIS(194.75,135.95)}${IRIS(205.25,135.95)}`],
      // 4 · Las proporciones: el cuadrado dividido en cabezas (I–VIII), palmos y dedos
      ["debajo",`<path class="vf-medida" d="${ticks.join("")}"/><g class="vf-numeros">${numeros.join("")}</g>`],
      // 5 · Anatomía del natural: los músculos con luces y sombras suaves, y unas pocas líneas finas
      ["tono",`<path class="vf-t-sombra" d="${par(ANATOMIA[figura].sombra)} ${ANATOMIA[figura].centro}" filter="url(#${id}t)"/><path class="vf-t-luz" d="${par(ANATOMIA[figura].luz)}" filter="url(#${id}tl)"/>`
        +`<path class="vf-fino vf-leve" d="${par(ANATOMIA[figura].lineas)}"/>`],
      // 6 · Rodillas, tobillos, dedos de manos y pies, codos y muñecas
      ["detalle",`<g clip-path="url(#${id}c)"><path class="vf-t-sombra" d="${par(MANOS_PIES.tono)}" filter="url(#${id}t2)"/></g><path class="vf-fino vf-menudo" d="${par(MANOS_PIES.lineas)}"/>`],
      // 7 · Sombreado a plumilla
      ["sombra",sombra(tramaA,"vf-trama","s1")],
      // 8 · Notas en escritura especular
      ["detalle",`<g class="vf-nota">${nota(134,88,"el cuerpo es medida de todas las cosas")}${nota(134,94.5,"cuatro dedos hacen un palmo")}${nota(134,101,"y la cabeza, la octava parte")}${nota(352,385,"tanto abre el cuerpo los brazos cuanto es su altura")}${nota(352,391.5,"paso a paso se sube la montaña")}${nota(352,83.4,"el rostro, en tres partes iguales",3.6)}</g>`
        +`<g class="vf-estudio"><path class="vf-guia" d="${ESTUDIO.guias}"/><path class="vf-estudio-t" d="${ESTUDIO.trazo}"/><path class="vf-fino vf-menudo" d="${ESTUDIO.fino}"/></g>`],
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
        +sello(id,61,384)
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
.vitruvio .vf-trazo{fill:none;stroke:var(--vf-tinta,#5a3a20);stroke-width:.68;stroke-linecap:round;stroke-linejoin:round}
.vitruvio .vf-eco{stroke-width:.3;opacity:.32}
.vitruvio .vf-peso{stroke-width:1.3;opacity:var(--vf-peso,.85)}
.vitruvio .vf-penti>*{fill:none;stroke:var(--vf-tinta,#5a3a20);stroke-width:.32;opacity:.2;stroke-linecap:round}
.vitruvio .vf-f-sombra{flood-color:rgb(var(--vf-sombra,110,58,30))}
.vitruvio .vf-f-luz{flood-color:var(--vf-luz,#fffaf0)}
.vitruvio .vf-v-ancha{opacity:var(--vf-v-ancha,.22)}
.vitruvio .vf-v-borde{opacity:var(--vf-v-borde,.42)}
.vitruvio .vf-v-luz{opacity:var(--vf-v-luz,.6)}
.vitruvio .vf-t-sombra{fill:rgb(var(--vf-sombra,110,58,30));opacity:var(--vf-t-sombra,.34)}
.vitruvio .vf-t-luz{fill:var(--vf-luz,#fffaf0);opacity:var(--vf-t-luz,.4)}
.vitruvio .vf-leve{opacity:.5;stroke-width:.36}
.vitruvio .vf-menudo{stroke-width:.3;opacity:.7}
.vitruvio .vf-pelo{stroke-width:.6}
.vitruvio .vf-cabello{fill:var(--vf-papel,#f2e8d3);fill-opacity:.94}
.vitruvio .vf-tinte{fill:rgb(var(--vf-tono-pelo,128,88,52));opacity:.2}
.vitruvio .vf-guia-cara{fill:none;stroke:var(--vf-guia,#a4855f);stroke-width:.3;opacity:.7;stroke-dasharray:1.4 1}
.vitruvio .vf-guia-cara.vf-tenue{opacity:.25}
.vitruvio .vf-p2-linea{fill:none;stroke:var(--vf-tinta,#5a3a20);stroke-width:.62;opacity:.72;stroke-linecap:round;stroke-linejoin:round}
.vitruvio .vf-p2-carne{fill:rgb(var(--vf-carne,214,174,128));opacity:calc(var(--vf-carne-o,.34) * .55)}
.vitruvio .vf-p2-sombra{fill:#000;opacity:calc(var(--vf-v-borde,.42) * .6)}
.vitruvio .vf-fino{fill:none;stroke:var(--vf-tinta,#5a3a20);stroke-width:.42;stroke-linecap:round;opacity:.72}
.vitruvio .vf-iris{fill:var(--vf-tinta,#5a3a20);opacity:.4}
.vitruvio .vf-pupila{fill:var(--vf-tinta,#5a3a20);opacity:.9}
.vitruvio .vf-brillo{fill:var(--vf-luz,#fffaf0)}
.vitruvio .vf-ojo{stroke-width:.55;opacity:.9}
.vitruvio .vf-ceja{fill:none;stroke:var(--vf-tinta,#5a3a20);stroke-width:.28;opacity:.75;stroke-linecap:round}
.vitruvio .vf-t-cara{opacity:.3}
.vitruvio .vf-hebras{fill:none;stroke:var(--vf-tinta,#5a3a20);stroke-width:.24;opacity:.5;stroke-linecap:round}
.vitruvio .vf-c-sombra{opacity:.5}
.vitruvio .vf-c-luz{opacity:.7}
.vitruvio .vf-trama{fill:none;stroke:var(--vf-tinta,#5a3a20);stroke-width:.3;opacity:.6;stroke-linecap:round}
.vitruvio .vf-cruzada{opacity:.5}
.vitruvio .vf-trama.vf-tinta1{stroke-opacity:.7}
.vitruvio .vf-trama.vf-tinta2{stroke-opacity:.45;stroke-width:.26}
.vitruvio .vf-medida{fill:none;stroke:var(--vf-tinta,#5a3a20);stroke-width:.4;opacity:.6}
.vitruvio .vf-numeros text,.vitruvio .vf-nota text,.vitruvio .vf-firma text{fill:var(--vf-tinta,#5a3a20);font-family:var(--serif,Georgia),Georgia,serif;font-style:italic}
.vitruvio .vf-numeros text{opacity:.6;font-style:normal}
.vitruvio .vf-nota text{opacity:.75}
.vitruvio .vf-guia{fill:none;stroke:var(--vf-guia,#a4855f);stroke-width:.4;stroke-dasharray:2.4 1.8;opacity:.8}
.vitruvio .vf-compas{fill:none;stroke:var(--vf-guia,#a4855f);stroke-width:.45;opacity:.85}
.vitruvio .vf-carne{fill:rgb(var(--vf-carne,214,174,128));opacity:var(--vf-carne-o,.34)}
.vitruvio .vf-zona{fill:rgba(var(--vf-zona,178,74,44),calc(var(--b) * var(--vf-zona-o,.4)))}
.vitruvio *{pointer-events:none}
.vitruvio .vf-zona,.vitruvio .vf-zona *{pointer-events:auto}
.vitruvio .vf-sel{fill:none;stroke:var(--vf-oro,#b07d2a);stroke-width:1;stroke-dasharray:2.2 1.6}
.vitruvio .vf-lacre{fill:rgb(156,44,32)}
.vitruvio .vf-cera-luz{stop-color:#c75a40}
.vitruvio .vf-cera{stop-color:#7a2116}
.vitruvio .vf-sello-aro{fill:none;stroke:rgba(255,236,220,.45);stroke-width:.35}
.vitruvio .vf-sello-lema{fill:rgba(255,236,220,.75);font-family:var(--serif,Georgia),Georgia,serif;letter-spacing:.2px}
.vitruvio .vf-sello-letra{fill:rgba(255,236,220,.88);font-family:var(--serif,Georgia),Georgia,serif;font-weight:700}
.vitruvio .vf-verjura{fill:none;stroke:var(--vf-grano,#7a5a36);stroke-width:.18;opacity:.05}
.vitruvio .vf-manchas circle{fill:var(--vf-grano,#7a5a36);fill-opacity:.12}
.vitruvio .vf-estudio-t{fill:none;stroke:var(--vf-tinta,#5a3a20);stroke-width:.4;opacity:.75;stroke-linecap:round}
.vitruvio .vf-esfera{fill:none;stroke:var(--vf-tinta,#5a3a20);stroke-width:.35;opacity:.3}
.vitruvio .vf-esfera-oro{stroke:var(--vf-oro,#b07d2a);stroke-width:.55;opacity:.95}
.vitruvio .vf-anillo{fill:none;stroke:var(--vf-oro,#b07d2a);stroke-width:1.8;stroke-linecap:round}
.vitruvio .vf-perla{fill:var(--vf-oro,#b07d2a);stroke:var(--vf-papel,#f2e8d3);stroke-width:.8}
@keyframes vf-trazar{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
@keyframes vf-aparecer{from{opacity:0}}
@keyframes vf-crecer{from{stroke-dashoffset:var(--d,0)}to{stroke-dashoffset:0}}
@keyframes vf-latido{0%,100%{stroke-width:1.8}50%{stroke-width:3.4}}
@keyframes vf-destello{0%,100%{transform:scale(1)}50%{transform:scale(1.8)}}
.vitruvio.vf-animada .vf-traza{stroke-dasharray:1 1;animation:vf-trazar 1.9s cubic-bezier(.45,.05,.25,1) both}
.vitruvio.vf-animada .vf-eco,.vitruvio.vf-animada .vf-peso{animation-delay:.2s}
.vitruvio.vf-animada .vf-penti>*{animation-delay:.45s}
.vitruvio.vf-animada .vf-aparece{animation:vf-aparecer 1.2s ease .9s both}
.vitruvio.vf-animada .vf-anillo{animation:vf-crecer 1.4s cubic-bezier(.3,0,.2,1) 1s both}
.vitruvio.vf-animada .vf-perla,.vitruvio.vf-animada .vf-esfera-oro{animation:vf-aparecer .6s ease 2.2s both}
.vitruvio.vf-celebra .vf-anillo:not(.vf-obj){animation:vf-crecer 1.4s cubic-bezier(.3,0,.2,1) 1s both,vf-latido 1s ease-in-out 2.5s 3}
.vitruvio.vf-celebra .vf-perla{transform-box:fill-box;transform-origin:center;animation:vf-aparecer .6s ease 2.2s both,vf-destello 1s ease-in-out 2.5s 3}
@media (prefers-reduced-motion:reduce){.vitruvio *{animation:none!important}}`;
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

  // Sombra o luz interior en el borde de cada forma: la silueta desplazada se resta de sí misma, se difumina y se
  // queda dentro (dx, dy hacia la luz: el borde contrario queda en sombra). Así brazos, piernas y torso ganan volumen.
  const filtroBorde=(id,dx,dy,difuminado,clase)=>`<filter id="${id}" x="-5%" y="-5%" width="110%" height="110%"><feOffset in="SourceAlpha" dx="${dx}" dy="${dy}" result="o"/><feComposite in="SourceAlpha" in2="o" operator="out" result="r"/><feGaussianBlur in="r" stdDeviation="${difuminado}" result="b"/><feComposite in="b" in2="SourceAlpha" operator="in" result="m"/><feFlood class="${clase}"/><feComposite in2="m" operator="in"/></filter>`;

  // Papel verjurado: corondeles cada 26 y puntizones muy juntos, como el papel hecho a mano
  const VERJURA=(()=>{ const out=[]; for(let x=58;x<356;x+=26) out.push(`M${x} 75V402`); for(let y=76;y<402;y+=1.6) out.push(`M42 ${f1(y)}H358`); return out.join(""); })();
  // Manchas del papel (siempre las mismas)
  const MANCHAS=(()=>{ const r=azar(77), out=[]; for(let i=0;i<9;i++){ const lado=i%4, t=r(); const x=lado===0?50+r()*8:lado===1?342+r()*8:52+t*296, y=lado===2?84+r()*6:lado===3?392+r()*5:90+t*300; out.push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(1.2+r()*2.8)}" opacity="${(0.4+r()*0.6).toFixed(2)}"/>`); } return out.join(""); })();

  let serie=0;
  // figura: "hombre" | "mujer"; etapa 1–12; avance (0–1) dentro de la etapa; nivel (0–1) hacia el siguiente nivel;
  // objetivos (0–1 o null); brillo: {zona: 0–1}; zonaActiva: la seleccionada; exportar: lleva sus estilos dentro;
  // animar: el dibujo se traza al aparecer; celebrar: el anillo late (al subir de nivel)
  function svg({figura="hombre", etapa=1, avance=0, nivel=0, objetivos=null, brillo={}, zonaActiva=null, titulo="Figura de Vitruvio", exportar=false, animar=false, celebrar=false}={}){
    if(!CUERPOS[figura]) figura="hombre";
    const b=CUERPOS[figura], id="vf"+(++serie), pel=pelo(b), L=capas(b,figura,id,pel);
    const sil=silueta(b), cab=cabeza(b);
    // Cada capa ya alcanzada, y la siguiente a medio trazar
    const lugares={debajo:"",tono:"",pose2:"",sombra:"",detalle:""};
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
    // El anillo dorado va justo por fuera del círculo dibujado, y la esfera (72 marcas) por dentro; donde se apoyan los
    // pies no hay marcas. Las ya recorridas, doradas.
    let marcasOro="", marcasTinta="";
    const RA=C.r+2.3;
    for(let i=0;i<72;i++){ if(i>=33&&i<=39) continue; const a=-Math.PI/2+i/72*2*Math.PI, l=-(i%6?1.6:3), c=Math.cos(a), sn=Math.sin(a), r0=C.r-1.2;
      const m=`M${f1(C.x+r0*c)} ${f1(C.y+r0*sn)}L${f1(C.x+(r0+l)*c)} ${f1(C.y+(r0+l)*sn)}`; if(i/72<p-1e-9) marcasOro+=m; else marcasTinta+=m; }
    const anillo=`<path class="vf-esfera" d="${marcasTinta}"/><path class="vf-esfera vf-esfera-oro" d="${marcasOro}"/>`
      +`<circle class="vf-anillo" style="stroke:url(#${id}oro);--d:${p.toFixed(4)}" cx="${C.x}" cy="${C.y}" r="${RA}" pathLength="1" stroke-dasharray="${p.toFixed(4)} 1" transform="rotate(-90 ${C.x} ${C.y})"${p<0.004?' stroke-opacity="0"':""}/>`
      +(p>0.004&&p<0.996?`<circle class="vf-perla" style="fill:url(#${id}gema)" cx="${f1(C.x+RA*Math.cos(ang))}" cy="${f1(C.y+RA*Math.sin(ang))}" r="2.7"/>`:"");
    let obj="";
    if(objetivos!=null){
      const o=Math.max(0,Math.min(1,objetivos)), [ox,oy]=enCuadrado(o), m=2.3, L2=SQ.l+2*m;
      // Sin progreso no se pinta nada (el extremo redondo de un trazo vacío dejaría un punto sobre la cabeza)
      obj=`<path class="vf-anillo vf-obj" style="stroke:url(#${id}oro);--d:${o.toFixed(4)}" d="M${SQ.x+SQ.l/2} ${SQ.y-m} h${L2/2} v${L2} h${-L2} v${-L2} Z" pathLength="1" stroke-dasharray="${o.toFixed(4)} 1"${o<0.004?' stroke-opacity="0"':""}/>`
        +(o>0.004&&o<0.996?`<circle class="vf-perla" style="fill:url(#${id}gema)" cx="${f1(ox+(ox<=SQ.x+0.01?-m:ox>=SQ.x+SQ.l-0.01?m:0))}" cy="${f1(oy+(oy<=SQ.y+0.01?-m:oy>=SQ.y+SQ.l-0.01?m:0))}" r="2.4"/>`:"");
    }
    // Las esquinas del cuadrado se pasan un poco, como en un dibujo de taller
    const geo=`<circle class="vf-geo" cx="${C.x}" cy="${C.y}" r="${C.r}"/>`
      +`<path class="vf-geo" d="M${SQ.x-5} ${SQ.y} L${SQ.x+SQ.l+5} ${SQ.y} M${SQ.x-5} ${SQ.y+SQ.l} L${SQ.x+SQ.l+5} ${SQ.y+SQ.l} M${SQ.x} ${SQ.y-5} L${SQ.x} ${SQ.y+SQ.l+5} M${SQ.x+SQ.l} ${SQ.y-5} L${SQ.x+SQ.l} ${SQ.y+SQ.l+5}"/>`;
    const contorno=cuerpo(b)+" "+cab;
    return `<svg class="vitruvio${animar||celebrar?" vf-animada":""}${celebrar?" vf-celebra":""}" viewBox="40 74 320 330"${exportar?` xmlns="http://www.w3.org/2000/svg" width="640" height="660"`:""} role="img" aria-label="${titulo}">
      ${exportar?`<style>${ESTILO}</style>`:""}
      <defs>
        <path id="${id}S" d="${sil} ${cab}"/><path id="${id}K" d="${contorno}" pathLength="1"/><path id="${id}B" d="${cuerpo(b)}" pathLength="1"/><path id="${id}P" d="${pel}" pathLength="1"/>
        <clipPath id="${id}c"><use href="#${id}S"/></clipPath>
        <clipPath id="${id}h"><use href="#${id}P"/></clipPath>
        <radialGradient id="${id}v" cx="50%" cy="46%" r="72%"><stop offset="55%" class="vf-vineta" stop-opacity="0"/><stop offset="100%" class="vf-vineta" stop-opacity=".22"/></radialGradient>
        <filter id="${id}g" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.6 1.05"/><feComposite in="SourceGraphic" operator="in"/></filter>
        <filter id="${id}m" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".018" numOctaves="3" seed="9"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.25"/><feComposite in="SourceGraphic" operator="in"/></filter>
        <filter id="${id}p" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".06" numOctaves="2" seed="2"/><feDisplacementMap in="SourceGraphic" scale="1.3" xChannelSelector="R" yChannelSelector="G" result="t"/><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="8"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  .9 0 0 0 .35" result="a"/><feComposite in="t" in2="a" operator="in"/></filter>
        <filter id="${id}w" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="5.5" result="b"/><feTurbulence type="fractalNoise" baseFrequency=".04" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .7 .45"/><feComposite in="b" operator="in"/></filter>
        <filter id="${id}d"><feGaussianBlur stdDeviation="5"/></filter>
        <filter id="${id}bd" x="-3%" y="-3%" width="106%" height="106%"><feTurbulence type="fractalNoise" baseFrequency=".07" numOctaves="3" seed="13"/><feDisplacementMap in="SourceGraphic" scale="4.5" xChannelSelector="R" yChannelSelector="G"/></filter>
        <filter id="${id}sl" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".25" numOctaves="2" seed="5"/><feDisplacementMap in="SourceGraphic" scale="2.2" xChannelSelector="R" yChannelSelector="G"/></filter>
        <filter id="${id}fx" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.4"/></filter>
        <linearGradient id="${id}oro" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8a5a1c"/><stop offset=".28" stop-color="#e2b65a"/><stop offset=".5" stop-color="#b3812e"/><stop offset=".74" stop-color="#f1d184"/><stop offset="1" stop-color="#93631f"/></linearGradient>
        <radialGradient id="${id}gema" cx="38%" cy="34%" r="70%"><stop offset="0" stop-color="#fff7de"/><stop offset=".35" stop-color="#e9c26c"/><stop offset="1" stop-color="#83561a"/></radialGradient>
        <radialGradient id="${id}cera" cx="40%" cy="36%" r="70%"><stop offset="0" class="vf-cera-luz"/><stop offset="1" class="vf-cera"/></radialGradient>
        ${filtroBorde(id+"vb",-10,-6,6,"vf-f-sombra")}${filtroBorde(id+"vs",-3.4,-2.2,2.2,"vf-f-sombra")}${filtroBorde(id+"vl",3,2.2,2.4,"vf-f-luz")}
        <filter id="${id}vr" x="-5%" y="-5%" width="110%" height="110%"><feOffset in="SourceAlpha" dx="-2.6" dy="-1.8" result="o"/><feComposite in="SourceAlpha" in2="o" operator="out" result="r"/><feMorphology in="r" operator="dilate" radius="1.3" result="d"/><feGaussianBlur in="d" stdDeviation=".7" result="b"/><feFlood flood-color="#fff"/><feComposite in2="b" operator="in"/></filter>
        <mask id="${id}gm" maskUnits="userSpaceOnUse" x="40" y="74" width="320" height="330"><rect x="40" y="74" width="320" height="330" fill="#fff"/><use href="#${id}S" fill="#4a4a4a"/></mask>
        <mask id="${id}pm" maskUnits="userSpaceOnUse" x="40" y="74" width="320" height="330"><use href="#${id}S" filter="url(#${id}vr)"/></mask>
        <filter id="${id}t" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="1.1"/></filter>
        <filter id="${id}tl" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="2.2"/></filter>
        <filter id="${id}t2" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation=".45"/></filter>
        <filter id="${id}q" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".09" numOctaves="2" seed="11"/><feDisplacementMap in="SourceGraphic" scale="2.6" xChannelSelector="R" yChannelSelector="G"/></filter>
        <mask id="${id}s1" maskUnits="userSpaceOnUse" x="40" y="74" width="320" height="330"><path d="${SOMBRA[figura]}" fill="#fff" filter="url(#${id}d)"/></mask>
        <mask id="${id}s2" maskUnits="userSpaceOnUse" x="40" y="74" width="320" height="330"><path d="${SOMBRA_HONDA}" fill="#fff" filter="url(#${id}d)"/></mask>
        <mask id="${id}2" maskUnits="userSpaceOnUse" x="40" y="74" width="320" height="330"><rect x="40" y="74" width="320" height="330" fill="#fff"/><use href="#${id}S" fill="#000" stroke="#000" stroke-width="2.4"/><use href="#${id}P" fill="#000" stroke="#000" stroke-width="2.4"/></mask>
      </defs>
      <g filter="url(#${id}bd)">
        <rect class="vf-papel" x="42" y="74.6" width="316" height="327.8" rx="7"/>
        <rect class="vf-grano" x="42" y="74.6" width="316" height="327.8" rx="7" filter="url(#${id}m)" opacity=".07"/>
        <rect class="vf-grano" x="42" y="74.6" width="316" height="327.8" rx="7" filter="url(#${id}g)" opacity=".16"/>
        <rect x="42" y="74.6" width="316" height="327.8" rx="7" fill="url(#${id}v)"/>
        <path class="vf-verjura" d="${VERJURA}"/>
        <g class="vf-manchas" filter="url(#${id}fx)">${MANCHAS}</g>
      </g>
      <g mask="url(#${id}gm)">${lugares.debajo}</g>
      <g filter="url(#${id}p)">${geo}</g>
      <g class="vf-aparece" clip-path="url(#${id}c)"><use class="vf-carne" href="#${id}S" filter="url(#${id}w)"/><g class="vf-zonas" filter="url(#${id}w)">${zonasSvg}</g>
        <g class="vf-volumen"><use class="vf-v-ancha" href="#${id}S" filter="url(#${id}vb)"/><use class="vf-v-borde" href="#${id}S" filter="url(#${id}vs)"/><use class="vf-v-luz" href="#${id}S" filter="url(#${id}vl)"/></g>
        ${lugares.tono}</g>
      ${sel}
      <g class="vf-pose2 vf-aparece" mask="url(#${id}2)">${lugares.pose2}</g>
      <g class="vf-aparece">${lugares.sombra}</g>
      <g filter="url(#${id}p)">
        <use class="vf-trazo vf-traza" href="#${id}K"/>
        <use class="vf-trazo vf-eco vf-traza" transform="translate(.45 .5)" href="#${id}K"/>
        <use class="vf-trazo vf-peso vf-traza" href="#${id}K" mask="url(#${id}pm)"/>
        <use class="vf-cabello vf-aparece" href="#${id}P"/><use class="vf-tinte vf-aparece" href="#${id}P" filter="url(#${id}w)"/>
        <g class="vf-aparece" clip-path="url(#${id}h)"><use class="vf-c-sombra" href="#${id}P" filter="url(#${id}vs)"/><use class="vf-c-luz" href="#${id}P" filter="url(#${id}vl)"/></g><use class="vf-trazo vf-pelo vf-traza" href="#${id}P"/>${b.oreja?`<path class="vf-trazo vf-pelo" d="${par(b.oreja)}"/>`:""}
      </g>
      <path class="vf-guia-cara${etapa>=3?" vf-tenue":""}" d="M200 ${figura==="mujer"?125:126} L200 150 M${figura==="mujer"?188.4:188} 135.9 L${figura==="mujer"?211.6:212} 135.9 M196 142.2 L204 142.2 M196.6 145.6 L203.4 145.6"/>
      <g class="vf-penti" filter="url(#${id}q)"><use class="vf-traza" href="#${id}B" transform="translate(200 240) scale(1.007 1.003) translate(-200 -240) translate(.7 -.5)"/><use class="vf-traza" href="#${id}B" transform="translate(200 240) scale(.994 1.002) translate(-200 -240) translate(-.4 .8)"/></g>
      <g class="vf-aparece">${lugares.detalle}</g>
      ${anillo}${obj}
    </svg>`;
  }
  return {svg, ESTILO, ZONAS:["cabeza","pecho","brazos","manos","abdomen","piernas"]};
})();
