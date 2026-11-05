import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { TenantFeatureKey } from '../api/types';

interface FeaturesContextType {
  features: Record<string, boolean>;
  hasFeature: (name: TenantFeatureKey | string) => boolean;
  refreshFeatures: () => Promise<void>;
  loading: boolean;
}

const defaultFeatures: Record<string, boolean> = {
  menu: true,
  club: true,
  stats: true,
};

const FeaturesContext = createContext<FeaturesContextType>({
  features: defaultFeatures,
  hasFeature: (name) => defaultFeatures[name] ?? true,
  refreshFeatures: async () => {},
  loading: false,
});

export const FeaturesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [features, setFeatures] = useState<Record<string, boolean>>(defaultFeatures);
  const [loading, setLoading] = useState(true);

  const refreshFeatures = useCallback(async () => {
    try {
      const data = await api.getFeatures();
      if (data && typeof data === 'object') {
        setFeatures(data);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshFeatures();
  }, [refreshFeatures]);

  const hasFeature = useCallback(
    (name: TenantFeatureKey | string) => {
      if (features[name] !== undefined) {
        return Boolean(features[name]);
      }
      return true;
    },
    [features]
  );

  return (
    <FeaturesContext.Provider value={{ features, hasFeature, refreshFeatures, loading }}>
      {children}
    </FeaturesContext.Provider>
  );
};

export function useFeature(name: TenantFeatureKey | string): boolean {
  const context = useContext(FeaturesContext);
  return context.hasFeature(name);
}

export function useFeatures() {
  return useContext(FeaturesContext);
}

interface FeatureProps {
  name: TenantFeatureKey | string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const Feature: React.FC<FeatureProps> = ({ name, children, fallback = null }) => {
  const enabled = useFeature(name);
  if (!enabled) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
};
