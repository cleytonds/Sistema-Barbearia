# Deploy — Elite Barbearia 081

## 1. Objetivo

Este documento registra a arquitetura de produção e o procedimento seguro para publicar frontend, backend e banco de dados.

Infraestrutura atual:

```text
Frontend  -> Vercel
Backend   -> Railway
Banco     -> MySQL Railway
E-mail    -> Brevo API HTTPS
```

---

## 2. Arquitetura de produção

```text
Navegador
   |
   | HTTPS
   v
Vercel
React + Vite
   |
   | /api/*
   v
Rewrite same-origin
   |
   v
Railway
Node.js + Express
   |
   +------> MySQL Railway
   |
   +------> Brevo HTTPS API
```

A aplicação usa o proxy `/api` da Vercel para manter a sessão do navegador em uma origem coerente com o cookie `SameSite=Lax`.

---

## 3. Frontend — Vercel

Configuração principal:

```text
Framework: Vite
Root Directory: frontend
Build Command: npm run build
Output Directory: dist
```

Variável de produção:

```env
VITE_API_URL=/api
```

A aplicação não deve apontar diretamente para a URL Railway no navegador em produção.

---

## 4. Rewrites da Vercel

O rewrite de `/api/*` precisa ser processado antes do fallback da SPA.

Fluxo:

```text
/api/* -> Railway backend
/*     -> /index.html
```

Se o fallback SPA vier primeiro, chamadas de API podem receber HTML em vez de JSON.

---

## 5. Backend — Railway

Serviço:

```text
Sistema-Barbearia
```

Runtime:

```text
Node.js
Express
PORT fornecida pelo Railway
```

O servidor deve escutar a porta fornecida pela plataforma.

Endpoint público de referência:

```text
https://sistema-barbearia-production-7801.up.railway.app
```

---

## 6. Health e readiness

### Health

```http
GET /api/health
```

Indica que o processo HTTP está vivo.

### Readiness

```http
GET /api/ready
```

Indica que pré-condições essenciais estão disponíveis, como banco, schema/migrations e configuração base.

Uma aplicação pode estar `health=ok` e ainda não estar pronta para operação.

---

## 7. Banco de produção

Banco:

```text
MySQL Railway
database: railway
```

O backend de produção deve usar a rede privada do Railway sempre que possível.

Não abrir acesso público do MySQL sem necessidade operacional explícita.

---

## 8. Migrations

Comandos:

```powershell
npm.cmd run migrate:status --prefix backend
npm.cmd run migrate --prefix backend
```

Regras:

- nunca editar migration já aplicada;
- criar nova migration para qualquer evolução de schema;
- revisar banco alvo antes de executar;
- não rodar migration de produção no banco local por engano;
- não executar seed de demonstração em produção.

A versão atual possui migrations numeradas de `001` a `018`.

---

## 9. Variáveis do backend

Exemplos de nomes usados:

```env
NODE_ENV=production

DB_HOST=<host>
DB_PORT=<porta>
DB_USER=<usuario>
DB_PASSWORD=<segredo>
DB_NAME=<database>
DB_CONNECTION_LIMIT=<limite>

JWT_SECRET=<segredo-forte>
JWT_EXPIRES_IN=<duracao>
JWT_ISSUER=<issuer>
JWT_AUDIENCE=<audience>
JWT_REVOCATION_CLEANUP_MINUTES=<minutos>

FRONTEND_URL=https://sistema-barbearia-bice.vercel.app
TRUST_PROXY=1

BREVO_API_KEY=<segredo>
EMAIL_FROM=<remetente-verificado>
EMAIL_FROM_NAME=Elite Barbearia 081
```

Nunca copiar valores reais para GitHub ou documentação pública.

---

## 10. `TRUST_PROXY`

Em produção atrás da infraestrutura Railway:

```env
TRUST_PROXY=1
```

A configuração deve ser explícita.

Não usar confiança irrestrita em proxies apenas para corrigir IP/rate-limit sem entender a topologia.

---

## 11. E-mail — Brevo

Recuperação de senha usa HTTPS:

```text
POST https://api.brevo.com/v3/smtp/email
```

Apesar do caminho conter `smtp`, a integração usada é HTTP/HTTPS, não conexão SMTP.

Isso é importante porque Railway Hobby pode restringir tráfego SMTP de saída.

---

## 12. Processo recomendado de deploy

```text
1. revisar git status
2. testes focados
3. validação final
4. commit
5. push main
6. Vercel/Railway recebem nova versão
7. acompanhar logs
8. validar /health
9. validar /ready
10. smoke test real
```

---

## 13. Smoke test pós-deploy

Validar:

```text
[ ] página inicial abre
[ ] refresh em rota funciona
[ ] login cliente
[ ] login barbeiro
[ ] login admin
[ ] /auth/me mantém sessão
[ ] serviços carregam
[ ] barbeiros carregam
[ ] disponibilidade responde
[ ] agendamento é criado
[ ] cancelamento/reagendamento essencial funciona
[ ] recuperação de senha envia e-mail
[ ] link de redefinição funciona
[ ] /api/health = 200
[ ] /api/ready = 200
```

---

## 14. Rollback

Se um deploy introduzir falha grave:

1. identificar se a falha é frontend, backend ou banco;
2. evitar alterações adicionais impulsivas;
3. restaurar deploy anterior da plataforma quando possível;
4. não reverter migration destrutivamente sem plano específico;
5. preservar logs/evidências;
6. validar health/readiness novamente;
7. documentar causa e correção.

Código pode ser revertido com segurança muito mais facilmente que uma alteração destrutiva de banco.

---

## 15. Regra de produção

Depois do lançamento, priorizar:

```text
estabilidade
segurança
backup
observabilidade
correções pequenas
```

Evitar grandes refatorações diretamente na branch de produção.
