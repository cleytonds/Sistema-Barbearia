CREATE TABLE horarios_funcionamento (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  dia_semana TINYINT UNSIGNED NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  intervalo_inicio TIME NULL,
  intervalo_fim TIME NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  atualizado_em DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  CONSTRAINT uq_horarios_funcionamento_dia UNIQUE (dia_semana),
  CONSTRAINT chk_hf_dia CHECK (dia_semana BETWEEN 0 AND 6),
  CONSTRAINT chk_hf_jornada CHECK (hora_fim > hora_inicio),
  CONSTRAINT chk_hf_intervalo_par CHECK ((intervalo_inicio IS NULL AND intervalo_fim IS NULL) OR (intervalo_inicio IS NOT NULL AND intervalo_fim IS NOT NULL)),
  CONSTRAINT chk_hf_intervalo_ordem CHECK (intervalo_inicio IS NULL OR intervalo_fim > intervalo_inicio),
  CONSTRAINT chk_hf_intervalo_jornada CHECK (intervalo_inicio IS NULL OR (intervalo_inicio >= hora_inicio AND intervalo_fim <= hora_fim))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
