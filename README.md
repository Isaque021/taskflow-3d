# Taskflow

Aplicação web de tarefas multi-tenant com Bun, TypeScript, Fastify, React, TanStack Query, PostgreSQL e Drizzle ORM.

## Requisitos

- Bun 1.3 ou superior
- Docker e Docker Compose, para executar o PostgreSQL localmente

## Configuração

1. Instale as dependências:

```bash
bun install
```

2. Crie o arquivo de ambiente:

```bash
cp .env.example .env
```

3. Inicie o PostgreSQL:

```bash
docker compose up -d postgres
```

4. Aplique as migrações:

```bash
bun run db:migrate
```

## Desenvolvimento

Em terminais separados:

```bash
bun run dev:api
```

```bash
bun run dev:web
```

A API estará em `http://localhost:3000` e o frontend em `http://localhost:5173`.

Abra `http://localhost:5173/register` para criar a primeira organização. O primeiro usuário será administrador.

## Scripts

| Comando | Função |
|---|---|
| `bun run dev:api` | Inicia a API com hot reload |
| `bun run dev:web` | Inicia o frontend Vite |
| `bun run build:web` | Gera o build do frontend |
| `bun run db:generate` | Gera uma nova migração Drizzle |
| `bun run db:migrate` | Aplica as migrações no PostgreSQL |
| `bun run typecheck` | Verifica os tipos TypeScript |
| `bun test` | Executa os testes Bun |

## Regras importantes

- Cada usuário pertence a uma organização.
- Todas as consultas de tarefas e usuários são filtradas pela organização da sessão.
- Usuários são desativados, preservando o histórico das tarefas.
- `max_users` e `expires_at` da licença são nulos no MVP, representando limites ilimitados.
- As categorias disponíveis são Mercado, Carro e Trabalho.
