import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api, Receipt } from '../../api';
import { Skeleton } from '../../components/ui/Skeleton';
import { DieCutTicket } from '../../components/ticket/DieCutTicket';
import { ArrowLeft, Lock } from 'lucide-react';

export const ReceiptDetailView: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [businessAddress, setBusinessAddress] = useState<string | undefined>(undefined);
  const [stampsCount, setStampsCount] = useState<number>(4);
  const [stampsTarget, setStampsTarget] = useState<number>(5);
  const [isLoading, setIsLoading] = useState(true);
  const [isLockedOrExpired, setIsLockedOrExpired] = useState(false);

  useEffect(() => {
    let active = true;

    const loadReceipt = async () => {
      setIsLoading(true);
      try {
        const data = await api.getReceiptById(id);
        if (!active) return;

        if (!data) {
          const cartel = await api.getCartelByCode(id).catch(() => null);
          if (active && cartel) {
            navigate(`/u/${cartel.code}`, { replace: true });
            return;
          }
          setReceipt(null);
          setIsLockedOrExpired(true);
          return;
        }

        const hub = await api.getPublicHub(data.cartelCode || 'BURGER01').catch(() => null);
        if (active && hub) {
          setBusinessAddress(hub.config?.details?.address);
          setStampsCount(hub.club?.member?.stamps ?? 4);
          setStampsTarget(hub.club?.config?.targetStamps ?? 5);
        }

        if (data.status === 'ready') {
          const claimed = await api.claimReceipt(data.id).catch(() => ({ receipt: data }));
          if (active) {
            setReceipt(claimed.receipt);
            setIsLockedOrExpired(false);
          }
        } else {
          if (active) {
            setReceipt(data);
            setIsLockedOrExpired(false);
          }
        }
      } catch {
        if (active) {
          setReceipt(null);
          setIsLockedOrExpired(true);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    loadReceipt();

    return () => {
      active = false;
    };
  }, [id, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-4">
          <Skeleton className="h-96 w-full rounded-3xl bg-[#141414]" />
        </div>
      </div>
    );
  }

  if (!receipt || isLockedOrExpired) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-[#F4F4F6] flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl bg-[#141414] border border-[#242424] p-7 text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-[#D95B26]/15 text-[#D95B26] flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold text-[#F4F4F6]">Comprobante no disponible</h1>
          <p className="text-xs text-[#9E9EA8] leading-relaxed">
            No encontramos este comprobante o ya fue cerrado.
          </p>
          <div className="pt-2">
            <Link
              to="/"
              className="w-full py-3 px-5 rounded-2xl bg-[#D95B26] text-white font-semibold text-xs flex items-center justify-center"
            >
              Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F4F4F6] py-8 px-4 flex flex-col items-center justify-center">
      <div className="max-w-md w-full space-y-4">
        <div className="flex items-center justify-between print:hidden">
          <Link
            to={`/u/${receipt.cartelCode}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#9E9EA8] hover:text-[#F4F4F6] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Volver al local
          </Link>
          <span className="text-[11px] font-mono text-[#9E9EA8]">#{receipt.id}</span>
        </div>

        <DieCutTicket
          receiptId={receipt.id}
          businessName={receipt.businessName}
          businessAddress={businessAddress}
          total={receipt.total}
          createdAt={receipt.createdAt}
          items={receipt.items}
          method={receipt.method}
          stamps={stampsCount}
          stampsRequired={stampsTarget}
          isDark={true}
        />
      </div>
    </div>
  );
};
