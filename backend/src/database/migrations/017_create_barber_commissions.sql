ALTER TABLE plano_servicos
  ADD COLUMN valor_base_comissao DECIMAL(10,2) NULL AFTER servico_id,
  ADD CONSTRAINT chk_plano_servicos_valor_base_comissao CHECK (
    valor_base_comissao IS NULL OR valor_base_comissao > 0
  );

-- statement-breakpoint
CREATE TABLE configuracoes_comissao_barbeiros (
  barbeiro_id BIGINT UNSIGNED NOT NULL,
  percentual_avulso DECIMAL(5,2) NOT NULL,
  percentual_plano DECIMAL(5,2) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  atualizado_em DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (barbeiro_id),
  CONSTRAINT chk_config_comissao_percentual_avulso CHECK (
    percentual_avulso >= 0 AND percentual_avulso <= 100
  ),
  CONSTRAINT chk_config_comissao_percentual_plano CHECK (
    percentual_plano >= 0 AND percentual_plano <= 100
  ),
  INDEX idx_config_comissao_ativo (ativo, barbeiro_id),
  CONSTRAINT fk_config_comissao_barbeiro FOREIGN KEY (barbeiro_id)
    REFERENCES barbeiros (id) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- statement-breakpoint
CREATE TABLE comissoes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  agendamento_id BIGINT UNSIGNED NOT NULL,
  barbeiro_id BIGINT UNSIGNED NOT NULL,
  tipo_cobranca VARCHAR(20) NOT NULL,
  valor_base_snapshot DECIMAL(10,2) NOT NULL,
  percentual_snapshot DECIMAL(5,2) NOT NULL,
  valor_comissao DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pendente',
  pago_por BIGINT UNSIGNED NULL,
  pago_em DATETIME(6) NULL,
  criado_em DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  atualizado_em DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  CONSTRAINT uq_comissoes_agendamento UNIQUE (agendamento_id),
  CONSTRAINT chk_comissoes_tipo_cobranca CHECK (tipo_cobranca IN ('avulso', 'plano')),
  CONSTRAINT chk_comissoes_valor_base CHECK (valor_base_snapshot >= 0),
  CONSTRAINT chk_comissoes_percentual CHECK (
    percentual_snapshot >= 0 AND percentual_snapshot <= 100
  ),
  CONSTRAINT chk_comissoes_valor CHECK (valor_comissao >= 0),
  CONSTRAINT chk_comissoes_status CHECK (status IN ('pendente', 'paga')),
  CONSTRAINT chk_comissoes_pagamento CHECK (
    (status = 'pendente' AND pago_por IS NULL AND pago_em IS NULL)
    OR (status = 'paga' AND pago_por IS NOT NULL AND pago_em IS NOT NULL)
  ),
  INDEX idx_comissoes_barbeiro_status_data (barbeiro_id, status, criado_em),
  INDEX idx_comissoes_tipo_status_data (tipo_cobranca, status, criado_em),
  INDEX idx_comissoes_pago_por_data (pago_por, pago_em),
  CONSTRAINT fk_comissoes_agendamento FOREIGN KEY (agendamento_id)
    REFERENCES agendamentos (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_comissoes_barbeiro FOREIGN KEY (barbeiro_id)
    REFERENCES barbeiros (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_comissoes_pagador FOREIGN KEY (pago_por)
    REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
