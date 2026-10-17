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
      success('¡Comercio registrado con éxito!', 'Tu cuenta pertenece a Toque.');
      navigate('/panel');
    } catch (err) {
      toastError('No pudimos registrar tu cuenta', err instanceof Error ? err.message : 'Probá de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F4EE] flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-[#3A3FE0] text-white flex items-center justify-center font-display font-bold text-2xl mx-auto shadow-xs">
            T
          </div>
          <h1 className="font-display font-bold text-2xl text-[#0B1030]">
            Creá la cuenta de tu negocio
          </h1>
          <p className="text-xs text-[#5E6072]">
            Sumá tu comercio a Toque para empezar a emitir recibos y captar reseñas.
          </p>
        </div>

        <Card padding="lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#0B1030] mb-1.5" htmlFor="bizName">
                Nombre del comercio o local *
              </label>
              <input
                id="bizName"
                type="text"
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Ej. Café La Esquina"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E3DDD2] bg-[#F7F4EE]/50 text-sm text-[#0B1030] focus:bg-white focus:outline-none focus:border-[#3A3FE0]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0B1030] mb-1.5" htmlFor="owner">
                Tu nombre y apellido *
              </label>
              <input
                id="owner"
                type="text"
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Ej. Martín Gómez"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E3DDD2] bg-[#F7F4EE]/50 text-sm text-[#0B1030] focus:bg-white focus:outline-none focus:border-[#3A3FE0]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0B1030] mb-1.5" htmlFor="email">
                Correo electrónico *
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contacto@laesquina.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E3DDD2] bg-[#F7F4EE]/50 text-sm text-[#0B1030] focus:bg-white focus:outline-none focus:border-[#3A3FE0]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0B1030] mb-1.5" htmlFor="password">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E3DDD2] bg-[#F7F4EE]/50 text-sm text-[#0B1030] focus:bg-white focus:outline-none focus:border-[#3A3FE0]"
              />
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                variant="estrella"
                fullWidth
                size="touch"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Creando cuenta…' : 'Registrar mi negocio'}
              </Button>
            </div>
          </form>
        </Card>

        <p className="text-center text-xs text-[#5E6072]">
          ¿Ya tenés una cuenta registrada?{' '}
          <Link to="/login" className="font-semibold text-[#3A3FE0] hover:underline">
            Iniciá sesión
          </Link>
        </p>
      </div>
    </div>
  );
};
