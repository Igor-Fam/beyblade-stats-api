# Checklist de Validação - Multi-Database e Segurança

Este guia detalha os passos necessários para validar a implementação de isolamento de dados e segurança no Beyblade Stats API.

## 1. Validação de Autenticação (Backend)
- [ ] Tente acessar `GET /battles` sem um token JWT. 
    - **Resultado esperado**: Erro `401 Unauthorized`.
- [ ] Tente acessar `GET /stats/parts` sem um token JWT.
    - **Resultado esperado**: Erro `401 Unauthorized`.
- [ ] Verifique se o token JWT contém o `sub` (userId) correto do Supabase.

## 2. Isolamento de Dados e Propriedade (Backend)
- [ ] **Acesso Cruzado**: Faça login com o **Usuário A** e tente listar as batalhas usando o `databaseId` do **Usuário B**.
    - **Resultado esperado**: Erro `403 Forbidden` ("Unauthorized access to this database").
- [ ] **Renomeação Proibida**: Tente atualizar o nome de uma Database que pertence ao **Usuário B** estando logado como **Usuário A**.
    - **Resultado esperado**: Erro `403 Forbidden`.
- [ ] **Sincronização Segura**: Tente enviar uma batalha via `POST /sync` onde o `databaseId` no corpo da requisição não pertence ao usuário autenticado.
    - **Resultado esperado**: A batalha deve ser ignorada ou a requisição deve falhar com erro de permissão.

## 3. Fluxo de Sincronização (Frontend)
- [ ] **Primeiro Sync**: Limpe o armazenamento local (IndexedDB) e faça login. Crie uma Database local e sincronize.
    - **Resultado esperado**: A Database deve ser criada no PostgreSQL com o seu `userId` como dono.
- [ ] **Conflito de Database**: 
    1. Tenha uma Database já salva na nuvem.
    2. No modo deslogado, crie uma nova Database local com nome diferente.
    3. Faça login.
    - **Resultado esperado**: O `SyncConflictModal` deve aparecer perguntando se você deseja usar a Database da nuvem ou a local.
- [ ] **Restore**: Use a opção "Restaurar Dados" no menu de configurações.
    - **Resultado esperado**: Apenas as batalhas da Database ativa devem ser baixadas e salvas no IndexedDB.

## 4. Banco de Dados (Local/Prisma)
- [ ] Execute `npx prisma studio` e verifique a tabela `Database`.
    - [ ] Cada registro deve ter um `ownerId` (UUID do Supabase).
    - [ ] A tabela `Battle` deve ter a coluna `databaseId` preenchida e vinculada corretamente.

## 5. Testes Automatizados
- [ ] Execute `npm test` no backend.
    - **Resultado esperado**: Todos os 39 testes (incluindo os novos de `ownership` e `BattleService`) devem passar.

---
> [!IMPORTANT]
> Lembre-se de atualizar o seu arquivo `.env` (ou `.env.sandbox`) com as credenciais corretas do Supabase e PostgreSQL local antes de iniciar os testes manuais.
