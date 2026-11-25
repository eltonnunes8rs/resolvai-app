# Histórico de versões — ResolvAÍ app

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
