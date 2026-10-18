import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/authContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';

export const RegisterView: React.FC = () => {
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register } = useAuth();
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim() || !ownerName.trim() || !email.trim()) {
      toastError('Completá todos los campos requeridos');
      return;
    }
    setIsSubmitting(true);
    try {
      await register({ businessName, ownerName, email, password });
      success('¡Comercio registrado con éxito!', 'Tu cuenta y tu primer cartel ya están activos.');
      navigate('/panel');
    } catch (err) {
      toastError(
        'No pudimos registrar tu cuenta',
        err instanceof Error ? err.message : 'Probá de nuevo.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-[#f1f1ee] flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <Link to="/" className="inline-flex items-center gap-2.5 justify-center">
            <div className="w-10 h-10 rounded-full bg-[#f1f1ee] border border-[#242426] flex items-center justify-center">
              <img src="/assets/logo.svg" alt="" className="w-6 h-6 object-contain" />
            </div>
            <span className="font-bold text-xl text-[#f1f1ee] tracking-tight">toque™</span>
          </Link>
          <h1 className="font-bold text-2xl text-[#f1f1ee] tracking-tight pt-2">
            Creá la cuenta de tu negocio
          </h1>
          <p className="text-xs text-[#a1a1aa]">
            Sumá tu comercio a Toque para emitir recibos digitales en tiempo real y fidelizar clientes.
          </p>
        </div>

        <Card padding="lg" className="bg-[#111113] border border-[#242426]">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                className="block text-[11px] uppercase tracking-wider font-semibold text-[#a1a1aa] mb-1.5"
                htmlFor="bizName"
              >
                Nombre del comercio o local *
              </label>
              <input
                id="bizName"
                type="text"
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Ej. Café La Esquina"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#28282a] bg-[#18181b] text-sm text-[#f1f1ee] placeholder-[#a1a1aa]/60 focus:outline-none focus:border-[#bec8ff]"
              />
            </div>

            <div>
              <label
                className="block text-[11px] uppercase tracking-wider font-semibold text-[#a1a1aa] mb-1.5"
                htmlFor="owner"
              >
                Tu nombre y apellido *
              </label>
              <input
                id="owner"
                type="text"
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Ej. Martín Gómez"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#28282a] bg-[#18181b] text-sm text-[#f1f1ee] placeholder-[#a1a1aa]/60 focus:outline-none focus:border-[#bec8ff]"
              />
            </div>

            <div>
              <label
                className="block text-[11px] uppercase tracking-wider font-semibold text-[#a1a1aa] mb-1.5"
                htmlFor="email"
              >
                Correo electrónico *
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contacto@laesquina.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#28282a] bg-[#18181b] text-sm text-[#f1f1ee] placeholder-[#a1a1aa]/60 focus:outline-none focus:border-[#bec8ff]"
              />
            </div>

            <div>
              <label
                className="block text-[11px] uppercase tracking-wider font-semibold text-[#a1a1aa] mb-1.5"
                htmlFor="password"
              >
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#28282a] bg-[#18181b] text-sm text-[#f1f1ee] placeholder-[#a1a1aa]/60 focus:outline-none focus:border-[#bec8ff]"
              />
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                variant="ultramar"
                fullWidth
                size="touch"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Creando cuenta…' : 'Registrar mi negocio'}
              </Button>
            </div>
          </form>
        </Card>

        <p className="text-center text-xs text-[#a1a1aa]">
          ¿Ya tenés una cuenta registrada?{' '}
          <Link to="/login" className="font-semibold text-[#bec8ff] hover:underline">
            Iniciá sesión
          </Link>
        </p>
      </div>
    </div>
  );
};
