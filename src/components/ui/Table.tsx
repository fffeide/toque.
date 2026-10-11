/**
 * Toque — Tabla Responsive Liquid Glass (Table)
 * Accesible, navegación con teclado, contenedor con scroll horizontal si es necesario.
 */

import React, { TableHTMLAttributes, ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

export interface TableProps<T> extends TableHTMLAttributes<HTMLTableElement> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  emptyMessage?: string;
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = 'No hay elementos para mostrar.',
  className = '',
}: TableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-white/60 border border-white/15 rounded-2xl bg-white/5 backdrop-blur-md">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={`overflow-x-auto rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md shadow-lg ${className}`}>
      <table className="w-full text-left text-sm border-collapse text-white">
        <thead className="bg-white/10 border-b border-white/15 text-white/90">
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                scope="col"
                className={`p-3.5 font-semibold text-white ${
                  col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                } ${col.className || ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {data.map(item => (
            <tr
              key={keyExtractor(item)}
              tabIndex={0}
              className="hover:bg-white/10 focus:bg-white/10 transition-colors focus:outline-none"
            >
              {columns.map(col => (
                <td
                  key={col.key}
                  className={`p-3.5 ${
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                  } ${col.className || ''}`}
                >
                  {col.render ? col.render(item) : (item as Record<string, unknown>)[col.key] as ReactNode}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
