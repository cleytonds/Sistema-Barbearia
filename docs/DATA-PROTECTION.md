# Proteção de Dados — Elite Barbearia 081

## 1. Objetivo

Este documento descreve medidas técnicas e operacionais relacionadas ao tratamento de dados pessoais no sistema.

Ele serve como documentação de engenharia e **não constitui certificação de conformidade jurídica com a LGPD**, nem substitui avaliação jurídica sobre base legal, avisos de privacidade, prazos de retenção ou direitos dos titulares.

---

## 2. Categorias de dados tratadas

O sistema pode tratar dados como:

### Identificação

```text
nome
e-mail
telefone
```

### Autenticação

```text
hash de senha
versão de autenticação
registros de revogação
tokens de recuperação armazenados de forma segura
```

### Operação da barbearia

```text
agendamentos
serviço escolhido
profissional
data/horário
status
observações
histórico operacional
```

### Planos

```text
assinatura
período
pagamento confirmado
utilizações
status
```

### Dados financeiros operacionais

```text
preços snapshot
valores de plano
comissões
```

O sistema não deve armazenar dados que não sejam necessários à finalidade operacional.

---

## 3. Princípio de minimização

Cada área deve receber apenas os campos necessários.

Exemplo:

### Cliente

Pode receber dados próprios e informações públicas de serviço/profissional.

### Barbeiro

Recebe dados necessários ao atendimento e à própria operação.

Não precisa receber detalhes financeiros completos da assinatura do cliente.

### Administrador

Possui visão operacional ampliada, mas não deve receber segredos de autenticação.

---

## 4. Dados que nunca devem ser expostos

A API e os logs não devem retornar:

```text
senha
senha_hash
JWT completo
cookie de sessão
BREVO_API_KEY
DB_PASSWORD
token puro de recuperação
chaves privadas
```

---

## 5. Senhas

Senhas são transformadas em hash com bcrypt.

O banco armazena:

```text
senha_hash
```

e não a senha em texto puro.

A aplicação também invalida sessões antigas em operações de segurança por meio da versão de autenticação.

---

## 6. Recuperação de senha

O token de recuperação:

- é gerado de forma aleatória;
- possui expiração;
- é de uso único;
- não deve ser registrado em logs;
- tem somente sua representação segura/hash persistida para validação.

A resposta do endpoint de solicitação é neutra para não revelar se um e-mail está cadastrado.

---

## 7. Controle de acesso

A aplicação usa:

```text
autenticação
+
papéis
+
propriedade do recurso
```

Papéis:

```text
cliente
barbeiro
admin
```

Exemplos:

- cliente não acessa agendamento de outro cliente;
- barbeiro não acessa agenda privada de outro profissional;
- admin acessa recursos administrativos;
- frontend não é autoridade de autorização.

---

## 8. Sessão

JWT é mantido em cookie:

```text
HttpOnly
Secure em produção
SameSite=Lax
```

Isso reduz a exposição do token ao JavaScript da página.

---

## 9. CSRF e origem

Mutações autenticadas por cookie possuem proteção adicional baseada em origem e header de proteção.

A produção usa proxy `/api` para manter a relação same-origin no navegador.

---

## 10. Banco de dados

Acesso ao banco deve ocorrer por credenciais de ambiente.

Produção:

```text
MySQL Railway
```

Sempre que possível, o banco permanece em rede privada da infraestrutura.

Não expor acesso público sem necessidade operacional.

---

## 11. SQL

Consultas usam parâmetros.

Isso reduz risco de injeção e evita misturar dados recebidos do usuário diretamente na estrutura SQL.

Ordenações e outros identificadores dinâmicos devem usar allowlists internas.

---

## 12. Histórico e snapshots

O sistema preserva histórico por necessidade de integridade operacional.

Exemplos:

- histórico de agendamento;
- preço do serviço no momento da reserva;
- condições contratadas do plano;
- uso do plano;
- comissão relacionada ao atendimento.

Alterar cadastro atual não deve reescrever fatos históricos.

---

## 13. Desativação versus exclusão

Em várias entidades operacionais, a aplicação prefere desativação lógica.

Motivos:

- preservar referências;
- evitar quebrar históricos;
- manter auditabilidade.

Isso significa que uma política formal de retenção precisa distinguir:

```text
desativar registro
≠
apagar dados pessoais
```

O prazo e a base jurídica para retenção não estão definidos por esta documentação técnica e devem ser estabelecidos pelo responsável pelo tratamento com orientação adequada.

---

## 14. Logs

Logs devem ser minimizados.

Permitido quando necessário:

```text
request id
status HTTP
código de erro
categoria da operação
status seguro de provedor
```

Evitar:

```text
payload completo de autenticação
senhas
cookies
tokens
dados pessoais desnecessários
```

---

## 15. E-mail transacional

Recuperação de senha utiliza Brevo via API HTTPS.

Somente dados necessários ao envio devem ser enviados ao provedor, como:

- endereço de e-mail;
- nome de remetente;
- conteúdo necessário da mensagem.

A chave da API permanece secreta.

---

## 16. Backups

Backups de produção também são dados pessoais.

Portanto:

- não devem ser commitados;
- devem ter acesso restrito;
- devem ser armazenados de forma protegida;
- cópias antigas precisam entrar na política de retenção;
- testes de restore devem ocorrer em ambiente controlado.

---

## 17. Ambientes de teste

Testes automatizados devem preferir fixtures fictícias, por exemplo:

```text
@example.test
```

Não reutilizar dados pessoais reais em testes quando não houver necessidade técnica.

Banco de teste:

```text
barbearia_agendamento_test
```

---

## 18. Produção e desenvolvimento

Não copiar a base de produção integralmente para notebooks/desenvolvimento sem necessidade e sem controles adequados.

Se for necessário reproduzir problema com dados, preferir:

```text
dados sintéticos
ou
dados minimizados/anônimos
```

quando tecnicamente possível.

---

## 19. Incidentes

Se houver suspeita de exposição:

1. preservar evidências;
2. limitar acesso;
3. rotacionar credenciais comprometidas;
4. identificar quais dados foram afetados;
5. registrar período e impacto;
6. não apagar logs relevantes antes da análise;
7. avaliar obrigações legais com profissional responsável.

---

## 20. Direitos e processos organizacionais

Itens como:

- aviso de privacidade;
- base legal;
- canal para titular;
- solicitação de acesso;
- correção;
- eliminação quando aplicável;
- política formal de retenção;
- contratos com operadores;

não podem ser considerados implementados apenas por existir segurança técnica no software.

São processos organizacionais que precisam ser definidos pelo responsável pelo negócio.

---

## 21. Checklist técnico de privacidade

```text
[ ] API retorna apenas campos necessários
[ ] sem senhas/hashes em respostas
[ ] sem tokens em logs
[ ] cookies seguros
[ ] autorização no backend
[ ] ownership validado
[ ] backups protegidos
[ ] banco de teste isolado
[ ] dados reais evitados em fixtures
[ ] segredos fora do Git
[ ] Brevo configurado por variável
[ ] acesso ao MySQL restrito
```

---

## 22. Regra de ouro

Segurança técnica ajuda a proteger dados pessoais, mas não transforma automaticamente o sistema em juridicamente conforme.

Documentação, processos internos e decisões do controlador também são necessários.
