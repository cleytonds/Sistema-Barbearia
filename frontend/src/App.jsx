import { Link, Route, Routes } from 'react-router-dom';

function Home() {
  return (
    <main className="hero">
      <p className="eyebrow">Estilo, cuidado e pontualidade</p>
      <h1>Seu próximo corte começa aqui.</h1>
      <p className="lead">A base do sistema está pronta. Em breve, serviços, profissionais e horários estarão disponíveis.</p>
      <Link className="button" to="/status">Ver status do projeto</Link>
    </main>
  );
}

export function App() {
  return (
    <div className="app-shell">
      <header className="header"><Link to="/" className="brand">BARBEARIA<span>.</span></Link></header>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/status" element={<main className="hero"><p className="eyebrow">Fase 1</p><h1>Estrutura inicial concluída.</h1><Link className="text-link" to="/">Voltar ao início</Link></main>} />
        <Route path="*" element={<main className="hero"><h1>Página não encontrada.</h1><Link className="text-link" to="/">Voltar ao início</Link></main>} />
      </Routes>
      <footer>© {new Date().getFullYear()} Barbearia</footer>
    </div>
  );
}

