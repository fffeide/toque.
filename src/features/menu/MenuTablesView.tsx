import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import { RestaurantTable } from '../../api/types';
import { useAuth } from '../../lib/authContext';
import { useToast } from '../../components/ui/Toast';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { RealQrCode } from '../../components/ui/RealQrCode';
import { Plus, Printer, QrCode, Trash2, CheckCircle, ExternalLink } from 'lucide-react';

export const MenuTablesView: React.FC = () => {
  const { business } = useAuth();
  const { showToast } = useToast();
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const [showAddSingle, setShowAddSingle] = useState(false);
  const [showAddBatch, setShowAddBatch] = useState(false);
  const [singleName, setSingleName] = useState('');
  const [batchFrom, setBatchFrom] = useState(1);
  const [batchTo, setBatchTo] = useState(10);
  const [isPrinting, setIsPrinting] = useState(false);

  const loadTables = async () => {
    try {
      const data = await api.listTables();
      setTables(data);
    } catch {
      // Manejo silencioso
    }
  };

  useEffect(() => {
    loadTables();
  }, []);

  const handleAddSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleName.trim()) return;
    try {
      const created = await api.createTables({ labels: [singleName.trim()] });
      setTables((prev) => [...prev, ...created]);
      setSingleName('');
      setShowAddSingle(false);
      showToast('Mesa agregada correctamente', 'success');
    } catch {
      showToast('No pudimos crear la mesa', 'error');
    }
  };

  const handleAddBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const from = Math.min(batchFrom, batchTo);
    const to = Math.max(batchFrom, batchTo);
    if (to - from > 50) {
      showToast('Máximo 50 mesas por tanda', 'error');
      return;
    }
    const labels: string[] = [];
    for (let i = from; i <= to; i++) {
      labels.push(`Mesa ${i}`);
    }
    try {
      const created = await api.createTables({ labels });
      setTables((prev) => [...prev, ...created]);
      setShowAddBatch(false);
      showToast(`${created.length} mesas agregadas`, 'success');
    } catch {
      showToast('No pudimos crear las mesas', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteTable(id);
      setTables((prev) => prev.filter((t) => t.id !== id));
      if (selectedTable?.id === id) setSelectedTable(null);
      showToast('Mesa eliminada', 'info');
    } catch {
      showToast('No pudimos eliminar la mesa', 'error');
    }
  };

  return (
    <div className="space-y-4 max-w-xl mx-auto">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[#F4F4F6]">
          Mesas ({tables.length})
        </h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowAddBatch(true)} className="text-xs">
            Agregar varias
          </Button>
          <Button size="sm" onClick={() => setShowAddSingle(true)} className="text-xs">
            <Plus className="w-3.5 h-3.5 mr-1" />
            Agregar mesa
          </Button>
        </div>
      </div>

      {/* Cuadrícula de Mesas */}
      {tables.length === 0 ? (
        <div className="bg-[#141418] border border-[#282830] rounded-2xl p-8 text-center space-y-3">
          <QrCode className="w-8 h-8 text-[#9E9EA8] mx-auto opacity-50" />
          <p className="text-xs text-[#9E9EA8]">Todavía no creaste ninguna mesa.</p>
          <Button size="sm" onClick={() => setShowAddBatch(true)}>Crear del 1 al 10</Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {tables.map((tbl) => {
            const tableUrl = `${window.location.origin}/m/${tbl.code}`;
            return (
              <div
                key={tbl.id}
                onClick={() => setSelectedTable(tbl)}
                className="bg-[#141418] border border-[#282830] hover:border-[#3A3A46] rounded-2xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-colors group relative"
              >
                <div className="p-2 rounded-xl bg-white mb-2 shadow-sm">
                  <RealQrCode value={tableUrl} size={64} margin={0} />
                </div>
                <span className="text-sm font-semibold text-[#F4F4F6] group-hover:text-white">
                  {tbl.label}
                </span>
                <span className="text-[11px] font-mono text-[#9E9EA8] mt-0.5">{tbl.code}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal QR Detalle e Impresión */}
      <Modal isOpen={Boolean(selectedTable)} onClose={() => setSelectedTable(null)} title={selectedTable?.label || 'Mesa'}>
        {selectedTable && (
          <div className="space-y-5 text-center">
            {/* Tarjeta imprimible limpia */}
            <div id="printable-card" className="bg-white text-black p-6 rounded-2xl border border-zinc-200 max-w-xs mx-auto shadow-sm space-y-3">
              <div className="text-xs font-semibold text-zinc-600">{business?.name || 'Local'}</div>
              <div className="text-2xl font-black text-zinc-900 tracking-tight">{selectedTable.label}</div>
              <div className="flex justify-center py-2">
                <RealQrCode value={`${window.location.origin}/m/${selectedTable.code}`} size={160} margin={1} />
              </div>
              <p className="text-xs font-medium text-zinc-800 leading-snug">
                Escaneá para ver la carta y pedir
              </p>
              <div className="text-[10px] font-mono text-zinc-500 pt-1">{selectedTable.code}</div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  window.print();
                }}
                className="text-xs flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir QR</span>
              </Button>
              <a
                href={`/m/${selectedTable.code}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#282830] text-xs font-medium text-[#F4F4F6] hover:bg-[#1A1A22] transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Probar carta</span>
              </a>
              <button
                onClick={() => handleDelete(selectedTable.id)}
                className="text-xs text-rose-400 hover:text-rose-300 p-2"
                title="Eliminar mesa"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Agregar Mesa Individual */}
      <Modal isOpen={showAddSingle} onClose={() => setShowAddSingle(false)} title="Agregar mesa">
        <form onSubmit={handleAddSingle} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#9E9EA8] mb-1.5">Nombre o número de mesa</label>
            <input
              type="text"
              required
              placeholder="Ej. Mesa 1, Barra 2, Terraza A"
              value={singleName}
              onChange={(e) => setSingleName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181D] border border-[#282830] text-sm text-[#F4F4F6] focus:outline-none focus:border-amber-400"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddSingle(false)}>Cancelar</Button>
            <Button type="submit" size="sm">Guardar mesa</Button>
          </div>
        </form>
      </Modal>

      {/* Modal Agregar Varias Mesas */}
      <Modal isOpen={showAddBatch} onClose={() => setShowAddBatch(false)} title="Agregar varias mesas">
        <form onSubmit={handleAddBatch} className="space-y-4">
          <p className="text-xs text-[#9E9EA8]">Crea una serie correlativa de mesas con sus códigos QR de una sola vez.</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#9E9EA8] mb-1.5">Desde</label>
              <input
                type="number"
                min="1"
                max="99"
                value={batchFrom}
                onChange={(e) => setBatchFrom(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3 py-2 rounded-xl bg-[#18181D] border border-[#282830] text-sm text-[#F4F4F6]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#9E9EA8] mb-1.5">Hasta</label>
              <input
                type="number"
                min="1"
                max="99"
                value={batchTo}
                onChange={(e) => setBatchTo(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3 py-2 rounded-xl bg-[#18181D] border border-[#282830] text-sm text-[#F4F4F6]"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddBatch(false)}>Cancelar</Button>
            <Button type="submit" size="sm">Crear mesas</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
