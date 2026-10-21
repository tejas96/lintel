'use client';

import type { GanttDragPart } from '@lintel/design-system/web';
import {
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { addDays } from '@/lib/format/dates';

/** A bar being moved or resized, by pointer or keyboard, before it is reviewed. */
export interface TimelineEdit {
  readonly taskId: string;
  readonly start: string;
  readonly end: string;
  readonly originStart: string;
  readonly originEnd: string;
  /** dragging: following the pointer; adjusting: keyboard; reviewing: dropped, effect shown. */
  readonly phase: 'dragging' | 'adjusting' | 'reviewing';
}

interface BarDates {
  readonly id: string;
  readonly start: string;
  readonly end: string;
}

/** A press must travel this far before it becomes a drag, so a click still opens the task. */
const DRAG_THRESHOLD_PX = 4;

function shifted(bar: BarDates, part: GanttDragPart, days: number) {
  if (part === 'move') return { start: addDays(bar.start, days), end: addDays(bar.end, days) };
  if (part === 'start') {
    const start = addDays(bar.start, days);
    return { start: start > bar.end ? bar.end : start, end: bar.end };
  }
  const end = addDays(bar.end, days);
  return { start: bar.start, end: end < bar.start ? bar.start : end };
}

type KeyboardAction = 'cancel' | 'review' | { part: GanttDragPart; days: number };

/** What a key does on a bar; Enter and Escape only matter while a change is being made. */
function keyboardAction(
  event: KeyboardEvent<HTMLButtonElement>,
  adjusting: boolean,
): KeyboardAction | null {
  if (adjusting && event.key === 'Escape') return 'cancel';
  if (adjusting && event.key === 'Enter') return 'review';
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return null;
  const part: GanttDragPart = event.shiftKey ? 'end' : event.altKey ? 'start' : 'move';
  return { part, days: event.key === 'ArrowLeft' ? -1 : 1 };
}

const moved = (edit: TimelineEdit) =>
  edit.start !== edit.originStart || edit.end !== edit.originEnd;

/**
 * Moving and resizing task bars. Pointer: drag the bar to move it, drag an
 * end to change that date; whole days only; Escape puts it back. Keyboard
 * (on a focused bar): ← → move a day, Shift + ← → change the end, Alt + ← →
 * change the start, Enter reviews the change, Escape cancels.
 */
export function useTimelineEdit(dayWidth: number, onReview: (edit: TimelineEdit) => void) {
  const [edit, setEdit] = useState<TimelineEdit | null>(null);
  const cleanup = useRef<(() => void) | null>(null);
  const cancel = useCallback(() => {
    cleanup.current?.();
    cleanup.current = null;
    setEdit(null);
  }, []);
  useEffect(() => () => cleanup.current?.(), []);

  const startDrag = useCallback(
    (bar: BarDates, part: GanttDragPart, event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0 || event.pointerType === 'touch') return;
      const originX = event.clientX;
      let current: TimelineEdit | null = null;
      const move = (pointer: PointerEvent) => {
        const dx = pointer.clientX - originX;
        if (current === null && Math.abs(dx) < DRAG_THRESHOLD_PX) return;
        pointer.preventDefault();
        const dates = shifted(bar, part, Math.round(dx / dayWidth));
        current = {
          taskId: bar.id,
          ...dates,
          originStart: bar.start,
          originEnd: bar.end,
          phase: 'dragging',
        };
        setEdit(current);
      };
      const up = () => {
        cleanup.current?.();
        cleanup.current = null;
        if (current === null) return;
        // The click that ends a drag must not open the task.
        const swallow = (click: MouseEvent) => {
          click.preventDefault();
          // Stops React's onClick too (it listens below the window), so the bar does not open.
          click.stopPropagation();
        };
        window.addEventListener('click', swallow, { capture: true, once: true });
        window.setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0);
        if (moved(current)) {
          const dropped: TimelineEdit = { ...current, phase: 'reviewing' };
          setEdit(dropped);
          onReview(dropped);
        } else setEdit(null);
      };
      const key = (keyboard: globalThis.KeyboardEvent) => {
        if (keyboard.key === 'Escape') cancel();
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up, { once: true });
      window.addEventListener('keydown', key);
      cleanup.current = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('keydown', key);
      };
    },
    [dayWidth, onReview, cancel],
  );

  const finishKeyboard = useCallback(
    (base: TimelineEdit) => {
      if (!moved(base)) return cancel();
      const reviewing: TimelineEdit = { ...base, phase: 'reviewing' };
      setEdit(reviewing);
      onReview(reviewing);
    },
    [cancel, onReview],
  );

  const keyDown = useCallback(
    (bar: BarDates, event: KeyboardEvent<HTMLButtonElement>) => {
      const base = edit?.taskId === bar.id && edit.phase === 'adjusting' ? edit : null;
      const action = keyboardAction(event, base !== null);
      if (action === null) return;
      event.preventDefault();
      if (action === 'cancel') return cancel();
      if (action === 'review') return base ? finishKeyboard(base) : undefined;
      const from = base ? { id: bar.id, start: base.start, end: base.end } : bar;
      setEdit({
        taskId: bar.id,
        ...shifted(from, action.part, action.days),
        originStart: base?.originStart ?? bar.start,
        originEnd: base?.originEnd ?? bar.end,
        phase: 'adjusting',
      });
    },
    [edit, cancel, finishKeyboard],
  );

  return { edit, startDrag, keyDown, cancel };
}
