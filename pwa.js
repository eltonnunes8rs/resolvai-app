// Instalação do app + aviso de versão nova.
(function () {
  'use strict';
  var VERSAO = window.RESOLVAI_VERSAO || '0';
  function guardar(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function ler(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  var instalado = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;

  var topo = document.createElement('div');
  topo.id = 'avisos-topo';
  document.body.insertBefore(topo, document.body.firstChild);

  // ---------- Service worker ----------
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }

  // ---------- Versão nova ----------
  var avisouVersao = null;
  function avisarNovaVersao(nova) {
    if (avisouVersao === nova) return;
    avisouVersao = nova;
    var d = document.getElementById('aviso-versao');
    if (!d) { d = document.createElement('div'); d.id = 'aviso-versao'; topo.appendChild(d); }
    d.innerHTML = '<span>🔄 Tem versão nova do app (v' + nova + ').</span> <button type="button" id="atualizar">Atualizar agora</button>';
    document.getElementById('atualizar').onclick = function () {
      this.disabled = true; this.textContent = 'Atualizando…';
      var fim = function () { location.reload(); };
      var limpar = window.caches ? caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); }) : Promise.resolve();
      limpar.then(function () {
        return navigator.serviceWorker ? navigator.serviceWorker.getRegistrations().then(function (rs) { return Promise.all(rs.map(function (r) { return r.update(); })); }) : null;
      }).then(fim, fim);
    };
  }
  function verificar() {
    fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
      if (j && j.versao && j.versao !== VERSAO) avisarNovaVersao(j.versao);
    }).catch(function () {});
  }
  verificar();
  setInterval(verificar, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) verificar(); });

  // ---------- Instalar ----------
  var evento = null;
  function dispensado() { var t = parseInt(ler('resolvai_instalar_ate') || '0', 10); return t > Date.now(); }
  function mostrarInstalar() {
    if (instalado || dispensado() || document.getElementById('aviso-instalar')) return;
    if (!evento && !ios) return;
    var d = document.createElement('div');
    d.id = 'aviso-instalar'; d.className = 'card';
    d.innerHTML = '<h2>📲 Instale o app</h2><p class="vazio">Fica na tela do seu celular, sem precisar procurar o link.</p>' +
      (evento
        ? '<button type="button" id="instalar">Instalar o app</button>'
        : '<p>No iPhone: toque em <b>Compartilhar</b> (o quadrado com a seta) e depois em <b>Adicionar à Tela de Início</b>.</p>') +
      '<p><a href="#" id="agora-nao">Agora não</a></p>';
    topo.appendChild(d);
    document.getElementById('agora-nao').onclick = function (e) {
      e.preventDefault(); guardar('resolvai_instalar_ate', String(Date.now() + 7 * 24 * 3600 * 1000)); d.remove();
    };
    var b = document.getElementById('instalar');
    if (b) b.onclick = function () {
      evento.prompt();
      evento.userChoice.then(function (r) {
        if (r.outcome !== 'accepted') guardar('resolvai_instalar_ate', String(Date.now() + 7 * 24 * 3600 * 1000));
        evento = null; d.remove();
      });
    };
  }
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); evento = e; mostrarInstalar(); });
  window.addEventListener('appinstalled', function () { var d = document.getElementById('aviso-instalar'); if (d) d.remove(); evento = null; });
  if (ios) setTimeout(mostrarInstalar, 1500);
})();
