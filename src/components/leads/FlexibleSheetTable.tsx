import React, { useMemo, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { FlexibleColumn } from '@/types/leads';

export interface FlexibleSheetRow {
  id: string;
  ownerName?: string;
  values: Record<string, string>;
  raw?: unknown;
}

interface FlexibleSheetTableProps {
  title: string;
  columns: FlexibleColumn[];
  rows: FlexibleSheetRow[];
  showOwner?: boolean;
  ownerLabel?: string;
  emptyText?: string;
  savingId?: string;
  onColumnsChange: (columns: FlexibleColumn[]) => void;
  onSaveRow: (rowId: string, values: Record<string, string>, raw?: unknown) => void;
  onAddRow: () => void;
  onDeleteRow?: (rowId: string) => void;
}

const makeColumnId = (label: string) =>
  label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || `custom_${Date.now()}`;

export function FlexibleSheetTable({
  title,
  columns,
  rows,
  showOwner,
  ownerLabel = 'User',
  emptyText = 'No rows found.',
  savingId,
  onColumnsChange,
  onSaveRow,
  onAddRow,
  onDeleteRow,
}: FlexibleSheetTableProps) {
  const [draftRows, setDraftRows] = useState<Record<string, Record<string, string>>>({});
  const [newColumnName, setNewColumnName] = useState('');

  const visibleColumns = useMemo(() => columns.filter((column) => column.label.trim()), [columns]);

  const getValue = (row: FlexibleSheetRow, columnId: string) => draftRows[row.id]?.[columnId] ?? row.values[columnId] ?? '';

  const setValue = (rowId: string, columnId: string, value: string) => {
    setDraftRows((current) => ({
      ...current,
      [rowId]: {
        ...(current[rowId] || rows.find((row) => row.id === rowId)?.values || {}),
        [columnId]: value,
      },
    }));
  };

  const saveRow = (row: FlexibleSheetRow) => {
    const values = { ...row.values, ...(draftRows[row.id] || {}) };
    onSaveRow(row.id, values, row.raw);
    setDraftRows((current) => {
      const next = { ...current };
      delete next[row.id];
      return next;
    });
  };

  const addColumn = () => {
    const label = newColumnName.trim();
    if (!label) return;
    const baseId = makeColumnId(label);
    let id = baseId;
    let index = 2;
    while (columns.some((column) => column.id === id)) {
      id = `${baseId}_${index}`;
      index += 1;
    }
    onColumnsChange([...columns, { id, label, type: 'text' }]);
    setNewColumnName('');
  };

  const renameColumn = (columnId: string, label: string) => {
    onColumnsChange(columns.map((column) => (column.id === columnId ? { ...column, label } : column)));
  };

  const deleteColumn = (columnId: string) => {
    onColumnsChange(columns.filter((column) => column.id !== columnId));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">Cells accept multiple values with comma, semicolon, pipe, or new line.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={newColumnName}
            onChange={(event) => setNewColumnName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addColumn();
              }
            }}
            placeholder="New column name"
            className="sm:w-56"
          />
          <Button type="button" variant="outline" onClick={addColumn}>
            <Plus className="mr-2 h-4 w-4" />
            Add Column
          </Button>
          <Button type="button" onClick={onAddRow}>
            <Plus className="mr-2 h-4 w-4" />
            Add Row
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[1100px] border-collapse text-sm">
          <thead className="bg-muted/60">
            <tr>
              {showOwner ? <th className="sticky left-0 z-10 w-44 border-r bg-muted/90 px-3 py-2 text-left font-medium">{ownerLabel}</th> : null}
              {visibleColumns.map((column) => (
                <th key={column.id} className="min-w-44 border-r px-2 py-2 text-left align-top font-medium">
                  <div className="flex items-center gap-2">
                    <Input
                      value={column.label}
                      onChange={(event) => renameColumn(column.id, event.target.value)}
                      className="h-8 border-transparent bg-transparent px-1 font-medium shadow-none"
                    />
                    {!column.systemField ? (
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => deleteColumn(column.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                </th>
              ))}
              <th className="w-28 px-3 py-2 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length + (showOwner ? 2 : 1)} className="py-12 text-center text-muted-foreground">
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const dirty = Boolean(draftRows[row.id]);
                return (
                  <tr key={row.id} className="border-t hover:bg-muted/30">
                    {showOwner ? (
                      <td className="sticky left-0 z-10 border-r bg-background px-3 py-2">
                        <Badge variant="outline" className="max-w-40 truncate">
                          {row.ownerName || 'Unknown'}
                        </Badge>
                      </td>
                    ) : null}
                    {visibleColumns.map((column) => (
                      <td key={column.id} className="border-r p-1 align-top">
                        <textarea
                          value={getValue(row, column.id)}
                          onChange={(event) => setValue(row.id, column.id, event.target.value)}
                          className="min-h-16 w-full resize-y rounded-md border border-transparent bg-transparent px-2 py-2 outline-none focus:border-ring focus:bg-background"
                          placeholder="-"
                        />
                      </td>
                    ))}
                    <td className="p-2 align-top">
                      <div className="flex gap-1">
                        <Button type="button" size="icon" variant={dirty ? 'default' : 'ghost'} disabled={savingId === row.id} onClick={() => saveRow(row)}>
                          <Save className="h-4 w-4" />
                        </Button>
                        {onDeleteRow ? (
                          <Button type="button" size="icon" variant="ghost" className="text-rose-600" onClick={() => onDeleteRow(row.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
