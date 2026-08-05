CREATE TABLE IF NOT EXISTS papeis (
  id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome VARCHAR(20) NOT NULL,
  criado_em DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  CONSTRAINT uq_papeis_nome UNIQUE (nome),
  CONSTRAINT chk_papeis_nome CHECK (nome IN ('cliente', 'barbeiro', 'admin'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- statement-breakpoint
INSERT IGNORE INTO papeis (nome) VALUES ('cliente'), ('barbeiro'), ('admin');

-- statement-breakpoint
CREATE TABLE IF NOT EXISTS usuario_papeis (
  usuario_id BIGINT UNSIGNED NOT NULL,
  papel_id SMALLINT UNSIGNED NOT NULL,
  criado_em DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (usuario_id, papel_id),
  CONSTRAINT fk_usuario_papeis_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    ON UPDATE RESTRICT ON DELETE CASCADE,
  CONSTRAINT fk_usuario_papeis_papel FOREIGN KEY (papel_id) REFERENCES papeis(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  INDEX idx_usuario_papeis_papel_usuario (papel_id, usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- statement-breakpoint
INSERT IGNORE INTO usuario_papeis (usuario_id, papel_id)
SELECT u.id, p.id FROM usuarios u INNER JOIN papeis p ON p.nome = u.perfil;
