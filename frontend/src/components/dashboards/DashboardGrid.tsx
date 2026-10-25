import React, { useState } from 'react';
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
  Maximize01Icon,
  Minimize01Icon,
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
  const handleDragStart = (e: React.DragEvent, id: string) => {
    if (!isEditMode) return;
    setDraggedWidgetId(id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!isEditMode) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
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

  // Adjust width with bounds check [3..12]
  const handleAdjustWidth = (widget: DashboardWidget, delta: number) => {
    const newWidth = Math.min(12, Math.max(3, (widget.width || 6) + delta));
    const updated = widgets.map((w) => (w.id === widget.id ? { ...w, width: newWidth } : w));
    onUpdateLayout(updated);
  };

  // Shift position left / right
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

  // Corner resize drag handler for fine adjustments
  const handleCornerResize = (widget: DashboardWidget, deltaX: number) => {
    if (Math.abs(deltaX) > 25) {
      const step = deltaX > 0 ? 1 : -1;
      const newWidth = Math.min(12, Math.max(3, (widget.width || 6) + step));
      if (newWidth !== widget.width) {
        const updated = widgets.map((w) => (w.id === widget.id ? { ...w, width: newWidth } : w));
        onUpdateLayout(updated);
      }
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pb-12">
      {widgets.map((widget) => {
        const colSpan = getColSpanClass(widget.width || 6);
        const isMenuOpen = activeMenuId === widget.id;

        return (
          <div
            key={widget.id}
            draggable={isEditMode}
            onDragStart={(e) => handleDragStart(e, widget.id)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, widget.id)}
            className={`col-span-12 ${colSpan} transition-all duration-200 relative group flex flex-col ${
              isEditMode
                ? 'cursor-grab active:cursor-grabbing hover:ring-1 hover:ring-primary/60'
                : ''
            }`}
          >
            <Card
              className={`rounded-none border-border bg-card shadow-none h-full flex flex-col min-h-[200px] overflow-hidden ${
                isEditMode ? 'border-dashed border-primary/50 bg-card/90 shadow-sm' : ''
              }`}
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
                        className="absolute right-0 top-7 z-50 w-44 bg-card border border-border shadow-xl p-1 text-xs font-mono space-y-0.5"
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
                              Width: {widget.width || 6}/12
                            </div>
                            <div className="grid grid-cols-2 gap-1 px-1">
                              <button
                                type="button"
                                onClick={() => handleAdjustWidth(widget, -2)}
                                className="px-1.5 py-1 text-[10px] bg-muted/40 hover:bg-muted border border-border flex items-center justify-center gap-1"
                                disabled={(widget.width || 6) <= 3}
                              >
                                <HugeiconsIcon icon={Minimize01Icon} className="size-3" />
                                <span>Narrow</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAdjustWidth(widget, 2)}
                                className="px-1.5 py-1 text-[10px] bg-muted/40 hover:bg-muted border border-border flex items-center justify-center gap-1"
                                disabled={(widget.width || 6) >= 12}
                              >
                                <HugeiconsIcon icon={Maximize01Icon} className="size-3" />
                                <span>Wider</span>
                              </button>
                            </div>

                            <div className="border-t border-border/50 my-1" />

                            <div className="px-2 py-0.5 text-[9px] text-muted-foreground uppercase font-semibold">
                              Position
                            </div>
                            <div className="grid grid-cols-2 gap-1 px-1">
                              <button
                                type="button"
                                onClick={() => handleShiftPosition(widget, 'left')}
                                className="px-1.5 py-1 text-[10px] bg-muted/40 hover:bg-muted border border-border flex items-center justify-center gap-1"
                              >
                                <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3" />
                                <span>Move Left</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleShiftPosition(widget, 'right')}
                                className="px-1.5 py-1 text-[10px] bg-muted/40 hover:bg-muted border border-border flex items-center justify-center gap-1"
                              >
                                <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
                                <span>Move Right</span>
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

                {/* Bottom-right interactive corner resize handle in edit mode */}
                {isEditMode && (
                  <div
                    title="Drag corner to resize width"
                    className="absolute right-0 bottom-0 size-4 cursor-se-resize flex items-end justify-end p-0.5 text-primary opacity-60 hover:opacity-100"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const startX = e.clientX;
                      const target = e.target as HTMLElement;
                      target.setPointerCapture(e.pointerId);

                      const onMove = (ev: PointerEvent) => {
                        const delta = ev.clientX - startX;
                        handleCornerResize(widget, delta);
                      };

                      const onUp = () => {
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
