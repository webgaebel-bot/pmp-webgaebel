import React, { useMemo, useState } from 'react';
import { AlertTriangle, Maximize2, Minimize2, Plus, Save, Trash2 } from 'lucide-react';
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
  onSaveRow?: (rowId: string, values: Record<string, string>, raw?: unknown) => void | Promise<void>;
  onAddRow?: () => void;
  onDeleteRow?: (rowId: string) => void;
  rowWarnings?: Record<string, string>;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canManageColumns?: boolean;
  autoSave?: boolean;
  autoSaveDelay?: number;
  initialRenderRows?: number;
  renderBatchSize?: number;
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
  rowWarnings = {},
  isFullscreen = false,
  onToggleFullscreen,
  canAdd = true,
  canEdit = true,
  canDelete = Boolean(onDeleteRow),
  canManageColumns = true,
  autoSave = false,
  autoSaveDelay = 900,
  initialRenderRows = 120,
  renderBatchSize = 120,
}: FlexibleSheetTableProps) {
  const [draftRows, setDraftRows] = useState<Record<string, Record<string, string>>>({});
  const [newColumnName, setNewColumnName] = useState('');
  const [visibleRowLimit, setVisibleRowLimit] = useState(initialRenderRows);
  const autoSaveTimers = React.useRef<Record<string, number>>({});
  const savingRows = React.useRef<Record<string, boolean>>({});
  const queuedSaveValues = React.useRef<Record<string, Record<string, string>>>({});

  const visibleColumns = useMemo(() => columns.filter((column) => column.label.trim()), [columns]);
  const renderedRows = rows.slice(0, visibleRowLimit);

  React.useEffect(() => {
    setVisibleRowLimit(initialRenderRows);
  }, [initialRenderRows, rows.length]);

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    const nearBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 240;
    if (nearBottom && visibleRowLimit < rows.length) {
      setVisibleRowLimit((current) => Math.min(current + renderBatchSize, rows.length));
    }
  };

  const getValue = (row: FlexibleSheetRow, columnId: string) => draftRows[row.id]?.[columnId] ?? row.values[columnId] ?? '';

  const hasAnyValue = (values: Record<string, string>) =>
    Object.values(values).some((value) => String(value || '').trim());

  const saveValues = async (row: FlexibleSheetRow, values: Record<string, string>) => {
    if (!onSaveRow || !hasAnyValue(values)) return;
    if (savingRows.current[row.id]) {
      queuedSaveValues.current[row.id] = values;
      return;
    }

    savingRows.current[row.id] = true;
    try {
      await onSaveRow(row.id, values, row.raw);
    } finally {
      savingRows.current[row.id] = false;
      const queuedValues = queuedSaveValues.current[row.id];
      delete queuedSaveValues.current[row.id];
      if (queuedValues) {
        void saveValues(row, queuedValues);
      }
    }
  };

  const queueAutoSave = (rowId: string, values: Record<string, string>) => {
    if (!autoSave || !canEdit || !onSaveRow || !hasAnyValue(values)) return;
    window.clearTimeout(autoSaveTimers.current[rowId]);
    autoSaveTimers.current[rowId] = window.setTimeout(() => {
      const row = rows.find((item) => item.id === rowId);
      if (!row) return;
      void saveValues(row, values);
    }, autoSaveDelay);
  };

  React.useEffect(() => {
    return () => {
      Object.values(autoSaveTimers.current).forEach((timerId) => window.clearTimeout(timerId));
    };
  }, []);

  const setValue = (rowId: string, columnId: string, value: string) => {
    const baseValues = rows.find((row) => row.id === rowId)?.values || {};
    const nextValues = {
      ...(draftRows[rowId] || baseValues),
      [columnId]: value,
    };

    setDraftRows((current) => ({
      ...current,
      [rowId]: nextValues,
    }));

    queueAutoSave(rowId, nextValues);
  };

  const saveRow = (row: FlexibleSheetRow) => {
    if (!onSaveRow) return;
    const values = { ...row.values, ...(draftRows[row.id] || {}) };
    void saveValues(row, values);
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
        {(canManageColumns || canAdd) ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            {onToggleFullscreen ? (
              <Button type="button" variant="outline" onClick={onToggleFullscreen}>
                {isFullscreen ? <Minimize2 className="mr-2 h-4 w-4" /> : <Maximize2 className="mr-2 h-4 w-4" />}
                {isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
              </Button>
            ) : null}
            {canManageColumns ? (
              <>
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
              </>
            ) : null}
            {canAdd && onAddRow ? (
              <Button type="button" onClick={onAddRow}>
                <Plus className="mr-2 h-4 w-4" />
                Add Row
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className={isFullscreen ? 'max-h-[calc(100vh-14rem)] overflow-auto rounded-lg border' : 'max-h-[70vh] overflow-auto rounded-lg border'} onScroll={handleScroll}>
        <table className="w-full min-w-[1600px] border-collapse text-sm">
          <thead className="bg-muted/60">
            <tr>
              <th className="sticky left-0 z-20 w-14 border-r bg-muted/90 px-3 py-2 text-center font-medium">#</th>
              {showOwner ? <th className="sticky left-14 z-10 w-44 border-r bg-muted/90 px-3 py-2 text-left font-medium">{ownerLabel}</th> : null}
              {visibleColumns.map((column) => (
                <th key={column.id} className="min-w-[240px] border-r px-2 py-2 text-left align-top font-medium">
                  <div className="flex items-center gap-2">
                    {canManageColumns ? (
                      <Input
                        value={column.label}
                        onChange={(event) => renameColumn(column.id, event.target.value)}
                        className="h-8 border-transparent bg-transparent px-1 font-medium shadow-none"
                      />
                    ) : (
                      <span className="px-1">{column.label}</span>
                    )}
                    {canManageColumns && !column.systemField ? (
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
                <td colSpan={visibleColumns.length + (showOwner ? 3 : 2)} className="py-12 text-center text-muted-foreground">
                  {emptyText}
                </td>
              </tr>
            ) : (
              renderedRows.map((row, rowIndex) => {
                const dirty = Boolean(draftRows[row.id]);
                const warningMessage = rowWarnings[row.id];
                return (
                  <tr key={row.id} className="border-t hover:bg-muted/30">
                    <td className="sticky left-0 z-20 border-r bg-background px-3 py-2 text-center text-xs text-muted-foreground">
                      <div className="flex flex-col items-center gap-1">
                        <span>{rowIndex + 1}</span>
                        {warningMessage ? (
                          <Badge
                            variant="outline"
                            title={warningMessage}
                            className="border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700"
                          >
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            Duplicate
                          </Badge>
                        ) : null}
                      </div>
                    </td>
                    {showOwner ? (
                      <td className="sticky left-14 z-10 border-r bg-background px-3 py-2">
                        {row.ownerName ? (
                          <Badge variant="outline" className="max-w-40 truncate">
                            {row.ownerName}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                    ) : null}
                    {visibleColumns.map((column) => (
                      <td key={column.id} className="border-r p-1 align-top">
                        {column.options ? (
                          <select
                            value={getValue(row, column.id)}
                            onChange={(event) => setValue(row.id, column.id, event.target.value)}
                            className="min-h-16 w-full rounded-md border border-transparent bg-background px-2 py-2 outline-none focus:border-ring"
                            disabled={!canEdit}
                          >
                            <option value="">Select...</option>
                            {column.options.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                            {getValue(row, column.id) && !column.options.some((option) => option.value === getValue(row, column.id)) ? (
                              <option value={getValue(row, column.id)}>
                                {getValue(row, column.id)}
                              </option>
                            ) : null}
                          </select>
                        ) : (
                          <textarea
                            value={getValue(row, column.id)}
                            onChange={(event) => setValue(row.id, column.id, event.target.value)}
                            onBlur={() => {
                              if (!autoSave || !canEdit || !onSaveRow) return;
                              const values = { ...row.values, ...(draftRows[row.id] || {}) };
                              window.clearTimeout(autoSaveTimers.current[row.id]);
                              void saveValues(row, values);
                            }}
                            onKeyDown={(event) => {
                              if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                                event.preventDefault();
                                void saveRow(row);
                              }
                            }}
                            readOnly={!canEdit}
                            className="min-h-16 w-full resize-y rounded-md border border-transparent bg-transparent px-2 py-2 outline-none focus:border-ring focus:bg-background"
                            placeholder="-"
                          />
                        )}
                      </td>
                    ))}
                    <td className="p-2 align-top">
                      <div className="flex gap-1">
                        {canEdit && onSaveRow ? (
                          <Button type="button" size="icon" variant={dirty ? 'default' : 'ghost'} disabled={savingId === row.id} onClick={() => void saveRow(row)}>
                            <Save className="h-4 w-4" />
                          </Button>
                        ) : null}
                        {canDelete && onDeleteRow ? (
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
            {visibleRowLimit < rows.length ? (
              <tr>
                <td colSpan={visibleColumns.length + (showOwner ? 3 : 2)} className="py-4 text-center text-xs text-muted-foreground">
                  Scroll down to load more rows ({visibleRowLimit} of {rows.length})
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
