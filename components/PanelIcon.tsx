// Paylaşılan ikon komponenti — bütün panel shell-ləri, sidebar və dashboard-lar
// bunu işlədir. Glyph-lər RƏSMİ `lucide-react` kolleksiyasındandır (əl ilə çəkilmiş
// SVG yox), amma `name`-əsaslı API saxlanılıb ki, çağırış yerləri və tipli nav
// (`icon: IconName`) dəyişməsin. Yeni ikon: aşağıdakı ICONS xəritəsinə bir sətir əlavə et.

import type { ComponentType, CSSProperties } from "react";
import {
  Home,
  Calendar,
  Users,
  User,
  MessageCircle,
  MessageSquare,
  Video,
  Package,
  BadgeCheck,
  Inbox,
  ShieldCheck,
  Star,
  Flag,
  Sparkles,
  Search,
  Bell,
  Plus,
  Check,
  Clock,
  BookOpen,
  NotebookText,
  SquarePen,
  LogOut,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  Settings,
  Headset,
  BarChart3,
  Megaphone,
  FileText,
  ClipboardList,
  Lock,
  Heart,
  Brain,
  HeartHandshake,
  Eye,
  Download,
  File,
  X,
  Menu,
} from "lucide-react";

export type IconName =
  | "home"
  | "calendar"
  | "users"
  | "user"
  | "chat"
  | "message"
  | "video"
  | "package"
  | "badge"
  | "inbox"
  | "shield"
  | "star"
  | "flag"
  | "sparkle"
  | "search"
  | "bell"
  | "plus"
  | "check"
  | "clock"
  | "book"
  | "journal"
  | "edit"
  | "logout"
  | "chevron"
  | "arrow-right"
  | "arrow-left"
  | "settings"
  | "headset"
  | "chart"
  | "megaphone"
  | "content"
  | "clipboard"
  | "lock"
  | "heart"
  | "brain"
  | "psychology"
  | "eye"
  | "download"
  | "file"
  | "x"
  | "menu";

/** Lucide ikon komponentinin qəbul etdiyi minimal prop dəsti. */
type IconCmp = ComponentType<{
  size?: number | string;
  strokeWidth?: number | string;
  color?: string;
  className?: string;
  style?: CSSProperties;
}>;

const ICONS: Record<IconName, IconCmp> = {
  home: Home,
  calendar: Calendar,
  users: Users,
  user: User,
  chat: MessageCircle,
  message: MessageSquare,
  video: Video,
  package: Package,
  badge: BadgeCheck,
  inbox: Inbox,
  shield: ShieldCheck,
  star: Star,
  flag: Flag,
  sparkle: Sparkles,
  search: Search,
  bell: Bell,
  plus: Plus,
  check: Check,
  clock: Clock,
  book: BookOpen,
  journal: NotebookText,
  edit: SquarePen,
  logout: LogOut,
  chevron: ChevronRight,
  "arrow-right": ArrowRight,
  "arrow-left": ArrowLeft,
  settings: Settings,
  headset: Headset,
  chart: BarChart3,
  megaphone: Megaphone,
  content: FileText,
  clipboard: ClipboardList,
  lock: Lock,
  heart: Heart,
  brain: Brain,
  psychology: HeartHandshake,
  eye: Eye,
  download: Download,
  file: File,
  x: X,
  menu: Menu,
};

interface Props {
  name: IconName;
  size?: number;
  stroke?: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
}

export default function PanelIcon({
  name,
  size = 16,
  stroke = 1.8,
  color = "currentColor",
  className,
  style,
}: Props) {
  const Cmp = ICONS[name];
  if (!Cmp) return null;
  return <Cmp size={size} strokeWidth={stroke} color={color} className={className} style={style} />;
}
