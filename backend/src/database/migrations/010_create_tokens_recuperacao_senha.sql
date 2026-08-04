CREATE TABLE tokens_recuperacao_senha (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expira_em DATETIME(6) NOT NULL,
  utilizado_em DATETIME(6) NULL,
  criado_em DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  CONSTRAINT uq_tokens_recuperacao_hash UNIQUE (token_hash),
  INDEX idx_tokens_recuperacao_usuario_data (usuario_id, criado_em),
  INDEX idx_tokens_recuperacao_expiracao (expira_em, utilizado_em),
  CONSTRAINT fk_tokens_recuperacao_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
