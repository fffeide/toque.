import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { PublicHubView } from '../hub/PublicHubView';

/**
 * Vista pública de Fidelización (/club y /club/:codigoLocal).
 * Reutiliza la experiencia unificada de Tarjeta de Sellos Digital + Smart Hub de Musical Monroe.
 */
export const ClientClubOnboardingView: React.FC = () => {
  const { codigoLocal } = useParams<{ codigoLocal?: string }>();
  if (!codigoLocal) {
    return <Navigate to="/u/musical-monroe" replace />;
  }
  return <PublicHubView />;
};
