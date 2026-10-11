/**
 * Toque — Enlace Vencido o No Disponible (ExpiredLinkView)
 * Pantalla informativa cuando un visitante escanea un cartel descontinuado o reemplazado.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { BrandLogo } from '../../components/ui/Avatar';
import { AlertTriangle, Home } from 'lucide-react';

export const ExpiredLinkView: React.FC = () => {
  return (
    <div className="material-page-bg min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center p-8 space-y-5">
        <div className="flex justify-center mb-2">
          <BrandLogo />
        </div>

        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-[var(--ambar)] flex items-center justify-center mx-auto">
          <AlertTriangle className="w-7 h-7" />
        </div>

        <div>
          <h1 className="font-display text-title-2 font-bold text-[var(--text-main)]">
            Enlace no disponible
          </h1>
          <p className="text-small text-[var(--text-muted)] mt-2">
            Este cartel fue reemplazado o dado de baja por el negocio. Si sos el dueño, podés revisar su estado desde tu panel.
          </p>
        </div>

        <div className="pt-2">
          <Link to="/resumen">
            <Button variant="secondary" leftIcon={<Home className="w-4 h-4" />} className="w-full">
              Ir al inicio de Toque
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
};
