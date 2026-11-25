# Histórico de versões — ResolvAÍ app

## 0.8.5
- Computador: botões de ação da tabela em uma linha, coluna Ações ajustada ao tamanho dos botões.

## 0.8.4
- Avisos compactos: nova versão vira faixa fina no topo e instalar vira cartão pequeno no canto.

## 0.8.3
- Botões secundários (Cancelar, Recusar, Trocar, Retomar bot, Editar, Sair) com contorno e texto verdes, bem visíveis.

## 0.8.2
- Botões de ação alinhados em colunas iguais (detalhe do pedido e painel no celular).

## 0.8.1
- Celular: as tabelas do painel viram blocos, com os botões de ação embaixo e lado a lado (sem rolagem lateral).

## 0.8.0
- Gestão da equipe: o gerente cadastra, edita, desativa e reativa prestadores e gerentes pelo app (menu Equipe), com boas-vindas no WhatsApp.

## 0.7.0
- Atualização automática a cada 45 s com o app aberto (não mexe se você estiver digitando ou com foto aberta), rodapé mostra a hora da última atualização; erro de rede não desloga mais.

## 0.6.0
- App do prestador: lista por situação, agenda de 15 dias, detalhe com fotos e mapa, aceitar, recusar (volta ao gerente), enviar orçamento, iniciar e finalizar serviço.

## 0.5.1
- Removido o link da pasta do Drive no detalhe do pedido (ficam só as miniaturas).

## 0.5.0
- App instalável (PWA): banner de instalação, ícone na tela, funciona sem internet na casca e aviso de versão nova no topo.

Formato: MAIOR.MENOR.AJUSTE. A versão fica em `config.js` (`RESOLVAI_VERSAO`) e nas URLs de `index.html` (`?v=`). Ao publicar: subir os três juntos, atualizar este arquivo e criar a tag git `vX.Y.Z`.

## 0.4.0
- Logo e ícones (logo.svg, icone-192.png, icone-512.png), favicon e versão no rodapé.
- Fotos do pedido em miniaturas, com caixa de ampliação (usa o workflow n8n `APP - Foto`).

## 0.3.0
- Detalhe do pedido: dados, linha do tempo, avaliação e conversa com o cliente.

## 0.2.0
- Ações do gerente no painel: aprovar, recusar, trocar prestador, marcar pago, retomar bot, cancelar (inclui pedido sem prestador).

## 0.1.0
- Login por código no WhatsApp e painel do gerente.
