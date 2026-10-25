import { useRef, useState } from 'react';

interface ResizeHandleProps {
  direction: 'horizontal' | 'vertical';
  onResize: (delta: number) => void;
  onResizeEnd?: () => void;
  className?: string;
  title?: string;
  minDelta?: number;
  maxDelta?: number;
}

export function ResizeHandle({
  direction,
  onResize,
  onResizeEnd,
  className = '',
  title,
}: ResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const startPosRef = useRef<number>(0);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    startPosRef.current = direction === 'horizontal' ? e.clientX : e.clientY;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const currentPos = direction === 'horizontal' ? e.clientX : e.clientY;
    const delta = currentPos - startPosRef.current;
    if (delta !== 0) {
      onResize(delta);
      startPosRef.current = currentPos;
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    if (onResizeEnd) {
      onResizeEnd();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 20 : 5;
    if (direction === 'horizontal') {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onResize(-step);
        onResizeEnd?.();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onResize(step);
        onResizeEnd?.();
      }
    } else {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        onResize(-step);
        onResizeEnd?.();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        onResize(step);
        onResizeEnd?.();
      }
    }
  };

  const isH = direction === 'horizontal';

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation={direction}
      aria-label={title || `Resize pane ${direction}`}
      title={title || 'Drag to resize pane'}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
      className={`group relative shrink-0 transition-colors focus:outline-none select-none touch-none ${
        isH
          ? 'w-1.5 cursor-col-resize hover:bg-primary/40 focus-visible:bg-primary/60'
          : 'h-1.5 cursor-row-resize hover:bg-primary/40 focus-visible:bg-primary/60'
      } ${isDragging ? 'bg-primary' : 'bg-transparent'} ${className}`}
    >
      {/* Visual drag handle bar */}
      <div
        className={`absolute inset-0 m-auto transition-opacity ${
          isH ? 'w-0.5 h-6 rounded-full' : 'h-0.5 w-6 rounded-full'
        } ${isDragging ? 'bg-primary opacity-100' : 'bg-border opacity-0 group-hover:opacity-100'}`}
      />
    </div>
  );
}
