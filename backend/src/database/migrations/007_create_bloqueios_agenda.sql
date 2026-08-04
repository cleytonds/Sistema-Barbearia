CREATE TABLE bloqueios_agenda (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  barbeiro_id BIGINT UNSIGNED NULL,
  inicio_em DATETIME(6) NOT NULL,
  fim_em DATETIME(6) NOT NULL,
  motivo VARCHAR(500) NOT NULL,
  criado_por BIGINT UNSIGNED NOT NULL,
  criado_em DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  atualizado_em DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  CONSTRAINT chk_bloqueios_periodo CHECK (fim_em > inicio_em),
  INDEX idx_bloqueios_barbeiro_periodo (barbeiro_id, inicio_em, fim_em),
  INDEX idx_bloqueios_periodo (inicio_em, fim_em),
  INDEX idx_bloqueios_criado_por (criado_por),
  CONSTRAINT fk_bloqueios_barbeiro FOREIGN KEY (barbeiro_id) REFERENCES barbeiros (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_bloqueios_criador FOREIGN KEY (criado_por) REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
