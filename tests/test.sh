#!/bin/sh
# Testes de integração da calculadora (rodam dentro do container "tests")
BASE_URL="${BASE_URL:-http://localhost:3000}"
falhas=0

checa() {
  descricao="$1"; url="$2"; esperado="$3"
  resposta=$(curl -s "$BASE_URL$url")
  if echo "$resposta" | grep -q "$esperado"; then
    echo "OK    $descricao"
  else
    echo "FALHA $descricao"
    echo "      esperado: $esperado"
    echo "      recebido: $resposta"
    falhas=$((falhas + 1))
  fi
}

echo "Testando $BASE_URL"
checa "health responde"          "/health"                    '"status":"ok"'
checa "cache (Redis) conectado"  "/health"                    '"cache":"up"'
checa "soma 5 + 3 = 8"           "/calc?op=soma&a=5&b=3"      '"resultado":8'
checa "sub 10 - 4 = 6"           "/calc?op=sub&a=10&b=4"      '"resultado":6'
checa "mult 6 * 7 = 42"          "/calc?op=mult&a=6&b=7"      '"resultado":42'
checa "div 9 / 3 = 3"            "/calc?op=div&a=9&b=3"       '"resultado":3'
checa "div por zero dá erro"     "/calc?op=div&a=1&b=0"       '"erro"'
checa "operação inválida dá erro" "/calc?op=pot&a=2&b=3"      '"erro"'
checa "2ª chamada vem do cache"  "/calc?op=soma&a=5&b=3"      '"cache":true'
checa "histórico registrado"     "/historico"                 '"op":"mult"'

echo
if [ "$falhas" -eq 0 ]; then
  echo "Todos os testes passaram"
  exit 0
else
  echo "$falhas teste(s) falharam"
  exit 1
fi
