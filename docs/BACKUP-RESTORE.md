# Backup e Restauração — Elite Barbearia 081

## 1. Objetivo

O backup é a proteção contra:

- exclusão acidental;
- migration incorreta;
- falha operacional;
- corrupção;
- erro humano;
- incidente de infraestrutura.

Backup que nunca foi restaurado em teste não deve ser considerado plenamente validado.

---

## 2. Escopo

O ativo crítico é o banco MySQL de produção.

Código já está versionado no GitHub e deploys possuem histórico nas plataformas.

Dados do banco exigem estratégia própria.

---

## 3. O que deve estar no backup

Inclui:

- schema;
- dados;
- índices;
- constraints;
- triggers, se existirem;
- rotinas, se existirem.

---

## 4. O que não deve ser commitado

Nunca adicionar ao Git:

```text
*.sql de produção
backups/
dumps/
credenciais
.env
```

Backups contêm dados pessoais e devem ter controle de acesso.

---

## 5. Backup lógico

Ferramenta recomendada:

```text
mysqldump
```

Exemplo conceitual com túnel seguro:

```powershell
railway.cmd connect mysql --tunnel-only
```

Em outro terminal:

```powershell
$env:MYSQL_PWD="<senha>"
mysqldump `
  -h 127.0.0.1 `
  -P <PORTA_DO_TUNEL> `
  -u root `
  --single-transaction `
  --quick `
  --routines `
  --triggers `
  --set-gtid-purged=OFF `
  railway > backup-elite-YYYYMMDD-HHmmss.sql
```

Depois:

```powershell
Remove-Item Env:MYSQL_PWD
```

Não colocar a senha diretamente no comando salvo em histórico sempre que houver alternativa.

---

## 6. `--single-transaction`

Para tabelas InnoDB, ajuda a obter fotografia consistente sem bloquear toda a aplicação durante o dump.

Isso não substitui manutenção planejada em cenários de operações muito sensíveis.

---

## 7. Frequência recomendada

Para produção pequena:

```text
backup diário
+
backup manual antes de migration relevante
+
backup antes de operação excepcional no banco
```

A frequência pode aumentar conforme volume e importância comercial.

---

## 8. Nomenclatura

Exemplo:

```text
elite-prod-20260825-190000.sql
```

Não incluir senha ou segredo no nome.

---

## 9. Armazenamento

Manter cópias em local protegido e diferente do servidor principal.

Idealmente:

```text
cópia plataforma
+
cópia externa criptografada
```

Não deixar o único backup no mesmo computador que executa o desenvolvimento.

---

## 10. Retenção sugerida

Exemplo simples:

```text
7 backups diários
4 backups semanais
3 backups mensais
```

A política pode ser ajustada conforme espaço e necessidade legal/comercial.

---

## 11. Verificação

Depois do dump:

- confirmar que arquivo não está vazio;
- verificar tamanho plausível;
- registrar data;
- proteger acesso;
- testar restauração periodicamente.

---

## 12. Restauração deve ocorrer primeiro em ambiente isolado

Nunca usar produção como primeiro teste de restore.

Criar banco temporário:

```text
barbearia_restore_test
```

e restaurar o dump nele.

Depois validar:

```text
migrations
usuarios
barbeiros
servicos
agendamentos
planos
comissoes
constraints
```

---

## 13. Exemplo de restore isolado

```powershell
$env:MYSQL_PWD="<senha-local-ou-segura>"

mysql `
  -h 127.0.0.1 `
  -P <porta> `
  -u root `
  barbearia_restore_test < backup.sql

Remove-Item Env:MYSQL_PWD
```

---

## 14. Validação pós-restore

Executar consultas somente leitura:

```sql
SELECT COUNT(*) FROM usuarios;
SELECT COUNT(*) FROM barbeiros;
SELECT COUNT(*) FROM servicos;
SELECT COUNT(*) FROM agendamentos;
SELECT COUNT(*) FROM planos;
```

Comparar com os totais esperados do backup.

---

## 15. Restore de produção

Só executar quando:

```text
[ ] incidente confirmado
[ ] backup correto selecionado
[ ] impacto comunicado
[ ] backup atual da produção feito antes
[ ] procedimento testado isoladamente
[ ] banco alvo confirmado
[ ] janela operacional definida
```

---

## 16. Cuidado com migrations

Um dump pode representar schema de uma versão anterior.

Antes de restaurar:

1. identificar commit da aplicação;
2. identificar migrations aplicadas;
3. restaurar versão compatível;
4. aplicar migrations posteriores somente se necessário e validado.

---

## 17. RPO e RTO

### RPO

Quanto dado pode ser perdido.

Backup diário:

```text
RPO máximo aproximado: até 24 horas
```

### RTO

Quanto tempo a operação pode ficar indisponível até restaurar.

Esses valores devem ser definidos com o proprietário conforme o sistema se tornar mais crítico.

---

## 18. Regra de ouro

```text
backup
+
restore testado
+
procedimento documentado
=
estratégia real de recuperação
```
