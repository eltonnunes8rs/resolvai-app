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
          setTimeout(function () { painelGerente(s); }, 2500);
        });
      };
    });
  }

  function painelGerente(s) {
    $app.innerHTML = topo(s) + '<main><p class="vazio">Carregando…</p></main>';
    document.getElementById('sair').onclick = sair;
    api({ acao: 'gerente_resumo', token: s.token }).then(function (r) {
      if (!r.ok) { gravarSessao(null); telaLogin('tel'); return; }
      var st = r.status || {}, kp = Object.keys(st).map(function (k) { return '<div class="kpi"><b>' + st[k] + '</b><span>' + esc(k) + '</span></div>'; }).join('') || '<p class="vazio">Sem pedidos.</p>';
      $app.innerHTML = topo(s) + '<main>' +
        '<div class="card"><h2>Pedidos por situação</h2><div class="grid">' + kp + '</div></div>' +
        '<div class="card"><h2>Orçamentos para aprovar</h2>' + tabela([
          ['Pedido', function (l) { return '#' + l.id; }], ['Cliente', function (l) { return esc(l.cliente); }],
          ['Serviço', function (l) { return esc(l.servico); }], ['Prestador', function (l) { return esc(l.prestador); }],
          ['Valor', function (l) { return brl(l.valor_orcado); }], ['Local', function (l) { return esc((l.bairro || '') + (l.cidade ? ' / ' + l.cidade : '')); }],
          ['Ações', function (l) { return btn('APROVAR', l.id, 'Aprovar') + ' ' + btn('RECUSAR', l.id, 'Recusar', 'sec') + ' ' + btn('TROCAR', l.id, 'Trocar prestador', 'sec'); }]
        ], r.aprovar) + '</div>' +
        '<div class="card"><h2>Pedidos recentes</h2>' + tabela([
          ['Pedido', function (l) { return '#' + l.id; }], ['Cliente', function (l) { return esc(l.cliente); }],
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
        ], r.pedidos) + '</div>' +
        '<div class="card"><h2>Agenda dos próximos 7 dias</h2>' + tabela([
          ['Quando', function (l) { return dh(l.inicio); }], ['Pedido', function (l) { return '#' + l.id; }],
          ['Prestador', function (l) { return esc(l.prestador); }], ['Cliente', function (l) { return esc(l.cliente); }],
          ['Serviço', function (l) { return esc(l.servico); }], ['Situação', function (l) { return '<span class="tag">' + esc(l.status) + '</span>'; }]
        ], r.agenda) + '</div>' +
        '<div class="card"><h2>Prestadores</h2>' + tabela([
          ['Nome', function (l) { return esc(l.nome); }],
          ['Situação', function (l) { return l.ativo ? '<span class="tag">Ativo</span>' : '<span class="tag warn">Inativo</span>'; }]
        ], r.prestadores) + '</div>' +
        '<div class="card"><h2>Avaliações que pedem atenção</h2>' + tabela([
          ['Pedido', function (l) { return '#' + l.id; }], ['Prestador', function (l) { return esc(l.prestador); }],
          ['Nota', function (l) { return '<span class="tag ' + (l.nota === 'PESSIMO' ? 'bad' : 'warn') + '">' + esc(l.nota) + '</span>'; }],
          ['Comentário', function (l) { return esc(l.comentario || '-'); }]
        ], r.avaliacoes_ruins) + '</div></main>';
      document.getElementById('sair').onclick = sair;
      ligarAcoes(s);
    });
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
    if (s.papel === 'GERENTE') painelGerente(s); else painelPrestador(s);
  }
  iniciar();
})();
