# Operação em Produção — Elite Barbearia 081

## 1. Objetivo

Este documento funciona como manual operacional para manter a aplicação ativa e diagnosticar problemas do dia a dia.

---

## 2. Serviços envolvidos

```text
Vercel  -> frontend
Railway -> backend
Railway -> MySQL
Brevo   -> e-mail transacional
GitHub  -> código-fonte
```

Uma falha percebida pelo usuário pode estar em qualquer uma dessas camadas.

---

## 3. Verificação rápida

Quando houver reclamação de indisponibilidade:

### 1. Frontend

Abrir a URL pública e confirmar carregamento.

### 2. API

```http
GET /api/health
```

### 3. Readiness

```http
GET /api/ready
```

### 4. Login

Confirmar um fluxo real de autenticação.

### 5. Logs

Verificar Railway sem copiar segredos para chats ou tickets.

---

## 4. Interpretação

### Frontend abre, API falha

Provável problema:

- Railway backend;
- variáveis;
- banco;
- deploy backend;
- rewrite.

### `/health` funciona e `/ready` falha

Provável problema:

- banco inacessível;
- schema incompleto;
- configuração essencial ausente.

### Login retorna sucesso e área protegida perde sessão

Investigar:

- cookie;
- `/auth/me`;
- proxy `/api`;
- `SameSite`;
- `Secure`;
- origem;
- CSRF;
- cache/deploy frontend.

---

## 5. Usuários e papéis

Papéis:

```text
cliente
barbeiro
admin
```

Um usuário pode possuir vários papéis.

Não criar contas duplicadas apenas para dar acesso a outra área.

Mudanças de papel devem preservar a identidade e invalidar sessões antigas quando necessário.

---

## 6. Serviços

Operação administrativa permite:

- criar;
- editar;
- ativar;
- desativar.

Preferir desativação lógica.

Não apagar serviço histórico apenas porque deixou de ser oferecido.

---

## 7. Profissionais

Profissional envolve:

```text
usuario
+
barbeiro
+
servicos vinculados
+
jornada
```

Ao cadastrar/alterar profissional, validar todos os vínculos.

---

## 8. Funcionamento

Há dois níveis:

```text
horario da barbearia
horario do profissional
```

A disponibilidade é a interseção dos dois.

Alterações podem afetar horários futuros imediatamente.

---

## 9. Bloqueios

Podem ser:

```text
globais
ou
por profissional
```

Usar para exceções pontuais, ausências ou indisponibilidades.

Não editar jornada semanal para representar um bloqueio isolado quando a regra correta é bloqueio.

---

## 10. Agendamentos

Nunca alterar diretamente no banco como primeira opção operacional.

Usar as rotas/painéis do sistema para preservar:

- validação;
- histórico;
- plano;
- comissão;
- concorrência.

---

## 11. Planos

Operações principais:

- abrir/fechar adesões;
- ativar/desativar;
- suspender uso;
- consultar assinaturas;
- confirmar pagamento;
- suspender/reativar/cancelar assinatura.

Pagamento é presencial e confirmado pelo administrador.

---

## 12. Comissões

Comissão deve ser tratada como dado financeiro derivado do domínio.

Evitar correções manuais diretamente no banco sem diagnóstico da origem.

---

## 13. Arquivamento do barbeiro

Arquivar atendimento é operação de organização visual/operacional.

Não significa excluir:

- agendamento;
- histórico;
- comissão;
- uso de plano.

---

## 14. Recuperação de senha

Fluxo depende da Brevo.

Se o usuário não receber e-mail:

1. confirmar que a API respondeu;
2. verificar logs seguros;
3. confirmar `BREVO_API_KEY`;
4. confirmar sender verificado;
5. confirmar `EMAIL_FROM`;
6. verificar painel da Brevo;
7. não exibir token de recuperação em produção.

---

## 15. Logs

Logs devem ajudar a responder:

```text
qual requisição?
qual serviço?
qual código?
qual status?
```

Nunca registrar:

- senha;
- JWT completo;
- cookie;
- chave Brevo;
- senha do banco;
- token puro de reset.

---

## 16. Mudanças em produção

Antes de qualquer mudança:

```powershell
git status --short
```

Regras:

- preservar alterações existentes;
- não usar `git add .` em worktree misto;
- stage explícito;
- testes focados;
- não executar SQL destrutivo sem escopo;
- não misturar correção urgente com refatoração.

---

## 17. Manutenção do banco

Preferência:

```text
migration versionada
>
SQL manual
```

SQL manual só quando:

- a operação é excepcional;
- há validação prévia;
- existe backup;
- há rollback claro;
- o alvo foi confirmado.

---

## 18. Dados operacionais iniciais

Scripts usados para importação/migração única não devem ser executados novamente em produção sem nova análise.

Ferramentas one-shot devem abortar quando o destino já contém dados.

---

## 19. Checklist diário simples

```text
[ ] site abre
[ ] login funciona
[ ] agenda carrega
[ ] disponibilidade responde
[ ] banco ready
[ ] sem erro repetitivo nos logs
```

---

## 20. Checklist antes de abrir a barbearia

```text
[ ] profissionais ativos corretos
[ ] serviços ativos corretos
[ ] preços/durações corretos
[ ] jornadas corretas
[ ] funcionamento correto
[ ] bloqueios excepcionais cadastrados
[ ] admin acessa painel
[ ] barbeiros acessam suas agendas
[ ] recuperação de senha funcional
```

---

## 21. Incidente em produção

Registrar:

```text
data/hora
impacto
rota/funcionalidade
erro observado
último deploy
mudança recente
logs relevantes sem segredo
ação tomada
resultado
```

Evitar testar várias correções ao mesmo tempo.

---

## 22. Prioridade

Ordem recomendada:

```text
1. segurança
2. perda/corrupção de dados
3. login
4. agendamento
5. operação do barbeiro
6. administração
7. planos/comissões
8. melhorias visuais
```
