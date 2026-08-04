import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/operational/index.jsx';
import { Alert, Button, Input, Skeleton, Textarea } from '../../components/ui/index.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useRemoteData } from '../../hooks/useRemoteData.js';
import { operacionalService } from '../../services/operacionalService.js';
export default function BarberProfilePage() {
  useDocumentTitle('Meu perfil');
  const profile = useRemoteData(() => operacionalService.myProfile(), []),
    services = useRemoteData(() => operacionalService.myServices(), []);
  const [form, setForm] = useState({ descricao: '', especialidades: '', foto_url: '' }),
    [message, setMessage] = useState('');
  useEffect(() => {
    if (profile.data?.data)
      setForm({
        descricao: profile.data.data.descricao ?? '',
        especialidades: profile.data.data.especialidades ?? '',
        foto_url: profile.data.data.foto_url ?? '',
      });
  }, [profile.data]);
  async function save(e) {
    e.preventDefault();
    try {
      await operacionalService.updateMyProfile({ ...form, foto_url: form.foto_url || null });
      setMessage('Perfil atualizado.');
      profile.reload();
    } catch (error) {
      setMessage(error.response?.data?.error?.message ?? 'Não foi possível atualizar o perfil.');
    }
  }
  const item = profile.data?.data;
  return (
    <>
      <PageHeader title="Meu perfil" />
      {profile.loading ? (
        <Skeleton />
      ) : profile.error ? (
        <Alert type="error">{profile.error.message}</Alert>
      ) : (
        <>
          <section className="card">
            <h2>{item.nome}</h2>
            <p>{item.email}</p>
            <p>{item.telefone}</p>
            <p>
              Serviços:{' '}
              {(services.data?.data ?? []).map((s) => s.nome).join(', ') || 'Nenhum vínculo'}
            </p>
          </section>
          <form className="card form" onSubmit={save}>
            <Textarea
              label="Descrição"
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            />
            <Input
              label="Especialidades"
              value={form.especialidades}
              onChange={(e) => setForm({ ...form, especialidades: e.target.value })}
            />
            <Input
              label="URL da foto"
              type="url"
              value={form.foto_url}
              onChange={(e) => setForm({ ...form, foto_url: e.target.value })}
            />
            <Button type="submit">Salvar</Button>
            {message && <Alert>{message}</Alert>}
          </form>
        </>
      )}
    </>
  );
}
