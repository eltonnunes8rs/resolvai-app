#!/bin/sh
# Uso: ./publicar.sh 0.5.1 "o que mudou"
# Atualiza a versão em config.js, index.html e version.json, registra no CHANGELOG, faz commit, tag e push.
set -e
V="$1"; MSG="$2"
[ -z "$V" ] && { echo "uso: ./publicar.sh X.Y.Z \"mensagem\""; exit 1; }
sed -i "s/RESOLVAI_VERSAO = '[^']*'/RESOLVAI_VERSAO = '$V'/" config.js
sed -i "s/?v=[0-9.]*/?v=$V/g" index.html
echo "{\"versao\":\"$V\"}" > version.json
printf '# Histórico de versões — ResolvAÍ app\n\n## %s\n- %s\n\n' "$V" "$MSG" > /tmp/_cl_novo
tail -n +2 CHANGELOG.md | sed '1{/^$/d}' > /tmp/_cl_resto
cat /tmp/_cl_novo /tmp/_cl_resto > CHANGELOG.md
git add -A && git commit -m "v$V: $MSG" && git tag "v$V" && git push --follow-tags
