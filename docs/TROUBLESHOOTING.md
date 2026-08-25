# Troubleshooting — Elite Barbearia 081

## 1. Objetivo

Guia rápido para diagnosticar falhas sem começar alterando código às cegas.

---

## 2. Regra principal

Antes de corrigir:

```text
reproduzir
↓
localizar camada
↓
coletar evidência
↓
identificar causa
↓
alteração mínima
↓
teste focado
```

---

## 3. Site não abre

Verificar:

1. status do deploy Vercel;
2. erro de build;
3. console do navegador;
4. assets;
5. fallback SPA.

Se a página principal nem carrega, não começar investigando MySQL.

---

## 4. Refresh retorna 404

Causa provável:

- fallback SPA/Rewrites da Vercel.

A navegação React precisa que rotas desconhecidas sejam entregues ao `index.html`, exceto `/api/*`.

---

## 5. API retorna HTML

Causa provável:

- rewrite `/api` incorreto;
- fallback SPA executado antes do proxy.

Confirmar ordem do `vercel.json`.

---

## 6. Login funciona e depois perde sessão

Investigar:

```text
cookie barbearia_session
withCredentials
/api/auth/me
SameSite
Secure
proxy /api
Origin
CSRF
```

Não resolver colocando JWT em `localStorage`.

---

## 7. `401`

Significa falha de autenticação.

Possíveis causas:

- cookie ausente;
- token expirado;
- revogação;
- `auth_versao`;
- usuário inativo;
- cookie não enviado.

---

## 8. `403`

Sessão pode estar válida.

Possíveis causas:

- papel incorreto;
- ownership;
- CSRF;
- origem;
- recurso de outro barbeiro/cliente.

Não fazer logout automaticamente só por `403`.

---

## 9. `/health` 200 e `/ready` falha

Provável problema de dependência.

Verificar:

- DB_HOST;
- DB_PORT;
- DB_NAME;
- credenciais;
- migrations;
- configuração singleton;
- acesso privado Railway.

---

## 10. `ER_BAD_DB_ERROR`

Banco informado não existe ou possui nome incorreto.

Verificar especialmente espaços acidentais:

```text
DB_NAME=" railway"
```

é diferente de:

```text
DB_NAME=railway
```

---

## 11. `Access denied`

Verificar:

- usuário;
- senha;
- host;
- banco;
- `.env`;
- variável Railway.

Não imprimir senha no terminal/chat para diagnóstico.

---

## 12. Não há horários disponíveis

Isso pode ser comportamento correto.

Verificar:

- serviço ativo;
- barbeiro ativo;
- vínculo;
- dia de funcionamento;
- jornada;
- pausa;
- bloqueio;
- antecedência mínima;
- agendamentos existentes;
- buffer.

---

## 13. Dupla reserva

Não tentar resolver apenas desabilitando botão no frontend.

Verificar:

- lock do barbeiro;
- transação;
- revalidação;
- idempotência;
- estado que ocupa agenda.

---

## 14. Cliente não consegue cancelar

Verificar:

- propriedade;
- status;
- prazo mínimo;
- horário atual no fuso;
- regra de plano;
- endpoint correto.

---

## 15. Plano aparece mas não cobre

Verificar:

```text
assinatura
status
pagamento
data
serviço snapshot
barbeiro snapshot
uso permitido
limite semanal
limite total
```

Cobertura ausente pode significar agendamento avulso, não erro.

---

## 16. Pagamento confirmado e ainda avulso

Investigar:

- período do pagamento;
- data do atendimento;
- assinatura ativa;
- serviço;
- profissional;
- cotas;
- snapshot.

---

## 17. E-mail não chega

Verificar:

1. Brevo API;
2. `BREVO_API_KEY`;
3. remetente verificado;
4. `EMAIL_FROM`;
5. logs;
6. caixa spam;
7. status no painel Brevo.

Railway Hobby pode bloquear SMTP; usar integração HTTPS.

---

## 18. `ETIMEDOUT` no e-mail

Se o código tenta SMTP em Railway Hobby, a infraestrutura pode bloquear a conexão.

Solução atual do projeto:

```text
Brevo API HTTPS
```

---

## 19. Tela preta após deploy

Verificar:

- bundle novo;
- cache;
- erro de JavaScript;
- imports/export;
- chunk lazy;
- console;
- deploy concluído.

Não assumir backend se o erro ocorre antes de qualquer chamada.

---

## 20. "Carregando..." aparece no canto

Origem típica:

- fallback textual de `Suspense`;
- guard de rota.

A versão atual usa loader visual centralizado sem texto visível.

---

## 21. Teste tenta banco errado

Pare imediatamente.

Confirmar:

```text
barbearia_agendamento_test
```

Nunca contornar a proteção fail-closed.

---

## 22. Migration falha

Não editar migration já aplicada.

Verificar:

- migration atual;
- schema;
- erro exato;
- ordem;
- idempotência;
- checksum.

Criar nova migration para correção quando necessário.

---

## 23. Git mostra arquivos não relacionados

Não usar:

```powershell
git add .
```

Usar staging explícito:

```powershell
git add caminho1 caminho2
```

---

## 24. Railway deploy não refletiu mudança

Confirmar:

- commit existe;
- push ocorreu;
- branch correta;
- Railway está conectado ao repo/branch corretos;
- deploy terminou;
- logs correspondem ao novo commit.

---

## 25. Vercel não refletiu mudança

Confirmar:

- push;
- produção;
- commit;
- build;
- cache;
- variável `VITE_API_URL=/api`.

---

## 26. Diagnóstico mínimo para reportar bug

Fornecer:

```text
passos
resultado esperado
resultado atual
status HTTP
mensagem visível
log seguro
arquivo/rota provável
```

Nunca enviar segredo.
