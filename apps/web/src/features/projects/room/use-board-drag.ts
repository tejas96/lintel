'use client';

import type { TaskSummary } from '@lintel/api-contracts';
import type { TaskStatus } from '@lintel/domain';
import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { legalTargets } from './use-board-move';

/** How far the pointer travels before a press becomes a drag (so clicks still open the task). */
const DRAG_THRESHOLD_PX = 5;
/** Near the board's edge, the board scrolls sideways to reach far columns. */
const EDGE_PX = 64;
const EDGE_STEP_PX = 14;

export interface BoardDrag {
  readonly task: TaskSummary;
  /** Pointer position, and where on the card it was grabbed. */
  readonly x: number;
  readonly y: number;
  readonly grabX: number;
  readonly grabY: number;
  readonly width: number;
}

function columnUnder(x: number, y: number): TaskStatus | null {
  for (const element of document.elementsFromPoint(x, y)) {
    const column = element.closest<HTMLElement>('[data-board-column]');
    if (column?.dataset.boardColumn) return column.dataset.boardColumn as TaskStatus;
  }
  return null;
}

/**
 * Pointer dragging for board cards (mouse and pen; touch uses the "Move to"
 * menu so the board still scrolls). A press that moves past a few pixels
 * lifts the card; letting go over a column it may move to moves it; Escape
 * puts it back. The click that ends a drag never opens the task.
 */
export function useBoardDrag(onDrop: (task: TaskSummary, to: TaskStatus) => void) {
  const [drag, setDrag] = useState<BoardDrag | null>(null);
  const [over, setOver] = useState<TaskStatus | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const cleanup = useRef<(() => void) | null>(null);

  const end = useCallback(() => {
    cleanup.current?.();
    cleanup.current = null;
    setDrag(null);
    setOver(null);
  }, []);
  useEffect(() => end, [end]);

  const start = useCallback(
    (task: TaskSummary, event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0 || event.pointerType === 'touch') return;
      if ((event.target as HTMLElement).closest('button')) return;
      const card = event.currentTarget.getBoundingClientRect();
      const origin = { x: event.clientX, y: event.clientY };
      let lifted = false;
      let target: TaskStatus | null = null;
      const legal = legalTargets(task.status);
      const move = (pointer: PointerEvent) => {
        if (
          !lifted &&
          Math.hypot(pointer.clientX - origin.x, pointer.clientY - origin.y) < DRAG_THRESHOLD_PX
        )
          return;
        lifted = true;
        pointer.preventDefault();
        setDrag({
          task,
          x: pointer.clientX,
          y: pointer.clientY,
          grabX: origin.x - card.left,
          grabY: origin.y - card.top,
          width: card.width,
        });
        const column = columnUnder(pointer.clientX, pointer.clientY);
        target = column && legal.includes(column) ? column : null;
        setOver(target);
        const box = scroller.current?.getBoundingClientRect();
        if (box && pointer.clientX > box.right - EDGE_PX)
          scroller.current?.scrollBy({ left: EDGE_STEP_PX });
        if (box && pointer.clientX < box.left + EDGE_PX)
          scroller.current?.scrollBy({ left: -EDGE_STEP_PX });
      };
      const up = () => {
        if (lifted) {
          // The click that follows a drag (same task as this pointerup) must not open the task.
          const swallow = (click: MouseEvent) => click.preventDefault();
          window.addEventListener('click', swallow, { capture: true, once: true });
          window.setTimeout(
            () => window.removeEventListener('click', swallow, { capture: true }),
            0,
          );
          if (target) onDrop(task, target);
        }
        end();
      };
      const key = (keyboard: KeyboardEvent) => {
        if (keyboard.key === 'Escape') end();
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
    [end, onDrop],
  );

  return { drag, over, start, scroller };
}
