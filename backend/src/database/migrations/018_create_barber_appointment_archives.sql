CREATE TABLE agendamentos_arquivados_barbeiro (
  agendamento_id BIGINT UNSIGNED NOT NULL,
  barbeiro_id BIGINT UNSIGNED NOT NULL,
  arquivado_por BIGINT UNSIGNED NOT NULL,
  arquivado_em DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (agendamento_id),
  INDEX idx_agendamentos_arquivados_barbeiro_data (barbeiro_id, arquivado_em),
  CONSTRAINT fk_agendamentos_arquivados_agendamento FOREIGN KEY (agendamento_id)
    REFERENCES agendamentos (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_agendamentos_arquivados_barbeiro FOREIGN KEY (barbeiro_id)
    REFERENCES barbeiros (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_agendamentos_arquivados_autor FOREIGN KEY (arquivado_por)
    REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
