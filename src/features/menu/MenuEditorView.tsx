import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import { MenuCategory, MenuItem } from '../../api/types';
import { formatARS } from '../../lib/format';
import { useToast } from '../../components/ui/Toast';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Plus, ArrowUp, ArrowDown, Trash2, Edit2, UtensilsCrossed } from 'lucide-react';

export const MenuEditorView: React.FC = () => {
  const { showToast } = useToast();
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [showAddCat, setShowAddCat] = useState(false);
  const [catName, setCatName] = useState('');
  const [showAddItem, setShowAddItem] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemDesc, setItemDesc] = useState('');
  const [itemPrice, setItemPrice] = useState<number>(0);

  const loadMenu = async () => {
    try {
      const data = await api.listMenu();
      setCategories(data.categories || []);
      setItems(data.items || []);
      if (!selectedCatId && data.categories?.length > 0) {
        setSelectedCatId(data.categories[0].id);
      }
    } catch {
      // Silencioso
    }
  };

  useEffect(() => {
    loadMenu();
  }, []);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    try {
      const created = await api.createCategory({ name: catName.trim() });
      setCategories((prev) => [...prev, created]);
      setSelectedCatId(created.id);
      setCatName('');
      setShowAddCat(false);
      showToast('Categoría creada', 'success');
    } catch {
      showToast('No pudimos crear la categoría', 'error');
    }
  };

  const handleMoveCategory = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= categories.length) return;
    const newCats = [...categories];
    const temp = newCats[index];
    newCats[index] = newCats[targetIndex];
    newCats[targetIndex] = temp;
    // Actualizar órdenes
    newCats.forEach((c, i) => (c.sortOrder = i + 1));
    setCategories(newCats);
    try {
      await api.updateCategory(newCats[index].id, { sortOrder: index + 1 });
      await api.updateCategory(newCats[targetIndex].id, { sortOrder: targetIndex + 1 });
    } catch {
      // Revertir
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await api.deleteCategory(id);
      const filtered = categories.filter((c) => c.id !== id);
      setCategories(filtered);
      if (selectedCatId === id) {
        setSelectedCatId(filtered[0]?.id || '');
      }
      showToast('Categoría eliminada', 'info');
    } catch {
      showToast('No pudimos eliminar la categoría', 'error');
    }
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || !selectedCatId) return;
    try {
      if (editingItem) {
        const updated = await api.updateItem(editingItem.id, {
          name: itemName.trim(),
          description: itemDesc.trim(),
          price: itemPrice,
        });
        setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
        showToast('Plato modificado', 'success');
      } else {
        const created = await api.createItem({
          categoryId: selectedCatId,
          name: itemName.trim(),
          description: itemDesc.trim(),
          price: itemPrice,
          available: true,
        });
        setItems((prev) => [...prev, created]);
        showToast('Plato agregado a la carta', 'success');
      }
      setShowAddItem(false);
      setEditingItem(null);
      setItemName('');
      setItemDesc('');
      setItemPrice(0);
    } catch {
      showToast('No pudimos guardar el plato', 'error');
    }
  };

  const handleToggleAvailable = async (item: MenuItem) => {
    try {
      const nextAvailable = !item.available;
      const updated = await api.updateItem(item.id, { available: nextAvailable });
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
      showToast(nextAvailable ? 'Plato marcado como disponible' : 'Plato marcado como agotado', 'info');
    } catch {
      showToast('No pudimos actualizar la disponibilidad', 'error');
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      await api.deleteItem(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      showToast('Plato eliminado', 'info');
    } catch {
      showToast('No pudimos eliminar el plato', 'error');
    }
  };

  const currentCategory = categories.find((c) => c.id === selectedCatId) || categories[0];
  const currentItems = items.filter((i) => i.categoryId === currentCategory?.id);

  return (
    <div className="space-y-4 max-w-xl mx-auto">
      {/* Solapas de Categorías con botón agregar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {categories.map((cat, idx) => (
          <div key={cat.id} className="flex items-center shrink-0">
            <button
              onClick={() => setSelectedCatId(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                currentCategory?.id === cat.id
                  ? 'bg-amber-400 text-black font-semibold'
                  : 'bg-[#141418] border border-[#282830] text-[#9E9EA8] hover:text-[#F4F4F6]'
              }`}
            >
              {cat.name}
            </button>
          </div>
        ))}
        <button
          onClick={() => setShowAddCat(true)}
          className="px-2.5 py-1.5 rounded-xl text-xs font-medium border border-dashed border-[#383844] text-[#9E9EA8] hover:text-[#F4F4F6] shrink-0 flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Categoría</span>
        </button>
      </div>

      {/* Controles de la categoría activa */}
      {currentCategory && (
        <div className="flex items-center justify-between bg-[#141418] border border-[#282830] p-3 rounded-2xl">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#F4F4F6]">{currentCategory.name}</span>
            <div className="flex items-center gap-1 text-[#9E9EA8]">
              <button
                onClick={() => handleMoveCategory(categories.findIndex((c) => c.id === currentCategory.id), 'up')}
                className="p-1 hover:text-[#F4F4F6] rounded"
                title="Subir categoría"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleMoveCategory(categories.findIndex((c) => c.id === currentCategory.id), 'down')}
                className="p-1 hover:text-[#F4F4F6] rounded"
                title="Bajar categoría"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => {
                setEditingItem(null);
                setItemName('');
                setItemDesc('');
                setItemPrice(0);
                setShowAddItem(true);
              }}
              className="text-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Agregar plato
            </Button>
            <button
              onClick={() => handleDeleteCategory(currentCategory.id)}
              className="text-xs text-[#9E9EA8] hover:text-rose-400 p-1.5"
              title="Borrar categoría"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Lista de Platos */}
      {currentItems.length === 0 ? (
        <div className="bg-[#141418] border border-[#282830] rounded-2xl p-8 text-center space-y-2">
          <UtensilsCrossed className="w-8 h-8 text-[#9E9EA8] mx-auto opacity-40" />
          <p className="text-xs text-[#9E9EA8]">No hay platos cargados en esta categoría.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {currentItems.map((item) => (
            <div
              key={item.id}
              className={`p-3.5 rounded-2xl border transition-colors flex items-center justify-between gap-3 ${
                item.available ? 'bg-[#141418] border-[#282830]' : 'bg-[#121215] border-[#222228] opacity-60'
              }`}
            >
              <div className="space-y-0.5 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold truncate ${item.available ? 'text-[#F4F4F6]' : 'text-[#888894] line-through'}`}>
                    {item.name}
                  </span>
                  {!item.available && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                      Agotado
                    </span>
                  )}
                </div>
                {item.description && (
                  <p className="text-xs text-[#9E9EA8] line-clamp-1">{item.description}</p>
                )}
                <div className="text-xs font-medium text-emerald-400">{formatARS(item.price)}</div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleToggleAvailable(item)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-medium transition-colors ${
                    item.available
                      ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {item.available ? 'Disponible' : 'Agotado'}
                </button>
                <button
                  onClick={() => {
                    setEditingItem(item);
                    setItemName(item.name);
                    setItemDesc(item.description || '');
                    setItemPrice(item.price);
                    setShowAddItem(true);
                  }}
                  className="p-1.5 text-[#9E9EA8] hover:text-[#F4F4F6] rounded"
                  title="Editar plato"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDeleteItem(item.id)}
                  className="p-1.5 text-[#9E9EA8] hover:text-rose-400 rounded"
                  title="Eliminar plato"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Agregar Categoría */}
      <Modal isOpen={showAddCat} onClose={() => setShowAddCat(false)} title="Nueva categoría">
        <form onSubmit={handleAddCategory} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#9E9EA8] mb-1.5">Nombre de la categoría</label>
            <input
              type="text"
              required
              placeholder="Ej. Cafetería, Pastelería, Almuerzos"
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181D] border border-[#282830] text-sm text-[#F4F4F6]"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddCat(false)}>Cancelar</Button>
            <Button type="submit" size="sm">Crear categoría</Button>
          </div>
        </form>
      </Modal>

      {/* Modal Agregar/Editar Plato */}
      <Modal isOpen={showAddItem} onClose={() => setShowAddItem(false)} title={editingItem ? 'Editar plato' : 'Nuevo plato'}>
        <form onSubmit={handleSaveItem} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#9E9EA8] mb-1.5">Nombre del plato</label>
            <input
              type="text"
              required
              placeholder="Ej. Tostón con palta y huevo"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181D] border border-[#282830] text-sm text-[#F4F4F6]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#9E9EA8] mb-1.5">Descripción corta (opcional)</label>
            <textarea
              rows={2}
              placeholder="Ej. Pan de masa madre, semillas tostadas y oliva"
              value={itemDesc}
              onChange={(e) => setItemDesc(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-[#18181D] border border-[#282830] text-sm text-[#F4F4F6] resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#9E9EA8] mb-1.5">Precio ($ ARS)</label>
            <input
              type="number"
              min="0"
              step="50"
              required
              value={itemPrice || ''}
              onChange={(e) => setItemPrice(parseInt(e.target.value, 10) || 0)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181D] border border-[#282830] text-sm text-[#F4F4F6]"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddItem(false)}>Cancelar</Button>
            <Button type="submit" size="sm">Guardar plato</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
