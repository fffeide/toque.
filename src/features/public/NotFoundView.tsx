/**
 * Toque — Página 404 (NotFoundView)
 * Idioma: Rioplatense, salida clara.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { BrandLogo } from '../../components/ui/Avatar';
import { ArrowLeft, Compass } from 'lucide-react';

export const NotFoundView: React.FC = () => {
  return (
    <div className="material-page-bg min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center p-8 space-y-5">
        <div className="flex justify-center mb-2">
          <BrandLogo />
        </div>

        <div className="w-14 h-14 rounded-2xl bg-[var(--ultramar)]/10 text-[var(--brand)] flex items-center justify-center mx-auto">
          <Compass className="w-7 h-7" />
        </div>

        <div>
          <h1 className="font-display text-title-2 font-bold text-[var(--text-main)]">
            Página no encontrada (404)
          </h1>
          <p className="text-small text-[var(--text-muted)] mt-2">
            La dirección que buscás no existe o fue movida a otra sección del panel.
          </p>
        </div>

        <div className="pt-2">
          <Link to="/resumen">
            <Button variant="primary" leftIcon={<ArrowLeft className="w-4 h-4" />} className="w-full">
              Volver al panel principal
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
};
