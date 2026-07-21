/**
 * FANUS UI KIT — React komponent qatı
 * ===================================
 * Bütün panellər (admin / operator / psixoloq / pasiyent) YALNIZ buradan
 * istifadə edir. Səhifədə birbaşa `.fx-*` sinifi yazmaq və ya yeni panel-
 * spesifik CSS prefiksi (`.op-`, `.psy-`, `.pcli-` …) yaratmaq QADAĞANDIR.
 *
 * Stil mənbəyi: fanus-ui-kit/tokens.css + fanus-ui-kit/components.css
 * Canlı nümunə: /ui-kit
 *
 * Əsas qaydalar:
 *  1. Status rəngli rozet və ya rəngli nöqtə ilə göstərilmir — <Status> mətndir.
 *  2. Başlıqlar cümlə formasında; UPPERCASE "eyebrow" etiket yoxdur.
 *  3. Kartda dekorativ kölgə yoxdur — yalnız hairline sərhəd.
 *  4. Emoji yoxdur — bütün ikonlar inline SVG.
 *  5. Panel əməliyyat/API xətaları qlobal toast-a gedir, banner-ə yox.
 *  6. Tarixlər həmişə gg.aa.iiii (@/lib/datetime).
 */

export { Button, ButtonLink, TextButton, IconButton, buttonClass, linkClass } from "./Button";
export type { ButtonVariant } from "./Button";

export { Card, CardHead, CardBody, CardFoot, CardPad } from "./Card";
export type { CardTone } from "./Card";

export { PageHead, SectionTitle } from "./PageHead";

export { Stats, Stat, Trend } from "./Stat";

export { Status, PaymentStatus, PAYMENT_STATUS } from "./Status";
export type { StatusTone } from "./Status";

export { Row, Avatar } from "./Row";

export {
  Field,
  FieldRow,
  Input,
  Select,
  Textarea,
  Checkbox,
  Radio,
  Switch,
  SearchInput,
} from "./Form";

export { Tabs, Segmented, ToggleChip } from "./Tabs";
export type { TabItem } from "./Tabs";

export { TableWrap, Table, Th, Td, Pagination, TableSkeleton } from "./Table";

export { Modal, Drawer, DrawerSection, Menu, MenuItem, MenuDivider } from "./Overlay";
export type { ModalIconTone } from "./Overlay";

export { Banner, EmptyBlock, Progress, Stepper } from "./Feedback";
export type { BannerTone } from "./Feedback";
