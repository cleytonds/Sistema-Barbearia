# Segurança — Elite Barbearia 081

## 1. Objetivo

Este documento registra as principais decisões de segurança da aplicação e os cuidados obrigatórios para manutenção e produção.

Segurança é aplicada em camadas:

```text
Navegador
  ↓
Proxy same-origin
  ↓
Express
  ↓
Autenticação / autorização
  ↓
Validação
  ↓
Regras de domínio
  ↓
SQL parametrizado
  ↓
Constraints do MySQL
```

## 2. Princípios

1. o backend é a autoridade;
2. negar por padrão;
3. validar entrada em todas as fronteiras;
4. não confiar em papel, preço, status ou propriedade enviados pelo frontend;
5. minimizar dados expostos;
6. não registrar segredos;
7. usar transações em operações compostas;
8. usar SQL parametrizado;
9. manter histórico e snapshots;
10. falhar de forma segura.

## 3. Proteção HTTP

O Express utiliza mecanismos como:

- `helmet`;
- CORS configurado;
- `credentials: true`;
- limite de tamanho de JSON;
- tratamento centralizado de erros;
- remoção de `x-powered-by`;
- request context/request id;
- rate limiting.

Pipeline conceitual:

```text
request
  ↓
request context
  ↓
Helmet
  ↓
CORS
  ↓
parsers
  ↓
routes / middlewares
  ↓
notFound
  ↓
errorHandler
```

## 4. CORS e origem

A API aceita apenas origens explicitamente configuradas. Em produção, o frontend usa `/api` pela própria origem Vercel e o rewrite encaminha ao Railway.

Nunca tornar CORS aberto nem afrouxar `SameSite` apenas para contornar configuração incorreta de proxy.

## 5. Cookie de sessão

Cookie:

```text
barbearia_session
```

Produção:

```text
HttpOnly
Secure
SameSite=Lax
Path=/
```

O token não deve ser persistido pelo frontend em `localStorage`.

## 6. CSRF

Como cookies são enviados automaticamente pelo navegador, mutações autenticadas precisam de proteção CSRF. O backend valida método, autenticação por cookie, origem e header de proteção.

## 7. Autenticação e autorização

### Autenticação

Valida:

- JWT;
- algoritmo permitido;
- issuer;
- audience;
- expiração;
- `jti`;
- versão de autenticação;
- revogação;
- usuário existente e ativo.

### Autorização

Papéis:

```text
cliente
barbeiro
admin
```

Regras:

- cliente acessa somente os próprios dados;
- barbeiro acessa somente a operação permitida;
- admin acessa funções administrativas;
- papéis são validados pelo backend;
- propriedade do recurso é validada separadamente do papel.

## 8. Múltiplos papéis

A relação `usuario_papeis` permite mais de um papel sem duplicar usuários. O frontend não deve presumir `papeis[0]` como papel efetivo único.

## 9. Senhas

Senhas são armazenadas somente como hash bcrypt.

Nunca:

- salvar senha em texto puro;
- registrar senha em log;
- retornar hash na API;
- colocar senha real em documentação.

## 10. Recuperação de senha

Proteções:

- resposta não enumerável;
- token criptograficamente aleatório;
- persistência por hash;
- expiração;
- uso único;
- invalidação após uso;
- rate limiting;
- `auth_versao` alterada após redefinição;
- Brevo via HTTPS em produção.

## 11. Rate limiting

Há limites para operações sensíveis, como login, cadastro e recuperação de senha, além de limites gerais/operacionais.

O armazenamento em memória é adequado enquanto a aplicação opera com uma única instância. Em múltiplas réplicas, deve existir store compartilhado, como Redis.

## 12. SQL Injection

Repositories usam parâmetros:

```sql
SELECT ... FROM ... WHERE id = ?
```

Campos dinâmicos inevitáveis, como ordenação, são escolhidos por allowlist interna.

## 13. Mass assignment

Payloads possuem contratos explícitos. Cadastro público não pode aceitar um papel administrativo apenas porque o navegador enviou o campo.

## 14. Validação de entrada

A API valida IDs, strings, datas, horários, estados, transições, preço, duração, paginação, filtros e campos adicionais inesperados.

O frontend pode validar por usabilidade, mas o backend sempre repete as regras críticas.

## 15. Dinheiro

Valores financeiros são persistidos como `DECIMAL`.

```text
Banco       → DECIMAL
API         → string quando aplicável
Frontend    → string
```

Não usar ponto flutuante como fonte de verdade financeira.

## 16. IDs grandes

IDs `BIGINT` são serializados de modo a evitar perda de precisão no JavaScript, utilizando string quando necessário.

## 17. Concorrência

Operações críticas usam transações e locks.

Princípios:

- mesma conexão durante toda a tentativa;
- rollback em falha;
- ordem de locks consistente;
- histórico na mesma operação;
- retry limitado apenas para erros transitórios previstos;
- repository não inicia `beginTransaction`, `commit` ou `rollback` por conta própria.

## 18. Idempotência

Criação de agendamento usa `Idempotency-Key` para impedir efeitos duplicados por clique repetido, timeout ou perda de resposta.

Mesma chave com payload diferente deve resultar em conflito.

## 19. Proteção contra dupla reserva

A disponibilidade pública é informativa. Na criação, o backend revalida em transação:

```text
lock do barbeiro
   ↓
serviço + vínculo
   ↓
funcionamento
   ↓
jornada
   ↓
bloqueios
   ↓
agendamentos conflitantes
   ↓
regras do plano
   ↓
insert + histórico
   ↓
commit
```

## 20. Snapshots e histórico

Dados históricos não são recalculados com valores atuais. Exemplos: preço, duração, buffer, dados do plano, limites contratados e vínculos cobertos.

## 21. Proteção por perfil

### Cliente

Não recebe dados de outros clientes, observações internas, hashes, tokens ou controles administrativos.

### Barbeiro

Recebe apenas informações operacionais necessárias. Dados financeiros de assinatura não necessários ao atendimento permanecem ocultos.

### Administrador

Tem visão ampliada, mas ainda não recebe senha, hash, JWT, token de recuperação ou segredos de infraestrutura.

## 22. Erros

| HTTP | Situação |
|---:|---|
| 400/422 | validação/regra |
| 401 | sessão inválida |
| 403 | sem permissão |
| 404 | recurso inexistente/inacessível |
| 409 | conflito/concorrência/idempotência |
| 429 | rate limit |
| 500 | falha interna sanitizada |

Stack trace não deve ser retornada ao navegador em produção.

## 23. Segredos e variáveis

Nunca versionar valores reais de:

```text
JWT_SECRET
DB_PASSWORD
BREVO_API_KEY
tokens
cookies
chaves privadas
```

`.env` reais permanecem fora do Git. `.env.example` contém apenas nomes e valores fictícios.

## 24. Banco de testes

Testes de integração não devem tocar no banco de desenvolvimento ou produção.

Banco isolado:

```text
barbearia_agendamento_test
```

A aplicação possui proteção fail-closed para impedir uso acidental de banco inadequado em modo de teste.

## 25. Produção

Infraestrutura atual:

```text
Frontend → Vercel
Backend  → Railway
MySQL    → Railway
E-mail   → Brevo HTTPS API
```

O MySQL de produção deve permanecer em rede privada sempre que possível.

## 26. Checklist antes de deploy

```text
[ ] git status revisado
[ ] nenhum .env staged
[ ] nenhum segredo em diff
[ ] testes afetados passaram
[ ] build passou
[ ] lint/format passaram
[ ] git diff --check passou
[ ] migrations revisadas
[ ] teste não aponta para produção
[ ] health responde
[ ] ready responde
[ ] login validado
[ ] recuperação de senha validada
```

## 27. Regra de manutenção

Não enfraquecer controles de segurança apenas para "fazer funcionar". Investigar a causa antes de desabilitar CSRF, abrir CORS, remover `HttpOnly`, aceitar qualquer `Origin`, relaxar autorização ou executar testes em produção.
