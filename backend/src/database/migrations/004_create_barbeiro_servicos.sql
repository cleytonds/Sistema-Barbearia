CREATE TABLE barbeiro_servicos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  barbeiro_id BIGINT UNSIGNED NOT NULL,
  servico_id BIGINT UNSIGNED NOT NULL,
  criado_em DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  CONSTRAINT uq_barbeiro_servicos UNIQUE (barbeiro_id, servico_id),
  INDEX idx_barbeiro_servicos_servico (servico_id, barbeiro_id),
  CONSTRAINT fk_barbeiro_servicos_barbeiro FOREIGN KEY (barbeiro_id) REFERENCES barbeiros (id) ON UPDATE RESTRICT ON DELETE CASCADE,
  CONSTRAINT fk_barbeiro_servicos_servico FOREIGN KEY (servico_id) REFERENCES servicos (id) ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
