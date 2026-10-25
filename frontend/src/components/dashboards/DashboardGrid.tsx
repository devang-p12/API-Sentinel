import { useState, type DragEvent, type KeyboardEvent } from 'react';
import type { DashboardWidget } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { WidgetRenderer } from './renderers/WidgetRenderer';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  MoreVerticalIcon,
  Delete02Icon,
  Edit02Icon,
  Copy01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowUp01Icon,
  ArrowDown01Icon,
  DragDropIcon,
  Add01Icon,
} from '@hugeicons/core-free-icons';

interface DashboardGridProps {
  widgets: DashboardWidget[];
  isEditMode: boolean;
  isLoading?: boolean;
  onEditWidget: (widget: DashboardWidget) => void;
  onDeleteWidget: (widgetId: string) => void;
  onDuplicateWidget: (widget: DashboardWidget) => void;
  onUpdateLayout: (updatedWidgets: DashboardWidget[]) => void;
  onAddVisualization: () => void;
}

export function DashboardGrid({
  widgets,
  isEditMode,
  isLoading,
  onEditWidget,
  onDeleteWidget,
  onDuplicateWidget,
  onUpdateLayout,
  onAddVisualization,
}: DashboardGridProps) {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [draggedWidgetId, setDraggedWidgetId] = useState<string | null>(null);

  if (widgets.length === 0) {
    return (
      <div className="py-20 px-6 border border-border border-dashed bg-card/20 flex flex-col items-center justify-center text-center space-y-4">
        <div className="size-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
          <HugeiconsIcon icon={Add01Icon} className="size-6" />
        </div>
        <div className="space-y-1.5 max-w-md">
          <h3 className="font-heading font-semibold text-base text-foreground">
            Your dashboard is empty
          </h3>
          <p className="text-xs text-muted-foreground">
            Add your first visualization to start monitoring your APIs. Choose from real-time availability SLAs, latency percentiles, error rates, and status distributions.
          </p>
        </div>
        <Button size="sm" onClick={onAddVisualization} className="gap-1.5 mt-2">
          <HugeiconsIcon icon={Add01Icon} className="size-4" />
          <span>Add Visualization</span>
        </Button>
      </div>
    );
  }

  // Column span helper
  const getColSpanClass = (w: number) => {
    switch (w) {
      case 12:
        return 'md:col-span-12';
      case 11:
        return 'md:col-span-11';
      case 10:
        return 'md:col-span-10';
      case 9:
        return 'md:col-span-9';
      case 8:
        return 'md:col-span-8';
      case 7:
        return 'md:col-span-7';
      case 6:
        return 'md:col-span-6';
      case 5:
        return 'md:col-span-5';
      case 4:
        return 'md:col-span-4';
      case 3:
      default:
        return 'md:col-span-3';
    }
  };

  // Drag & drop handlers
  const handleDragStart = (e: DragEvent, id: string) => {
    if (!isEditMode) return;
    setDraggedWidgetId(id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: DragEvent) => {
    if (!isEditMode) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: DragEvent, targetId: string) => {
    if (!isEditMode) return;
    e.preventDefault();
    const sourceId = draggedWidgetId || e.dataTransfer.getData('text/plain');
    if (!sourceId || sourceId === targetId) return;

    const sourceIndex = widgets.findIndex((w) => w.id === sourceId);
    const targetIndex = widgets.findIndex((w) => w.id === targetId);
    if (sourceIndex === -1 || targetIndex === -1) return;

    const reordered = [...widgets];
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    const updated = reordered.map((w, idx) => ({
      ...w,
      x: (idx * 6) % 12,
      y: Math.floor((idx * 6) / 12) * 3,
    }));

    onUpdateLayout(updated);
    setDraggedWidgetId(null);
  };

  // Direct Arrow Adjust Width [3..12]
  const handleAdjustWidth = (widget: DashboardWidget, delta: number) => {
    const currentW = widget.width || 6;
    const newWidth = Math.min(12, Math.max(3, currentW + delta));
    if (newWidth === currentW) return;
    const updated = widgets.map((w) => (w.id === widget.id ? { ...w, width: newWidth } : w));
    onUpdateLayout(updated);
  };

  // Direct Arrow Adjust Height (Row Span) [2..8]
  const handleAdjustHeight = (widget: DashboardWidget, delta: number) => {
    const currentH = widget.height || 3;
    const newHeight = Math.min(8, Math.max(2, currentH + delta));
    if (newHeight === currentH) return;
    const updated = widgets.map((w) => (w.id === widget.id ? { ...w, height: newHeight } : w));
    onUpdateLayout(updated);
  };

  // Helper to group widgets into rows based on column width and row breaks
  const computeRows = (widgetList: DashboardWidget[]): DashboardWidget[][] => {
    const rows: DashboardWidget[][] = [];
    let currentRow: DashboardWidget[] = [];
    let currentCols = 0;

    for (const w of widgetList) {
      const wWidth = w.width || 6;
      const isNewRow = Boolean(w.configuration?.newRow);

      if (isNewRow || (currentCols + wWidth > 12 && currentRow.length > 0)) {
        rows.push(currentRow);
        currentRow = [w];
        currentCols = wWidth;
      } else {
        currentRow.push(w);
        currentCols += wWidth;
      }
    }
    if (currentRow.length > 0) {
      rows.push(currentRow);
    }
    return rows;
  };

  // Move widget up or down across rows
  const handleMoveRow = (widget: DashboardWidget, direction: 'up' | 'down') => {
    const rows = computeRows(widgets);
    const sourceRowIdx = rows.findIndex((r) => r.some((w) => w.id === widget.id));
    if (sourceRowIdx === -1) return;

    if (direction === 'up') {
      if (sourceRowIdx === 0) return;
      const targetRowIdx = sourceRowIdx - 1;
      rows[sourceRowIdx] = rows[sourceRowIdx].filter((w) => w.id !== widget.id);
      rows[targetRowIdx].push(widget);
    } else {
      if (sourceRowIdx === rows.length - 1) {
        if (rows[sourceRowIdx].length > 1) {
          rows[sourceRowIdx] = rows[sourceRowIdx].filter((w) => w.id !== widget.id);
          rows.push([{ ...widget, configuration: { ...widget.configuration, newRow: true } }]);
        } else {
          return;
        }
      } else {
        const targetRowIdx = sourceRowIdx + 1;
        rows[sourceRowIdx] = rows[sourceRowIdx].filter((w) => w.id !== widget.id);
        rows[targetRowIdx].unshift(widget);
      }
    }

    const cleanRows = rows.filter((r) => r.length > 0);
    const reordered = cleanRows.flatMap((r, rIdx) =>
      r.map((w, cIdx) => ({
        ...w,
        x: (cIdx * (w.width || 6)) % 12,
        y: rIdx * 3,
      }))
    );

    onUpdateLayout(reordered);
  };

  // Toggle whether widget breaks onto its own fresh row
  const handleToggleNewRow = (widget: DashboardWidget) => {
    const currentNewRow = Boolean(widget.configuration?.newRow);
    const updated = widgets.map((w) =>
      w.id === widget.id
        ? {
            ...w,
            configuration: {
              ...w.configuration,
              newRow: !currentNewRow,
            },
          }
        : w
    );
    onUpdateLayout(updated);
  };

  // Shift position left / right within current ordering
  const handleShiftPosition = (widget: DashboardWidget, direction: 'left' | 'right') => {
    const idx = widgets.findIndex((w) => w.id === widget.id);
    if (idx === -1) return;
    const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= widgets.length) return;

    const reordered = [...widgets];
    const temp = reordered[idx];
    reordered[idx] = reordered[targetIdx];
    reordered[targetIdx] = temp;

    const updated = reordered.map((w, i) => ({
      ...w,
      x: (i * 6) % 12,
      y: Math.floor((i * 6) / 12) * 3,
    }));
    onUpdateLayout(updated);
  };

  const currentRows = computeRows(widgets);
  const totalRows = currentRows.length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pb-12">
      {widgets.map((widget) => {
        const colSpan = getColSpanClass(widget.width || 6);
        const isMenuOpen = activeMenuId === widget.id;
        const currentRowIndex = currentRows.findIndex((r) => r.some((w) => w.id === widget.id));
        const isNewRow = Boolean(widget.configuration?.newRow);

        return (
          <div
            key={widget.id}
            draggable={isEditMode}
            onDragStart={(e) => handleDragStart(e, widget.id)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, widget.id)}
            onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
              if (!isEditMode) return;
              if (e.shiftKey && e.key === 'ArrowUp') {
                e.preventDefault();
                handleMoveRow(widget, 'up');
              } else if (e.shiftKey && e.key === 'ArrowDown') {
                e.preventDefault();
                handleMoveRow(widget, 'down');
              } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                handleAdjustWidth(widget, -1);
              } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                handleAdjustWidth(widget, 1);
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                handleAdjustHeight(widget, -1);
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                handleAdjustHeight(widget, 1);
              }
            }}
            tabIndex={isEditMode ? 0 : undefined}
            className={`col-span-12 ${colSpan} ${isNewRow ? 'md:col-start-1' : ''} transition-all duration-200 relative group flex flex-col ${
              isEditMode
                ? 'cursor-grab active:cursor-grabbing hover:ring-1 hover:ring-primary/60 focus:ring-1 focus:ring-primary focus:outline-none'
                : ''
            }`}
          >
            <Card
              className={`rounded-none border-border bg-card shadow-none h-full flex flex-col overflow-hidden relative ${
                isEditMode ? 'border-dashed border-primary/50 bg-card/90 shadow-sm' : ''
              }`}
              style={{ minHeight: `${(widget.height || 3) * 75 + 60}px` }}
            >
              <CardHeader className="py-2.5 px-3 border-b border-border/40 bg-muted/20 flex flex-row items-center justify-between space-y-0 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  {isEditMode && (
                    <span
                      title="Drag to reposition panel"
                      className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
                    >
                      <HugeiconsIcon icon={DragDropIcon} className="size-3.5" />
                    </span>
                  )}
                  <CardTitle className="text-xs font-semibold truncate text-foreground">
                    {widget.title}
                  </CardTitle>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* DIRECT ROW & COLUMN CONTROLS (Edit Mode) */}
                  {isEditMode && (
                    <div className="flex items-center gap-1">
                      {/* Row Movement: [ ▲ ] Row 1 [ ▼ ] */}
                      <div
                        className="flex items-center border border-border bg-card text-[10px] font-mono shadow-xs"
                        title="Move panel to row above / below (or Shift+Up/Down)"
                      >
                        <button
                          type="button"
                          title="Move to row above (▲)"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveRow(widget, 'up');
                          }}
                          disabled={currentRowIndex <= 0}
                          className="size-5 flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                        >
                          <HugeiconsIcon icon={ArrowUp01Icon} className="size-3" />
                        </button>
                        <span className="px-1 text-[9px] font-semibold text-foreground select-none">
                          Row {currentRowIndex + 1}
                        </span>
                        <button
                          type="button"
                          title="Move to row below (▼)"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveRow(widget, 'down');
                          }}
                          disabled={currentRowIndex >= totalRows - 1 && (currentRows[currentRowIndex]?.length || 0) <= 1}
                          className="size-5 flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                        >
                          <HugeiconsIcon icon={ArrowDown01Icon} className="size-3" />
                        </button>
                      </div>

                      {/* Width Column Control: [ ← ] 6/12 [ → ] */}
                      <div
                        className="flex items-center border border-border bg-card text-[10px] font-mono shadow-xs"
                        title="Resize panel width (columns)"
                      >
                        <button
                          type="button"
                          title="Shrink width (← arrow)"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAdjustWidth(widget, -1);
                          }}
                          disabled={(widget.width || 6) <= 3}
                          className="size-5 flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                        >
                          <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3" />
                        </button>
                        <span className="px-1 text-[9px] font-semibold text-foreground select-none">
                          {widget.width || 6}/12
                        </span>
                        <button
                          type="button"
                          title="Expand width (→ arrow)"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAdjustWidth(widget, 1);
                          }}
                          disabled={(widget.width || 6) >= 12}
                          className="size-5 flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                        >
                          <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
                        </button>
                      </div>

                      {/* Height Row Span Control: [ ↑ ] 3 rows [ ↓ ] */}
                      <div
                        className="flex items-center border border-border bg-card text-[10px] font-mono shadow-xs"
                        title="Resize panel height (row span)"
                      >
                        <button
                          type="button"
                          title="Shrink height (↑ arrow)"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAdjustHeight(widget, -1);
                          }}
                          disabled={(widget.height || 3) <= 2}
                          className="size-5 flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                        >
                          <HugeiconsIcon icon={ArrowUp01Icon} className="size-3" />
                        </button>
                        <span className="px-1 text-[9px] font-semibold text-foreground select-none">
                          {widget.height || 3} rows
                        </span>
                        <button
                          type="button"
                          title="Expand height (↓ arrow)"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAdjustHeight(widget, 1);
                          }}
                          disabled={(widget.height || 3) >= 8}
                          className="size-5 flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                        >
                          <HugeiconsIcon icon={ArrowDown01Icon} className="size-3" />
                        </button>
                      </div>
                    </div>
                  )}

                  <Badge variant="outline" className="text-[10px] font-mono px-1 py-0 uppercase">
                    {widget.visualizationType}
                  </Badge>

                  {/* Contextual Toolbar Menu */}
                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => setActiveMenuId(isMenuOpen ? null : widget.id)}
                      className="size-6 p-0 text-muted-foreground hover:text-foreground"
                      title="Panel actions"
                    >
                      <HugeiconsIcon icon={MoreVerticalIcon} className="size-3.5" />
                    </Button>

                    {isMenuOpen && (
                      <div
                        className="absolute right-0 top-7 z-50 w-52 bg-card border border-border shadow-xl p-1 text-xs font-mono space-y-0.5"
                        onMouseLeave={() => setActiveMenuId(null)}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuId(null);
                            onEditWidget(widget);
                          }}
                          className="w-full text-left px-2 py-1.5 hover:bg-muted flex items-center gap-2 text-foreground"
                        >
                          <HugeiconsIcon icon={Edit02Icon} className="size-3.5 text-primary" />
                          <span>Edit Query</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuId(null);
                            onDuplicateWidget(widget);
                          }}
                          className="w-full text-left px-2 py-1.5 hover:bg-muted flex items-center gap-2 text-foreground"
                        >
                          <HugeiconsIcon icon={Copy01Icon} className="size-3.5" />
                          <span>Duplicate</span>
                        </button>

                        {isEditMode && (
                          <>
                            <div className="border-t border-border/50 my-1" />

                            <div className="px-2 py-0.5 text-[9px] text-muted-foreground uppercase font-semibold">
                              Change Row (Move Row)
                            </div>
                            <div className="grid grid-cols-2 gap-1 px-1">
                              <button
                                type="button"
                                onClick={() => handleMoveRow(widget, 'up')}
                                className="px-1.5 py-1 text-[10px] bg-muted/40 hover:bg-muted border border-border flex items-center justify-center gap-1 text-foreground disabled:opacity-30"
                                disabled={currentRowIndex <= 0}
                              >
                                <HugeiconsIcon icon={ArrowUp01Icon} className="size-3" />
                                <span>Row Above</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveRow(widget, 'down')}
                                className="px-1.5 py-1 text-[10px] bg-muted/40 hover:bg-muted border border-border flex items-center justify-center gap-1 text-foreground disabled:opacity-30"
                                disabled={currentRowIndex >= totalRows - 1 && (currentRows[currentRowIndex]?.length || 0) <= 1}
                              >
                                <span>Row Below</span>
                                <HugeiconsIcon icon={ArrowDown01Icon} className="size-3" />
                              </button>
                            </div>

                            <div className="px-1 pt-1">
                              <button
                                type="button"
                                onClick={() => handleToggleNewRow(widget)}
                                className={`w-full py-1 text-[10px] border flex items-center justify-center gap-1.5 ${
                                  isNewRow
                                    ? 'bg-primary/10 border-primary text-primary font-semibold'
                                    : 'bg-muted/40 hover:bg-muted border-border text-foreground'
                                }`}
                              >
                                <span>{isNewRow ? '✓ Starts on New Row' : 'Start on New Row (↵)'}</span>
                              </button>
                            </div>

                            <div className="border-t border-border/50 my-1" />

                            <div className="px-2 py-0.5 text-[9px] text-muted-foreground uppercase font-semibold">
                              Resize Width (Columns)
                            </div>
                            <div className="flex items-center gap-1 px-1">
                              <button
                                type="button"
                                onClick={() => handleAdjustWidth(widget, -1)}
                                className="flex-1 py-1 text-[10px] bg-muted/40 hover:bg-muted border border-border flex items-center justify-center gap-1 text-foreground disabled:opacity-30"
                                disabled={(widget.width || 6) <= 3}
                              >
                                <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3" />
                                <span>Shrink</span>
                              </button>
                              <span className="text-[10px] font-mono px-1 font-semibold text-foreground">
                                {widget.width || 6}/12
                              </span>
                              <button
                                type="button"
                                onClick={() => handleAdjustWidth(widget, 1)}
                                className="flex-1 py-1 text-[10px] bg-muted/40 hover:bg-muted border border-border flex items-center justify-center gap-1 text-foreground disabled:opacity-30"
                                disabled={(widget.width || 6) >= 12}
                              >
                                <span>Expand</span>
                                <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
                              </button>
                            </div>

                            <div className="px-2 py-0.5 text-[9px] text-muted-foreground uppercase font-semibold mt-1">
                              Resize Height (Row Span)
                            </div>
                            <div className="flex items-center gap-1 px-1">
                              <button
                                type="button"
                                onClick={() => handleAdjustHeight(widget, -1)}
                                className="flex-1 py-1 text-[10px] bg-muted/40 hover:bg-muted border border-border flex items-center justify-center gap-1 text-foreground disabled:opacity-30"
                                disabled={(widget.height || 3) <= 2}
                              >
                                <HugeiconsIcon icon={ArrowUp01Icon} className="size-3" />
                                <span>Shorter</span>
                              </button>
                              <span className="text-[10px] font-mono px-1 font-semibold text-foreground">
                                {widget.height || 3} rows
                              </span>
                              <button
                                type="button"
                                onClick={() => handleAdjustHeight(widget, 1)}
                                className="flex-1 py-1 text-[10px] bg-muted/40 hover:bg-muted border border-border flex items-center justify-center gap-1 text-foreground disabled:opacity-30"
                                disabled={(widget.height || 3) >= 8}
                              >
                                <span>Taller</span>
                                <HugeiconsIcon icon={ArrowDown01Icon} className="size-3" />
                              </button>
                            </div>

                            <div className="border-t border-border/50 my-1" />

                            <div className="px-2 py-0.5 text-[9px] text-muted-foreground uppercase font-semibold">
                              Shift Column Position
                            </div>
                            <div className="grid grid-cols-2 gap-1 px-1">
                              <button
                                type="button"
                                onClick={() => handleShiftPosition(widget, 'left')}
                                className="px-1.5 py-1 text-[10px] bg-muted/40 hover:bg-muted border border-border flex items-center justify-center gap-1 text-foreground"
                              >
                                <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3" />
                                <span>Shift Left</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleShiftPosition(widget, 'right')}
                                className="px-1.5 py-1 text-[10px] bg-muted/40 hover:bg-muted border border-border flex items-center justify-center gap-1 text-foreground"
                              >
                                <span>Shift Right</span>
                                <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
                              </button>
                            </div>
                          </>
                        )}

                        <div className="border-t border-border/50 my-1" />

                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuId(null);
                            onDeleteWidget(widget.id);
                          }}
                          className="w-full text-left px-2 py-1.5 hover:bg-destructive/10 text-destructive flex items-center gap-2"
                        >
                          <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
                          <span>Delete Panel</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>

              {/* Card Body with Independent Error Handling */}
              <CardContent className="p-0 flex-1 flex flex-col relative">
                {isLoading && !widget.data ? (
                  <div className="p-6 flex flex-col items-center justify-center h-full space-y-2 text-muted-foreground animate-pulse">
                    <div className="h-4 w-28 bg-muted rounded-none" />
                    <div className="h-10 w-44 bg-muted/60 rounded-none" />
                    <div className="h-3 w-32 bg-muted/40 rounded-none" />
                  </div>
                ) : (
                  <WidgetRenderer widget={widget} isLoading={isLoading} />
                )}

                {/* Right-edge draggable arrow resize handle in edit mode */}
                {isEditMode && (
                  <div
                    title="Drag right edge to resize width (← / →)"
                    className="absolute -right-1 top-0 bottom-0 w-2.5 cursor-ew-resize hover:bg-primary/20 active:bg-primary/40 transition-colors z-20 flex items-center justify-center group/edge"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const startX = e.clientX;
                      const initialWidth = widget.width || 6;
                      const target = e.target as HTMLElement;
                      target.setPointerCapture(e.pointerId);

                      const onMove = (ev: PointerEvent) => {
                        const deltaPixels = ev.clientX - startX;
                        const columnDelta = Math.round(deltaPixels / 60);
                        const newWidth = Math.min(12, Math.max(3, initialWidth + columnDelta));
                        if (newWidth !== widget.width) {
                          const updated = widgets.map((w) => (w.id === widget.id ? { ...w, width: newWidth } : w));
                          onUpdateLayout(updated);
                        }
                      };

                      const onUp = (ev: PointerEvent) => {
                        try { target.releasePointerCapture(ev.pointerId); } catch {}
                        window.removeEventListener('pointermove', onMove);
                        window.removeEventListener('pointerup', onUp);
                      };

                      window.addEventListener('pointermove', onMove);
                      window.addEventListener('pointerup', onUp);
                    }}
                  >
                    <div className="w-0.5 h-8 bg-border group-hover/edge:bg-primary group-hover/edge:h-12 rounded transition-all" />
                  </div>
                )}

                {/* Bottom-edge draggable arrow resize handle in edit mode */}
                {isEditMode && (
                  <div
                    title="Drag bottom edge to resize height (↑ / ↓)"
                    className="absolute left-0 right-0 -bottom-1 h-2.5 cursor-ns-resize hover:bg-primary/20 active:bg-primary/40 transition-colors z-20 flex items-center justify-center group/bottom"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const startY = e.clientY;
                      const initialHeight = widget.height || 3;
                      const target = e.target as HTMLElement;
                      target.setPointerCapture(e.pointerId);

                      const onMove = (ev: PointerEvent) => {
                        const deltaPixels = ev.clientY - startY;
                        const rowDelta = Math.round(deltaPixels / 50);
                        const newHeight = Math.min(8, Math.max(2, initialHeight + rowDelta));
                        if (newHeight !== widget.height) {
                          const updated = widgets.map((w) => (w.id === widget.id ? { ...w, height: newHeight } : w));
                          onUpdateLayout(updated);
                        }
                      };

                      const onUp = (ev: PointerEvent) => {
                        try { target.releasePointerCapture(ev.pointerId); } catch {}
                        window.removeEventListener('pointermove', onMove);
                        window.removeEventListener('pointerup', onUp);
                      };

                      window.addEventListener('pointermove', onMove);
                      window.addEventListener('pointerup', onUp);
                    }}
                  >
                    <div className="h-0.5 w-12 bg-border group-hover/bottom:bg-primary group-hover/bottom:w-16 rounded transition-all" />
                  </div>
                )}

                {/* Bottom-right interactive corner diagonal resize handle in edit mode */}
                {isEditMode && (
                  <div
                    title="Drag corner to resize width and height (⤡)"
                    className="absolute right-0 bottom-0 size-4 cursor-se-resize flex items-end justify-end p-0.5 text-primary opacity-60 hover:opacity-100 z-30"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const startX = e.clientX;
                      const startY = e.clientY;
                      const initialWidth = widget.width || 6;
                      const initialHeight = widget.height || 3;
                      const target = e.target as HTMLElement;
                      target.setPointerCapture(e.pointerId);

                      const onMove = (ev: PointerEvent) => {
                        const deltaX = ev.clientX - startX;
                        const deltaY = ev.clientY - startY;
                        const columnDelta = Math.round(deltaX / 60);
                        const rowDelta = Math.round(deltaY / 50);
                        const newWidth = Math.min(12, Math.max(3, initialWidth + columnDelta));
                        const newHeight = Math.min(8, Math.max(2, initialHeight + rowDelta));
                        if (newWidth !== widget.width || newHeight !== widget.height) {
                          const updated = widgets.map((w) =>
                            w.id === widget.id ? { ...w, width: newWidth, height: newHeight } : w
                          );
                          onUpdateLayout(updated);
                        }
                      };

                      const onUp = (ev: PointerEvent) => {
                        try { target.releasePointerCapture(ev.pointerId); } catch {}
                        window.removeEventListener('pointermove', onMove);
                        window.removeEventListener('pointerup', onUp);
                      };

                      window.addEventListener('pointermove', onMove);
                      window.addEventListener('pointerup', onUp);
                    }}
                  >
                    <svg viewBox="0 0 10 10" className="size-2.5 fill-current">
                      <path d="M 9 1 L 9 9 L 1 9 Z" />
                    </svg>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );
      })}
    </div>
  );
}
