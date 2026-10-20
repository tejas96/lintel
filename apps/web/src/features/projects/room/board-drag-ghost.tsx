'use client';

import { dragLift, snappySpring } from '@lintel/design-system/web';
import { motion } from 'motion/react';
import { createPortal } from 'react-dom';
import { TaskNumber } from '@/features/tasks/task-presentation';
import type { BoardDrag } from './use-board-drag';

/** The lifted card under the pointer while dragging: tilted slightly, on a deeper shadow. */
export function BoardDragGhost({ drag }: { readonly drag: BoardDrag | null }) {
  if (!drag) return null;
  return createPortal(
    <div
      aria-hidden
      className="pointer-events-none fixed top-0 left-0 z-50"
      style={{
        width: drag.width,
        transform: `translate(${drag.x - drag.grabX}px, ${drag.y - drag.grabY}px)`,
      }}
    >
      <motion.div
        initial={{ scale: 1, rotate: 0 }}
        animate={dragLift}
        transition={snappySpring}
        className="flex flex-col gap-2 rounded-md border border-rule bg-raised p-3 shadow-e3"
      >
        <p className="type-body-sm font-medium text-ink">{drag.task.title}</p>
        <TaskNumber value={drag.task.number} />
      </motion.div>
    </div>,
    document.body,
  );
}
