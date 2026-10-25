import { useState, useCallback } from 'react';

export interface WorkspaceState {
  editMode: boolean;
  saveStatus: 'saved' | 'saving' | 'error' | 'idle';
  rightDrawerOpen: boolean;
  rightDrawerWidth: number;
  bottomPaneOpen: boolean;
  bottomPaneHeight: number;
  bottomPaneCollapsed: boolean;
  selectedWidgetId: string | null;
}

export function useWorkspaceState() {
  const [editMode, setEditMode] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | 'idle'>('saved');

  // Right Drawer state
  const [rightDrawerOpen, setRightDrawerOpen] = useState<boolean>(false);
  const [rightDrawerWidth, setRightDrawerWidthState] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('sentinel_right_drawer_width');
      return stored ? parseInt(stored, 10) : 420;
    } catch {
      return 420;
    }
  });

  // Bottom Pane state
  const [bottomPaneOpen, setBottomPaneOpen] = useState<boolean>(false);
  const [bottomPaneHeight, setBottomPaneHeightState] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('sentinel_bottom_pane_height');
      return stored ? parseInt(stored, 10) : 260;
    } catch {
      return 260;
    }
  });
  const [bottomPaneCollapsed, setBottomPaneCollapsed] = useState<boolean>(false);

  // Selected widget for editing / query inspection
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);

  const setRightDrawerWidth = useCallback((delta: number) => {
    setRightDrawerWidthState((prev) => {
      // Invert delta because dragging left border to the left increases width
      const next = Math.min(720, Math.max(320, prev - delta));
      try {
        localStorage.setItem('sentinel_right_drawer_width', String(next));
      } catch {}
      return next;
    });
  }, []);

  const setBottomPaneHeight = useCallback((delta: number) => {
    setBottomPaneHeightState((prev) => {
      // Invert delta because dragging top border upward (negative clientY) increases height
      const next = Math.min(520, Math.max(160, prev - delta));
      try {
        localStorage.setItem('sentinel_bottom_pane_height', String(next));
      } catch {}
      return next;
    });
  }, []);

  const openRightDrawer = useCallback(() => {
    setRightDrawerOpen(true);
  }, []);

  const closeRightDrawer = useCallback(() => {
    setRightDrawerOpen(false);
  }, []);

  const openBottomPane = useCallback((widgetId?: string) => {
    setBottomPaneOpen(true);
    setBottomPaneCollapsed(false);
    if (widgetId) {
      setSelectedWidgetId(widgetId);
    }
  }, []);

  const closeBottomPane = useCallback(() => {
    setBottomPaneOpen(false);
    setSelectedWidgetId(null);
  }, []);

  const toggleBottomPaneCollapse = useCallback(() => {
    setBottomPaneCollapsed((prev) => !prev);
  }, []);

  return {
    editMode,
    setEditMode,
    saveStatus,
    setSaveStatus,
    rightDrawerOpen,
    rightDrawerWidth,
    openRightDrawer,
    closeRightDrawer,
    setRightDrawerWidth,
    bottomPaneOpen,
    bottomPaneHeight,
    bottomPaneCollapsed,
    openBottomPane,
    closeBottomPane,
    toggleBottomPaneCollapse,
    setBottomPaneHeight,
    selectedWidgetId,
    setSelectedWidgetId,
  };
}
