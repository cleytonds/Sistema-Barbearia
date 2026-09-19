ALTER TABLE agendamentos
  MODIFY COLUMN cliente_id BIGINT UNSIGNED NULL,
  ADD COLUMN cliente_nome_snapshot VARCHAR(150) NULL AFTER cliente_id,
  ADD COLUMN cliente_telefone_snapshot VARCHAR(20) NULL AFTER cliente_nome_snapshot,
  ADD CONSTRAINT chk_agendamentos_cliente_ou_snapshot CHECK (
    cliente_id IS NOT NULL
    OR (cliente_nome_snapshot IS NOT NULL AND CHAR_LENGTH(TRIM(cliente_nome_snapshot)) > 0)
  );
