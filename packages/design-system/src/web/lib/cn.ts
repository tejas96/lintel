import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/** tailwind-merge that knows our `type-*` utilities are font-size class groups. */
const mergeClasses = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          type: [
            'display-xl',
            'display-lg',
            'display-md',
            'title-lg',
            'title-md',
            'body',
            'body-sm',
            'label',
            'overline',
            'mono',
          ],
        },
      ],
      shadow: [{ shadow: ['e0', 'e1', 'e2', 'e3', 'e4'] }],
    },
  },
});

/** Joins class names and lets later Tailwind classes win over earlier ones. */
export function cn(...inputs: ClassValue[]): string {
  return mergeClasses(clsx(inputs));
}
