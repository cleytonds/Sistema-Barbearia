ALTER TABLE agendamentos
  ADD COLUMN buffer_minutos SMALLINT UNSIGNED NOT NULL AFTER duracao_minutos,
  ADD COLUMN fim_ocupacao_em DATETIME(6) NOT NULL AFTER fim_em,
  ADD COLUMN idempotency_key_hash BINARY(32) NULL AFTER motivo_cancelamento,
  ADD COLUMN idempotency_payload_hash BINARY(32) NULL AFTER idempotency_key_hash,
  ADD INDEX idx_agendamentos_barbeiro_conflito (
    barbeiro_id,
    status,
    inicio_em,
    fim_ocupacao_em
  ),
  ADD CONSTRAINT uq_agendamentos_idempotencia UNIQUE (
    criado_por,
    origem,
    idempotency_key_hash
  ),
  ADD CONSTRAINT chk_agendamentos_buffer CHECK (buffer_minutos >= 0),
  ADD CONSTRAINT chk_agendamentos_fim_ocupacao CHECK (
    fim_ocupacao_em >= fim_em
  ),
  ADD CONSTRAINT chk_agendamentos_hashes_idempotencia CHECK (
    (idempotency_key_hash IS NULL AND idempotency_payload_hash IS NULL)
    OR
    (idempotency_key_hash IS NOT NULL AND idempotency_payload_hash IS NOT NULL)
  ),
  ADD CONSTRAINT chk_agendamentos_fim_snapshot CHECK (
    fim_em = TIMESTAMPADD(MINUTE, duracao_minutos, inicio_em)
  ),
  ADD CONSTRAINT chk_agendamentos_ocupacao_snapshot CHECK (
    fim_ocupacao_em = TIMESTAMPADD(MINUTE, buffer_minutos, fim_em)
  );
