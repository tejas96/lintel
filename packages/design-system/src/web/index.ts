/**
 * @lintel/design-system/web — React DOM components. Consumed as TypeScript
 * source (Next.js `transpilePackages`); mobile must import only `./tokens`.
 * Styles: import `@lintel/design-system/theme.css` and `components.css`, and
 * add this folder to Tailwind's `@source`.
 */
export { Button, type ButtonProps, buttonStyles, IconButton } from './controls/button';
export { Checkbox, Switch } from './controls/checkbox';
export { Combobox, type ComboboxOption } from './controls/combobox';
export { DatePicker } from './controls/date-picker';
export { controlSurface, Field, useField } from './controls/field';
export { Input, Textarea } from './controls/input';
export { Select, type SelectOption } from './controls/select';
export { type ActivityEntry, ActivityFeed } from './data/activity-feed';
export { ApprovalCard } from './data/approval-card';
export { Avatar, AvatarStack, initialsOf, LOAD_LABELS, type LoadStatus } from './data/avatar';
export { Sparkline, type TrendBarDatum, TrendBars } from './data/charts';
export { KpiTile } from './data/kpi-tile';
export { type PriorityLevel, PriorityMarker } from './data/priority-marker';
export { ProgressRing } from './data/progress-ring';
export { StageTracker, type TrackerStage } from './data/stage-tracker';
export { StatusGlyph, type StatusGlyphName } from './data/status-glyph';
export { Badge, CountBadge, type PillTone, StatusPill } from './data/status-pill';
export { EmptyState } from './feedback/empty-state';
export { type ErrorKind, ErrorState } from './feedback/error-state';
export { Skeleton, SkeletonGroup, SkeletonText, useDelayedVisibility } from './feedback/skeleton';
export { type ToastInput, ToastProvider, type ToastTone, useToast } from './feedback/toast';
export type { DrawingName } from './illustrations/drawings';
export { LineDrawing } from './illustrations/line-drawing';
export { Card, CardHeader, PageHeader } from './layout/card';
export { ResponsiveTable, type TableColumn } from './layout/responsive-table';
export { SegmentedControl, type SegmentOption } from './layout/segmented-control';
export {
  type LinkLike,
  type NavTabItem,
  type TabItem,
  TabNav,
  TabPanel,
  Tabs,
} from './layout/tabs';
export { dayNumber, daysFrom, positionBetween, shortDate } from './lib/calendar-math';
export { cn } from './lib/cn';
export {
  MotionPreferenceProvider,
  useCalmMotion,
  useMotionPreference,
} from './motion/motion-preference';
export * from './motion/presets';
export { useCountUp } from './motion/use-count-up';
export { Dialog } from './overlays/dialog';
export { Popover, Tooltip, TooltipProvider } from './overlays/popover';
export { Sheet } from './overlays/sheet';
export {
  GANTT_HEADER_HEIGHT,
  GANTT_ROW_HEIGHT,
  GanttChart,
  GanttRow,
} from './timeline/gantt';
export { GanttBar, GanttMilestoneMark } from './timeline/gantt-bar';
export { GanttDependencies, type GanttLink } from './timeline/gantt-dependencies';
export {
  type GanttDateLine,
  GanttDateLines,
  type GanttDragPart,
  GanttEditableBar,
  type GanttEditState,
} from './timeline/gantt-editing';
export {
  type MilestoneHealth,
  MilestoneTimeline,
  type TimelineMilestone,
} from './timeline/milestone-timeline';
export {
  createTimelineScale,
  type TimelineScale,
  type TimelineTick,
  type TimelineZoom,
} from './timeline/timeline-scale';
