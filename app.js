(function () {
  'use strict';
  var API = window.RESOLVAI_API;
  var $app = document.getElementById('app');
  var KEY = 'resolvai_sessao';

  function lerSessao() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function gravarSessao(s) { try { if (s) localStorage.setItem(KEY, JSON.stringify(s)); else localStorage.removeItem(KEY); } catch (e) {} }

  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function brl(v) { return v == null ? '-' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function dh(v) { if (!v) return '-'; var d = new Date(v); return isNaN(d) ? esc(v) : d.toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }

  function api(body) {
    return fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .catch(function () { return { ok: false, erro: 'Sem conexão com o servidor.' }; });
  }

  // ---------- Login ----------
  function telaLogin(etapa, tel) {
    $app.innerHTML =
      '<div class="login card"><h2>ResolvAÍ</h2>' +
      (etapa === 'codigo'
        ? '<p class="vazio">Enviamos um código de 6 dígitos para o seu WhatsApp.</p>' +
          '<input id="cod" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="Código">' +
          '<button id="ok">Entrar</button><button id="voltar" class="sec">Trocar número</button>'
        : '<p class="vazio">Digite seu WhatsApp com DDD para receber o código de acesso.</p>' +
          '<input id="tel" inputmode="tel" autocomplete="tel" placeholder="(46) 99999-9999">' +
          '<button id="ok">Receber código</button>') +
      '<div class="erro" id="erro"></div></div>';
    var $erro = document.getElementById('erro'), $ok = document.getElementById('ok');
    if (etapa === 'codigo') {
      document.getElementById('voltar').onclick = function () { telaLogin('tel'); };
      $ok.onclick = function () {
        var cod = document.getElementById('cod').value.trim();
        $ok.disabled = true; $erro.textContent = '';
        api({ acao: 'entrar', telefone: tel, codigo: cod }).then(function (r) {
          $ok.disabled = false;
          if (r.ok) { gravarSessao({ token: r.token, papel: r.papel, nome: r.nome }); iniciar(); }
          else $erro.textContent = r.erro || 'Não foi possível entrar.';
        });
      };
    } else {
      $ok.onclick = function () {
        var t = document.getElementById('tel').value.replace(/\D/g, '');
        if (t.length < 10) { $erro.textContent = 'Digite o número com DDD.'; return; }
        if (t.length <= 11) t = '55' + t;
        $ok.disabled = true; $erro.textContent = '';
        api({ acao: 'codigo', telefone: t }).then(function () { telaLogin('codigo', t); });
      };
    }
  }

  // ---------- Painel do gerente ----------
  function topo(s) {
    return '<header><h1>ResolvAÍ</h1><div>' + esc(s.nome || '') + ' <button id="sair" class="sec mini">Sair</button></div></header>';
  }
  function tabela(cols, linhas) {
    if (!linhas || !linhas.length) return '<p class="vazio">Nada por aqui.</p>';
    return '<div class="tabela"><table><tr>' + cols.map(function (c) { return '<th>' + c[0] + '</th>'; }).join('') + '</tr>' +
      linhas.map(function (l) { return '<tr>' + cols.map(function (c) { return '<td>' + c[1](l) + '</td>'; }).join('') + '</tr>'; }).join('') + '</table></div>';
  }
  function btn(cmd, id, rotulo, cls) {
    return '<button class="mini ' + (cls || '') + '" data-cmd="' + cmd + '" data-id="' + id + '">' + rotulo + '</button>';
  }
  var ROTULO = { APROVAR: 'Aprovar o orçamento', RECUSAR: 'Recusar o orçamento', TROCAR: 'Trocar de prestador', PAGO: 'Marcar como pago', CANCELAR: 'Cancelar o pedido', RETOMAR: 'Retomar o bot' };
  function ligarAcoes(s) {
    $app.querySelectorAll('button[data-cmd]').forEach(function (b) {
      b.onclick = function () {
        var cmd = b.getAttribute('data-cmd'), id = b.getAttribute('data-id'), texto = '';
        if (cmd === 'RECUSAR') {
          var m = window.prompt('Motivo da recusa (o prestador recebe e refaz o orçamento):', '');
          if (m === null) return;
          texto = m;
        } else if (!window.confirm((ROTULO[cmd] || cmd) + ' — pedido #' + id + '?')) return;
        b.disabled = true;
        api({ acao: 'comando', token: s.token, cmd: cmd, pedido: id, texto: texto }).then(function (r) {
          if (!r.ok) { b.disabled = false; window.alert(r.erro || 'Não foi possível enviar.'); return; }
          window.alert(r.aviso || 'Comando enviado.');
          setTimeout(function () { iniciar(); }, 2500);
        });
      };
    });
  }

  function painelGerente(s) {
    $app.innerHTML = topo(s) + '<main><p class="vazio">Carregando…</p></main>';
    document.getElementById('sair').onclick = sair;
    api({ acao: 'gerente_resumo', token: s.token }).then(function (r) {
      if (!r.ok) { gravarSessao(null); telaLogin('tel'); return; }
      var noAprovar = {}; (r.aprovar || []).forEach(function (l) { noAprovar[l.id] = true; });
      var pedidos = (r.pedidos || []).filter(function (l) { return !noAprovar[l.id]; });   // não repete o que já está em "para aprovar"
      var st = r.status || {}, kp = Object.keys(st).map(function (k) { return '<div class="kpi"><b>' + st[k] + '</b><span>' + esc(k) + '</span></div>'; }).join('') || '<p class="vazio">Sem pedidos.</p>';
      $app.innerHTML = topo(s) + '<main>' +
        '<div class="card"><h2>Pedidos por situação</h2><div class="grid">' + kp + '</div></div>' +
        '<div class="card"><h2>Orçamentos para aprovar</h2>' + tabela([
          ['Pedido', function (l) { return linkPedido(l.id); }], ['Cliente', function (l) { return esc(l.cliente); }],
          ['Serviço', function (l) { return esc(l.servico); }], ['Prestador', function (l) { return esc(l.prestador); }],
          ['Valor', function (l) { return brl(l.valor_orcado); }], ['Local', function (l) { return esc((l.bairro || '') + (l.cidade ? ' / ' + l.cidade : '')); }],
          ['Ações', function (l) { return btn('APROVAR', l.id, 'Aprovar') + ' ' + btn('RECUSAR', l.id, 'Recusar', 'sec') + ' ' + btn('TROCAR', l.id, 'Trocar prestador', 'sec'); }]
        ], r.aprovar) + '</div>' +
        '<div class="card"><h2>Pedidos recentes</h2>' + tabela([
          ['Pedido', function (l) { return linkPedido(l.id); }], ['Cliente', function (l) { return esc(l.cliente); }],
          ['Serviço', function (l) { return esc(l.servico); }], ['Prestador', function (l) { return esc(l.prestador); }],
          ['Situação', function (l) { return '<span class="tag">' + esc(l.status || '-') + '</span>' + (l.pagamento_status ? ' <span class="tag warn">Pgto: ' + esc(l.pagamento_status) + '</span>' : ''); }],
          ['Valor', function (l) { return brl(l.valor_orcado); }], ['Agenda', function (l) { return dh(l.agenda_inicio); }],
          ['Ações', function (l) {
            var a = [];
            if (l.pagamento_status && l.pagamento_status !== 'PAGO') a.push(btn('PAGO', l.id, 'Marcar pago'));
            if (l.bot_pausado) a.push(btn('RETOMAR', l.id, 'Retomar bot', 'sec'));
            if (l.status !== 'CANCELADO' && l.status !== 'CONCLUIDO') a.push(btn('CANCELAR', l.id, 'Cancelar', 'sec'));
            return a.join(' ') || '-';
          }]
        ], pedidos) + '</div>' +
        '<div class="card"><h2>Agenda dos próximos 7 dias</h2>' + tabela([
          ['Quando', function (l) { return dh(l.inicio); }], ['Pedido', function (l) { return linkPedido(l.id); }],
          ['Prestador', function (l) { return esc(l.prestador); }], ['Cliente', function (l) { return esc(l.cliente); }],
          ['Serviço', function (l) { return esc(l.servico); }], ['Situação', function (l) { return '<span class="tag">' + esc(l.status) + '</span>'; }]
        ], r.agenda) + '</div>' +
        '<div class="card"><h2>Prestadores</h2>' + tabela([
          ['Nome', function (l) { return esc(l.nome); }],
          ['Situação', function (l) { return l.ativo ? '<span class="tag">Ativo</span>' : '<span class="tag warn">Inativo</span>'; }]
        ], r.prestadores) + '</div>' +
        '<div class="card"><h2>Avaliações que pedem atenção</h2>' + tabela([
          ['Pedido', function (l) { return linkPedido(l.id); }], ['Prestador', function (l) { return esc(l.prestador); }],
          ['Nota', function (l) { return '<span class="tag ' + (l.nota === 'PESSIMO' ? 'bad' : 'warn') + '">' + esc(l.nota) + '</span>'; }],
          ['Comentário', function (l) { return esc(l.comentario || '-'); }]
        ], r.avaliacoes_ruins) + '</div></main>';
      document.getElementById('sair').onclick = sair;
      ligarAcoes(s);
    });
  }

  var _fotoCache = {};
  function carregarFoto(s, id) {
    if (_fotoCache[id]) return _fotoCache[id];
    var url = String(window.RESOLVAI_API).replace(/app-api$/, 'app-foto');
    _fotoCache[id] = fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: s.token, foto: String(id) }) })
      .then(function (r) { if (!r.ok) throw new Error('x'); return r.blob(); })
      .then(function (b) { return URL.createObjectURL(b); });
    _fotoCache[id].catch(function () { delete _fotoCache[id]; });
    return _fotoCache[id];
  }

  function abrirCaixa(s, lista, i) {
    var box = document.getElementById('caixa-foto');
    if (!box) { box = document.createElement('div'); box.id = 'caixa-foto'; document.body.appendChild(box); }
    function mostrar() {
      var f = lista[i];
      box.innerHTML = '<button class="cx-x" aria-label="Fechar">✕</button>' + (lista.length > 1 ? '<button class="cx-p" aria-label="Anterior">‹</button><button class="cx-n" aria-label="Próxima">›</button>' : '') +
        '<div class="cx-img"><span class="vazio">Carregando…</span></div><div class="cx-leg">' + (i + 1) + ' / ' + lista.length + (f.legenda ? ' · ' + esc(f.legenda) : '') + '</div>';
      box.className = 'aberta';
      box.querySelector('.cx-x').onclick = fechar;
      if (lista.length > 1) {
        box.querySelector('.cx-p').onclick = function (e) { e.stopPropagation(); i = (i - 1 + lista.length) % lista.length; mostrar(); };
        box.querySelector('.cx-n').onclick = function (e) { e.stopPropagation(); i = (i + 1) % lista.length; mostrar(); };
      }
      var alvo = box.querySelector('.cx-img'), atual = i;
      carregarFoto(s, f.id).then(function (u) { if (atual === i) alvo.innerHTML = '<img src="' + u + '" alt="Foto ' + (i + 1) + '">'; })
        .catch(function () { alvo.innerHTML = '<span class="vazio">Não consegui carregar a foto.</span>'; });
    }
    function fechar() { box.className = ''; box.innerHTML = ''; document.removeEventListener('keydown', tecla); }
    function tecla(e) {
      if (e.key === 'Escape') fechar();
      else if (e.key === 'ArrowRight' && lista.length > 1) { i = (i + 1) % lista.length; mostrar(); }
      else if (e.key === 'ArrowLeft' && lista.length > 1) { i = (i - 1 + lista.length) % lista.length; mostrar(); }
    }
    box.onclick = function (e) { if (e.target === box) fechar(); };
    document.addEventListener('keydown', tecla);
    mostrar();
  }

  function linkPedido(id) { return '<a href="#pedido=' + id + '">#' + id + '</a>'; }

  function painelPedido(s, id) {
    $app.innerHTML = topo(s) + '<main><p class="vazio">Carregando…</p></main>';
    document.getElementById('sair').onclick = sair;
    api({ acao: 'pedido', token: s.token, pedido: String(id) }).then(function (r) {
      if (!r.ok) {
        if (r.erro === 'Sessão inválida.') { gravarSessao(null); telaLogin('tel'); return; }
        $app.innerHTML = topo(s) + '<main><p><a href="#">← Voltar</a></p><div class="card">' + esc(r.erro || 'Erro.') + '</div></main>';
        document.getElementById('sair').onclick = sair; return;
      }
      var p = r.pedido, linhas = [
        ['Cliente', p.cliente], ['Serviço', p.servico], ['Prestador', p.prestador], ['Endereço', p.endereco],
        ['Terreno', p.tamanho], ['O cliente espera', p.expectativa],
        ['Orçamento', p.valor_orcado != null ? brl(p.valor_orcado) + (p.duracao_min ? ' • ' + Math.round(p.duracao_min / 60 * 10) / 10 + ' h' : '') : null],
        ['Obs. do orçamento', p.observacao_orcamento], ['Situação do orçamento', p.orcamento_status], ['Motivo da recusa', p.orcamento_motivo],
        ['Agenda', p.agenda_inicio ? dh(p.agenda_inicio) : null], ['Pagamento', p.pagamento_status], ['Forma de pagamento', p.forma_pagamento]
      ].filter(function (x) { return x[1] != null && x[1] !== ''; });
      var acoes = [];
      if (p.orcamento_status === 'AGUARDANDO_GERENTE') acoes.push(btn('APROVAR', p.id, 'Aprovar'), btn('RECUSAR', p.id, 'Recusar', 'sec'), btn('TROCAR', p.id, 'Trocar prestador', 'sec'));
      if (p.pagamento_status && p.pagamento_status !== 'PAGO') acoes.push(btn('PAGO', p.id, 'Marcar pago'));
      if (p.bot_pausado) acoes.push(btn('RETOMAR', p.id, 'Retomar bot', 'sec'));
      if (p.status !== 'CANCELADO' && p.status !== 'CONCLUIDO') acoes.push(btn('CANCELAR', p.id, 'Cancelar', 'sec'));
      var av = r.avaliacao ? '<div class="card"><h2>Avaliação</h2><p><span class="tag ' + (r.avaliacao.nota === 'PESSIMO' ? 'bad' : (r.avaliacao.nota === 'REGULAR' ? 'warn' : '')) + '">' + esc(r.avaliacao.nota) + '</span></p>' +
        (r.avaliacao.comentario ? '<p>' + esc(r.avaliacao.comentario) + '</p>' : '<p class="vazio">Sem comentário.</p>') + '</div>' : '';
      $app.innerHTML = topo(s) + '<main><p><a href="#">← Voltar</a></p>' +
        '<div class="card"><h2>Pedido #' + p.id + ' <span class="tag">' + esc(p.status || '-') + '</span></h2>' +
        '<table>' + linhas.map(function (x) { return '<tr><th>' + x[0] + '</th><td>' + esc(x[1]) + '</td></tr>'; }).join('') + '</table>' +
        (acoes.length ? '<p class="acoes">' + acoes.join(' ') + '</p>' : '') + '</div>' +
        fotosCard(p) +
        av +
        '<div class="card"><h2>Linha do tempo</h2>' + ((r.linha_do_tempo || []).length ? '<ul class="tempo">' + r.linha_do_tempo.map(function (e) { return '<li><b>' + dh(e.quando) + '</b> ' + esc(e.evento) + '</li>'; }).join('') + '</ul>' : '<p class="vazio">Sem eventos.</p>') + '</div>' +
        '<div class="card"><h2>Conversa com o cliente</h2>' + ((r.conversa || []).length ? '<div class="chat">' + r.conversa.map(function (m) {
          var saida = m.direcao === 'SAIDA';
          return '<div class="bolha ' + (saida ? 'bot' : 'cli') + '"><small>' + (saida ? 'Bot' : esc(m.papel === 'CLIENTE' ? 'Cliente' : m.papel)) + (m.via_botao ? ' · botão' : '') + ' · ' + dh(m.quando) + '</small>' + esc(m.texto) + '</div>';
        }).join('') + '</div>' : '<p class="vazio">Sem mensagens registradas.</p>') + '</div></main>';
      document.getElementById('sair').onclick = sair;
      ligarAcoes(s);
      var lista = p.fotos_lista || [];
      Array.prototype.forEach.call(document.querySelectorAll('.miniatura'), function (el, k) {
        carregarFoto(s, lista[k].id).then(function (u) { el.style.backgroundImage = 'url(' + u + ')'; el.classList.add('ok'); }).catch(function () { el.textContent = '⚠'; });
        el.onclick = function () { abrirCaixa(s, lista, k); };
      });
    });
  }

  function fotosCard(p) {
    var l = p.fotos_lista || [];
    if (!l.length && !p.drive_url) return '';
    return '<div class="card"><h2>Fotos' + (l.length ? ' (' + l.length + ')' : '') + '</h2>' +
      (l.length ? '<div class="grade-fotos">' + l.map(function () { return '<button class="miniatura" type="button" aria-label="Ampliar foto"></button>'; }).join('') + '</div>' : '<p class="vazio">Nenhuma foto registrada.</p>') +
      (p.drive_url ? '<p><a href="' + esc(p.drive_url) + '" target="_blank" rel="noopener">Abrir pasta no Drive</a></p>' : '') + '</div>';
  }

  function painelPrestador(s) {
    $app.innerHTML = topo(s) + '<main><div class="card"><h2>Olá, ' + esc(s.nome || '') + '</h2><p class="vazio">A agenda e os serviços do prestador chegam na próxima etapa.</p></div></main>';
    document.getElementById('sair').onclick = sair;
  }

  function sair() {
    var s = lerSessao(); gravarSessao(null);
    if (s) api({ acao: 'sair', token: s.token });
    telaLogin('tel');
  }

  function iniciar() {
    var s = lerSessao();
    if (!s) return telaLogin('tel');
    var m = /^#pedido=(\d+)$/.exec(location.hash || '');
    if (s.papel === 'GERENTE') { if (m) painelPedido(s, m[1]); else painelGerente(s); }
    else painelPrestador(s);
  }
  window.addEventListener('hashchange', iniciar);
  iniciar();
})();
