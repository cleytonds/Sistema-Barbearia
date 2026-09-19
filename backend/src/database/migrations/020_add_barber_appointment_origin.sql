ALTER TABLE agendamentos
  DROP CHECK chk_agendamentos_origem,
  ADD CONSTRAINT chk_agendamentos_origem CHECK (origem IN ('cliente', 'admin', 'barbeiro', 'sistema'));
