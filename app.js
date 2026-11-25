(function () {
  'use strict';
  var API = window.RESOLVAI_API;
  var $app = document.getElementById('app');
  var KEY = 'resolvai_sessao';
  var quieto = false;   // true durante a atualização automática: não mostra "Carregando…"

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
      '<div class="login card"><img src="logo.svg" alt="ResolvAÍ" class="logo-grande"><h2>ResolvAÍ</h2>' +
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
    var nav = s.papel === 'GERENTE' ? '<nav class="menu"><a href="#" class="' + (/^#(equipe)?$/.test(location.hash || '') && location.hash !== '#equipe' ? 'on' : '') + '">Painel</a><a href="#equipe" class="' + (location.hash === '#equipe' ? 'on' : '') + '">Equipe</a></nav>' : '';
    return '<header><h1><img src="logo.svg" alt="" class="logo-mini">ResolvAÍ</h1><div>' + esc(s.nome || '') + ' <button id="sair" class="sec mini">Sair</button></div></header>' + nav;
  }
  function tabela(cols, linhas) {
    if (!linhas || !linhas.length) return '<p class="vazio">Nada por aqui.</p>';
    return '<div class="tabela"><table><tr class="cab">' + cols.map(function (c) { return '<th>' + c[0] + '</th>'; }).join('') + '</tr>' +
      linhas.map(function (l) {
        return '<tr>' + cols.map(function (c) {
          var acoes = c[0] === 'Ações';
          return '<td' + (acoes ? ' class="cel-acoes"' : ' data-label="' + c[0] + '"') + '>' + c[1](l) + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</table></div>';
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
    var calado = quieto; if (!calado) $app.innerHTML = topo(s) + '<main><p class="vazio">Carregando…</p></main>';
    document.getElementById('sair').onclick = sair;
    api({ acao: 'gerente_resumo', token: s.token }).then(function (r) {
      if (!r.ok) { if (calado) return; if (r.erro === 'Sessão inválida.') { gravarSessao(null); telaLogin('tel'); return; } $app.innerHTML = topo(s) + '<main><div class="card">' + esc(r.erro || 'Erro.') + '</div></main>'; document.getElementById('sair').onclick = sair; return; }
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
    var calado = quieto; if (!calado) $app.innerHTML = topo(s) + '<main><p class="vazio">Carregando…</p></main>';
    document.getElementById('sair').onclick = sair;
    api({ acao: 'pedido', token: s.token, pedido: String(id) }).then(function (r) {
      if (!r.ok) {
        if (calado && r.erro !== 'Sessão inválida.') return;
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
    if (!l.length) return '';
    return '<div class="card"><h2>Fotos' + (l.length ? ' (' + l.length + ')' : '') + '</h2>' +
      (l.length ? '<div class="grade-fotos">' + l.map(function () { return '<button class="miniatura" type="button" aria-label="Ampliar foto"></button>'; }).join('') + '</div>' : '<p class="vazio">Nenhuma foto registrada.</p>') +
'</div>';
  }

  // ---------- Prestador ----------
  var FASE_ROT = { NOVO: 'Novo pedido', REFAZER: 'Refazer orçamento', AGUARDANDO_GERENTE: 'Aguardando o gerente', AGUARDANDO_CLIENTE: 'Aguardando o cliente',
    AGENDADO: 'Agendado', EM_ANDAMENTO: 'Em andamento', RECUSADO: 'Devolvido ao gerente', CONCLUIDO: 'Concluído' };
  var SECOES = [
    ['Precisam de você', ['NOVO', 'REFAZER']], ['Em andamento', ['EM_ANDAMENTO']], ['Agendados', ['AGENDADO']],
    ['Aguardando aprovação', ['AGUARDANDO_GERENTE', 'AGUARDANDO_CLIENTE']], ['Devolvidos ao gerente', ['RECUSADO']], ['Concluídos', ['CONCLUIDO']]
  ];

  function ligarFotos(s, lista) {
    Array.prototype.forEach.call(document.querySelectorAll('.miniatura'), function (el, k) {
      carregarFoto(s, lista[k].id).then(function (u) { el.style.backgroundImage = 'url(' + u + ')'; el.classList.add('ok'); }).catch(function () { el.textContent = '⚠'; });
      el.onclick = function () { abrirCaixa(s, lista, k); };
    });
  }
  function dia(v) { var d = new Date(v); return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' }); }
  function hora(v) { var d = new Date(v); return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
  function sessaoExpirou(r, s) { if (!r.ok && r.erro === 'Sessão inválida.') { gravarSessao(null); telaLogin('tel'); return true; } return false; }

  function painelPrestador(s) {
    var calado = quieto; if (!calado) $app.innerHTML = topo(s) + '<main><p class="vazio">Carregando…</p></main>';
    document.getElementById('sair').onclick = sair;
    api({ acao: 'prestador_resumo', token: s.token }).then(function (r) {
      if (sessaoExpirou(r, s)) return;
      if (!r.ok && calado) return;
      if (!r.ok) { $app.innerHTML = topo(s) + '<main><div class="card">' + esc(r.erro || 'Erro.') + '</div></main>'; document.getElementById('sair').onclick = sair; return; }
      var ped = r.pedidos || [], html = '<main>';
      var secs = SECOES.map(function (sc) {
        var l = ped.filter(function (p) { return sc[1].indexOf(p.fase) >= 0; });
        if (!l.length) return '';
        return '<div class="card"><h2>' + sc[0] + ' (' + l.length + ')</h2>' + l.map(function (p) {
          return '<a class="item-pedido" href="#pedido=' + p.id + '"><b>#' + p.id + '</b> ' + esc(p.servico || 'Serviço') + ' — ' + esc(p.cliente || '') +
            '<small>' + esc(p.local || '') + (p.agenda_inicio ? ' · ' + dh(p.agenda_inicio) : '') + (p.valor_orcado != null ? ' · ' + brl(p.valor_orcado) : '') +
            ' · <span class="tag ' + (p.fase === 'NOVO' || p.fase === 'REFAZER' ? 'warn' : '') + '">' + esc(FASE_ROT[p.fase] || p.fase) + '</span></small></a>';
        }).join('') + '</div>';
      }).join('');
      var ag = r.agenda || [], porDia = {}, ordem = [];
      ag.forEach(function (x) { var k = dia(x.inicio); if (!porDia[k]) { porDia[k] = []; ordem.push(k); } porDia[k].push(x); });
      var agHtml = '<div class="card"><h2>Minha agenda (15 dias)</h2>' + (ordem.length ? ordem.map(function (k) {
        return '<h3 class="dia">' + esc(k) + '</h3>' + porDia[k].map(function (x) {
          return '<a class="item-pedido" href="#pedido=' + x.id + '"><b>' + hora(x.inicio) + (x.fim ? '–' + hora(x.fim) : '') + '</b> ' + esc(x.servico || 'Serviço') + ' — ' + esc(x.cliente || '') + '<small>#' + x.id + ' · ' + esc(x.local || '') + '</small></a>';
        }).join('');
      }).join('') : '<p class="vazio">Nada agendado.</p>') + '</div>';
      $app.innerHTML = topo(s) + '<main>' + (secs || '<div class="card"><p class="vazio">Nenhum pedido no momento.</p></div>') + agHtml + '</main>';
      document.getElementById('sair').onclick = sair;
    });
  }

  function painelPedidoPrest(s, id) {
    var calado = quieto; if (!calado) $app.innerHTML = topo(s) + '<main><p class="vazio">Carregando…</p></main>';
    document.getElementById('sair').onclick = sair;
    api({ acao: 'prestador_pedido', token: s.token, pedido: String(id) }).then(function (r) {
      if (sessaoExpirou(r, s)) return;
      if (!r.ok && calado) return;
      if (!r.ok) { $app.innerHTML = topo(s) + '<main><p><a href="#">← Voltar</a></p><div class="card">' + esc(r.erro || 'Erro.') + '</div></main>'; document.getElementById('sair').onclick = sair; return; }
      var p = r.pedido, ac = p.acoes || [];
      var linhas = [['Serviço', p.servico], ['Cliente', p.cliente], ['Endereço', p.endereco], ['Terreno', p.tamanho], ['O cliente espera', p.expectativa],
        ['Orçamento', p.valor_orcado != null ? brl(p.valor_orcado) + (p.duracao_min ? ' • ' + Math.round(p.duracao_min / 60 * 10) / 10 + ' h' : '') : null],
        ['Obs. do orçamento', p.observacao_orcamento], ['Agenda', p.agenda_inicio ? dh(p.agenda_inicio) : null],
        ['Pagamento', p.agenda_inicio ? (p.pago ? 'Confirmado' : 'Aguardando o cliente') : null]
      ].filter(function (x) { return x[1] != null && x[1] !== ''; });
      var botoes = '';
      if (ac.indexOf('ACEITAR') >= 0) botoes += '<button class="mini" data-pa="ACEITAR">Aceitar</button> ';
      if (ac.indexOf('ORCAR') >= 0) botoes += '<button class="mini" id="abrir-orc">Enviar orçamento</button> ';
      if (ac.indexOf('RECUSAR') >= 0) botoes += '<button class="mini sec" data-pa="RECUSAR">Recusar</button> ';
      if (ac.indexOf('INICIAR') >= 0) botoes += '<button class="mini" data-pa="INICIAR">Iniciar serviço</button> ';
      if (ac.indexOf('FINALIZAR') >= 0) botoes += '<button class="mini" data-pa="FINALIZAR">Finalizar serviço</button> ';
      var aviso = p.fase === 'REFAZER' ? '<p class="alerta">O gerente pediu para refazer o orçamento' + (p.motivo_refazer ? ': ' + esc(p.motivo_refazer) : '.') + '</p>' : '';
      var nota = ac.indexOf('FINALIZAR') >= 0 ? '<p class="vazio">Antes de finalizar, envie as fotos do resultado pelo WhatsApp: elas seguem para o cliente junto com a avaliação.</p>' : '';
      var form = ac.indexOf('ORCAR') >= 0 ?
        '<form id="form-orc" class="card" hidden><h2>Orçamento</h2>' +
        '<label>Valor (R$)<input id="orc-valor" inputmode="decimal" placeholder="350,00" required></label>' +
        '<label>Horas de serviço<input id="orc-horas" inputmode="decimal" placeholder="2 ou 2,5" required></label>' +
        '<label>Observação (opcional)<input id="orc-obs" maxlength="200" placeholder="Ex.: inclui descarte do material"></label>' +
        '<button type="submit">Enviar ao gerente</button> <button type="button" class="sec" id="cancelar-orc">Cancelar</button></form>' : '';
      $app.innerHTML = topo(s) + '<main><p><a href="#">← Voltar</a></p>' + aviso +
        '<div class="card"><h2>Pedido #' + p.id + ' <span class="tag">' + esc(FASE_ROT[p.fase] || p.fase) + '</span></h2>' +
        '<table>' + linhas.map(function (x) { return '<tr><th>' + x[0] + '</th><td>' + esc(x[1]) + '</td></tr>'; }).join('') + '</table>' +
        (p.mapa ? '<p><a href="' + esc(p.mapa) + '" target="_blank" rel="noopener">📍 Abrir no mapa</a></p>' : '') +
        (botoes ? '<p class="acoes">' + botoes + '</p>' : '') + nota + '</div>' + form + fotosCard(p) + '</main>';
      document.getElementById('sair').onclick = sair;
      ligarFotos(s, p.fotos_lista || []);

      function enviar(acao, extra, btnEl, depoisMs) {
        if (btnEl) btnEl.disabled = true;
        var corpo = { acao: 'prestador_acao', token: s.token, acao_pedido: acao, pedido: String(p.id) };
        Object.keys(extra || {}).forEach(function (k) { corpo[k] = extra[k]; });
        api(corpo).then(function (x) {
          if (!x.ok) { if (btnEl) btnEl.disabled = false; window.alert(x.erro || 'Não foi possível enviar.'); return; }
          window.alert(x.aviso || 'Pronto.');
          if (acao === 'RECUSAR') { location.hash = ''; setTimeout(iniciar, 50); } else setTimeout(iniciar, depoisMs);
        });
      }
      Array.prototype.forEach.call(document.querySelectorAll('button[data-pa]'), function (b) {
        b.onclick = function () {
          var a = b.getAttribute('data-pa');
          if (a === 'RECUSAR') {
            var m = window.prompt('Por que você está recusando? (o gerente recebe e escolhe outro prestador)', '');
            if (m === null) return;
            enviar('RECUSAR', { texto: m }, b, 0);
          } else if (a === 'ACEITAR') enviar('ACEITAR', {}, b, 0);
          else if (window.confirm((a === 'INICIAR' ? 'Iniciar o serviço' : 'Finalizar o serviço') + ' do pedido #' + p.id + '?')) enviar(a, {}, b, 2500);
        };
      });
      var ab = document.getElementById('abrir-orc');
      if (ab) {
        ab.onclick = function () { document.getElementById('form-orc').hidden = false; document.getElementById('orc-valor').focus(); };
        document.getElementById('cancelar-orc').onclick = function () { document.getElementById('form-orc').hidden = true; };
        document.getElementById('form-orc').onsubmit = function (e) {
          e.preventDefault();
          var v = document.getElementById('orc-valor').value, h = document.getElementById('orc-horas').value;
          if (!window.confirm('Enviar orçamento de R$ ' + v + ' para ' + h + ' h de serviço?')) return;
          enviar('ORCAR', { valor: v, horas: h, texto: document.getElementById('orc-obs').value }, e.target.querySelector('button[type=submit]'), 2500);
        };
      }
    });
  }

  // ---------- Equipe (gerente) ----------
  function fmtTel(v) {
    var d = String(v || '').replace(/\D/g, '');
    if (d.length > 13) return 'Grupo do WhatsApp';
    if (d.indexOf('55') === 0) d = d.slice(2);
    if (d.length === 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
    if (d.length === 11) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
    return v || '';
  }
  function painelEquipe(s) {
    var calado = quieto; if (!calado) $app.innerHTML = topo(s) + '<main><p class="vazio">Carregando…</p></main>';
    document.getElementById('sair').onclick = sair;
    api({ acao: 'equipe', token: s.token }).then(function (r) {
      if (sessaoExpirou(r, s)) return;
      if (!r.ok) { if (calado) return; $app.innerHTML = topo(s) + '<main><div class="card">' + esc(r.erro || 'Erro.') + '</div></main>'; document.getElementById('sair').onclick = sair; return; }
      function linha(tipo, x) {
        var tags = (x.ativo ? '<span class="tag">Ativo</span>' : '<span class="tag bad">Inativo</span>') + (x.principal ? ' <span class="tag">Principal</span>' : '') + (x.eu ? ' <span class="tag">Você</span>' : '') +
          (tipo === 'PRESTADOR' && x.abertos ? ' <span class="tag warn">' + x.abertos + ' em aberto</span>' : '');
        return '<div class="item-pedido"><b>' + esc(x.nome) + '</b> ' + tags + '<small>' + esc(fmtTel(x.telefone)) + '</small>' +
          '<p class="acoes"><button class="mini sec" data-ed="' + tipo + ':' + x.id + '">Editar</button> ' +
          '<button class="mini sec" data-at="' + tipo + ':' + x.id + ':' + (x.ativo ? '0' : '1') + '">' + (x.ativo ? 'Desativar' : 'Reativar') + '</button></p></div>';
      }
      var dados = {};
      (r.gerentes || []).forEach(function (x) { dados['GERENTE:' + x.id] = x; });
      (r.prestadores || []).forEach(function (x) { dados['PRESTADOR:' + x.id] = x; });
      $app.innerHTML = topo(s) + '<main>' +
        '<form id="form-equipe" class="card" hidden><h2 id="fe-titulo">Cadastrar</h2>' +
        '<label>Nome<input id="fe-nome" maxlength="60" required></label>' +
        '<label>WhatsApp com DDD<input id="fe-tel" inputmode="tel" placeholder="(46) 99999-9999" required></label>' +
        '<button type="submit">Salvar</button> <button type="button" class="sec" id="fe-cancelar">Cancelar</button></form>' +
        '<div class="card"><h2>Prestadores</h2>' + ((r.prestadores || []).map(function (x) { return linha('PRESTADOR', x); }).join('') || '<p class="vazio">Nenhum prestador.</p>') +
        '<p><button class="mini" data-novo="PRESTADOR">+ Novo prestador</button></p></div>' +
        '<div class="card"><h2>Gerentes</h2>' + ((r.gerentes || []).map(function (x) { return linha('GERENTE', x); }).join('') || '<p class="vazio">Nenhum gerente.</p>') +
        '<p><button class="mini" data-novo="GERENTE">+ Novo gerente</button></p></div></main>';
      document.getElementById('sair').onclick = sair;
      var form = document.getElementById('form-equipe'), alvo = null;
      function abrir(tipo, x) {
        alvo = { tipo: tipo, id: x ? x.id : '', ativo: x ? x.ativo : true };
        document.getElementById('fe-titulo').textContent = (x ? 'Editar ' : 'Novo ') + (tipo === 'GERENTE' ? 'gerente' : 'prestador');
        document.getElementById('fe-nome').value = x ? x.nome : '';
        document.getElementById('fe-tel').value = x ? fmtTel(x.telefone) : '';
        form.hidden = false; window.scrollTo(0, 0); document.getElementById('fe-nome').focus();
      }
      function salvar(a, botao) {
        if (botao) botao.disabled = true;
        api({ acao: 'equipe_salvar', token: s.token, tipo: a.tipo, id: String(a.id || ''), nome: a.nome, telefone: a.telefone, ativo: a.ativo ? 'true' : 'false' }).then(function (x) {
          if (botao) botao.disabled = false;
          if (!x.ok) { window.alert(x.erro || 'Não foi possível salvar.'); return; }
          window.alert(x.aviso || 'Salvo.'); painelEquipe(s);
        });
      }
      Array.prototype.forEach.call(document.querySelectorAll('[data-novo]'), function (b) { b.onclick = function () { abrir(b.getAttribute('data-novo'), null); }; });
      Array.prototype.forEach.call(document.querySelectorAll('[data-ed]'), function (b) { b.onclick = function () { abrir(b.getAttribute('data-ed').split(':')[0], dados[b.getAttribute('data-ed')]); }; });
      Array.prototype.forEach.call(document.querySelectorAll('[data-at]'), function (b) {
        b.onclick = function () {
          var p = b.getAttribute('data-at').split(':'), x = dados[p[0] + ':' + p[1]], ativar = p[2] === '1';
          if (!window.confirm((ativar ? 'Reativar ' : 'Desativar ') + x.nome + '?' + (ativar ? '' : ' Esta pessoa perde o acesso ao app e deixa de receber pedidos.'))) return;
          salvar({ tipo: p[0], id: x.id, nome: x.nome, telefone: x.telefone, ativo: ativar }, b);
        };
      });
      document.getElementById('fe-cancelar').onclick = function () { form.hidden = true; };
      form.onsubmit = function (e) {
        e.preventDefault();
        alvo.nome = document.getElementById('fe-nome').value; alvo.telefone = document.getElementById('fe-tel').value;
        salvar(alvo, form.querySelector('button[type=submit]'));
      };
    });
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
    if (s.papel === 'GERENTE') { if (m) painelPedido(s, m[1]); else if (location.hash === '#equipe') painelEquipe(s); else painelGerente(s); }
    else { if (m) painelPedidoPrest(s, m[1]); else painelPrestador(s); }
  }
  window.addEventListener('hashchange', iniciar);
  var rod = document.createElement('footer'); rod.className = 'versao'; rod.textContent = 'ResolvAÍ v' + (window.RESOLVAI_VERSAO || '?'); document.body.appendChild(rod);
  // ---------- Atualização automática ----------
  var INTERVALO = 45 * 1000, ultima = Date.now();
  function marcarHora() { rod.textContent = 'ResolvAÍ v' + (window.RESOLVAI_VERSAO || '?') + ' · atualizado às ' + new Date(ultima).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
  function ocupado() {
    var cx = document.getElementById('caixa-foto'), f = document.getElementById('form-orc'), f2 = document.getElementById('form-equipe'), a = document.activeElement;
    return (cx && cx.className === 'aberta') || (f && !f.hidden) || (f2 && !f2.hidden) || (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
  }
  function atualizarSilencioso() {
    if (document.hidden || !lerSessao() || ocupado()) return;
    var y = window.scrollY;
    ultima = Date.now(); marcarHora();
    quieto = true; iniciar(); quieto = false;
    var n = 0; (function volta() { window.scrollTo(0, y); if (++n < 8) setTimeout(volta, 150); })();
  }
  setInterval(atualizarSilencioso, INTERVALO);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && Date.now() - ultima > 15000) atualizarSilencioso(); });
  marcarHora();
  iniciar();
})();
