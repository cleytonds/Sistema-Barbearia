# Testes — Elite Barbearia 081

## 1. Objetivo

A estratégia de testes protege regras críticas sem usar produção como ambiente de experimentação.

---

## 2. Ferramentas

Backend:

```text
node:test
MySQL isolado
```

Frontend:

```text
node:test
Testing Library / jsdom
testes de contrato e UI
```

Build:

```text
Vite
```

---

## 3. Banco isolado

Banco de desenvolvimento:

```text
barbearia_agendamento
```

Banco de teste:

```text
barbearia_agendamento_test
```

Nunca executar integração destrutiva no banco de desenvolvimento.

Nunca apontar teste para produção.

---

## 4. Fail-closed

A configuração de testes valida o nome/destino do banco antes de permitir operações.

Se a configuração não provar que o banco é de teste, a execução deve falhar em vez de prosseguir.

---

## 5. Testes unitários/de domínio

Adequados para:

- overlap;
- datas;
- regras de disponibilidade;
- transições;
- cobertura de plano;
- cálculo;
- normalizações;
- política de comissão.

São rápidos e devem ser a primeira camada.

---

## 6. Testes de integração

Validam:

```text
HTTP
+
middlewares
+
services
+
repositories
+
MySQL
```

Exemplos:

- autenticação;
- cookies;
- autorização;
- disponibilidade;
- agendamentos;
- concorrência;
- planos;
- comissões.

---

## 7. Testes de concorrência

Cenários importantes:

- duas reservas do mesmo horário;
- locks do mesmo barbeiro;
- idempotência;
- cota de plano;
- mudanças simultâneas.

O objetivo é provar comportamento real do MySQL, não apenas mocks.

---

## 8. Testes de frontend

Validam:

- navegação;
- guards;
- autenticação;
- loading/error/empty;
- formulários;
- páginas de planos;
- agenda;
- comissões;
- responsividade por contrato;
- acessibilidade.

---

## 9. Estratégia de execução

Durante uma correção:

```text
1. teste focado
2. corrigir
3. repetir teste focado
4. validações do arquivo
```

Somente ao fechar um bloco relevante:

```text
5. suíte mais ampla
6. build
7. lint
8. format
9. git diff --check
```

Isso reduz custo e tempo sem sacrificar qualidade.

---

## 10. Comandos principais

Backend:

```powershell
npm.cmd test --prefix backend
```

Integração:

```powershell
npm.cmd run test:integration --prefix backend
```

Frontend:

```powershell
npm.cmd test --prefix frontend
```

Build:

```powershell
npm.cmd run build --prefix frontend
```

Lint:

```powershell
npm.cmd run lint -- --max-warnings=0
```

Format:

```powershell
npm.cmd run format
npm.cmd run format:check
```

Migration status:

```powershell
npm.cmd run migrate:status --prefix backend
```

---

## 11. Testes de autenticação

Cobrem conceitos como:

- cadastro;
- login;
- sessão por cookie;
- `/auth/me`;
- logout;
- revogação;
- alteração de senha;
- recuperação;
- reset;
- usuário inativo;
- papéis;
- CSRF;
- rate limit.

---

## 12. Testes de agendamento

Cobrem:

- disponibilidade;
- vínculo serviço-profissional;
- horário;
- jornada;
- bloqueio;
- criação;
- idempotência;
- concorrência;
- ownership;
- cancelamento;
- reagendamento;
- estados.

---

## 13. Testes de planos

Cobrem:

- criação;
- edição;
- status;
- adesão;
- idempotência;
- snapshots;
- pagamento;
- cotas;
- reserva/consumo/liberação;
- plano x avulso;
- concorrência.

---

## 14. Testes de comissões

Cobrem:

- autorização;
- cálculo;
- consulta;
- tipo de cobrança;
- estados;
- integridade financeira;
- isolamento do barbeiro.

---

## 15. Fixtures

Fixtures devem ser:

- identificáveis;
- temporárias;
- determinísticas;
- removidas no `finally`/teardown;
- exclusivas do banco de teste.

Evitar depender de dados pessoais reais para testes automatizados.

---

## 16. Testes de e-mail

Não chamar Brevo real em suíte automatizada.

Usar mock do transporte HTTP.

Teste real de envio é smoke test manual controlado de produção/staging.

---

## 17. Critério de sucesso

Não declarar:

```text
"testado"
```

se apenas build passou.

Distinguir:

```text
teste automatizado
teste de integração
build
smoke test manual
teste visual real
```

---

## 18. Antes de commit

Checklist:

```text
[ ] arquivos certos
[ ] teste focado passou
[ ] lint alterados
[ ] prettier alterados
[ ] git diff --check
[ ] nenhum segredo
[ ] nenhum banco real tocado
```

---

## 19. Antes de release

```text
[ ] backend
[ ] frontend
[ ] build
[ ] lint
[ ] format
[ ] migrations
[ ] health
[ ] ready
[ ] smoke de login
[ ] smoke de agendamento
[ ] recuperação de senha
```
