# calculadora-docker

API de calculadora em Node.js rodando com Docker Compose, com cache Redis e testes automáticos no CI.

## Estrutura

```
calculadora-docker/
├── calculadora/              # código e Dockerfile da app (imagem calculadora:v1)
│   ├── Dockerfile
│   ├── package.json
│   └── server.js
├── tests/
│   └── test.sh               # testes de integração (curl)
├── docker-compose.yml        # stack principal: app + Redis
├── docker-compose.test.yml   # override para os testes do CI
└── .github/workflows/ci.yml  # GitHub Actions
```

## Serviços

| Serviço       | Imagem           | Função                                         | Rede              |
|---------------|------------------|------------------------------------------------|-------------------|
| `calculadora` | `calculadora:v1` | API na porta 3000                              | frontend, backend |
| `cache`       | `redis:7-alpine` | Cache dos resultados (TTL 60s) e histórico     | backend (interna) |
| `tests`       | `curlimages/curl`| Só no CI: roda `tests/test.sh` contra a API    | frontend          |

- **Redes:** `frontend` recebe as requisições; `backend` é `internal: true`, então o Redis não fica acessível de fora.
- **Volume:** `redis-data` guarda os dados do Redis (com `appendonly`), que sobrevivem a `docker compose down`.
- **Reinício:** `restart: unless-stopped` nos dois serviços: se cair, o Docker sobe de novo, a não ser que você tenha parado manualmente.
- **Healthchecks:** a app só sobe depois que o Redis responde `PONG` (`depends_on: condition: service_healthy`).
- Se o Redis cair, a calculadora continua respondendo, só sem cache.

## Endpoints

| Rota                              | Exemplo de resposta                                          |
|-----------------------------------|--------------------------------------------------------------|
| `/calc?op=soma&a=5&b=3`           | `{"op":"soma","a":5,"b":3,"resultado":8,"cache":false}`      |
| `/historico`                      | últimas 10 contas                                            |
| `/health`                         | `{"status":"ok","cache":"up"}`                               |

Operações: `soma`, `sub`, `mult`, `div`.

## Rodando no GitHub Codespaces

1. No GitHub: **Code → Codespaces → Create codespace on main**.
2. No terminal do Codespace:

```bash
docker compose up -d --build     # sobe app + Redis
docker compose ps                # os dois devem aparecer como (healthy)

curl "http://localhost:3000/calc?op=soma&a=5&b=3"
curl "http://localhost:3000/calc?op=soma&a=5&b=3"   # agora com "cache":true
curl "http://localhost:3000/historico"
curl "http://localhost:3000/health"

docker compose logs -f calculadora   # Ctrl+C para sair
```

3. Rodar os testes localmente (igual ao CI):

```bash
docker compose -f docker-compose.yml -f docker-compose.test.yml \
  up --build --abort-on-container-exit --exit-code-from tests
docker compose -f docker-compose.yml -f docker-compose.test.yml down -v
```

4. **Ao terminar, pare tudo e desligue o Codespace** para não gastar horas:

```bash
docker compose down
```

Depois, no GitHub: **Code → Codespaces → `...` ao lado do codespace → Stop codespace** (ou apague com *Delete* se não precisar mais).

## CI

A cada push ou pull request na `main`, o GitHub Actions sobe a stack com `docker-compose.test.yml`, roda `tests/test.sh` e falha o build se algum teste falhar. Resultado na aba **Actions** do repositório.
