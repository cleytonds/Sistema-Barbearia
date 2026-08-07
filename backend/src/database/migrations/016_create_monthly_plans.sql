CREATE TABLE planos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome VARCHAR(120) NOT NULL,
  descricao TEXT NULL,
  preco DECIMAL(10,2) NOT NULL,
  adesao_inicio DATE NOT NULL,
  adesao_fim DATE NOT NULL,
  utilizacao_inicio DATE NOT NULL,
  utilizacao_fim DATE NOT NULL,
  possui_limite_semanal BOOLEAN NOT NULL DEFAULT FALSE,
  limite_semanal SMALLINT UNSIGNED NULL,
  possui_limite_total BOOLEAN NOT NULL DEFAULT FALSE,
  limite_total SMALLINT UNSIGNED NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  adesoes_abertas BOOLEAN NOT NULL DEFAULT TRUE,
  uso_status VARCHAR(20) NOT NULL DEFAULT 'permitido',
  uso_suspensao_motivo VARCHAR(500) NULL,
  uso_suspenso_por BIGINT UNSIGNED NULL,
  uso_suspenso_em DATETIME(6) NULL,
  criado_por BIGINT UNSIGNED NOT NULL,
  atualizado_por BIGINT UNSIGNED NOT NULL,
  criado_em DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  atualizado_em DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  CONSTRAINT chk_planos_preco CHECK (preco > 0),
  CONSTRAINT chk_planos_adesao_periodo CHECK (adesao_fim >= adesao_inicio),
  CONSTRAINT chk_planos_utilizacao_periodo CHECK (utilizacao_fim >= utilizacao_inicio),
  CONSTRAINT chk_planos_uso_status CHECK (uso_status IN ('permitido', 'suspenso')),
  CONSTRAINT chk_planos_limite_semanal CHECK (
    (possui_limite_semanal = FALSE AND limite_semanal IS NULL)
    OR (possui_limite_semanal = TRUE AND limite_semanal > 0)
  ),
  CONSTRAINT chk_planos_limite_total CHECK (
    (possui_limite_total = FALSE AND limite_total IS NULL)
    OR (possui_limite_total = TRUE AND limite_total > 0)
  ),
  CONSTRAINT chk_planos_limites_relacao CHECK (
    NOT (possui_limite_semanal AND possui_limite_total)
    OR limite_semanal <= limite_total
  ),
  CONSTRAINT chk_planos_suspensao CHECK (
    (uso_status = 'permitido' AND uso_suspensao_motivo IS NULL AND uso_suspenso_por IS NULL AND uso_suspenso_em IS NULL)
    OR
    (uso_status = 'suspenso' AND CHAR_LENGTH(TRIM(uso_suspensao_motivo)) > 0 AND uso_suspenso_por IS NOT NULL AND uso_suspenso_em IS NOT NULL)
  ),
  INDEX idx_planos_publicos (ativo, adesoes_abertas, adesao_inicio, adesao_fim),
  INDEX idx_planos_uso_periodo (uso_status, utilizacao_inicio, utilizacao_fim),
  INDEX idx_planos_nome (nome),
  CONSTRAINT fk_planos_suspensor FOREIGN KEY (uso_suspenso_por) REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_planos_criador FOREIGN KEY (criado_por) REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_planos_atualizador FOREIGN KEY (atualizado_por) REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- statement-breakpoint
CREATE TABLE plano_servicos (
  plano_id BIGINT UNSIGNED NOT NULL,
  servico_id BIGINT UNSIGNED NOT NULL,
  criado_em DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (plano_id, servico_id),
  INDEX idx_plano_servicos_servico (servico_id, plano_id),
  CONSTRAINT fk_plano_servicos_plano FOREIGN KEY (plano_id) REFERENCES planos (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_plano_servicos_servico FOREIGN KEY (servico_id) REFERENCES servicos (id) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- statement-breakpoint
CREATE TABLE plano_barbeiros (
  plano_id BIGINT UNSIGNED NOT NULL,
  barbeiro_id BIGINT UNSIGNED NOT NULL,
  criado_em DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (plano_id, barbeiro_id),
  INDEX idx_plano_barbeiros_barbeiro (barbeiro_id, plano_id),
  CONSTRAINT fk_plano_barbeiros_plano FOREIGN KEY (plano_id) REFERENCES planos (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_plano_barbeiros_barbeiro FOREIGN KEY (barbeiro_id) REFERENCES barbeiros (id) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- statement-breakpoint
CREATE TABLE assinaturas_planos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  plano_id BIGINT UNSIGNED NOT NULL,
  cliente_id BIGINT UNSIGNED NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'aguardando_pagamento',
  inicio_em DATE NOT NULL,
  fim_em DATE NOT NULL,
  plano_nome_snapshot VARCHAR(120) NOT NULL,
  valor_contratado DECIMAL(10,2) NOT NULL,
  possui_limite_semanal_snapshot BOOLEAN NOT NULL DEFAULT FALSE,
  limite_semanal_snapshot SMALLINT UNSIGNED NULL,
  possui_limite_total_snapshot BOOLEAN NOT NULL DEFAULT FALSE,
  limite_total_snapshot SMALLINT UNSIGNED NULL,
  fuso_horario_snapshot VARCHAR(64) NOT NULL,
  solicitada_em DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  ativada_em DATETIME(6) NULL,
  suspensa_em DATETIME(6) NULL,
  cancelada_em DATETIME(6) NULL,
  motivo_status VARCHAR(500) NULL,
  alterada_por BIGINT UNSIGNED NULL,
  idempotency_key_hash BINARY(32) NULL,
  idempotency_payload_hash BINARY(32) NULL,
  criado_em DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  atualizado_em DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  CONSTRAINT uq_assinaturas_idempotencia UNIQUE (cliente_id, idempotency_key_hash),
  CONSTRAINT chk_assinaturas_status CHECK (status IN ('aguardando_pagamento', 'ativa', 'vencida', 'suspensa', 'cancelada')),
  CONSTRAINT chk_assinaturas_periodo CHECK (fim_em >= inicio_em),
  CONSTRAINT chk_assinaturas_valor CHECK (valor_contratado > 0),
  CONSTRAINT chk_assinaturas_limite_semanal CHECK (
    (possui_limite_semanal_snapshot = FALSE AND limite_semanal_snapshot IS NULL)
    OR (possui_limite_semanal_snapshot = TRUE AND limite_semanal_snapshot > 0)
  ),
  CONSTRAINT chk_assinaturas_limite_total CHECK (
    (possui_limite_total_snapshot = FALSE AND limite_total_snapshot IS NULL)
    OR (possui_limite_total_snapshot = TRUE AND limite_total_snapshot > 0)
  ),
  CONSTRAINT chk_assinaturas_limites_relacao CHECK (
    NOT (possui_limite_semanal_snapshot AND possui_limite_total_snapshot)
    OR limite_semanal_snapshot <= limite_total_snapshot
  ),
  CONSTRAINT chk_assinaturas_hashes CHECK (
    (idempotency_key_hash IS NULL AND idempotency_payload_hash IS NULL)
    OR (idempotency_key_hash IS NOT NULL AND idempotency_payload_hash IS NOT NULL)
  ),
  CONSTRAINT chk_assinaturas_timestamps CHECK (
    (status = 'aguardando_pagamento' AND ativada_em IS NULL AND suspensa_em IS NULL AND cancelada_em IS NULL)
    OR (status = 'ativa' AND ativada_em IS NOT NULL AND suspensa_em IS NULL AND cancelada_em IS NULL)
    OR (status = 'suspensa' AND ativada_em IS NOT NULL AND suspensa_em IS NOT NULL AND cancelada_em IS NULL AND CHAR_LENGTH(TRIM(motivo_status)) > 0)
    OR (status = 'vencida' AND ativada_em IS NOT NULL AND cancelada_em IS NULL)
    OR (status = 'cancelada' AND cancelada_em IS NOT NULL AND CHAR_LENGTH(TRIM(motivo_status)) > 0)
  ),
  INDEX idx_assinaturas_cliente_status_periodo (cliente_id, status, inicio_em, fim_em),
  INDEX idx_assinaturas_plano_status_inicio (plano_id, status, inicio_em),
  INDEX idx_assinaturas_status_fim (status, fim_em),
  CONSTRAINT fk_assinaturas_plano FOREIGN KEY (plano_id) REFERENCES planos (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_assinaturas_cliente FOREIGN KEY (cliente_id) REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_assinaturas_alterador FOREIGN KEY (alterada_por) REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- statement-breakpoint
CREATE TABLE assinatura_plano_servicos (
  assinatura_id BIGINT UNSIGNED NOT NULL,
  servico_id BIGINT UNSIGNED NOT NULL,
  servico_nome_snapshot VARCHAR(120) NOT NULL,
  criado_em DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (assinatura_id, servico_id),
  INDEX idx_assinatura_servicos_servico (servico_id, assinatura_id),
  CONSTRAINT fk_assinatura_servicos_assinatura FOREIGN KEY (assinatura_id) REFERENCES assinaturas_planos (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_assinatura_servicos_servico FOREIGN KEY (servico_id) REFERENCES servicos (id) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- statement-breakpoint
CREATE TABLE assinatura_plano_barbeiros (
  assinatura_id BIGINT UNSIGNED NOT NULL,
  barbeiro_id BIGINT UNSIGNED NOT NULL,
  barbeiro_nome_snapshot VARCHAR(150) NOT NULL,
  criado_em DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (assinatura_id, barbeiro_id),
  INDEX idx_assinatura_barbeiros_barbeiro (barbeiro_id, assinatura_id),
  CONSTRAINT fk_assinatura_barbeiros_assinatura FOREIGN KEY (assinatura_id) REFERENCES assinaturas_planos (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_assinatura_barbeiros_barbeiro FOREIGN KEY (barbeiro_id) REFERENCES barbeiros (id) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- statement-breakpoint
CREATE TABLE pagamentos_planos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  assinatura_id BIGINT UNSIGNED NOT NULL,
  referencia_mes DATE NOT NULL,
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  valor_confirmado DECIMAL(10,2) NOT NULL,
  forma VARCHAR(20) NOT NULL DEFAULT 'presencial',
  status VARCHAR(20) NOT NULL DEFAULT 'pendente',
  confirmado_por BIGINT UNSIGNED NULL,
  confirmado_em DATETIME(6) NULL,
  cancelado_por BIGINT UNSIGNED NULL,
  cancelado_em DATETIME(6) NULL,
  observacao VARCHAR(1000) NULL,
  criado_em DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  atualizado_em DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  CONSTRAINT uq_pagamentos_assinatura_referencia UNIQUE (assinatura_id, referencia_mes),
  CONSTRAINT chk_pagamentos_referencia CHECK (DAY(referencia_mes) = 1),
  CONSTRAINT chk_pagamentos_periodo CHECK (periodo_fim >= periodo_inicio),
  CONSTRAINT chk_pagamentos_valor CHECK (valor_confirmado > 0),
  CONSTRAINT chk_pagamentos_forma CHECK (forma IN ('presencial')),
  CONSTRAINT chk_pagamentos_status CHECK (status IN ('pendente', 'confirmado', 'cancelado')),
  CONSTRAINT chk_pagamentos_estado CHECK (
    (status = 'pendente' AND confirmado_por IS NULL AND confirmado_em IS NULL AND cancelado_por IS NULL AND cancelado_em IS NULL)
    OR (status = 'confirmado' AND confirmado_por IS NOT NULL AND confirmado_em IS NOT NULL AND cancelado_por IS NULL AND cancelado_em IS NULL)
    OR (status = 'cancelado' AND cancelado_por IS NOT NULL AND cancelado_em IS NOT NULL)
  ),
  INDEX idx_pagamentos_status_referencia (status, referencia_mes),
  INDEX idx_pagamentos_confirmador_data (confirmado_por, confirmado_em),
  CONSTRAINT fk_pagamentos_assinatura FOREIGN KEY (assinatura_id) REFERENCES assinaturas_planos (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_pagamentos_confirmador FOREIGN KEY (confirmado_por) REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_pagamentos_cancelador FOREIGN KEY (cancelado_por) REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- statement-breakpoint
CREATE TABLE usos_planos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  assinatura_id BIGINT UNSIGNED NOT NULL,
  agendamento_id BIGINT UNSIGNED NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'reservado',
  data_utilizacao DATE NOT NULL,
  semana_inicio DATE NOT NULL,
  reservado_em DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  consumido_em DATETIME(6) NULL,
  liberado_em DATETIME(6) NULL,
  motivo_liberacao VARCHAR(500) NULL,
  criado_em DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  atualizado_em DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  CONSTRAINT uq_usos_agendamento UNIQUE (agendamento_id),
  CONSTRAINT chk_usos_status CHECK (status IN ('reservado', 'consumido', 'liberado')),
  CONSTRAINT chk_usos_semana CHECK (WEEKDAY(semana_inicio) = 0),
  CONSTRAINT chk_usos_estado CHECK (
    (status = 'reservado' AND consumido_em IS NULL AND liberado_em IS NULL)
    OR (status = 'consumido' AND consumido_em IS NOT NULL AND liberado_em IS NULL)
    OR (status = 'liberado' AND consumido_em IS NULL AND liberado_em IS NOT NULL AND CHAR_LENGTH(TRIM(motivo_liberacao)) > 0)
  ),
  INDEX idx_usos_assinatura_semana_status (assinatura_id, semana_inicio, status),
  INDEX idx_usos_assinatura_data_status (assinatura_id, data_utilizacao, status),
  INDEX idx_usos_status_reserva (status, reservado_em),
  CONSTRAINT fk_usos_assinatura FOREIGN KEY (assinatura_id) REFERENCES assinaturas_planos (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_usos_agendamento FOREIGN KEY (agendamento_id) REFERENCES agendamentos (id) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- statement-breakpoint
CREATE TABLE historico_planos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  plano_id BIGINT UNSIGNED NULL,
  assinatura_id BIGINT UNSIGNED NULL,
  pagamento_id BIGINT UNSIGNED NULL,
  uso_id BIGINT UNSIGNED NULL,
  tipo_evento VARCHAR(50) NOT NULL,
  alterado_por BIGINT UNSIGNED NOT NULL,
  observacao VARCHAR(1000) NULL,
  dados_anteriores JSON NULL,
  dados_novos JSON NULL,
  criado_em DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  CONSTRAINT chk_historico_planos_entidade CHECK (
    plano_id IS NOT NULL OR assinatura_id IS NOT NULL OR pagamento_id IS NOT NULL OR uso_id IS NOT NULL
  ),
  CONSTRAINT chk_historico_planos_tipo CHECK (tipo_evento IN (
    'plano_criado', 'plano_editado', 'plano_ativado', 'plano_desativado',
    'adesoes_abertas', 'adesoes_fechadas', 'uso_permitido', 'uso_suspenso',
    'assinatura_solicitada', 'pagamento_criado', 'pagamento_confirmado',
    'pagamento_cancelado', 'assinatura_ativada', 'assinatura_suspensa',
    'assinatura_reativada', 'assinatura_cancelada', 'assinatura_vencida',
    'utilizacao_reservada', 'utilizacao_consumida', 'utilizacao_liberada',
    'cobertura_plano_para_avulso', 'cobertura_avulso_para_plano'
  )),
  INDEX idx_historico_planos_plano_data (plano_id, criado_em),
  INDEX idx_historico_planos_assinatura_data (assinatura_id, criado_em),
  INDEX idx_historico_planos_pagamento_data (pagamento_id, criado_em),
  INDEX idx_historico_planos_uso_data (uso_id, criado_em),
  INDEX idx_historico_planos_autor_data (alterado_por, criado_em),
  CONSTRAINT fk_historico_planos_plano FOREIGN KEY (plano_id) REFERENCES planos (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_historico_planos_assinatura FOREIGN KEY (assinatura_id) REFERENCES assinaturas_planos (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_historico_planos_pagamento FOREIGN KEY (pagamento_id) REFERENCES pagamentos_planos (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_historico_planos_uso FOREIGN KEY (uso_id) REFERENCES usos_planos (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_historico_planos_autor FOREIGN KEY (alterado_por) REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- statement-breakpoint
ALTER TABLE agendamentos
  ADD COLUMN tipo_cobranca VARCHAR(20) NOT NULL DEFAULT 'avulso' AFTER origem,
  ADD COLUMN assinatura_plano_id BIGINT UNSIGNED NULL AFTER tipo_cobranca,
  ADD COLUMN plano_id_snapshot BIGINT UNSIGNED NULL AFTER assinatura_plano_id,
  ADD COLUMN plano_nome_snapshot VARCHAR(120) NULL AFTER plano_id_snapshot,
  ADD COLUMN cobertura_confirmada_em DATETIME(6) NULL AFTER plano_nome_snapshot,
  ADD CONSTRAINT chk_agendamentos_tipo_cobranca CHECK (tipo_cobranca IN ('avulso', 'plano')),
  ADD CONSTRAINT chk_agendamentos_cobertura_plano CHECK (
    (tipo_cobranca = 'avulso' AND assinatura_plano_id IS NULL AND plano_id_snapshot IS NULL AND plano_nome_snapshot IS NULL AND cobertura_confirmada_em IS NULL)
    OR
    (tipo_cobranca = 'plano' AND assinatura_plano_id IS NOT NULL AND plano_id_snapshot IS NOT NULL AND CHAR_LENGTH(TRIM(plano_nome_snapshot)) > 0 AND cobertura_confirmada_em IS NOT NULL)
  ),
  ADD INDEX idx_agendamentos_tipo_inicio (tipo_cobranca, inicio_em),
  ADD INDEX idx_agendamentos_assinatura_inicio (assinatura_plano_id, inicio_em),
  ADD CONSTRAINT fk_agendamentos_assinatura_plano FOREIGN KEY (assinatura_plano_id) REFERENCES assinaturas_planos (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  ADD CONSTRAINT fk_agendamentos_plano_snapshot FOREIGN KEY (plano_id_snapshot) REFERENCES planos (id) ON UPDATE RESTRICT ON DELETE RESTRICT;
