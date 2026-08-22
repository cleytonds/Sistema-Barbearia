import { useCallback, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Container } from '../components/layout/index.jsx';
import { Alert, Card, EmptyState, Skeleton } from '../components/ui/index.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useRemoteData } from '../hooks/useRemoteData.js';
import { barbeiroService } from '../services/barbeiroService.js';
import { operacionalService } from '../services/operacionalService.js';
import { servicoService } from '../services/servicoService.js';
import { formatMoney } from '../utils/dateTime.js';
import { ADMIN_PHONE_DISPLAY } from '../config/adminContact.js';

export default function HomePage() {
  const location = useLocation();
  useDocumentTitle('Início');
  const loader = useCallback(async () => {
    const [configuration, services, barbers, hours] = await Promise.all([
      operacionalService.publicConfig(),
      servicoService.listPublic({ limit: 100 }),
      barbeiroService.listPublic({ limit: 100 }),
      operacionalService.publicHours(),
    ]);
    return {
      configuration: configuration.data,
      services: services.data,
      barbers: barbers.data,
      hours: hours.data,
    };
  }, []);
  const { data, loading, error, reload } = useRemoteData(loader, [loader]);
  useEffect(() => {
    if (!location.hash) return;
    document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }, [location.hash]);
  return (
    <>
      <section className="section">
        <Container>
          <p className="eyebrow">Elite Barbearia 081</p>
          <h1>Seu estilo, no seu horário.</h1>
          <p className="muted">Escolha o serviço, o profissional e o melhor horário para você.</p>
          <div className="cluster">
            <Link className="button button--primary" to="/agendar">
              Agendar horário
            </Link>
            <a className="button button--secondary" href="#servicos">
              Conhecer serviços
            </a>
          </div>
        </Container>
      </section>
      {error && (
        <Container>
          <Alert type="error">
            Não foi possível carregar as informações.{' '}
            <button onClick={reload}>Tentar novamente</button>
          </Alert>
        </Container>
      )}
      <section className="section section--muted" id="servicos">
        <Container>
          <h2>Serviços</h2>
          {loading ? (
            <div className="grid">
              <Skeleton />
              <Skeleton />
              <Skeleton />
            </div>
          ) : data?.services.length ? (
            <div className="grid">
              {data.services.map((service) => (
                <Card key={service.id}>
                  <h3>{service.nome}</h3>
                  {service.descricao && <p>{service.descricao}</p>}
                  <p>
                    {formatMoney(service.preco)} · {service.duracao_minutos} min
                  </p>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState title="Serviços indisponíveis">
              <p>Consulte novamente mais tarde.</p>
            </EmptyState>
          )}
        </Container>
      </section>
      <section className="section" id="profissionais">
        <Container>
          <h2>Profissionais</h2>
          {loading ? (
            <div className="grid">
              <Skeleton />
              <Skeleton />
            </div>
          ) : data?.barbers.length ? (
            <div className="grid">
              {data.barbers.map((barber) => (
                <Card key={barber.id}>
                  <div className="avatar" aria-hidden="true">
                    {barber.nome?.slice(0, 1)}
                  </div>
                  <h3>{barber.nome}</h3>
                  {barber.especialidades && <p>{barber.especialidades}</p>}
                  {barber.descricao && <p className="muted">{barber.descricao}</p>}
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState title="Profissionais indisponíveis">
              <p>Consulte novamente mais tarde.</p>
            </EmptyState>
          )}
        </Container>
      </section>
      <section className="section section--muted">
        <Container>
          <h2>Como funciona</h2>
          <ol className="grid">
            <Card as="li">Escolha o serviço.</Card>
            <Card as="li">Escolha o profissional.</Card>
            <Card as="li">Escolha data e horário.</Card>
            <Card as="li">Confirme seu agendamento.</Card>
          </ol>
        </Container>
      </section>
      <section className="section">
        <Container>
          <h2>Informações</h2>
          <p>{ADMIN_PHONE_DISPLAY}</p>
          {data?.configuration?.endereco && <p>{data.configuration.endereco}</p>}
          {data?.hours?.length > 0 && (
            <p>Os horários de funcionamento são exibidos conforme a configuração atual.</p>
          )}
          <a
            href="https://www.instagram.com/barbeariaelite081/"
            target="_blank"
            rel="noopener noreferrer"
          >
            @barbeariaelite081
          </a>
          <p>
            <Link className="button button--primary" to="/agendar">
              Agendar agora
            </Link>
          </p>
        </Container>
      </section>
    </>
  );
}
