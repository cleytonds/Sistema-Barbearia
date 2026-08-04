CREATE TABLE configuracoes (
  id TINYINT UNSIGNED NOT NULL,
  nome_barbearia VARCHAR(150) NOT NULL,
  telefone VARCHAR(20) NULL,
  endereco VARCHAR(500) NULL,
  fuso_horario VARCHAR(64) NOT NULL DEFAULT 'America/Recife',
  tempo_minimo_cancelamento_horas SMALLINT UNSIGNED NOT NULL DEFAULT 2,
  antecedencia_maxima_dias SMALLINT UNSIGNED NOT NULL DEFAULT 30,
  intervalo_entre_atendimentos_minutos SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  criado_em DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  atualizado_em DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  CONSTRAINT chk_configuracoes_singleton CHECK (id = 1),
  CONSTRAINT chk_configuracoes_antecedencia CHECK (antecedencia_maxima_dias > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
