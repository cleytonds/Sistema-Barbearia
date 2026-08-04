ALTER TABLE usuarios
  ADD COLUMN auth_versao INT UNSIGNED NOT NULL DEFAULT 1 AFTER ativo,
  ADD CONSTRAINT chk_usuarios_auth_versao CHECK (auth_versao > 0);

-- statement-breakpoint

CREATE TABLE tokens_jwt_revogados (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id BIGINT UNSIGNED NOT NULL,
  jti_hash CHAR(64) NOT NULL,
  expira_em DATETIME(6) NOT NULL,
  criado_em DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  CONSTRAINT uq_tokens_jwt_revogados_hash UNIQUE (jti_hash),
  INDEX idx_tokens_jwt_revogados_expiracao (expira_em),
  INDEX idx_tokens_jwt_revogados_usuario (usuario_id, criado_em),
  CONSTRAINT fk_tokens_jwt_revogados_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON UPDATE RESTRICT ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
