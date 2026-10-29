/* Editor "Editoras": artículos y devocionales. Publica directo en el repositorio de GitHub. */
(function(){
  'use strict';
  var C=window.Comun, D=window.Devocional, GH=window.GH;
  var esc=C.esc, cont=document.getElementById('contenido');
  var S={cfg:null,cats:[],arts:[],devs:[],mas:[],mes:[],recursos:[],testimonio:{},contacto:{},conf:{},vista:'articulos'};
  var ED=null, LOTE=[];
  var BKEY='mda_borradores_v1';

  /* ---------- utilidades ---------- */
  function $(id){return document.getElementById(id);}
  function estado(msg,tipo){
    var e=$('ed-estado'); if(!e){C.aviso(msg);return;}
    e.textContent=msg; e.className='nota ed-msg'+(tipo?' '+tipo:'');
    if(e.scrollIntoView) e.scrollIntoView({block:'nearest'});
  }
  function slug(s,max){
    s=String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
    return (s||'articulo').slice(0,max||60).replace(/-+$/,'');
  }
  function fechaValida(f){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(f||'')) return false;
    var p=f.split('-').map(Number), d=new Date(Date.UTC(p[0],p[1]-1,p[2]));
    return d.getUTCFullYear()===p[0]&&d.getUTCMonth()===p[1]-1&&d.getUTCDate()===p[2];
  }
  function normFecha(s){
    s=String(s).trim(); var m;
    if(fechaValida(s)) return s;
    if((m=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/))){
      var f=m[3]+'-'+('0'+m[2]).slice(-2)+'-'+('0'+m[1]).slice(-2);
      return fechaValida(f)?f:'';
    }
    return '';
  }
  function fechaCorta(f){return fechaValida(f)?D.fechaLarga(f):'';}
  function idUnico(titulo){
    var base=slug(titulo), id=base, n=2, usados=S.arts.map(function(a){return String(a.id);});
    while(usados.indexOf(id)>=0){id=base+'-'+n;n++;}
    return id;
  }

  /* Texto corrido <-> lista de párrafos.
     Línea en blanco = párrafo nuevo. "## algo" = subtítulo. "> algo" = cita (artículos viejos). */
  function textoAParrafos(txt){
    var out=[], cur=[];
    function cerrar(){ if(cur.length){ out.push(cur.join('\n').trim()); cur=[]; } }
    String(txt||'').replace(/\r/g,'').split('\n').forEach(function(l){
      var t=l.replace(/\s+$/,'');
      if(!t.trim()){ cerrar(); return; }
      if(/^(##|>)\s*$/.test(t.trim())) return;
      if(/^##\s+/.test(t)){ cerrar(); out.push('## '+t.replace(/^##\s+/,'').trim()); return; }
      if(/^>\s+/.test(t)){ cerrar(); out.push('> '+t.replace(/^>\s+/,'').trim()); return; }
      cur.push(t);
    });
    cerrar();
    return out.filter(Boolean);
  }
  /* Ordena el texto de un devocional pegado (carga de varios juntos):
     - saca una línea "Texto" suelta al principio,
     - "Versículo: “...” — Cita" pasa a ser una cita (> ...) y la referencia se guarda aparte,
     - "Enseñanza y orientación:" y "Oración:" pasan a ser subtítulos.
     Para sumar otro rótulo (por ejemplo "Aplicación"), agregalo en ROTULOS. */
  var ROTULOS=['Enseñanza y orientación','Oración'];
  function ordenarDevocional(parr){
    var out=[], ref='', cur=null, primero=true;
    function cerrar(){ if(cur!==null){ var t=cur.join('\n').trim(); if(t) out.push(t); cur=null; } }
    function rotulo(l){
      for(var i=0;i<ROTULOS.length;i++){
        var m=l.match(new RegExp('^'+ROTULOS[i]+'\\s*:\\s*([\\s\\S]*)$','i'));
        if(m) return {nombre:ROTULOS[i],resto:m[1]};
      }
      return null;
    }
    (parr||[]).forEach(function(p){
      if(/^(##|>)\s/.test(p)){ cerrar(); out.push(p); primero=false; return; }
      String(p).split('\n').forEach(function(l){
        var t=l.trim(), r, v;
        if(primero&&/^texto$/i.test(t)){ primero=false; return; }
        primero=false;
        if((v=t.match(/^Vers[ií]culo\s*:\s*([\s\S]+)$/i))){
          cerrar(); var x=v[1].trim(), k=x.lastIndexOf(' — ');
          if(k>0){ if(!ref) ref=x.slice(k+3).trim().replace(/\.+$/,''); x=x.slice(0,k).trim(); }
          out.push('> '+x); return;
        }
        if((r=rotulo(t))){ cerrar(); out.push('## '+r.nombre); cur=r.resto.trim()?[r.resto.trim()]:null; return; }
        if(cur===null) cur=[]; cur.push(l.replace(/\s+$/,''));
      });
      cerrar();
    });
    return {parrafos:out,referencia:ref};
  }
  function parrafosATexto(arr){return (arr||[]).map(String).join('\n\n');}
  /* Resumen automático: las primeras líneas del texto. */
  function autoResumen(parr){
    var plano=parr.filter(function(p){return !/^(##|>)\s/.test(p);}).map(function(p){return p.replace(/\s+/g,' ').trim();});
    var s='';
    for(var i=0;i<plano.length;i++){ s+=(s?' ':'')+plano[i]; if(s.length>=160) break; }
    if(s.length>170){
      s=s.slice(0,170); var k=s.lastIndexOf(' '); if(k>100) s=s.slice(0,k);
      s=s.replace(/[\s,.;:\-–]+$/,'')+'…';
    }
    return s;
  }
  /* Convierte en subtítulo la línea donde está el cursor (o la devuelve a párrafo). */
  function alternarSubtitulo(ta){
    var v=ta.value, pos=ta.selectionStart||0;
    var ini=pos>0?v.lastIndexOf('\n',pos-1)+1:0, fin=v.indexOf('\n',pos); if(fin<0) fin=v.length;
    var linea=v.slice(ini,fin);
    if(/^##\s+/.test(linea)) linea=linea.replace(/^##\s+/,''); else linea='## '+linea.replace(/^>\s+/,'');
    ta.value=v.slice(0,ini)+linea+v.slice(fin);
    ta.focus(); var np=ini+linea.length; if(ta.setSelectionRange) ta.setSelectionRange(np,np);
    ta.dispatchEvent(new Event('input',{bubbles:true}));
  }

  function blobADataURL(blob){
    return new Promise(function(ok,no){var r=new FileReader();r.onload=function(){ok(r.result);};r.onerror=function(){no(new Error('No se pudo leer la imagen.'));};r.readAsDataURL(blob);});
  }
  /* Reduce la foto (por defecto máx. 1400 px) y la pasa a WebP (o JPG si el celular no puede). */
  function reducirImagen(file,max,calidad){
    max=max||1400; calidad=calidad||.82;
    return new Promise(function(ok,no){
      var url=URL.createObjectURL(file), im=new Image();
      im.onload=function(){
        var r=Math.min(1,max/Math.max(im.width,im.height)), w=Math.round(im.width*r), h=Math.round(im.height*r);
        var c=document.createElement('canvas'); c.width=w; c.height=h; c.getContext('2d').drawImage(im,0,0,w,h);
        URL.revokeObjectURL(url);
        function fin(b,ext){blobADataURL(b).then(function(d){ok({blob:b,ext:ext,dataURL:d});},no);}
        c.toBlob(function(b){
          if(b&&b.type==='image/webp') fin(b,'webp');
          else c.toBlob(function(b2){fin(b2,'jpg');},'image/jpeg',Math.min(.95,calidad+.05));
        },'image/webp',calidad);
      };
      im.onerror=function(){URL.revokeObjectURL(url);no(new Error('No se pudo leer la imagen. Probá con otra foto.'));};
      im.src=url;
    });
  }

  /* ---------- borradores (se guardan en este celular, solo si se toca "Guardar borrador") ---------- */
  function leerBor(){try{return JSON.parse(localStorage.getItem(BKEY))||[];}catch(e){return [];}}
  function guardarBor(l){try{localStorage.setItem(BKEY,JSON.stringify(l));return true;}catch(e){return false;}}
  function quitarBor(id){if(!id) return; guardarBor(leerBor().filter(function(b){return b.id!==id;}));}
  function borPorId(id){return leerBor().filter(function(b){return b.id===id;})[0]||null;}

  /* ---------- ventanas (vista previa y avisos) ---------- */
  function capa(estilo,html){var o=document.createElement('div');o.style.cssText=estilo;o.innerHTML=html;document.body.appendChild(o);return o;}
  /* Vista previa: ventana que cubre toda la pantalla. Los estilos van "en línea" para que funcione aunque el celular tenga el CSS viejo guardado. */
  function mostrarVista(html){
    var prev=document.body.style.overflow; document.body.style.overflow='hidden';
    var v=capa('position:fixed;top:0;right:0;bottom:0;left:0;z-index:50;background:#FBF7F1;overflow-y:auto;-webkit-overflow-scrolling:touch',html);
    v.className='vista';
    function cerrar(){v.remove();document.body.style.overflow=prev;document.removeEventListener('keydown',tecla);}
    function tecla(e){if(e.key==='Escape') cerrar();}
    v.addEventListener('click',function(e){if(e.target.closest('[data-cerrar]')) cerrar();});
    document.addEventListener('keydown',tecla);
  }
  function htmlVista(o){
    return '<div class="vista-barra" style="position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;background:#DCE5D8;color:#4F6B58;font-weight:700;font-size:.85rem">'+
      '<span>Así se verá</span><button type="button" class="btn-sec" data-cerrar style="background:#fff">Cerrar vista previa</button></div>'+
      '<div class="pagina" style="max-width:560px;margin:0 auto"><article class="lectura">'+
      (o.imagen?'<div class="portada"><img src="'+esc(o.imagen)+'" alt=""></div>':'')+
      (o.etiqueta?'<div class="fila-etiqueta"><span class="etiqueta">'+esc(o.etiqueta)+'</span></div>':'')+
      '<h2>'+esc(o.titulo||'(sin título)')+'</h2>'+
      (o.fecha?'<p class="meta">'+esc(o.fecha)+'</p>':'')+
      (o.versiculo?'<blockquote class="cita">'+C.conSaltos(o.versiculo)+'</blockquote>':'')+
      '<div class="cuerpo">'+(o.parrafos.length?C.bloques(o.parrafos):'<p class="aviso-vacio">Todavía no escribiste el texto.</p>')+'</div></article></div>';
  }
  function dialogo(titulo,texto,botones){
    var o=capa('position:fixed;top:0;right:0;bottom:0;left:0;z-index:60;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(40,35,30,.55)',
      '<div role="dialog" aria-modal="true" style="width:100%;max-width:420px;padding:22px;border-radius:22px;background:#FBF7F1;box-shadow:0 20px 50px rgba(0,0,0,.3)">'+
      '<h3 style="margin:0 0 8px;font:600 1.4rem/1.2 Georgia,serif">'+esc(titulo)+'</h3><p style="margin:0 0 16px">'+esc(texto)+'</p>'+
      '<div class="dlg-acc" style="display:flex;flex-direction:column;gap:10px"></div></div>');
    var box=o.querySelector('.dlg-acc');
    botones.forEach(function(b){
      var el=document.createElement('button'); el.type='button'; el.className=b.cls||'btn-sec'; el.style.justifyContent='center'; el.textContent=b.t;
      el.addEventListener('click',function(){o.remove(); if(b.f) b.f();});
      box.appendChild(el);
    });
  }

  /* ---------- acceso ---------- */
  function acceso(){
    if(!(window.crypto&&window.crypto.subtle)){
      cont.innerHTML='<div class="error-carga">Este navegador no permite el acceso seguro. Abrí la app desde la dirección https de la página.</div>'; return;
    }
    if(!S.cfg.owner||!S.cfg.repo){
      cont.innerHTML='<div class="error-carga">Falta configurar el repositorio en <strong>data/editor.json</strong> (campos “owner” y “repo”).</div>'; return;
    }
    if(GH.hayLlave()) vistaLogin(); else vistaConfigurar();
  }
  function vistaConfigurar(){
    cont.innerHTML='<section class="oracion"><h3>Primer ingreso en este celular</h3>'+
      '<p>Para publicar hace falta la <strong>llave de GitHub</strong> (la crea el administrador del sitio) y una <strong>contraseña</strong> que elijas. La llave queda guardada acá, cifrada con tu contraseña.</p>'+
      '<details class="ayuda"><summary>Cómo se crea la llave</summary><ol>'+
        '<li>En GitHub: Settings → Developer settings → Personal access tokens → <em>Fine-grained tokens</em> → Generate new token.</li>'+
        '<li>Elegí un vencimiento y, en “Repository access”, <em>Only select repositories</em>: marcá solo el repositorio de la app.</li>'+
        '<li>En “Repository permissions” poné <strong>Contents: Read and write</strong>.</li>'+
        '<li>Generá la llave y copiala (empieza con <code>github_pat_</code>). Pegala acá abajo.</li></ol>'+
        '<p class="nota">Los nombres de los menús pueden variar un poco. Si la llave vence, hay que crear otra.</p></details>'+
      '<form class="form" id="f-cfg" novalidate>'+
        '<label for="c-token">Llave de GitHub</label><input id="c-token" type="password" autocomplete="off" autocapitalize="off" spellcheck="false">'+
        '<label for="c-p1">Elegí una contraseña (mínimo 8 caracteres)</label><input id="c-p1" type="password" autocomplete="new-password">'+
        '<label for="c-p2">Repetí la contraseña</label><input id="c-p2" type="password" autocomplete="new-password">'+
        '<div class="acciones"><button type="submit" class="btn-leer" id="c-ok">Guardar y entrar</button></div>'+
        '<p class="nota ed-msg" id="ed-estado"></p></form></section>';
    $('f-cfg').addEventListener('submit',function(e){
      e.preventDefault();
      var t=$('c-token').value.trim(), p1=$('c-p1').value, p2=$('c-p2').value;
      if(!t) return estado('Pegá la llave de GitHub.','error');
      if(p1.length<8) return estado('La contraseña necesita al menos 8 caracteres.','error');
      if(p1!==p2) return estado('Las contraseñas no coinciden.','error');
      $('c-ok').disabled=true; estado('Verificando…');
      GH.guardarLlave(t,p1).then(function(){GH.usar(t,S.cfg);return GH.verificar();}).then(entrar).catch(function(er){
        GH.olvidarLlave(); if($('c-ok')) $('c-ok').disabled=false; estado(GH.mensajeError(er),'error');
      });
    });
  }
  function vistaLogin(){
    cont.innerHTML='<section class="oracion"><h3>Ingresá tu contraseña</h3>'+
      '<form class="form" id="f-login" novalidate>'+
        '<label for="l-p">Contraseña</label><input id="l-p" type="password" autocomplete="current-password">'+
        '<div class="acciones"><button type="submit" class="btn-leer grande ancho" id="l-ok">Entrar</button></div>'+
        '<p class="nota ed-msg" id="ed-estado"></p></form></section>'+
      '<details class="ayuda ed-avanzado"><summary>¿Problemas para entrar?</summary>'+
        '<p class="nota">Si cambiaste la llave de GitHub o querés empezar de cero en este celular, podés borrar la llave guardada. Después hay que cargarla de nuevo.</p>'+
        '<button type="button" class="btn-sec peq peligro" data-acc="olvidar">Olvidar la llave de este celular</button></details>';
    $('f-login').addEventListener('submit',function(e){
      e.preventDefault();
      var p=$('l-p').value; if(!p) return estado('Escribí tu contraseña.','error');
      $('l-ok').disabled=true; estado('Entrando…');
      GH.abrirLlave(p).then(function(t){GH.usar(t,S.cfg);return GH.verificar();}).then(entrar).catch(function(er){
        GH.cerrar(); if($('l-ok')) $('l-ok').disabled=false; estado(GH.mensajeError(er),'error');
      });
    });
  }
  function entrar(){
    cont.innerHTML='<p class="cargando">Cargando tus artículos…</p>';
    return Promise.all([GH.leerJSON('data/articulos.json'),GH.leerJSON('data/devocionales.json'),GH.leerJSON('data/mas.json'),GH.leerJSON('data/mes.json'),GH.leerJSON('data/recursos.json'),GH.leerJSON('data/testimonio.json'),GH.leerJSON('data/contacto.json'),GH.leerJSON('data/config.json')]).then(function(r){
      S.arts=Array.isArray(r[0].datos)?r[0].datos:[]; S.devs=Array.isArray(r[1].datos)?r[1].datos:[]; S.mas=Array.isArray(r[2].datos)?r[2].datos:[]; S.mes=Array.isArray(r[3].datos)?r[3].datos:[]; S.recursos=Array.isArray(r[4].datos)?r[4].datos:[];
      S.testimonio=objeto(r[5].datos); S.contacto=objeto(r[6].datos); S.conf=objeto(r[7].datos);
      panel();
    }).catch(function(er){
      cont.innerHTML='<div class="error-carga">'+esc(GH.mensajeError(er))+'</div><p><button type="button" class="btn-sec" data-acc="salir">Salir</button></p>';
    });
  }

  /* ---------- panel y listas ---------- */
  function panel(){
    ED=null;
    var info=GH.repoInfo(), hechos=GH.tomarHechos();
    function lnk(u){return /^https:\/\/github\.com\//.test(u||'')?u:'';}
    var repoUrl='https://github.com/'+encodeURIComponent(info.owner)+'/'+encodeURIComponent(info.repo);
    var confirmacion='';
    if(hechos.length){
      confirmacion='<div class="ed-ok" role="status"><strong>✓ Guardado en GitHub</strong> (rama '+esc(info.rama)+')<ul>'+
        hechos.map(function(h){var u=lnk(h.url)||lnk(h.commit); return '<li>'+(u?'<a href="'+esc(u)+'" target="_blank" rel="noopener">'+esc(h.ruta)+'</a>':esc(h.ruta))+'</li>';}).join('')+'</ul>'+
        '<span>Las lectoras lo ven en 1 a 3 minutos. <a href="'+esc(repoUrl)+'/commits/'+encodeURIComponent(info.rama)+'" target="_blank" rel="noopener">Ver historial de cambios</a></span></div>';
    }
    var alerta=(info.principal&&info.principal!==info.rama)?
      '<div class="ed-aviso" role="alert">⚠ El editor publica en la rama <strong>'+esc(info.rama)+'</strong>, pero la rama principal del repositorio es <strong>'+esc(info.principal)+'</strong>. Si la página se publica desde otra rama, no vas a ver los cambios. Revisá <code>rama</code> en <code>data/editor.json</code>.</div>':'';
    var VISTAS=[['articulos','Artículos'],['devocionales','Devocionales'],['recursos','Recursos'],['mas','Más'],['testimonio','Testimonio'],['contacto','Contacto'],['apariencia','Apariencia']];
    cont.innerHTML='<div class="ed-barra"><h2>Panel de editoras</h2><button type="button" class="btn-sec peq" data-acc="salir">Salir</button></div>'+
      '<p class="nota ed-repo">Publicás en <a href="'+esc(repoUrl)+'" target="_blank" rel="noopener">'+esc(info.owner+'/'+info.repo)+'</a> · rama <strong>'+esc(info.rama)+'</strong>'+(S.detectado?' <span>(según la dirección de esta página)</span>':'')+'</p>'+alerta+confirmacion+
      '<div class="chips ed-chips">'+VISTAS.map(function(v){
        return '<button type="button" class="chip'+(S.vista===v[0]?' activa':'')+'" data-acc="vista" data-v="'+v[0]+'">'+v[1]+'</button>';
      }).join('')+'</div>'+
      '<div id="ed-cuerpo"></div>';
    if(S.vista==='articulos') listaArticulos(); else if(S.vista==='mas') listaMas(); else if(S.vista==='recursos') listaRecursos();
    else if(S.vista==='testimonio') listaTestimonio(); else if(S.vista==='contacto') listaContacto(); else if(S.vista==='apariencia') listaApariencia(); else listaDevocionales();
  }
  /* Un archivo que guarda UN solo dato (testimonio, contacto) viene como objeto; si falta, GitHub lo da como lista vacía. */
  function objeto(d){return (d&&typeof d==='object'&&!Array.isArray(d))?d:{};}
  function item(titulo,sub,botones,borrador){
    return '<div class="ed-item"><div class="ed-item-txt"><strong>'+(borrador?'<span class="etiqueta">Borrador</span> ':'')+esc(titulo||'(sin título)')+'</strong><span>'+esc(sub||'')+'</span></div><div class="ed-item-acc">'+botones+'</div></div>';
  }
  function btn(txt,acc,attr,extra){return '<button type="button" class="btn-sec peq'+(extra?' '+extra:'')+'" data-acc="'+acc+'" '+attr+'>'+txt+'</button>';}

  function listaArticulos(){
    var bor=leerBor().filter(function(b){return b.tipo==='articulo';});
    var pub=S.arts.slice().sort(function(a,b){return (b.fecha||'').localeCompare(a.fecha||'');});
    $('ed-cuerpo').innerHTML='<button type="button" class="btn-leer" data-acc="nuevo-art">+ Nuevo artículo</button>'+
      (bor.length?'<h3 class="ed-sub">Borradores</h3><div class="lista">'+bor.map(function(b){
        return item(b.titulo,b.ref?'Cambios sin publicar a un artículo':'Artículo nuevo, sin publicar',btn('Continuar','cont-art','data-id="'+esc(b.id)+'"')+btn('Descartar','borra-bor','data-id="'+esc(b.id)+'"','peligro'),true);
      }).join('')+'</div>':'')+
      '<h3 class="ed-sub">Publicados ('+pub.length+')</h3>'+
      (pub.length?'<div class="lista">'+pub.map(function(a){
        return item(a.titulo,[a.categoria,fechaCorta(a.fecha)].filter(Boolean).join(' · '),
          btn('Editar','edit-art','data-id="'+esc(a.id)+'"')+btn('Quitar de la app','borra-art','data-id="'+esc(a.id)+'"','peligro'));
      }).join('')+'</div>':'<p class="vacio">Todavía no hay artículos publicados.</p>');
  }
  function listaDevocionales(){
    var bor=leerBor().filter(function(b){return b.tipo==='devocional';});
    var pub=S.devs.slice().sort(function(a,b){return b.fecha<a.fecha?-1:b.fecha>a.fecha?1:0;});
    var hoy=D.hoyISO();
    $('ed-cuerpo').innerHTML='<div class="acciones"><button type="button" class="btn-leer" data-acc="nuevo-dev">+ Nuevo devocional</button>'+
      '<button type="button" class="btn-sec" data-acc="lote">Cargar varios juntos</button>'+
      '<button type="button" class="btn-sec" data-acc="nuevo-mes">Introducción del mes</button></div>'+
      (bor.length?'<h3 class="ed-sub">Borradores</h3><div class="lista">'+bor.map(function(b){
        return item(b.titulo,b.fecha?fechaCorta(b.fecha):'Sin fecha',btn('Continuar','cont-dev','data-id="'+esc(b.id)+'"')+btn('Descartar','borra-bor','data-id="'+esc(b.id)+'"','peligro'),true);
      }).join('')+'</div>':'')+
      '<h3 class="ed-sub">Introducciones del mes ('+S.mes.length+')</h3>'+
      (S.mes.length?'<div class="lista">'+S.mes.slice().sort(function(a,b){return a.mes<b.mes?1:a.mes>b.mes?-1:0;}).map(function(x){
        return item(x.titulo,mesTexto(x.mes),btn('Editar','edit-mes','data-m="'+esc(x.mes)+'"')+btn('Quitar de la app','borra-mes','data-m="'+esc(x.mes)+'"','peligro'));
      }).join('')+'</div>':'<p class="nota">Todavía no cargaste ninguna.</p>')+
      '<h3 class="ed-sub">Cargados ('+pub.length+')</h3>'+
      (pub.length?'<div class="lista">'+pub.map(function(d){
        return item(d.titulo,fechaCorta(d.fecha)+(d.fecha>hoy?' · aún no se publica':''),
          btn('Editar','edit-dev','data-f="'+esc(d.fecha)+'"')+btn('Quitar de la app','borra-dev','data-f="'+esc(d.fecha)+'"','peligro'));
      }).join('')+'</div>':'<p class="vacio">Todavía no hay devocionales cargados.</p>');
  }

  /* ---------- pieza común de los formularios: texto con botón Subtítulo ---------- */
  function campoTexto(id){
    return '<label for="'+id+'">Texto</label>'+
      '<div class="ed-herr"><button type="button" class="btn-sec peq" data-sub="'+id+'">Subtítulo</button><span class="nota">Escribí una línea, tocá el botón y pasa a ser subtítulo.</span></div>'+
      '<textarea id="'+id+'" rows="14"></textarea>'+
      '<p class="nota">Dejá una línea en blanco entre un párrafo y otro.</p>';
  }
  function botonesFinales(){
    return '<div class="ed-final"><button type="button" class="btn-sec" data-acc="e-vista">Vista previa</button>'+
      '<button type="button" class="btn-sec" data-acc="e-borrador">Guardar borrador</button>'+
      '<button type="button" class="btn-leer ancho" data-acc="e-publicar" id="e-pub">Publicar</button>'+
      '<button type="button" class="enlace" data-acc="cancelar">Cancelar</button></div>'+
      '<p class="nota ed-msg" id="ed-estado"></p>';
  }
  function guardarRegistro(reg,E){
    var l=leerBor(), i=l.map(function(b){return b.id;}).indexOf(reg.id);
    if(i>=0) l[i]=reg; else l.unshift(reg);
    return guardarBor(l);
  }

  /* ---------- editor de artículo ---------- */
  function editorArticulo(orig,draft){
    var d=draft?draft.datos:null;
    var E={id:draft?draft.id:null, ref:orig?String(orig.id):(draft?draft.ref:''), ocupado:false,
      imagenNueva:(d&&d.imagenData)?{dataURL:d.imagenData,ext:d.imagenExt||'webp',blob:null}:null,
      imagenActual:(d?d.imagenActual:(orig&&orig.imagen))||''};
    var cats=S.cats.slice(), catActual=(d?d.categoria:(orig&&orig.categoria))||cats[0]||'';
    if(catActual&&cats.indexOf(catActual)<0) cats.push(catActual);
    var fechaArt=(E.ref&&orig&&fechaValida(orig.fecha))?orig.fecha:D.hoyISO();

    cont.innerHTML='<form class="form ed-form" id="ed-form" novalidate>'+
      '<h2 class="ed-titulo">'+(E.ref?'Editar artículo':'Nuevo artículo')+'</h2>'+
      (draft?'<p class="aviso-vacio">Estás continuando un borrador guardado en este celular.</p>':'')+
      '<label for="a-cat">Categoría</label><select id="a-cat">'+cats.map(function(c){return '<option>'+esc(c)+'</option>';}).join('')+'</select>'+
      '<label for="a-titulo">Título</label><input id="a-titulo" type="text">'+
      campoTexto('a-texto')+
      '<label for="a-vers">Versículo</label><textarea id="a-vers" rows="2"></textarea>'+
      '<label for="a-file">Imagen de portada</label><div id="a-img" class="ed-img"></div><input id="a-file" type="file" accept="image/*">'+
      '<p class="ed-fecha">Fecha: <strong>'+esc(fechaCorta(fechaArt))+'</strong></p>'+
      botonesFinales()+'</form>';
    $('a-cat').value=catActual;
    $('a-titulo').value=d?d.titulo:(orig&&orig.titulo)||'';
    $('a-texto').value=d?(d.texto!=null?d.texto:parrafosATexto(d.parrafos)):parrafosATexto(C.lista(orig||{}));
    $('a-vers').value=d?(d.versiculo||''):(orig&&orig.versiculo)||'';

    function leer(){return {titulo:$('a-titulo').value.trim(),categoria:$('a-cat').value,texto:$('a-texto').value,versiculo:$('a-vers').value.trim()};}
    function foto(){return JSON.stringify(leer())+'|'+(E.imagenNueva?E.imagenNueva.dataURL.length:0)+'|'+E.imagenActual;}
    var base=foto();
    E.cambios=function(){return foto()!==base;};
    function pintarImg(){
      var src=E.imagenNueva?E.imagenNueva.dataURL:E.imagenActual;
      $('a-img').innerHTML=src?'<img src="'+esc(src)+'" alt="Portada">':'<p class="nota">Sin imagen. Si no subís una, el artículo se muestra sin portada.</p>';
    }
    pintarImg();

    $('ed-form').addEventListener('click',function(e){
      var s=e.target.closest('[data-sub]'); if(s) alternarSubtitulo($(s.getAttribute('data-sub')));
    });
    $('a-file').addEventListener('change',function(){
      var f=this.files[0]; if(!f) return;
      estado('Preparando la imagen…');
      reducirImagen(f).then(function(r){E.imagenNueva=r;pintarImg();estado('');},function(er){estado(er.message,'error');});
    });

    E.vista=function(){
      var v=leer(), parr=textoAParrafos(v.texto);
      mostrarVista(htmlVista({imagen:E.imagenNueva?E.imagenNueva.dataURL:E.imagenActual,etiqueta:v.categoria,titulo:v.titulo,fecha:fechaCorta(fechaArt),versiculo:v.versiculo,parrafos:parr}));
    };
    E.borrador=function(){
      var v=leer();
      if(!v.titulo&&!v.texto.trim()&&!v.versiculo){ estado('Todavía no hay nada para guardar.'); return false; }
      if(!E.id) E.id='b-'+Date.now().toString(36);
      var ok=guardarRegistro({id:E.id,tipo:'articulo',ref:E.ref,titulo:v.titulo,actualizado:Date.now(),
        datos:{titulo:v.titulo,categoria:v.categoria,texto:v.texto,versiculo:v.versiculo,imagenActual:E.imagenActual,
          imagenData:E.imagenNueva?E.imagenNueva.dataURL:'',imagenExt:E.imagenNueva?E.imagenNueva.ext:''}});
      if(ok){ base=foto(); estado('Borrador guardado en este celular.'); } else estado('No se pudo guardar el borrador (poco espacio en el celular).','error');
      return ok;
    };
    E.publicar=async function(){
      if(E.ocupado) return;
      var v=leer(), parr=textoAParrafos(v.texto);
      if(!v.titulo) return estado('Escribí el título.','error');
      if(!parr.length) return estado('Escribí el texto del artículo.','error');
      if(!confirm('¿Publicar este artículo ahora?')) return;
      E.ocupado=true; $('e-pub').disabled=true; estado('Publicando… no cierres esta pantalla.');
      try{
        var id=E.ref||idUnico(v.titulo), nuevo=!E.ref;
        var art=Object.assign({},orig||{},{id:id,titulo:v.titulo,categoria:v.categoria,resumen:autoResumen(parr),fecha:fechaArt,parrafos:parr});
        delete art.texto; delete art.contenido;
        if(!art.resumen) delete art.resumen;
        if(v.versiculo) art.versiculo=v.versiculo; else delete art.versiculo;
        var imagen=E.imagenActual;
        if(E.imagenNueva){
          var blob=E.imagenNueva.blob||await (await fetch(E.imagenNueva.dataURL)).blob();
          var ruta='img/articulos/'+id+'.'+E.imagenNueva.ext;
          estado('Subiendo la imagen…'); await GH.subir(ruta,blob,'Editor: imagen de «'+v.titulo+'»'); imagen=ruta;
        }
        if(imagen) art.imagen=imagen; else delete art.imagen;
        if(nuevo) art.destacado=true;   /* el último artículo publicado es el destacado del inicio */
        estado('Guardando el artículo…');
        S.arts=await GH.modificarJSON('data/articulos.json',function(arr){
          arr=Array.isArray(arr)?arr:[];
          if(nuevo) arr.forEach(function(x){if(String(x.id)!==id) delete x.destacado;});
          var i=arr.map(function(x){return String(x.id);}).indexOf(id);
          if(i>=0) arr[i]=art; else arr.unshift(art);
          return arr;
        },'Editor: '+(orig?'actualizar':'publicar')+' artículo «'+v.titulo+'»');
        quitarBor(E.id);
        S.vista='articulos'; panel(); C.aviso('Publicado. En un par de minutos lo verán las lectoras.');
      }catch(er){
        E.ocupado=false; if($('e-pub')) $('e-pub').disabled=false; estado(GH.mensajeError(er),'error');
      }
    };
    ED=E;
  }

  /* ---------- editor de devocional ---------- */
  function editorDevocional(orig,draft){
    var d=draft?draft.datos:null;
    var E={id:draft?draft.id:null, ref:orig?orig.fecha:(draft?draft.ref:''), ocupado:false};
    cont.innerHTML='<form class="form ed-form" id="ed-form" novalidate>'+
      '<h2 class="ed-titulo">'+(E.ref?'Editar devocional':'Nuevo devocional')+'</h2>'+
      (draft?'<p class="aviso-vacio">Estás continuando un borrador guardado en este celular.</p>':'')+
      '<label for="v-fecha">Fecha en que se publica</label><input id="v-fecha" type="date">'+
      '<label for="v-titulo">Título</label><input id="v-titulo" type="text">'+
      campoTexto('v-texto')+
      botonesFinales()+'</form>';
    $('v-fecha').value=d?(d.fecha||''):(orig&&orig.fecha)||D.hoyISO();
    $('v-titulo').value=d?d.titulo:(orig&&orig.titulo)||'';
    $('v-texto').value=d?(d.texto!=null?d.texto:parrafosATexto(d.parrafos)):parrafosATexto(C.lista(orig||{}));

    function leer(){return {fecha:$('v-fecha').value,titulo:$('v-titulo').value.trim(),texto:$('v-texto').value};}
    var base=JSON.stringify(leer());
    E.cambios=function(){return JSON.stringify(leer())!==base;};
    $('ed-form').addEventListener('click',function(e){
      var s=e.target.closest('[data-sub]'); if(s) alternarSubtitulo($(s.getAttribute('data-sub')));
    });
    E.vista=function(){
      var v=leer();
      mostrarVista(htmlVista({etiqueta:'Devocional',titulo:v.titulo,fecha:fechaCorta(v.fecha),parrafos:textoAParrafos(v.texto)}));
    };
    E.borrador=function(){
      var v=leer();
      if(!v.titulo&&!v.texto.trim()){ estado('Todavía no hay nada para guardar.'); return false; }
      if(!E.id) E.id='b-'+Date.now().toString(36);
      var ok=guardarRegistro({id:E.id,tipo:'devocional',ref:E.ref,titulo:v.titulo,fecha:v.fecha,actualizado:Date.now(),datos:{fecha:v.fecha,titulo:v.titulo,texto:v.texto}});
      if(ok){ base=JSON.stringify(leer()); estado('Borrador guardado en este celular.'); } else estado('No se pudo guardar el borrador.','error');
      return ok;
    };
    E.publicar=async function(){
      if(E.ocupado) return;
      var v=leer(), parr=textoAParrafos(v.texto);
      if(!fechaValida(v.fecha)) return estado('Elegí la fecha en que se publica.','error');
      if(!v.titulo) return estado('Escribí el título.','error');
      if(!parr.length) return estado('Escribí el texto del devocional.','error');
      var choca=S.devs.some(function(x){return x.fecha===v.fecha&&x.fecha!==E.ref;});
      if(choca&&!confirm('Ya hay un devocional para esa fecha. ¿Querés reemplazarlo?')) return;
      if(!confirm('¿Publicar este devocional ahora?')) return;
      E.ocupado=true; $('e-pub').disabled=true; estado('Publicando… no cierres esta pantalla.');
      try{
        var dev=Object.assign({},orig||{},{fecha:v.fecha,titulo:v.titulo,parrafos:parr});
        delete dev.texto; delete dev.contenido;
        S.devs=await GH.modificarJSON('data/devocionales.json',function(arr){
          arr=Array.isArray(arr)?arr:[];
          arr=arr.filter(function(x){return x.fecha!==v.fecha&&x.fecha!==E.ref;});
          arr.push(dev); arr.sort(function(a,b){return a.fecha<b.fecha?-1:a.fecha>b.fecha?1:0;});
          return arr;
        },'Editor: devocional del '+v.fecha);
        quitarBor(E.id);
        S.vista='devocionales'; panel(); C.aviso('Devocional guardado.');
      }catch(er){
        E.ocupado=false; if($('e-pub')) $('e-pub').disabled=false; estado(GH.mensajeError(er),'error');
      }
    };
    ED=E;
  }

  /* ---------- cargar varios devocionales juntos ---------- */
  function parsearLote(txt){
    var bloques=txt.replace(/\r/g,'').split(/^\s*-{3,}\s*$/m).map(function(s){return s.trim();}).filter(Boolean);
    var vistos={};
    return bloques.map(function(b,n){
      var l=b.split('\n');
      var f=normFecha(l.shift());
      while(l.length&&!l[0].trim()) l.shift();
      var titulo=(l.shift()||'').trim(), ref='';
      if(l.length&&/^\s*(cita|ref|referencia)\s*:/i.test(l[0])) ref=l.shift().replace(/^[^:]*:/,'').trim();
      var parr=textoAParrafos(l.join('\n')), ord=ordenarDevocional(parr); parr=ord.parrafos; if(!ref) ref=ord.referencia;
      var er=[]; if(!f) er.push('fecha no válida'); if(!titulo) er.push('falta el título'); if(!parr.length) er.push('falta el texto');
      if(f&&vistos[f]) er.push('fecha repetida en el lote'); if(f) vistos[f]=1;
      return {n:n+1,fecha:f,titulo:titulo,referencia:ref,parrafos:parr,error:er.join(', ')};
    });
  }
  function vistaLote(){
    ED=null; LOTE=[];
    cont.innerHTML='<div class="ed-barra"><h2>Cargar varios devocionales</h2><button type="button" class="btn-sec peq" data-acc="cancelar">‹ Volver</button></div>'+
      '<p class="intro">Pegá todos los devocionales juntos. Separá cada uno con una línea que tenga <code>---</code>.</p>'+
      '<details class="ayuda"><summary>Ver el formato</summary><pre class="ejemplo">2026-11-01\nTítulo del devocional\nPrimer párrafo del texto.\n\nSegundo párrafo.\n---\n02/11/2026\nOtro título\nTexto del segundo día...</pre>'+
      '<p class="nota">1.ª línea: fecha (2026-11-01 o 01/11/2026). 2.ª: título. Después, el texto con una línea en blanco entre párrafos. Una línea que empiece con “## ” es un subtítulo.</p></details>'+
      '<form class="form" id="f-lote"><textarea id="l-txt" rows="14" placeholder="Pegá acá los devocionales…"></textarea>'+
      '<div class="acciones"><button type="button" class="btn-leer" data-acc="lote-revisar">Revisar</button><button type="button" class="enlace" data-acc="cancelar">Cancelar</button></div></form>'+
      '<div id="l-res"></div><p class="nota ed-msg" id="ed-estado"></p>';
  }
  function revisarLote(){
    var txt=$('l-txt').value; if(!txt.trim()) return estado('Pegá primero los devocionales.','error');
    LOTE=parsearLote(txt);
    var ok=LOTE.filter(function(x){return !x.error;}), mal=LOTE.length-ok.length;
    var existentes=S.devs.map(function(x){return x.fecha;});
    $('l-res').innerHTML='<h3 class="ed-sub">Resultado: '+ok.length+' listos'+(mal?', '+mal+' con errores':'')+'</h3><div class="lista">'+LOTE.map(function(x){
      return '<div class="ed-item'+(x.error?' ed-err':'')+'"><div class="ed-item-txt"><strong>'+esc(x.titulo||'(sin título)')+'</strong><span>'+esc(x.fecha?fechaCorta(x.fecha):'Fecha no válida')+
        (x.error?' · '+esc(x.error):(existentes.indexOf(x.fecha)>=0?' · reemplaza al existente':' · nuevo'))+'</span></div></div>';
    }).join('')+'</div>'+
    (ok.length?'<div class="acciones"><button type="button" class="btn-leer" data-acc="lote-publicar" id="l-pub">Publicar '+ok.length+' devocionales</button></div>':'<p class="vacio">Corregí los errores y volvé a revisar.</p>');
    estado(mal?'Los que tienen errores no se publicarán.':'');
  }
  async function publicarLote(){
    var ok=LOTE.filter(function(x){return !x.error;}); if(!ok.length) return;
    if(!confirm('¿Publicar '+ok.length+' devocionales?')) return;
    $('l-pub').disabled=true; estado('Publicando…');
    try{
      S.devs=await GH.modificarJSON('data/devocionales.json',function(arr){
        arr=Array.isArray(arr)?arr:[];
        var fechas=ok.map(function(x){return x.fecha;});
        arr=arr.filter(function(x){return fechas.indexOf(x.fecha)<0;});
        ok.forEach(function(x){var o={fecha:x.fecha,titulo:x.titulo,parrafos:x.parrafos}; if(x.referencia) o.referencia=x.referencia; arr.push(o);});
        arr.sort(function(a,b){return a.fecha<b.fecha?-1:a.fecha>b.fecha?1:0;});
        return arr;
      },'Editor: cargar '+ok.length+' devocionales');
      S.vista='devocionales'; panel(); C.aviso(ok.length+' devocionales guardados.');
    }catch(er){ if($('l-pub')) $('l-pub').disabled=false; estado(GH.mensajeError(er),'error'); }
  }

  /* ---------- "Más": galería de imágenes (imagen + título) ---------- */
  function claveMas(x){return String(x.id||x.imagen);}
  function listaMas(){
    var l=S.mas;
    $('ed-cuerpo').innerHTML='<button type="button" class="btn-leer" data-acc="nuevo-mas">+ Nueva imagen</button>'+
      '<h3 class="ed-sub">Publicadas ('+l.length+')</h3>'+
      (l.length?'<div class="lista">'+l.map(function(x){
        return '<div class="ed-item"><div class="ed-item-txt" style="flex-direction:row;align-items:center;gap:10px">'+
          '<img src="'+esc(x.miniatura||x.imagen)+'" alt="" style="width:48px;height:60px;object-fit:cover;border-radius:8px;background:#EFE8DE;flex:none">'+
          '<strong>'+esc(x.titulo||'(sin título)')+'</strong></div>'+
          '<div class="ed-item-acc">'+btn('Editar','edit-mas','data-k="'+esc(claveMas(x))+'"')+btn('Quitar de la app','borra-mas','data-k="'+esc(claveMas(x))+'"','peligro')+'</div></div>';
      }).join('')+'</div>':'<p class="vacio">Todavía no hay imágenes en “Más”.</p>');
  }
  function editorMas(orig){
    var E={ref:orig?claveMas(orig):'',ocupado:false,imagenNueva:null,mini:null,imagenActual:(orig&&(orig.miniatura||orig.imagen))||'',sinBorrador:true};
    cont.innerHTML='<form class="form ed-form" id="ed-form" novalidate>'+
      '<h2 class="ed-titulo">'+(orig?'Editar imagen':'Nueva imagen')+'</h2>'+
      '<label for="m-file">Imagen (.png, .webp o .jpg)</label><div id="m-img" class="ed-img"></div>'+
      '<input id="m-file" type="file" accept="image/png,image/webp,image/jpeg,image/*">'+
      '<label for="m-titulo">Título</label><input id="m-titulo" type="text">'+
      '<div class="ed-final"><button type="button" class="btn-sec" data-acc="e-vista" style="grid-column:1/-1">Vista previa</button>'+
      '<button type="button" class="btn-leer ancho" data-acc="e-publicar" id="e-pub">Publicar</button>'+
      '<button type="button" class="enlace" data-acc="cancelar">Cancelar</button></div>'+
      '<p class="nota ed-msg" id="ed-estado"></p></form>';
    $('m-titulo').value=(orig&&orig.titulo)||'';
    function foto(){return $('m-titulo').value.trim()+'|'+(E.imagenNueva?E.imagenNueva.dataURL.length:0);}
    var base=foto(); E.cambios=function(){return foto()!==base;};
    function pintarImg(){
      var src=E.imagenNueva?E.imagenNueva.dataURL:E.imagenActual;
      $('m-img').innerHTML=src?'<img src="'+esc(src)+'" alt="Imagen elegida" style="max-height:260px;object-fit:contain;background:#EFE8DE">':'<p class="nota">Todavía no elegiste ninguna imagen.</p>';
    }
    pintarImg();
    $('m-file').addEventListener('change',function(){
      var f=this.files[0]; if(!f) return;
      estado('Preparando la imagen…');
      /* Se guardan dos tamaños: la imagen completa (para ver y compartir) y una miniatura liviana para la galería. */
      Promise.all([reducirImagen(f,1600,.9),reducirImagen(f,480,.8)]).then(function(r){
        E.imagenNueva=r[0]; E.mini=r[1]; pintarImg(); estado('');
      },function(er){estado(er.message,'error');});
    });
    E.vista=function(){
      var src=E.imagenNueva?E.imagenNueva.dataURL:E.imagenActual, t=$('m-titulo').value.trim();
      mostrarVista('<div class="vista-barra" style="position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;background:#DCE5D8;color:#4F6B58;font-weight:700;font-size:.85rem">'+
        '<span>Así se verá</span><button type="button" class="btn-sec" data-cerrar style="background:#fff">Cerrar vista previa</button></div>'+
        '<div class="pagina" style="max-width:560px;margin:0 auto"><h2 style="font:600 1.6rem/1.15 Georgia,serif;margin:6px 0 12px">'+esc(t||'(sin título)')+'</h2>'+
        (src?'<img src="'+esc(src)+'" alt="" style="display:block;width:100%;height:auto;border-radius:12px">':'<p class="aviso-vacio">Todavía no elegiste ninguna imagen.</p>')+'</div>');
    };
    E.publicar=async function(){
      if(E.ocupado) return;
      var t=$('m-titulo').value.trim();
      if(!E.imagenNueva&&!(orig&&orig.imagen)) return estado('Elegí una imagen.','error');
      if(!t) return estado('Escribí un título.','error');
      if(!confirm('¿Publicar esta imagen ahora?')) return;
      E.ocupado=true; $('e-pub').disabled=true; estado('Publicando… no cierres esta pantalla.');
      try{
        var item=Object.assign({},orig||{}); item.titulo=t;
        if(!item.id) item.id=slug(t,40)+'-'+Date.now().toString(36).slice(-4);
        if(E.imagenNueva){
          var raiz='img/mas/'+slug(t,40)+'-'+Date.now().toString(36).slice(-4);
          estado('Subiendo la imagen…'); await GH.subir(raiz+'.'+E.imagenNueva.ext,E.imagenNueva.blob,'Editor: imagen «'+t+'»');
          estado('Subiendo la miniatura…'); await GH.subir(raiz+'-mini.'+E.mini.ext,E.mini.blob,'Editor: miniatura «'+t+'»');
          item.imagen=raiz+'.'+E.imagenNueva.ext; item.miniatura=raiz+'-mini.'+E.mini.ext;
        }
        estado('Guardando…');
        var k=E.ref;
        S.mas=await GH.modificarJSON('data/mas.json',function(arr){
          arr=Array.isArray(arr)?arr:[];
          var i=k?arr.map(claveMas).indexOf(k):-1;
          if(i>=0) arr[i]=item; else arr.unshift(item);
          return arr;
        },'Editor: '+(orig?'actualizar':'publicar')+' imagen «'+t+'»');
        S.vista='mas'; panel(); C.aviso('Publicado. En un par de minutos lo verán las lectoras.');
      }catch(er){
        E.ocupado=false; if($('e-pub')) $('e-pub').disabled=false; estado(GH.mensajeError(er),'error');
      }
    };
    ED=E;
  }
  function quitarMas(k){
    var x=S.mas.filter(function(y){return claveMas(y)===k;})[0]; if(!x) return;
    if(!confirm('¿Quitar «'+(x.titulo||'esta imagen')+'» de la app? Dejará de verse para las lectoras.')) return;
    C.aviso('Quitando…');
    GH.modificarJSON('data/mas.json',function(arr){return (arr||[]).filter(function(y){return claveMas(y)!==k;});},'Editor: quitar imagen «'+(x.titulo||'')+'»')
      .then(function(l){S.mas=l;panel();C.aviso('Imagen quitada de la app.');}).catch(function(er){C.aviso(GH.mensajeError(er));});
  }

  /* ---------- Recursos: PDF para descargar (archivo + título + descripción) ---------- */
  var MAX_PDF=20*1024*1024;   /* 20 MB: más que eso tarda demasiado en el celular y en GitHub */
  function claveRec(x){return String(x.archivo||x.titulo);}
  function nombreArch(r){var n=String(r||'').split('?')[0].split('/').pop()||''; try{n=decodeURIComponent(n);}catch(e){} return n;}
  function tamano(b){return b<1048576?Math.max(1,Math.round(b/1024))+' KB':(b/1048576).toFixed(1).replace('.',',')+' MB';}
  function esPdf(f){return !!f&&(f.type==='application/pdf'||/\.pdf$/i.test(f.name||''));}
  function listaRecursos(){
    var l=S.recursos;
    $('ed-cuerpo').innerHTML='<button type="button" class="btn-leer" data-acc="nuevo-rec">+ Nuevo recurso (PDF)</button>'+
      '<h3 class="ed-sub">Publicados ('+l.length+')</h3>'+
      (l.length?'<div class="lista">'+l.map(function(x){
        return item(x.titulo,x.descripcion||nombreArch(x.archivo),
          btn('Editar','edit-rec','data-k="'+esc(claveRec(x))+'"')+btn('Quitar de la app','borra-rec','data-k="'+esc(claveRec(x))+'"','peligro'));
      }).join('')+'</div>':'<p class="vacio">Todavía no hay recursos para descargar.</p>');
  }
  /* Nombre libre para un PDF nuevo: pdf/<titulo>.pdf, y si ya existe en el repositorio, se le suma un número. */
  async function rutaNuevaPdf(titulo){
    var base=slug(titulo,60)||'recurso', usados=S.recursos.map(function(x){return String(x.archivo||'').toLowerCase();});
    for(var n=1;n<=30;n++){
      var ruta='pdf/'+base+(n>1?'-'+n:'')+'.pdf';
      if(usados.indexOf(ruta.toLowerCase())<0&&!(await GH.existe(ruta))) return ruta;
    }
    throw new Error('No se pudo elegir un nombre para el archivo. Probá con otro título.');
  }
  function editorRecurso(orig){
    var E={ref:orig?claveRec(orig):'',ocupado:false,archivo:null,sinBorrador:true};
    cont.innerHTML='<form class="form ed-form" id="ed-form" novalidate>'+
      '<h2 class="ed-titulo">'+(orig?'Editar recurso':'Nuevo recurso')+'</h2>'+
      '<label for="r-drop">Archivo PDF</label>'+
      '<div class="ed-drop" id="r-drop" role="button" tabindex="0" aria-label="Elegir un archivo PDF">'+
        '<strong>Tocá para elegir un PDF</strong><span>o arrastralo hasta acá</span>'+
        '<span class="ed-drop-arch" id="r-arch"></span></div>'+
      '<input id="r-file" type="file" accept="application/pdf,.pdf" hidden>'+
      '<p class="nota" id="r-nota">'+(orig?'Archivo actual: '+esc(nombreArch(orig.archivo))+'. Si no elegís otro, se mantiene.':'Hasta 20 MB.')+'</p>'+
      '<label for="r-titulo">Título</label><input id="r-titulo" type="text">'+
      '<label for="r-desc">Descripción (opcional)</label><textarea id="r-desc" rows="3"></textarea>'+
      '<div class="ed-final"><button type="button" class="btn-leer ancho" data-acc="e-publicar" id="e-pub">Publicar</button>'+
      '<button type="button" class="enlace" data-acc="cancelar">Cancelar</button></div>'+
      '<p class="nota ed-msg" id="ed-estado"></p></form>';
    $('r-titulo').value=(orig&&orig.titulo)||'';
    $('r-desc').value=(orig&&orig.descripcion)||'';
    function foto(){return $('r-titulo').value.trim()+'|'+$('r-desc').value.trim()+'|'+(E.archivo?E.archivo.name+E.archivo.size:'');}
    var base=foto(); E.cambios=function(){return foto()!==base;};

    function elegir(f){
      if(!f) return;
      if(!esPdf(f)) return estado('Ese archivo no es un PDF. Elegí un archivo .pdf.','error');
      if(f.size>MAX_PDF) return estado('El PDF pesa '+tamano(f.size)+' y el máximo es 20 MB. Probá con una versión más liviana.','error');
      if(!f.size) return estado('El archivo está vacío.','error');
      E.archivo=f; estado('');
      $('r-arch').textContent=f.name+' · '+tamano(f.size);
      $('r-drop').classList.add('lleno');
      if(!$('r-titulo').value.trim()) $('r-titulo').value=f.name.replace(/\.pdf$/i,'').replace(/[_\-]+/g,' ').replace(/\s+/g,' ').trim();
    }
    var zona=$('r-drop'), input=$('r-file');
    zona.addEventListener('click',function(){input.click();});
    zona.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();input.click();}});
    input.addEventListener('change',function(){elegir(this.files[0]); this.value='';});
    ['dragenter','dragover'].forEach(function(t){zona.addEventListener(t,function(e){e.preventDefault();zona.classList.add('sobre');});});
    ['dragleave','dragend'].forEach(function(t){zona.addEventListener(t,function(){zona.classList.remove('sobre');});});
    zona.addEventListener('drop',function(e){
      e.preventDefault(); zona.classList.remove('sobre');
      var fs=e.dataTransfer&&e.dataTransfer.files; if(fs&&fs.length) elegir(fs[0]);
    });

    E.publicar=async function(){
      if(E.ocupado) return;
      var t=$('r-titulo').value.trim(), desc=$('r-desc').value.trim();
      if(!E.archivo&&!(orig&&orig.archivo)) return estado('Elegí un archivo PDF.','error');
      if(!t) return estado('Escribí el título.','error');
      if(!confirm('¿Publicar este recurso ahora?')) return;
      E.ocupado=true; $('e-pub').disabled=true; estado('Publicando… no cierres esta pantalla.');
      try{
        var it=Object.assign({},orig||{}); it.titulo=t; it.tipo='PDF';
        if(desc) it.descripcion=desc; else delete it.descripcion;
        if(E.archivo){
          /* Si se está editando, el PDF nuevo reemplaza al anterior en la misma ruta (no queda un archivo huérfano). */
          var ruta=(orig&&orig.archivo)?orig.archivo:await rutaNuevaPdf(t);
          estado('Subiendo el PDF ('+tamano(E.archivo.size)+')… puede tardar un poco, no cierres esta pantalla.');
          await GH.subir(ruta,E.archivo,'Editor: PDF «'+t+'»');
          it.archivo=ruta;
        }
        estado('Guardando…');
        var k=E.ref;
        S.recursos=await GH.modificarJSON('data/recursos.json',function(arr){
          arr=Array.isArray(arr)?arr:[];
          var i=k?arr.map(claveRec).indexOf(k):-1;
          if(i>=0) arr[i]=it; else arr.unshift(it);
          return arr;
        },'Editor: '+(orig?'actualizar':'publicar')+' recurso «'+t+'»');
        S.vista='recursos'; panel(); C.aviso('Publicado. En un par de minutos lo verán las lectoras.');
      }catch(er){
        E.ocupado=false; if($('e-pub')) $('e-pub').disabled=false; estado(GH.mensajeError(er),'error');
      }
    };
    ED=E;
  }
  function quitarRec(k){
    var x=S.recursos.filter(function(y){return claveRec(y)===k;})[0]; if(!x) return;
    if(!confirm('¿Quitar «'+(x.titulo||'este recurso')+'» de la app? Dejará de verse para las lectoras.')) return;
    C.aviso('Quitando…');
    GH.modificarJSON('data/recursos.json',function(arr){return (arr||[]).filter(function(y){return claveRec(y)!==k;});},'Editor: quitar recurso «'+(x.titulo||'')+'»')
      .then(function(l){S.recursos=l;panel();C.aviso('Recurso quitado de la app.');}).catch(function(er){C.aviso(GH.mensajeError(er));});
  }

  /* ---------- Testimonio (una sola página: título, texto e imagen) ---------- */
  function listaTestimonio(){
    var t=S.testimonio, n=C.lista(t).length;
    $('ed-cuerpo').innerHTML='<p class="nota">Es el testimonio que se ve en el inicio y en su propia pantalla.</p>'+
      '<div class="lista">'+item(t.titulo||'Testimonio',n?(n+(n===1?' párrafo':' párrafos')):'Todavía sin texto',btn('Editar','edit-test',''))+'</div>';
  }
  function editorTestimonio(){
    var orig=S.testimonio, E={ocupado:false,imagenNueva:null,imagenActual:orig.imagen||'',sinBorrador:true};
    cont.innerHTML='<form class="form ed-form" id="ed-form" novalidate>'+
      '<h2 class="ed-titulo">Editar testimonio</h2>'+
      '<label for="t-titulo">Título</label><input id="t-titulo" type="text">'+
      campoTexto('t-texto')+
      '<label for="t-file">Imagen</label><div id="t-img" class="ed-img"></div><input id="t-file" type="file" accept="image/*">'+
      '<div class="ed-final"><button type="button" class="btn-sec" data-acc="e-vista" style="grid-column:1/-1">Vista previa</button>'+
      '<button type="button" class="btn-leer ancho" data-acc="e-publicar" id="e-pub">Publicar</button>'+
      '<button type="button" class="enlace" data-acc="cancelar">Cancelar</button></div>'+
      '<p class="nota ed-msg" id="ed-estado"></p></form>';
    $('t-titulo').value=orig.titulo||'';
    $('t-texto').value=parrafosATexto(C.lista(orig));
    function leer(){return {titulo:$('t-titulo').value.trim(),texto:$('t-texto').value};}
    function foto(){return JSON.stringify(leer())+'|'+(E.imagenNueva?E.imagenNueva.dataURL.length:0);}
    var base=foto(); E.cambios=function(){return foto()!==base;};
    function pintarImg(){
      var src=E.imagenNueva?E.imagenNueva.dataURL:E.imagenActual;
      $('t-img').innerHTML=src?'<img src="'+esc(src)+'" alt="Imagen del testimonio" onerror="this.remove()">':'<p class="nota">Sin imagen.</p>';
    }
    pintarImg();
    $('ed-form').addEventListener('click',function(e){var b=e.target.closest('[data-sub]'); if(b) alternarSubtitulo($(b.getAttribute('data-sub')));});
    $('t-file').addEventListener('change',function(){
      var f=this.files[0]; if(!f) return;
      estado('Preparando la imagen…');
      reducirImagen(f,1200,.85).then(function(r){E.imagenNueva=r;pintarImg();estado('');},function(er){estado(er.message,'error');});
    });
    E.vista=function(){
      var v=leer();
      mostrarVista(htmlVista({imagen:E.imagenNueva?E.imagenNueva.dataURL:E.imagenActual,etiqueta:orig.etiqueta||'Testimonio',titulo:v.titulo,parrafos:textoAParrafos(v.texto)}));
    };
    E.publicar=async function(){
      if(E.ocupado) return;
      var v=leer(), parr=textoAParrafos(v.texto);
      if(!v.titulo) return estado('Escribí el título.','error');
      if(!parr.length) return estado('Escribí el texto del testimonio.','error');
      if(!confirm('¿Publicar el testimonio ahora?')) return;
      E.ocupado=true; $('e-pub').disabled=true; estado('Publicando… no cierres esta pantalla.');
      try{
        var imagen=E.imagenActual;
        if(E.imagenNueva){
          var blob=E.imagenNueva.blob||await (await fetch(E.imagenNueva.dataURL)).blob();
          var ruta='img/testimonio.'+E.imagenNueva.ext;
          estado('Subiendo la imagen…'); await GH.subir(ruta,blob,'Editor: imagen del testimonio'); imagen=ruta;
        }
        estado('Guardando el testimonio…');
        S.testimonio=objeto(await GH.modificarJSON('data/testimonio.json',function(o){
          o=Object.assign({},objeto(o),{titulo:v.titulo,parrafos:parr});
          delete o.texto; delete o.contenido;
          if(!o.etiqueta) o.etiqueta='Testimonio';
          if(imagen) o.imagen=imagen; else delete o.imagen;
          return o;
        },'Editor: actualizar testimonio'));
        S.vista='testimonio'; panel(); C.aviso('Publicado. En un par de minutos lo verán las lectoras.');
      }catch(er){
        E.ocupado=false; if($('e-pub')) $('e-pub').disabled=false; estado(GH.mensajeError(er),'error');
      }
    };
    ED=E;
  }

  /* ---------- Contacto (correo y textos de la pantalla Contacto) ---------- */
  function listaContacto(){
    var c=S.contacto;
    $('ed-cuerpo').innerHTML='<p class="nota">Son los datos de la pantalla Contacto: a qué correo llegan los mensajes y los textos que se ven.</p>'+
      '<div class="lista">'+item('Pantalla Contacto',c.correo||'Falta cargar el correo',btn('Editar','edit-cont',''))+'</div>';
  }
  function editorContacto(){
    var orig=S.contacto, o=orig.oracion||{}, E={ocupado:false,sinBorrador:true};
    cont.innerHTML='<form class="form ed-form" id="ed-form" novalidate>'+
      '<h2 class="ed-titulo">Editar contacto</h2>'+
      '<label for="k-correo">Correo al que llegan los mensajes</label><input id="k-correo" type="email" autocapitalize="off" spellcheck="false">'+
      '<label for="k-intro">Texto de bienvenida</label><textarea id="k-intro" rows="3"></textarea>'+
      '<label for="k-asunto">Asunto de los mensajes</label><input id="k-asunto" type="text">'+
      '<label for="k-saludo">Saludo con el que arranca el mensaje</label><textarea id="k-saludo" rows="3"></textarea>'+
      '<h3 class="ed-sub">Pedido de oración</h3>'+
      '<label for="k-otitulo">Título</label><input id="k-otitulo" type="text">'+
      '<label for="k-otexto">Texto</label><textarea id="k-otexto" rows="3"></textarea>'+
      '<label for="k-oasunto">Asunto del mensaje</label><input id="k-oasunto" type="text">'+
      '<div class="ed-final"><button type="button" class="btn-leer ancho" data-acc="e-publicar" id="e-pub">Publicar</button>'+
      '<button type="button" class="enlace" data-acc="cancelar">Cancelar</button></div>'+
      '<p class="nota ed-msg" id="ed-estado"></p></form>';
    $('k-correo').value=orig.correo||''; $('k-intro').value=orig.intro||''; $('k-asunto').value=orig.asunto||'';
    $('k-saludo').value=String(orig.saludo||'').replace(/\s+$/,'');
    $('k-otitulo').value=o.titulo||''; $('k-otexto').value=o.texto||''; $('k-oasunto').value=o.asunto||'';
    function leer(){return {correo:$('k-correo').value.trim(),intro:$('k-intro').value.trim(),asunto:$('k-asunto').value.trim(),saludo:$('k-saludo').value.trim(),
      otitulo:$('k-otitulo').value.trim(),otexto:$('k-otexto').value.trim(),oasunto:$('k-oasunto').value.trim()};}
    var base=JSON.stringify(leer()); E.cambios=function(){return JSON.stringify(leer())!==base;};
    E.publicar=async function(){
      if(E.ocupado) return;
      var v=leer();
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.correo)) return estado('Escribí un correo válido (por ejemplo nombre@correo.com).','error');
      if(!confirm('¿Publicar estos datos de contacto ahora?')) return;
      E.ocupado=true; $('e-pub').disabled=true; estado('Publicando… no cierres esta pantalla.');
      try{
        S.contacto=objeto(await GH.modificarJSON('data/contacto.json',function(d){
          d=Object.assign({},objeto(d));
          d.correo=v.correo; d.intro=v.intro; d.asunto=v.asunto;
          d.saludo=v.saludo?v.saludo+'\n\n':'';   /* el mensaje arranca con el saludo y deja lugar para escribir */
          d.oracion=Object.assign({},d.oracion||{},{titulo:v.otitulo,texto:v.otexto,asunto:v.oasunto});
          return d;
        },'Editor: actualizar datos de contacto'));
        S.vista='contacto'; panel(); C.aviso('Publicado. En un par de minutos lo verán las lectoras.');
      }catch(er){
        E.ocupado=false; if($('e-pub')) $('e-pub').disabled=false; estado(GH.mensajeError(er),'error');
      }
    };
    ED=E;
  }

  /* ---------- Apariencia: imágenes y frases del inicio (se guardan en data/config.json) ---------- */
  var CREMA='#fbf7f1', COLOR_ORIG='#3b3f45';
  var PALETA=[['#3b3f45','Gris oscuro'],['#4f6b58','Verde'],['#a4524f','Rosa oscuro'],['#7d6a94','Lila'],['#000000','Negro']];
  function hexOk(c){return typeof c==='string'&&/^#[0-9a-fA-F]{6}$/.test(c);}
  function lum(h){var v=[1,3,5].map(function(i){var c=parseInt(h.substr(i,2),16)/255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4);});return 0.2126*v[0]+0.7152*v[1]+0.0722*v[2];}
  function contraste(a,b){var x=lum(a),y=lum(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);}
  /* De "img/hero.webp" saca "img/hero": la imagen nueva se guarda en la misma ruta (con la extensión que corresponda). */
  function baseImg(ruta,defecto){var m=String(ruta||'').match(/^(img\/[^?#]+)\.(?:webp|jpe?g|png|gif|svg)$/i);return m?m[1]:defecto;}
  function claveCat(c){return String((c&&c.href)||'').replace(/\.html.*$/,'').replace(/[^a-z0-9-]/gi,'')||slug(c&&c.nombre,30)||'categoria';}

  function listaApariencia(){
    var h=S.conf.hero||{}, cats=S.conf.categorias||[];
    function rec(t,n){t=String(t||''); return t.length>n?t.slice(0,n)+'…':t;}
    $('ed-cuerpo').innerHTML='<p class="nota">Acá cambiás cómo se ve el inicio de la app. Cada botón abre una pantalla para ese cambio.</p>'+
      '<div class="lista">'+
      item('1. Imagen principal (hero)','Foto grande de la portada',btn('Cambiar','ap-hero-img',''))+
      item('2. Frase principal y su color',rec(h.frasePrincipal,70)+(hexOk(h.colorPrincipal)?' · color '+h.colorPrincipal:''),btn('Editar','ap-frase','data-k="principal"'))+
      item('3. Frase secundaria y su color',rec(h.fraseSecundaria,70)+(hexOk(h.colorSecundaria)?' · color '+h.colorSecundaria:''),btn('Editar','ap-frase','data-k="secundaria"'))+
      item('4. Imagen del devocional','Foto de la tarjeta de devocional del inicio',btn('Cambiar','ap-dev-img',''))+
      item('5. Imágenes del carrusel',cats.map(function(c){return c.nombre;}).filter(Boolean).join(', ')||'Artículos, Recursos, Contacto y Más',btn('Cambiar','ap-cats',''))+
      '</div>';
  }

  /* Editor de una o varias imágenes: se suben a img/ y se enlazan desde data/config.json.
     o = {titulo, ayuda, slots:[{k,etiqueta,base,actual,max,calidad}], extraHtml, extraInit, extraLeer, aplicar(conf,rutas,extra), msg} */
  function editorImagenes(o){
    var E={ocupado:false,nuevas:{},sinBorrador:true};
    cont.innerHTML='<form class="form ed-form" id="ed-form" novalidate><h2 class="ed-titulo">'+esc(o.titulo)+'</h2>'+
      (o.ayuda?'<p class="nota">'+esc(o.ayuda)+'</p>':'')+
      o.slots.map(function(sl,i){
        return '<label for="i-file-'+i+'">'+esc(sl.etiqueta)+'</label><div class="ed-img" id="i-img-'+i+'"></div><input id="i-file-'+i+'" type="file" accept="image/*">';
      }).join('')+
      (o.extraHtml||'')+
      '<div class="ed-final"><button type="button" class="btn-leer ancho" data-acc="e-publicar" id="e-pub">Publicar</button>'+
      '<button type="button" class="enlace" data-acc="cancelar">Cancelar</button></div>'+
      '<p class="nota ed-msg" id="ed-estado"></p></form>';
    if(o.extraInit) o.extraInit();
    function pintar(i){
      var sl=o.slots[i], n=E.nuevas[sl.k], src=n?n.dataURL:sl.actual;
      $('i-img-'+i).innerHTML=src?'<img src="'+esc(src)+'" alt="Imagen actual: '+esc(sl.etiqueta)+'" onerror="this.remove()">':'<p class="nota">Sin imagen.</p>';
    }
    function foto(){return Object.keys(E.nuevas).map(function(k){return k+':'+E.nuevas[k].dataURL.length;}).join(',')+'|'+(o.extraLeer?o.extraLeer():'');}
    var base0=foto(); E.cambios=function(){return foto()!==base0;};
    o.slots.forEach(function(sl,i){
      pintar(i);
      $('i-file-'+i).addEventListener('change',function(){
        var f=this.files[0]; if(!f) return;
        estado('Preparando la imagen…');
        reducirImagen(f,sl.max,sl.calidad).then(function(r){E.nuevas[sl.k]=r;pintar(i);estado('');},function(er){estado(er.message,'error');});
      });
    });
    E.publicar=async function(){
      if(E.ocupado) return;
      if(!E.cambios()) return estado('Todavía no hay nada para publicar. Elegí una imagen nueva.','error');
      if(!confirm('¿Publicar el cambio ahora? Las lectoras lo van a ver en unos minutos.')) return;
      var claves=Object.keys(E.nuevas), extra=o.extraLeer?o.extraLeer():undefined;
      E.ocupado=true; $('e-pub').disabled=true; estado('Publicando… no cierres esta pantalla.');
      try{
        var rutas={}, hechas=0;
        for(var i=0;i<o.slots.length;i++){
          var sl=o.slots[i], n=E.nuevas[sl.k]; if(!n) continue;
          var ruta=sl.base+'.'+n.ext; hechas++;
          estado('Subiendo imagen '+hechas+' de '+claves.length+'…');
          await GH.subir(ruta,n.blob,'Editor: '+o.msg+' ('+sl.etiqueta+')');
          rutas[sl.k]=ruta;
        }
        estado('Guardando…');
        S.conf=objeto(await GH.modificarJSON('data/config.json',function(c){c=Object.assign({},objeto(c)); o.aplicar(c,rutas,extra); return c;},'Editor: '+o.msg));
        S.vista='apariencia'; panel(); C.aviso('Publicado. En un par de minutos lo verán las lectoras.');
      }catch(er){
        E.ocupado=false; if($('e-pub')) $('e-pub').disabled=false; estado(GH.mensajeError(er),'error');
      }
    };
    ED=E;
  }
  function editorHeroImg(){
    var h=S.conf.hero||{};
    editorImagenes({
      titulo:'Imagen principal (hero)',
      ayuda:'Es la foto grande de la portada. Funciona mejor una foto vertical o cuadrada, con la persona del lado derecho, porque el texto se ve a la izquierda.',
      slots:[{k:'hero',etiqueta:'Foto de la portada',base:baseImg(h.imagen,'img/hero'),actual:h.imagen||'',max:1400,calidad:0.85}],
      extraHtml:'<label for="h-desc">Descripción de la foto (opcional)</label><input id="h-desc" type="text" maxlength="140">'+
        '<p class="nota">Es para personas que usan lector de pantalla. Por ejemplo: “Mujer mirando el amanecer”.</p>',
      extraInit:function(){$('h-desc').value=h.descripcion||'';},
      extraLeer:function(){return $('h-desc').value.trim();},
      aplicar:function(c,r,d){c.hero=Object.assign({},c.hero||{}); if(r.hero) c.hero.imagen=r.hero; if(d) c.hero.descripcion=d; else delete c.hero.descripcion;},
      msg:'imagen principal del inicio'});
  }
  function editorDevImg(){
    var d=S.conf.devocional||{};
    editorImagenes({
      titulo:'Imagen del devocional',
      ayuda:'Es la foto de la tarjeta de devocional que se ve en el inicio. Funciona mejor cuadrada.',
      slots:[{k:'dev',etiqueta:'Foto del devocional',base:baseImg(d.imagen,'img/devocional'),actual:d.imagen||'img/devocional.webp',max:900,calidad:0.85}],
      aplicar:function(c,r){c.devocional=Object.assign({},c.devocional||{}); if(r.dev) c.devocional.imagen=r.dev;},
      msg:'imagen del devocional'});
  }
  function editorCats(){
    var cats=S.conf.categorias||[];
    if(!cats.length) return C.aviso('No hay categorías en el carrusel.');
    editorImagenes({
      titulo:'Imágenes del carrusel',
      ayuda:'Son las miniaturas de Artículos, Recursos, Contacto y Más en el inicio. Funcionan mejor apaisadas, de unos 400 × 300 px. Cambiá solo las que quieras.',
      slots:cats.map(function(c,i){return {k:String(i),etiqueta:c.nombre||('Imagen '+(i+1)),base:baseImg(c.imagen,'img/categorias/'+claveCat(c)),actual:c.imagen||'',max:700,calidad:0.82};}),
      aplicar:function(c,r){c.categorias=(c.categorias||[]).map(function(x,i){return r[String(i)]?Object.assign({},x,{imagen:r[String(i)]}):x;});},
      msg:'imágenes del carrusel del inicio'});
  }

  /* Frase del inicio (principal o secundaria) con el color de la letra y vista previa */
  function editorFrase(cual){
    var esP=cual==='principal', h=S.conf.hero||{};
    var campo=esP?'frasePrincipal':'fraseSecundaria', campoC=esP?'colorPrincipal':'colorSecundaria';
    var MAXC=esP?160:420, bueno=esP?3:4.5;
    var E={ocupado:false,sinBorrador:true,color:hexOk(h[campoC])?String(h[campoC]).toLowerCase():null};
    cont.innerHTML='<form class="form ed-form" id="ed-form" novalidate>'+
      '<h2 class="ed-titulo">'+(esP?'Frase principal':'Frase secundaria')+'</h2>'+
      '<label for="f-texto">Texto</label><textarea id="f-texto" rows="'+(esP?3:7)+'" maxlength="'+MAXC+'"></textarea><p class="nota" id="f-cont"></p>'+
      '<label for="f-color">Color de la letra</label>'+
      '<div class="ed-color"><input id="f-color" type="color" aria-label="Elegir otro color"><div class="ed-paleta" id="f-paleta">'+
        PALETA.map(function(p){return '<button type="button" class="ed-sw" data-color="'+p[0]+'" aria-label="'+esc(p[1])+'" title="'+esc(p[1])+'" style="background:'+p[0]+'"></button>';}).join('')+
      '</div></div>'+
      '<button type="button" class="enlace" data-orig="1">Usar el color original</button>'+
      '<p class="nota" id="f-color-msg"></p>'+
      '<label>Así se va a ver</label><div class="ed-prevhero"><p class="'+(esP?'pp':'ps')+'" id="f-prev"></p></div>'+
      '<div class="ed-final"><button type="button" class="btn-leer ancho" data-acc="e-publicar" id="e-pub">Publicar</button>'+
      '<button type="button" class="enlace" data-acc="cancelar">Cancelar</button></div>'+
      '<p class="nota ed-msg" id="ed-estado"></p></form>';
    $('f-texto').value=h[campo]||'';
    function refrescar(){
      var t=$('f-texto').value, col=E.color||COLOR_ORIG, r=contraste(col,CREMA), m;
      $('f-cont').textContent=t.length+' de '+MAXC+' letras';
      $('f-color').value=col;
      var pv=$('f-prev'); pv.textContent=t||'(sin texto)'; pv.style.color=col;
      if(r>=bueno) m='Se lee muy bien sobre el fondo claro.';
      else if(r>=3) m='Se lee, pero para letra chica conviene un color más oscuro.';
      else m='Ojo: este color casi no se ve sobre el fondo claro del inicio.';
      $('f-color-msg').textContent=(E.color?'Color elegido: '+E.color+'. ':'Color original del diseño. ')+m;
      Array.prototype.forEach.call(document.querySelectorAll('#f-paleta .ed-sw'),function(b){b.classList.toggle('on',b.getAttribute('data-color')===col);});
    }
    function foto(){return $('f-texto').value+'|'+(E.color||'');}
    var base0=foto(); E.cambios=function(){return foto()!==base0;};
    $('f-texto').addEventListener('input',refrescar);
    $('f-color').addEventListener('input',function(){E.color=this.value.toLowerCase();refrescar();});
    $('ed-form').addEventListener('click',function(e){
      var sw=e.target.closest('[data-color]'); if(sw){E.color=sw.getAttribute('data-color');refrescar();return;}
      if(e.target.closest('[data-orig]')){E.color=null;refrescar();}
    });
    refrescar();
    E.publicar=async function(){
      if(E.ocupado) return;
      var t=$('f-texto').value.replace(/\s*\n\s*/g,' ').trim();
      if(esP&&!t) return estado('Escribí la frase principal.','error');
      if(!E.cambios()) return estado('Todavía no cambiaste nada.','error');
      var poco=contraste(E.color||COLOR_ORIG,CREMA)<3;
      if(!confirm(poco?'Ojo: ese color casi no se va a leer sobre el fondo claro. ¿Publicar igual?':'¿Publicar el cambio ahora? Las lectoras lo van a ver en unos minutos.')) return;
      E.ocupado=true; $('e-pub').disabled=true; estado('Publicando… no cierres esta pantalla.');
      try{
        S.conf=objeto(await GH.modificarJSON('data/config.json',function(c){
          c=Object.assign({},objeto(c)); c.hero=Object.assign({},c.hero||{});
          c.hero[campo]=t; if(E.color) c.hero[campoC]=E.color; else delete c.hero[campoC];
          return c;
        },'Editor: '+(esP?'frase principal':'frase secundaria')+' del inicio'));
        S.vista='apariencia'; panel(); C.aviso('Publicado. En un par de minutos lo verán las lectoras.');
      }catch(er){
        E.ocupado=false; if($('e-pub')) $('e-pub').disabled=false; estado(GH.mensajeError(er),'error');
      }
    };
    ED=E;
  }

  /* ---------- Introducción del mes ("Tema de noviembre", arriba en la pantalla Devocional) ---------- */
  function mesTexto(m){
    if(!fechaValida(String(m)+'-01')) return String(m);
    var t=D.fechaLarga(m+'-01').replace(/^\d+ de /,'');
    return t.charAt(0).toUpperCase()+t.slice(1);
  }
  function mesPorDefecto(){
    var h=D.hoyISO(), cur=h.slice(0,7), dia=+h.slice(8,10);
    if(S.mes.some(function(x){return x.mes===cur;})||dia>=20){
      var y=+cur.slice(0,4), m=+cur.slice(5,7)+1; if(m>12){m=1;y++;}
      return y+'-'+('0'+m).slice(-2);
    }
    return cur;
  }
  function editorMes(orig){
    var E={ref:orig?orig.mes:'',ocupado:false,sinBorrador:true};
    cont.innerHTML='<form class="form ed-form" id="ed-form" novalidate>'+
      '<h2 class="ed-titulo">'+(orig?'Editar introducción del mes':'Introducción del mes')+'</h2>'+
      '<p class="nota">Es el texto que aparece arriba, en la pantalla Devocional, durante todo el mes.</p>'+
      '<label for="mes-mes">Mes</label><input id="mes-mes" type="month" placeholder="2026-11">'+
      '<label for="mes-titulo">Título</label><input id="mes-titulo" type="text" placeholder="Ej.: De qué trata este mes">'+
      campoTexto('mes-texto')+
      '<div class="ed-final"><button type="button" class="btn-sec" data-acc="e-vista" style="grid-column:1/-1">Vista previa</button>'+
      '<button type="button" class="btn-leer ancho" data-acc="e-publicar" id="e-pub">Publicar</button>'+
      '<button type="button" class="enlace" data-acc="cancelar">Cancelar</button></div>'+
      '<p class="nota ed-msg" id="ed-estado"></p></form>';
    $('mes-mes').value=orig?orig.mes:mesPorDefecto();
    $('mes-titulo').value=(orig&&orig.titulo)||'';
    $('mes-texto').value=parrafosATexto(C.lista(orig||{}));
    function leer(){return {mes:$('mes-mes').value.trim(),titulo:$('mes-titulo').value.trim(),texto:$('mes-texto').value};}
    var base=JSON.stringify(leer()); E.cambios=function(){return JSON.stringify(leer())!==base;};
    $('ed-form').addEventListener('click',function(ev){
      var s=ev.target.closest('[data-sub]'); if(s) alternarSubtitulo($(s.getAttribute('data-sub')));
    });
    E.vista=function(){
      var v=leer();
      mostrarVista(htmlVista({etiqueta:'Tema de '+mesTexto(v.mes).split(' de ')[0].toLowerCase(),titulo:v.titulo,parrafos:textoAParrafos(v.texto)}));
    };
    E.publicar=async function(){
      if(E.ocupado) return;
      var v=leer(), parr=textoAParrafos(v.texto);
      if(!/^\d{4}-\d{2}$/.test(v.mes)||!fechaValida(v.mes+'-01')) return estado('Elegí el mes (por ejemplo 2026-11).','error');
      if(!v.titulo) return estado('Escribí el título.','error');
      if(!parr.length) return estado('Escribí el texto de la introducción.','error');
      var choca=S.mes.some(function(x){return x.mes===v.mes&&x.mes!==E.ref;});
      if(choca&&!confirm('Ya hay una introducción para ese mes. ¿Querés reemplazarla?')) return;
      if(!confirm('¿Publicar esta introducción ahora?')) return;
      E.ocupado=true; $('e-pub').disabled=true; estado('Publicando… no cierres esta pantalla.');
      try{
        var it=Object.assign({},orig||{},{mes:v.mes,titulo:v.titulo,parrafos:parr});
        delete it.texto; delete it.contenido;
        S.mes=await GH.modificarJSON('data/mes.json',function(arr){
          arr=Array.isArray(arr)?arr:[];
          arr=arr.filter(function(x){return x.mes!==v.mes&&x.mes!==E.ref;});
          arr.push(it); arr.sort(function(a,b){return a.mes<b.mes?-1:a.mes>b.mes?1:0;});
          return arr;
        },'Editor: introducción de '+v.mes);
        S.vista='devocionales'; panel(); C.aviso('Introducción guardada.');
      }catch(er){
        E.ocupado=false; if($('e-pub')) $('e-pub').disabled=false; estado(GH.mensajeError(er),'error');
      }
    };
    ED=E;
  }
  function quitarMes(m){
    var x=S.mes.filter(function(y){return y.mes===m;})[0]; if(!x) return;
    if(!confirm('¿Quitar la introducción de '+mesTexto(m).toLowerCase()+' de la app? Dejará de verse para las lectoras.')) return;
    C.aviso('Quitando…');
    GH.modificarJSON('data/mes.json',function(arr){return (arr||[]).filter(function(y){return y.mes!==m;});},'Editor: quitar introducción de '+m)
      .then(function(l){S.mes=l;panel();C.aviso('Introducción quitada de la app.');}).catch(function(er){C.aviso(GH.mensajeError(er));});
  }

  /* ---------- acciones ---------- */
  function quitarArt(id){
    var a=S.arts.filter(function(x){return String(x.id)===id;})[0]; if(!a) return;
    if(!confirm('¿Quitar «'+a.titulo+'» de la app? Dejará de verse para las lectoras.')) return;
    C.aviso('Quitando…');
    GH.modificarJSON('data/articulos.json',function(arr){return (arr||[]).filter(function(x){return String(x.id)!==id;});},'Editor: quitar artículo «'+a.titulo+'»')
      .then(function(l){S.arts=l;panel();C.aviso('Artículo quitado de la app.');}).catch(function(er){C.aviso(GH.mensajeError(er));});
  }
  function quitarDev(f){
    var d=S.devs.filter(function(x){return x.fecha===f;})[0]; if(!d) return;
    if(!confirm('¿Quitar «'+d.titulo+'» de la app? Dejará de verse para las lectoras.')) return;
    C.aviso('Quitando…');
    GH.modificarJSON('data/devocionales.json',function(arr){return (arr||[]).filter(function(x){return x.fecha!==f;});},'Editor: quitar devocional del '+f)
      .then(function(l){S.devs=l;panel();C.aviso('Devocional quitado de la app.');}).catch(function(er){C.aviso(GH.mensajeError(er));});
  }
  function cancelar(){
    if(ED&&ED.cambios&&ED.cambios()&&ED.sinBorrador){
      dialogo('¿Salir sin publicar?','Hiciste cambios que todavía no están publicados.',[
        {t:'Seguir editando',cls:'btn-leer'},
        {t:'Salir sin publicar',cls:'btn-sec peligro',f:panel}]);
    } else if(ED&&ED.cambios&&ED.cambios()){
      dialogo('¿Qué querés hacer con lo escrito?','Hiciste cambios que todavía no están publicados.',[
        {t:'Guardar borrador',cls:'btn-leer',f:function(){if(ED.borrador()) panel();}},
        {t:'Salir sin guardar',cls:'btn-sec peligro',f:panel},
        {t:'Seguir editando',cls:'btn-sec'}]);
    } else panel();
  }
  var ACC={
    'salir':function(){GH.cerrar();acceso();},
    'olvidar':function(){if(confirm('¿Olvidar la llave guardada en este celular? Para volver a publicar habrá que cargarla otra vez.')){GH.olvidarLlave();acceso();}},
    'vista':function(b){S.vista=b.getAttribute('data-v');panel();},
    'cancelar':cancelar,
    'nuevo-art':function(){editorArticulo(null,null);},
    'edit-art':function(b){
      var id=b.getAttribute('data-id'), a=S.arts.filter(function(x){return String(x.id)===id;})[0]; if(!a) return;
      var bor=leerBor().filter(function(x){return x.tipo==='articulo'&&x.ref===id;})[0];
      editorArticulo(a,bor||null);
    },
    'cont-art':function(b){
      var bor=borPorId(b.getAttribute('data-id')); if(!bor) return;
      var orig=bor.ref?S.arts.filter(function(x){return String(x.id)===bor.ref;})[0]:null;
      editorArticulo(orig||null,bor);
    },
    'borra-art':function(b){quitarArt(b.getAttribute('data-id'));},
    'borra-bor':function(b){if(confirm('¿Descartar este borrador? No se puede recuperar.')){quitarBor(b.getAttribute('data-id'));panel();}},
    'nuevo-mas':function(){editorMas(null);},
    'edit-mas':function(b){var k=b.getAttribute('data-k'),x=S.mas.filter(function(y){return claveMas(y)===k;})[0]; if(x) editorMas(x);},
    'borra-mas':function(b){quitarMas(b.getAttribute('data-k'));},
    'nuevo-rec':function(){editorRecurso(null);},
    'edit-rec':function(b){var k=b.getAttribute('data-k'),x=S.recursos.filter(function(y){return claveRec(y)===k;})[0]; if(x) editorRecurso(x);},
    'borra-rec':function(b){quitarRec(b.getAttribute('data-k'));},
    'edit-test':function(){editorTestimonio();},
    'edit-cont':function(){editorContacto();},
    'ap-hero-img':function(){editorHeroImg();},
    'ap-frase':function(b){editorFrase(b.getAttribute('data-k')==='secundaria'?'secundaria':'principal');},
    'ap-dev-img':function(){editorDevImg();},
    'ap-cats':function(){editorCats();},
    'nuevo-mes':function(){editorMes(null);},
    'edit-mes':function(b){var m=b.getAttribute('data-m'),x=S.mes.filter(function(y){return y.mes===m;})[0]; if(x) editorMes(x);},
    'borra-mes':function(b){quitarMes(b.getAttribute('data-m'));},
    'nuevo-dev':function(){editorDevocional(null,null);},
    'edit-dev':function(b){
      var f=b.getAttribute('data-f'), d=S.devs.filter(function(x){return x.fecha===f;})[0]; if(!d) return;
      var bor=leerBor().filter(function(x){return x.tipo==='devocional'&&x.ref===f;})[0];
      editorDevocional(d,bor||null);
    },
    'cont-dev':function(b){
      var bor=borPorId(b.getAttribute('data-id')); if(!bor) return;
      var orig=bor.ref?S.devs.filter(function(x){return x.fecha===bor.ref;})[0]:null;
      editorDevocional(orig||null,bor);
    },
    'borra-dev':function(b){quitarDev(b.getAttribute('data-f'));},
    'lote':vistaLote, 'lote-revisar':revisarLote, 'lote-publicar':publicarLote,
    'e-vista':function(){if(ED) ED.vista();},
    'e-borrador':function(){if(ED) ED.borrador();},
    'e-publicar':function(){if(ED) ED.publicar();}
  };
  cont.addEventListener('click',function(e){
    var b=e.target.closest('[data-acc]'); if(!b) return;
    var f=ACC[b.getAttribute('data-acc')]; if(f) f(b,e);
  });

  /* ---------- arranque ---------- */
  C.iniciarPagina('editoras');
  C.get('data/editor.json').then(function(cfg){
    var r=Object.assign({},cfg.repo||{});
    /* Si la app se abre desde una dirección github.io, el repositorio es el de ESA dirección (usuario.github.io/repositorio/):
       así una copia del proyecto siempre guarda en sí misma y nunca en el repositorio de otra copia.
       data/editor.json se usa cuando la página está en otro dominio. */
    S.detectado=false;
    if(/\.github\.io$/i.test(location.hostname)){
      var seg=location.pathname.split('/')[1]||'';
      r.owner=location.hostname.split('.')[0];
      r.repo=(seg&&seg.indexOf('.')<0)?seg:location.hostname.toLowerCase();   /* sitio de usuario: el repositorio se llama usuario.github.io */
      S.detectado=true;
    }
    S.cfg={owner:(r.owner||'').trim(),repo:(r.repo||'').trim(),rama:(r.rama||'main').trim(),api:cfg.api||''};
    S.cats=Array.isArray(cfg.categorias)?cfg.categorias:[];
    acceso();
  }).catch(function(){cont.innerHTML='<div class="error-carga">No se pudo cargar data/editor.json.</div>';});
})();
