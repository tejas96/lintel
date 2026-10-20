'use client';

import { cn, dialogEnter, seconds } from '@lintel/design-system/web';
import { CornerDownLeft, Search } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { type KeyboardEvent, useEffect, useMemo, useState } from 'react';
import { type PaletteCommand, usePaletteCommands } from './use-palette-commands';

interface CommandPaletteProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

/** ⌘K / Ctrl+K: jump anywhere or change a preference without leaving the keyboard. */
export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const commands = usePaletteCommands(query, open);
  const groups = useMemo(() => groupCommands(commands), [commands]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const run = (command: PaletteCommand) => {
    onOpenChange(false);
    command.run();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((current) =>
        commands.length === 0 ? 0 : (current + step + commands.length) % commands.length,
      );
    } else if (event.key === 'Enter') {
      const command = commands[active];
      if (command) {
        event.preventDefault();
        run(command);
      }
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-scrim"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: seconds('fast') }}
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                {...dialogEnter}
                className="fixed inset-x-3 top-[12dvh] z-50 mx-auto flex max-h-[70dvh] max-w-xl flex-col overflow-hidden rounded-xl border border-hairline bg-raised shadow-e4"
              >
                <DialogPrimitive.Title className="sr-only">Jump to</DialogPrimitive.Title>
                <div className="flex items-center gap-3 border-b border-hairline px-4">
                  <Search aria-hidden className="size-[1.125rem] text-ink-faint" />
                  <input
                    role="combobox"
                    aria-expanded
                    aria-controls="command-palette-list"
                    aria-activedescendant={
                      commands[active] ? `command-${commands[active].id}` : undefined
                    }
                    aria-label="Search pages, projects and actions"
                    placeholder="Search pages, projects and actions"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setActive(0);
                    }}
                    onKeyDown={onKeyDown}
                    className="h-14 flex-1 bg-transparent type-body text-ink outline-none placeholder:text-ink-faint"
                  />
                </div>
                <div
                  id="command-palette-list"
                  role="listbox"
                  aria-label="Results"
                  className="overflow-y-auto p-2"
                >
                  {commands.length === 0 && (
                    <p className="px-3 py-8 text-center type-body-sm text-ink-faint">
                      Nothing matches “{query}”. Try a page name like Projects or People.
                    </p>
                  )}
                  {groups.map(({ group, items }) => (
                    <div key={group} role="presentation">
                      <p aria-hidden className="px-3 pt-2 pb-1 type-label text-ink-faint">
                        {group}
                      </p>
                      {items.map((command) => {
                        const index = commands.indexOf(command);
                        return (
                          <div
                            key={command.id}
                            id={`command-${command.id}`}
                            role="option"
                            tabIndex={-1}
                            aria-selected={index === active}
                            onMouseMove={() => setActive(index)}
                            onClick={() => run(command)}
                            onKeyDown={() => undefined}
                            className={cn(
                              'flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3',
                              index === active ? 'bg-sunken text-ink' : 'text-ink-muted',
                            )}
                          >
                            <command.icon
                              aria-hidden
                              className="size-4 shrink-0 text-ink-faint"
                              strokeWidth={1.75}
                            />
                            <span className="flex-1 truncate type-body">{command.label}</span>
                            {command.hint && (
                              <span className="truncate type-body-sm text-ink-faint">
                                {command.hint}
                              </span>
                            )}
                            {index === active && (
                              <CornerDownLeft aria-hidden className="size-3.5 text-ink-faint" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}

function groupCommands(commands: readonly PaletteCommand[]) {
  const groups: { group: string; items: PaletteCommand[] }[] = [];
  for (const command of commands) {
    const existing = groups.find((entry) => entry.group === command.group);
    if (existing) existing.items.push(command);
    else groups.push({ group: command.group, items: [command] });
  }
  return groups;
}
