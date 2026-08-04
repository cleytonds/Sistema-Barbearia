import { useEffect, useState } from 'react';
import { useToast } from '../../contexts/ToastContext.jsx';
import { operacionalService } from '../../services/operacionalService.js';
import {
  buildWhatsAppShareUrl,
  DEFAULT_BARBERSHOP_NAME,
  hasWhatsAppShareData,
} from '../../utils/whatsappShare.js';
import { Alert, Button } from '../ui/index.jsx';

export function WhatsAppShareButton({
  agendamento,
  nomeBarbearia,
  variant = 'secondary',
  className,
}) {
  const [publicName, setPublicName] = useState(nomeBarbearia);
  const [openError, setOpenError] = useState(false);
  const { notify } = useToast();

  useEffect(() => {
    if (nomeBarbearia) {
      setPublicName(nomeBarbearia);
      return undefined;
    }
    let active = true;
    operacionalService
      .publicConfig()
      .then((result) => {
        if (active && result.data?.nomeBarbearia) setPublicName(result.data.nomeBarbearia);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [nomeBarbearia]);

  const enabled = hasWhatsAppShareData(agendamento);
  const share = () => {
    setOpenError(false);
    const url = buildWhatsAppShareUrl(
      agendamento,
      publicName || nomeBarbearia || DEFAULT_BARBERSHOP_NAME,
    );
    if (!url) return;
    const openedWindow = window.open(url, '_blank', 'noopener,noreferrer');
    if (!openedWindow) {
      setOpenError(true);
      return;
    }
    try {
      openedWindow.opener = null;
    } catch {
      // Alguns navegadores já protegem opener e não permitem reatribuição.
    }
    notify('WhatsApp aberto com os dados do agendamento.');
  };

  return (
    <div className={`stack ${className ?? ''}`.trim()}>
      <Button type="button" variant={variant} disabled={!enabled} onClick={share}>
        <span aria-hidden="true">◉</span> Enviar pelo WhatsApp
      </Button>
      {openError && (
        <Alert type="error">
          Não foi possível abrir o WhatsApp. Verifique o bloqueio de janelas e tente novamente.
        </Alert>
      )}
    </div>
  );
}
