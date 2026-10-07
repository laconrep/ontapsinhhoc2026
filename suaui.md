# Ke hoach cai thien giao dien toan app (6 phien)

Muc tieu: app trong chuyen nghiep, dong nhat, de dung tren dien thoai 360px truoc, roi moi toi may tinh. Hoc sinh nhin la biet minh dang o buoc nao, bam trung nut, doc duoc chu, lam bai khong mat du lieu. Giao vien thao tac xoa/sua co xac nhan dep, bang khong tran, header khong tu bien mat. Dark mode dung mau thuong hieu. Popup mo phien trinh chieu khong de chu/khung nhay ra ngoai.

Trang thai: **phien 6 xong**. Day la nguon su that cho 6 phien. Phien sau CHI doc file nay + dung cac file duoc liet ke trong phien do. KHONG doc lai toan repo.

Nguon: ra soat code that (repo `ontapsinhhoc2026`). Moi diem moc ben duoi da doi chieu code **sau** cac commit live (`5097e11` va truoc do). Moi phien phai tu kiem tra bang mat tren man 360px va man desktop.

---

## 0. Prompt mo dau (copy dan cho AI phien code)

Ban la ky su Next.js/TypeScript. Doc toan bo `suaui.md`, lam DUNG phien duoc giao (khong lam truoc phien sau). Voi phien: (1) mo dung cac file liet ke, doi chieu code that, khong ap dung may moc neu ten bien/cau truc da khac; (2) sua dung pham vi phien; (3) chay `pnpm exec tsc --noEmit` va `pnpm lint`; (4) dien muc "Bao cao phien N" trong file nay; (5) commit + push. Khong them thu vien (da co: `next-themes`, `@dnd-kit`, `qrcode`, `sonner`, Radix/shadcn Dialog, Dropdown). Khong doi schema DB. Khong doi chu ky Server Action / API route. Khong doi `lib/worksheet-parser.ts`. Khong dam man san khau TV (`quiz-stage.tsx`, `stage-frame.tsx`, `adaptive-question.tsx`, `present-view.tsx`) tru khi phien noi ro. Doc muc 6 truoc khi sua.

Commit message: `wip(ui): phien N - <tom tat>`.

---

## 1. Quyet dinh da chot (khong hoi lai)

### 1.1 Pham vi

- Chi doi giao dien, nhan, hanh vi UX. Khong doi logic cham diem, khong doi du lieu luu server.
- Giu nguyen cu phap Word va pipeline import.
- Giu bo mau xanh la hien tai (`--primary` oklch 165). Chi chinh khi do tuong phan khong dat.

### 1.2 Ngon ngu va giong van

- Xung ho voi hoc sinh: **"ban"** (bo "em"). Thay dong loat trong `components/student/*`, `app/student/*`.
- Ten buoc hoc thong nhat 4 buoc: **1. Tu danh gia · 2. Dien khuyet · 3. Keo tha · 4. Kiem tra**. Thong bao/nhan o moi noi phai dung dung ten nay, khong ghi "Tab 2", "Tab 3".
- Ten thuong hieu: **EduSync**. Mot logo duy nhat.

### 1.3 Font va co chu

- Giu Inter (noi dung) + Bricolage Grotesque (`font-heading`). Ca hai da co subset `vietnamese`.
- `font-heading` chi dung tu `text-lg` tro len. Tieu de nho hon dung Inter `font-semibold`.
- Chu toi thieu **12px** (cam `text-[9px]`, `text-[10px]`, `text-[11px]`).
- Noi dung bai giang/the kien thuc: `text-base leading-relaxed` (16px). Chieu rong doc `max-w-prose` neu nam trong khung rong.
- So lieu/thong ke: `font-heading tabular-nums`.

### 1.4 Kich thuoc cham

- Vung cham toi thieu 44px tren dien thoai (`h-11`), thu nho xuong tren `md:`.
- Sua o `components/ui/button.tsx` va `components/ui/input.tsx` mot lan, khong them `min-h-11` rai rac tung cho (cac cho da co `min-h-11` van giu).
- De xuat: `default: h-10 md:h-9`, `sm: h-9 md:h-8`, `lg: h-11`, `icon: size-10 md:size-9`; Input `h-11 md:h-9`.

### 1.5 Mau va tuong phan

- Dat chuan WCAG AA (4.5:1 chu thuong). Do bang cong cu tuong phan, khong doan. Neu `--primary` + chu trang < 4.5:1 thi ha do sang `--primary` (khoang L 0.52–0.54).
- Khong chi dung mau de bao dung/sai: them icon ✓ / ✗ va chu.
- Muc "Chua biet" o tu danh gia: doi tu `destructive` (do) sang mau `accent` (vang/ho phach). "Biet" giu xanh.
- Dark mode: **tat ca** man phai dung bang mau xanh `.dark`, khong con bang xam.

### 1.6 Bo cuc

- Thang khoang cach 4/8px (`gap-2/3/4`, `p-4/6`).
- Trang giao vien: `mx-auto max-w-7xl px-4 md:px-6`.
- Trang hoc sinh: `max-w-md` tren dien thoai, `md:max-w-3xl` tren may tinh.
- Dung component dung chung thay vi lap lai: `Logo`, `ConfirmDialog`, `EmptyState`, `Stepper`, `StatCard`, `PageSkeleton` (muc 3).

### 1.8 Luong hoc tuan tu (thiet ke da chot, code hien tai CHUA dung — xem muc 2)

Thu tu bat buoc: **Tu danh gia (1) -> Dien khuyet (2) -> Keo tha (3) -> Kiem tra (4)**.

- Nop buoc 1: co kien thuc "Biet" -> sang buoc 2; khong co -> bo qua buoc 2, sang buoc 3.
- Buoc 2: het cau hoi **hoac** khong co cau hoi -> sang buoc 3.
- Buoc 3: lam het **hoac** khong co cau hoi (da nam vung het) -> sang buoc 4.
- **Buoc 1 bi khoa ngay khi nop (ca trong phien, khong cho doi sang lan tai trang).** Buoc 3, 4 chi mo khi da qua buoc truoc.
- **Chi khi nop xong buoc 4 (quiz co `completedAt` sau lan nop buoc 1 gan nhat)** thi moi hien nut "Lam lai tu dau" (xoa bai nop Tab 1, lam lai ca bai tu buoc 1). Truoc do khong hien nut nay. "Mo lai buoc 1" luon nghia la lam lai tu dau, khong bao gio la sua tung dap an.
- Tai lai trang giua chung: khong duoc nhay coc. Trang thai tinh tu DB (khong doi schema):
  - chua co `studentTab1Submissions` -> buoc 1
  - co submission, chua co `quizAttempts` nao co `startedAt` > `submittedAt` -> ve dau buoc 2 (hoac buoc 3 neu khong co "Biet"); chi mo toi buoc dang lam, buoc sau van khoa
  - co attempt `startedAt` > `submittedAt`, `completedAt` null -> buoc 4 (dang lam)
  - co attempt `completedAt` > `submittedAt` -> **hoan thanh**: hien nut "Lam lai tu dau" (Tab 1 van chi doc nhu cac buoc truoc)
- **Y chinh:** sau khi nop Tab 1 thi hoc sinh KHONG duoc mo lai Tab 1 de sua tu danh gia; bat buoc di tiep Tab 2 -> Tab 3 -> Tab 4. Viec khoa phai chan o **server** (khong chi an nut), vi tu danh gia quyet dinh cau hoi o Tab 2/3.
- **CHOT: chi di tien.** Cac buoc tuong tac 2 -> 3 -> 4 chi di len: khong quay lai buoc da qua, khong nhay toi buoc chua toi. Buoc da qua hien ✓ va khong bam duoc (`aria-disabled`).
- **CHOT: xem lai Tab 1 o che do chi doc.** Sau khi nop, hoc sinh co the mo "Xem lai kien thuc" bat cu luc nao (ke ca khi dang o buoc 2, 3, 4 va sau khi xong): hien noi dung tung kien thuc kem dau da chon (Biet / Chua biet), **khong co nut chon, khong luu gi**. Xem lai KHONG doi buoc hien tai va KHONG lam mat tien do dang lam o buoc 2/3/4 (khong duoc dung cach chuyen tab, vi se unmount buoc dang lam). Lam bang `Dialog` (`components/ui/dialog.tsx`, da co; khong co `sheet`/`drawer`), man dien thoai gan full chieu cao, noi dung cuon.
- Chi doc khac "mo Tab 1": khong co o tick, khong co nut Nop, khong goi `saveTab1Progress`/`submitTab1`.
- Cach "chuyen buoc" (tu dong co dem lui hay bam nut) la quyet dinh hien thi, khong doi luong tren. Luong tuan tu la bat buoc.

### 1.7 Khong lam

- Khong them thu vien, khong doi router, khong chuyen sang CSS-in-JS.
- Khong doi cach cham dung/sai. Khong doi API.
- Khong lam lai man TV/san khau (da xu ly rieng): `quiz-stage.tsx`, `stage-frame.tsx`, `adaptive-question.tsx`, `present-view.tsx`, `tv-stage-tour.tsx`, `tv-tour-illustrations.tsx`.
- Khong doi `lib/worksheet-parser.ts`, pipeline import, hien thi cong thuc (WMF/SVG).
- Khong doi thu tu/so luong cau live (`loadQuizQuestions` da lay het MC -> TF -> SA).

### 1.9 Cach xu ly phan lech so voi ban ke hoach cu

Khi code: mo file that, bo so dong cu neu lech. Khong coi lech la da xong phien.

- Title `app/layout.tsx` da la `EduSync — Ôn tập Sinh học thông minh` nhung **chua** co `template: "%s · EduSync"`, van con `generator: "v0.app"`. Phien 1 van phai lam metadata + ThemeProvider.
- `confirm` ket thuc phien: `components/live/teacher-console.tsx:405` (khong con dong 340). Van thay `confirm()`.
- `submitTab1` nam `app/actions/student-learn.ts` khoang 166–212. Doc ham, dung bam 166–208.
- Chu nho o `tv-stage-tour.tsx` / `tv-tour-illustrations.tsx`: **khong dam** (muc 1.7).
- Chu "EduSync" da co tren landing + shell HS + auth: phien 1 chi gop 3 icon logo (`Leaf` / `Sprout` / `BookOpen`) thanh 1 `Logo`, khong doi ten thuong hieu.

---

## 2. Diem moc code hien tai (khong doc lai file dai)

| Chu de | File : dong | Hien trang |
|---|---|---|
| Dark mode | `app/globals.css:86` | `.dark` dinh nghia bang mau xanh |
| Dark mode | `app/globals.css:121-122` | `@media (prefers-color-scheme: dark) { :root:not(.light) {...} }` ghi de bang mau **xam** (primary gan trang) |
| Dark mode | `app/layout.tsx` | **Khong co** `ThemeProvider`, khong `suppressHydrationWarning` → lop `.dark` khong bao gio duoc bat. Co `lang="vi"`. |
| Dark mode | `components/ui/sonner.tsx:3,8` | Goi `useTheme()` cua `next-themes` nhung khong co provider |
| Metadata | `app/layout.tsx:20,23` | `title: "EduSync — Ôn tập Sinh học thông minh"` (chuoi don, **chua** template); `generator: "v0.app"` |
| Landing | `app/page.tsx:5,16` | Render `<BuildStatus />` |
| Landing | `components/landing/site-header.tsx:23-24` | Link "Tien do" tro toi `#status` |
| Logo | landing `Leaf`; `auth-form.tsx:52` `Sprout`; `student-shell.tsx:29` `BookOpen` | 3 icon khac nhau; chu EduSync da co |
| Button | `components/ui/button.tsx:24,26,27` | default `h-8`, sm `h-7`, lg `h-9`, icon `size-8` |
| Input | `components/ui/input.tsx:12` | `h-8` |
| Chu nho | `class-stats-panel.tsx`, `quiz-progress.tsx`, `student-stats.tsx`, `teacher-console.tsx` | `text-[10px]`/`[11px]`/`[9px]` — **khong sua** chu nho o `tv-stage-tour` / `tv-tour-illustrations` |
| Thanh buoc hoc | `components/student/lesson-study.tsx:52-56,117,121` | Nhan tab: "Noi dung / Dien khuyet / Keo tha / Kiem tra"; tab `py-2 text-xs`; khoa `text-muted-foreground/50` |
| **Luong tuan tu** | `app/actions/student-learn.ts:166-212` `submitTab1` | Dat `isLocked: true` ngay khi nop (luu DB), **khong lien quan** viec xong buoc 4. Khong kiem tra da co submission — goi lai insert them hang |
| **Luong tuan tu** | `components/student/lesson-study.tsx:32-35` | `locked` khoi tao tu server; `unlocked = tab1Locked ? 4 : 1`; `current = tab1Locked ? 2 : 1`. Nop Tab 1 **trong cung phien** thi `locked` van `false` -> quay lai Tab 1 duoc; tai lai trang thi **mo het buoc 2, 3, 4** |
| **Luong tuan tu (server)** | `student-learn.ts:130-163` `saveTab1Progress` | Khong `assertLessonAccess`, khong kiem tra da nop Tab 1 |
| **Luong tuan tu** | `lesson-study.tsx:92-103` | Nut "Lam lai tu dau" hien ngay khi `locked`. Toast dong 45: "Em co the lam lai tu dau!" |
| **Luong tuan tu** | `lesson-study.tsx` + `tab4-quiz.tsx` | `<Tab4Quiz lessonId />` khong co callback hoan thanh |
| Tu chuyen buoc | `tab1-self-assess.tsx:95` | `setTimeout(() => onSubmitted(res.knownCount), 3000)` — khong clear khi unmount |
| Dien khuyet empty | `tab2-fill-in.tsx:42-45,52-61,70-73` | `.catch` coi loi = `empty`; dem lui 3s; van ghi "Tab 3" |
| Keo tha empty | `tab3-drag-drop.tsx:53-56,63-71,80-83` | `.catch` coi loi = `empty`; dem lui 3s; van ghi "Tab 4" |
| Keo tha | `tab3-drag-drop.tsx:171-181` | `setTimeout(() => grade(next), 300)` nam **trong** updater cua `setPlacement` |
| Keo tha | `tab3-drag-drop.tsx:313` | `id: \`chip-${chip}\`` → trung id neu 2 the cung chu |
| Kiem tra | `tab4-quiz.tsx` | Dap an chi nam trong `useState`; "Nop bai" khong xac nhan |
| Tu danh gia | `tab1-self-assess.tsx` | `pb-20` + thanh co dinh (doi chieu lai khi sua) |
| Khung HS | `components/student/student-shell.tsx:26,40` | `max-w-md` luon luon (ca desktop) |
| Header GV | `components/teacher/teacher-shell.tsx:49-65,91-93` | Header tu an sau 3000ms; `hidden ... md:block` |
| Tab GV | `components/teacher/class-tabs.tsx:33` | `useState` tab; khong `role=tablist/tab`; tab khong nam trong URL |
| `confirm()` | 7 cho: `lesson-detail.tsx:442,458,473`; `lesson-manager.tsx:122,135`; `question-editor.tsx:52`; `teacher-console.tsx:405` | Hop thoai goc trinh duyet |
| Bang thong ke | `components/teacher/class-stats-panel.tsx:169` | `min-w-[860px]` |
| Live HS | `components/live/student-quiz-view.tsx:73,85` | Goi `requestFullscreen?.()`; iPhone khong ho tro → bao sai fullscreen len TV |
| Auth | `components/auth/auth-form.tsx` | Khong hien/an mat khau, khong "Quen mat khau?" |
| Trang he thong | `app/` | Chi co `app/student/sessions/[id]/error.tsx`. Khong `loading.tsx`, `not-found.tsx`, `error.tsx` toan app |
| public | `public/` | Con `placeholder*.png/svg/jpg`; chua `manifest` |
| Build | `next.config.mjs` | `typescript.ignoreBuildErrors: true`; `serverActions` khai bao 2 lan (root + experimental); `monkeycode-ai.live` |
| Log | `app/`, `components/`, `lib/` | 11 dong `[v0]` (4 trong `live-quiz.ts`, 1 `student/page`, 1 `sessions/error`, 1 `learn/page`, 4 `teacher/classes/[id]/page`) |
| package | `package.json:2` | `"name": "my-project"` |
| gitignore | `.gitignore` | Chua `*.tsbuildinfo` |
| Theme | — | Khong co `components/theme-provider.tsx`, khong co `components/shared/` |
| **Popup mo phien** | xem muc 2.1 | Chu/khung nhay ra ngoai dialog |

Da xong ngoai ke hoach nay (khong lam lai):

- `components/live/adaptive-question.tsx`: kiem tra tran ngang tung o, chia khung `split` theo do dai thuc.
- `lib/extract-file.ts` `tagEquationImages`: gan `style="height:Xem;width:auto"` cho cong thuc WMF dung lai bang SVG.
- Live API dieu khien san khau (`GET/POST /api/sessions/[id]/live`), snapshot `error`, nut Bat dau khong khoa vi `total === 0`.
- `loadQuizQuestions` lay **het** cau MC/TF/SA, xep MC -> TF -> SA (khong con mau 18+4+6).

### 2.1 Loi popup "Cau hinh phien trinh chieu" (da xac nhan, chua sua)

File: `components/teacher/session-control.tsx` (Dialog dong 222–327) + `components/ui/dialog.tsx`.

Hien trang:

- `DialogContent` mac dinh (`dialog.tsx:57-58`): `sm:max-w-sm` (~384px), **khong** `overflow-hidden`, **khong** `max-h` viewport, **khong** cuon ca hop.
- Hang nut duoi (`session-control.tsx:317-325`): `flex justify-end gap-2`; Button `whitespace-nowrap` + icon Presentation + chu "Bat dau trinh chieu" → **tran ngang** ra ngoai goc bo.
- Tieu de khong chừa cho nut X (`absolute top-2 right-2`).
- 2 o mode `grid-cols-2` (`288-313`): chu phu dai khong cat, de doi khung.
- Form (danh sach bai `max-h-56` + thoi gian + 2 o mode + 2 nut) cao hon viewport ngan → dinh/day nhay khoi man.

Khong phai parser, khong phai cong thuc live.

Sua o **phien 5** (cung ConfirmDialog / dialog GV). Neu can sua `DialogContent` dung chung, chi them class an toan (`max-h`, overflow, padding nut X) — kiem tra cac dialog khac khong vo.

---

## 3. File se dam den (toan bo 6 phien)

Tao moi (component dung chung, dat o `components/shared/`):

- `logo.tsx` — logo + ten EduSync, 2 kich thuoc
- `confirm-dialog.tsx` — dua tren `components/ui/dialog.tsx`
- `empty-state.tsx` — icon + tieu de + mo ta + nut hanh dong
- `stepper.tsx` — thanh buoc hoc (phien 3)
- `stat-card.tsx` — the so lieu (so lon `font-heading tabular-nums`)
- `page-skeleton.tsx` — khung xuong tai trang

Sua: `app/globals.css`, `app/layout.tsx`, `app/page.tsx`, `components/landing/*`, `components/ui/button.tsx`, `components/ui/input.tsx`, `components/ui/dialog.tsx` (chi class an toan overflow neu can), `components/student/*`, `components/teacher/*` (gom `session-control.tsx`), `components/auth/*`, `components/live/student-quiz-view.tsx`, `components/live/teacher-console.tsx` (chi chu nho + confirm + cot phai), `next.config.mjs`.

Xoa: `components/landing/build-status.tsx`, `public/placeholder*`.

---

## Phien 1 — Nen tang: dark mode, thuong hieu, don rac

### Muc tieu

Dark mode dung mau xanh. Mot logo, mot title template. Landing khong con ghi chu noi bo.

### Viec lam

1. `app/globals.css`: **xoa het** khoi `@media (prefers-color-scheme: dark) { :root:not(.light) {...} }`. Giu `.dark`.
2. `app/layout.tsx`:
   - Them `ThemeProvider` (`next-themes`): `attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange`. Tao `components/theme-provider.tsx` ("use client") neu chua co.
   - `<html lang="vi" suppressHydrationWarning>`.
   - `metadata`: `title: { default: "EduSync — Ôn tập Sinh học thông minh", template: "%s · EduSync" }`, bo `generator`, them `openGraph` (title, description, `locale: "vi_VN"`, anh 1200x630 — dung chu thuong hieu neu chua co anh).
3. Them nut doi sang/toi (`ThemeToggle`, icon Sun/Moon) vao `site-header.tsx`, `student-shell.tsx`, `teacher-shell.tsx` (menu nguoi dung).
4. Tao `components/shared/logo.tsx` (Leaf + chu "EduSync", prop `size`). Thay 3 cho dang dung icon rieng (landing, auth-form Sprout, student-shell BookOpen). Moi trang them `export const metadata = { title: "..." }` (Dang nhap, Dang ky, Hoc sinh, Giao vien, …).
5. Xoa `components/landing/build-status.tsx`; go `<BuildStatus />` khoi `app/page.tsx`; go link "Tien do" trong `site-header.tsx`.
6. Thay muc tren bang section "Cach hoat dong" 3 buoc (Tham gia lop → On tap 4 buoc → Xem tien do). Dung `role-cards`/`feature-grid` co san neu du, khong them thu vien.
7. Don rac nhe: xoa 11 dong `[v0]`; xoa `public/placeholder*`; thay favicon bang logo (`icon.svg` + `apple-icon.png`); them `*.tsbuildinfo` vao `.gitignore`; doi `name` trong `package.json` tu `my-project` thanh `edusync`. **Khong commit** `tsconfig.tsbuildinfo`.

### File

`app/globals.css`, `app/layout.tsx`, `app/page.tsx`, `components/theme-provider.tsx` (moi), `components/shared/logo.tsx` (moi), `components/landing/site-header.tsx`, `components/landing/build-status.tsx` (xoa), `components/auth/*` (logo), `components/student/student-shell.tsx`, `components/teacher/teacher-shell.tsx`, `.gitignore`, `package.json`, `public/*`.

### Bao cao phien 1 (dien sau khi code)

- Da lam: xoa `@media (prefers-color-scheme: dark)` ghi de mau xam; them ThemeProvider + ThemeToggle (landing, HS, GV); metadata title template `%s · EduSync`, bo generator, them openGraph; Logo dung chung (Leaf + EduSync) thay Sprout/BookOpen; xoa BuildStatus khoi landing, them section Cach hoat dong 3 buoc; don 11 dong `[v0]`; doi package name `edusync`; gitignore `*.tsbuildinfo`; favicon `icon.svg` logo la.
- File da sua/tao: `app/globals.css`, `app/layout.tsx`, `app/page.tsx`, `app/sign-in/page.tsx`, `app/sign-up/page.tsx`, `app/onboarding/page.tsx`, `app/student/layout.tsx`, `app/teacher/layout.tsx`, `app/student/page.tsx`, `app/student/learn/page.tsx`, `app/student/sessions/[id]/error.tsx`, `app/teacher/classes/[id]/page.tsx`, `app/actions/live-quiz.ts`, `components/theme-provider.tsx` (moi), `components/shared/logo.tsx` (moi), `components/shared/theme-toggle.tsx` (moi), `components/landing/how-it-works.tsx` (moi), `components/landing/site-header.tsx`, `components/auth/auth-form.tsx`, `components/student/student-shell.tsx`, `components/teacher/teacher-shell.tsx`, `.gitignore`, `package.json`, `public/icon.svg`. `components/landing/build-status.tsx` va `public/placeholder*` van con tren disk (khong xoa file).
- Viec chua lam / de phien sau: kich thuoc nut/o, chu nho, tuong phan, giong van (phien 2); luong tuan tu HS (phien 3); keo tha/quiz/live (phien 4). Khong xoa `build-status.tsx` / placeholder.
- Commit: `3ce014f` `wip(ui): phien 1 - dark mode, logo, don rac`

---

## Phien 2 — Design tokens: kich thuoc, chu, mau

### Muc tieu

Nut/o nhap du lon de cham; chu khong qua nho; tuong phan dat chuan; giong van thong nhat.

### Viec lam

1. `components/ui/button.tsx`, `components/ui/input.tsx`: doi kich thuoc theo muc 1.4. Chay thu trang dang nhap tren 360px: o email, mat khau, nut deu cao >= 40px. Sau do ra soat cho da ep `h-8`/`h-7` (dashboard, bang, the lop, **console live**).
2. Chu nho: thay cho `text-[9|10|11px]` bang `text-xs` (12px) o `class-stats-panel`, `quiz-progress`, `student-stats`, `teacher-console`. **Khong sua** `tv-stage-tour` / `tv-tour-illustrations`. Neu bang/the bi chat, giam nhan hoac cho xuong dong thay vi thu chu.
3. `font-heading`: ra soat (`grep font-heading`), bo o cho tieu de `text-sm`/`text-base`, doi sang `font-semibold`. Khong dam tieu de lon tren san khau TV.
4. So lieu: `student-stats.tsx`, `quiz-progress.tsx`, dashboard giao vien → `font-heading tabular-nums`. Gom thanh `StatCard` (`components/shared/stat-card.tsx`) va dung o 3 cho nay.
5. Noi dung bai giang: the kien thuc / `kp-render` / Tab 1 → `text-base leading-relaxed`. Khung rong → `max-w-prose`.
6. `body`: them `text-rendering: optimizeLegibility` (da co `antialiased`).
7. Tuong phan: do `--primary` voi chu trang (nut, tab dang chon, badge). Neu < 4.5:1 thi ha sang. Do ca `--muted-foreground` tren `--card`/`--background` (sang va toi). Ghi ket qua do vao bao cao.
8. "Chua biet" (Tab 1): doi sang `accent`; them icon ✓/✗ cho trang thai dung/sai o Tab 2, 3, 4 (khong chi doi mau).
9. Giong van: doi "em" → "ban" trong `components/student/*`, `app/student/*`, thong bao `toast` (gom `lesson-study.tsx:45`).

### File

`components/ui/button.tsx`, `components/ui/input.tsx`, `app/globals.css`, `components/shared/stat-card.tsx` (moi), `components/student/{student-stats,quiz-progress,tab1-self-assess,tab2-fill-in,tab3-drag-drop,tab4-quiz,lesson-study}.tsx`, `components/teacher/{class-stats-panel,teacher-console}.tsx`.

### Bao cao phien 2 (dien sau khi code)

- Da lam: Button `h-10 md:h-9` / sm `h-9 md:h-8` / lg `h-11` / icon `size-10 md:size-9`; Input `h-11 md:h-9`; chu `text-[9|10|11px]` o stats/progress/console doi `text-xs` (giu TV tour); `font-heading` bo o tieu de sm/base trong pham vi phien; StatCard dung o student-stats, quiz-progress, dashboard GV; KP/tab 1-3 `text-base leading-relaxed max-w-prose`; body `text-rendering: optimizeLegibility`; "Chua biet" sang accent; icon ✓/✗ o tab 2/3/4; "em" → "ban" o student toast + quiz-progress + app/student sessions.
- Ket qua do tuong phan: light `--primary` L 0.58 + chu trang = 3.93:1 (chua dat AA) → ha sang L 0.53 = 4.78:1. Light muted-fg/bg 5.31, muted-fg/card 5.45. Dark primary/fg 7.98, muted-fg/bg 7.48, muted-fg/card 6.82. Dat WCAG AA.
- File da sua/tao: `components/ui/button.tsx`, `components/ui/input.tsx`, `app/globals.css`, `components/shared/stat-card.tsx` (moi), `components/student/{student-stats,quiz-progress,tab1-self-assess,tab2-fill-in,tab3-drag-drop,tab4-quiz,lesson-study}.tsx`, `components/teacher/class-stats-panel.tsx`, `components/live/teacher-console.tsx`, `app/teacher/page.tsx`, `app/student/sessions/[id]/page.tsx`.
- Viec chua lam / de phien sau: luong tuan tu + stepper (phien 3); keo tha tap-to-place / quiz localStorage / live iPhone (phien 4). `font-heading text-sm` con o assigned-work / student home / teacher-shell (ngoai file liet ke).
- Commit: `bc854ca` `wip(ui): phien 2 - kich thuoc, chu, mau, giong van`

---

## Phien 3 — Hoc sinh: thanh buoc, tab 1/2, khung man hinh

### Muc tieu

Hoc sinh biet dang o buoc may/4, khong bi tu chuyen bat ngo, dung duoc tren may tinh.

### Viec lam

0. **Luong tuan tu (muc 1.8) — lam truoc cac viec ben duoi.**

   - Server (`app/actions/student-learn.ts`, khong doi schema/chu ky cac action khac): them vao ket qua `getLessonForStudy` truong `stage: "tab1" | "tab2" | "tab3" | "tab4" | "done"` va `skippedTab2: boolean`, tinh theo muc 1.8 tu `studentTab1Submissions.submittedAt`, `quizAttempts.startedAt/completedAt`, va (de chon tab2 hay tab3) so luong "Biet" trong `studentProgress`. Giu `tab1Locked` cho tuong thich den khi client doi xong, roi xoa.
   - **Server chan sua Tab 1 sau khi nop:** `saveTab1Progress` va `submitTab1` phai (1) `assertLessonAccess`, (2) throw `"Ban da nop buoc Tu danh gia"` neu da co `studentTab1Submissions` (voi `saveTab1Progress`: lay `lessonId` tu `kpId` va kiem tra KP thuoc bai hoc sinh duoc truy cap). Khong doi chu ky. Client: bat loi → toast + `router.refresh()`.
   - Server: `resetLessonProgress` chi chay khi `stage === "done"`; neu khong thi throw "Hay hoan thanh bai kiem tra truoc".
   - `lesson-study.tsx`: thay `useState(tab1Locked)` / `unlocked` / `current` bang trang thai suy ra tu `stage`. Khi nop Tab 1: khoa ngay (khong cho tai lai trang), `advanceTo(known > 0 ? 2 : 3)`. `goTo(n)` chi nhan khi `n === current`. Tab 1 khong co `goTo`; thay bang nut "Xem lai kien thuc" mo `Dialog` chi doc (khong dong `current`).
   - Tao `components/student/tab1-readonly.tsx`: nhan `knowledgePoints` + `assessments`, dung lai `KPCard` voi prop moi `readOnly`. `Tab1SelfAssess` doi `onSubmitted(knownCount)` thanh `onSubmitted(knownCount, assessments)` de dung ngay trong phien. Khi tai lai lay tu `savedAssessments`.
   - `tab4-quiz.tsx`: them prop `onFinished?: () => void`, goi sau khi `submitQuiz` thanh cong (sau `setPhase("result")`) va khi `getLatestQuizResult` tra ket qua lan lam nay. `LessonStudy` nhan -> `stage = "done"` -> hien nut "Lam lai tu dau".
   - Nut "Lam lai tu dau" chi hien khi `stage === "done"`. Doi toast "Em co the..." -> "Ban co the...".
   - Mac dinh: tai lai giua buoc 2/3 thi **lam lai tu dau buoc 2 (hoac 3)**; khong mo buoc 4 truoc. Khong dung localStorage nho buoc (tru khi user chot sau).

1. Tao `components/shared/stepper.tsx`: 4 vong tron so. Trang thai: xong (✓, `bg-primary`), hien tai (vien `ring`), khoa (icon khoa, `text-muted-foreground`, **bo `/50`**), bo qua (buoc 2/3 khong co cau: gach ngang + "Bo qua"). **Buoc 1 sau khi nop hien ✓ + nhan "Xem lai"; cham vao mo Dialog chi doc.** Buoc da qua (2, 3) hien ✓ khong bam duoc; buoc chua toi hien khoa. Nhan duoi vong: ten buoc muc 1.2. `aria-current="step"`, vung cham >= 44px. Cuon ngang neu hep.
2. `lesson-study.tsx`: thay thanh tab `py-2 text-xs` bang `Stepper`. Doi thong bao khoa thanh ten buoc ("Hoan thanh *Tu danh gia* de mo *Dien khuyet*"). Doi nhan "Noi dung" thanh "Tu danh gia".
3. Tu chuyen buoc:
   - `tab1-self-assess.tsx:95`: doi thanh nut "Tiep tuc sang <ten buoc>"; neu giu tu chuyen thi nut "Chuyen ngay" + clear timeout + keo dai >= 6s.
   - `tab2-fill-in.tsx:52-61` va `tab3-drag-drop.tsx:62-71`: dem lui 3s **chi khi `empty`**, them nut "Chuyen ngay".
   - **Loi that:** `.catch` o tab 2 (dong 42-45) va tab 3 (dong 53-56) coi loi mang = empty. Tach `error` ("Khong tai duoc cau hoi" + "Thu lai"), khong coi la `empty`.
   - Cau cuoi dung o tab 2/3: them man ket qua ngan + nut "Tiep tuc" (khong `onComplete()` ngay sau toast).
4. Tab 2: Enter chuyen o ke tiep (da co `inputsRef`), o cuoi Enter = "Kiem tra". Cham sai lan 1: chi bao o sai + goi y chu cai dau; sai lan 2 moi hien dap an.
5. `student-shell.tsx`: `max-w-md md:max-w-3xl`. Tu `lg:` thanh nav sidebar trai (giong GV) thay vi thanh day man hinh.
6. `tab1-self-assess.tsx`: sua `pb-20` thanh du cho thanh tien do co dinh (`pb-40`) hoac `sticky`. The cuoi khong bi che khi hien nut "Hoan thanh".
7. Trang chu HS: o nhap ma lop len dau khi chua co lop, ghi "Ma gom 6 ky tu do giao vien cap". The "Lop cua toi" cho bam duoc.
8. Man gioi thieu kiem tra: ghi "N cau · khoang M phut".

### File

`components/shared/stepper.tsx` (moi), `components/student/{lesson-study,tab1-self-assess,tab1-readonly,tab2-fill-in,tab4-quiz,student-shell,student-nav,join-class-card,assigned-work}.tsx`, `app/actions/student-learn.ts`, `app/student/page.tsx`.

### Bao cao phien 3 (dien sau khi code)

- Da lam: luong tuan tu muc 1.8 — `getLessonForStudy` tra `stage`/`skippedTab2`/`quizQuestionCount`; `saveTab1Progress`/`submitTab1` chan sau nop (`TAB1_LOCKED_MSG` + assertLessonAccess); `resetLessonProgress` chi khi `stage === "done"`; `getLatestQuizResult` chi lay attempt sau lan nop Tab 1. Client: Stepper 4 buoc (✓ / ring / khoa / Bo qua / Xem lai); chi di tien; Dialog Tab 1 chi doc; nop Tab 1 -> nut "Tiep tuc sang ..."; Tab 2/3 tach error vs empty, dem lui 3s + "Chuyen ngay", man ket qua + "Tiep tuc"; Tab 2 Enter/gợi ý 2 lần/"Kiem tra"; Tab4 `onFinished` + intro "N cau · khoang M phut"; nut "Lam lai tu dau" chi khi done; student-shell `max-w-md md:max-w-3xl` + sidebar `lg:`; Tab 1 `pb-40` + thanh tien do; home: ma lop len dau khi chua co lop, the lop bam duoc.
- File da sua/tao: `components/shared/stepper.tsx` (moi), `components/student/{lesson-study,tab1-self-assess,tab1-readonly,tab2-fill-in,tab3-drag-drop,tab4-quiz,student-shell,student-nav,join-class-card}.tsx`, `app/actions/student-learn.ts`, `app/student/page.tsx`, `app/student/learn/[id]/page.tsx`.
- Viec chua lam / de phien sau: keo tha tap-to-place / id chip / nut Kiem tra / KeyboardSensor (phien 4); quiz localStorage + thanh so cau + ConfirmDialog nop (phien 4); live iPhone fullscreen (phien 4). `tab1Locked` con trong `getLessonForStudy` (tuong thich). `pnpm lint` khong chay duoc (thieu eslint.config).
- Commit: `070ba85` `wip(ui): phien 3 - luong tuan tu, stepper, khung HS`

---

## Phien 4 — Hoc sinh: keo tha, kiem tra, phien live

### Muc tieu

Het loi hanh vi o keo tha/kiem tra, khong mat bai, phien live khong bao sai tren iPhone.

### Viec lam

1. `tab3-drag-drop.tsx`:
   - `handleDragEnd`: tinh `next` **ngoai** updater, roi `setPlacement(next)`. Khong goi `setTimeout`/`grade` trong updater.
   - Bo tu cham sau 300ms. Hien nut **"Kiem tra"** khi dien du o (bam moi cham).
   - `id: \`chip-${i}-${chip}\``.
   - Them che do **cham the → cham o trong** (tap-to-place); giu keo tha. Them dong huong dan ngan.
   - `DropZone`: doi `<span onClick>` thanh `<button type="button">` (`aria-label`, focus ring). Them `KeyboardSensor` (giong `lesson-detail.tsx`). Nut "Dat lai".
   - O dung/sai: them icon ✓/✗ ngoai mau.
2. `tab4-quiz.tsx`:
   - Luu dap an dang lam vao `localStorage` (khoa `userId+lessonId`, giong Tab 1), khoi phuc khi mo lai, xoa khi nop.
   - Thanh so cau (1 2 3 …; da lam / chua lam / dang xem). Cho bo qua cau (khong khoa "Cau tiep theo").
   - Nut "Nop bai": neu con cau trong → `ConfirmDialog` "Con N cau chua lam, nop luon?" (dung component phien 5, hoac tao truoc neu phien 5 chua xong).
   - Man ket qua (luc nay `stage = "done"`) them nut "On lai cac diem kien thuc lam sai" -> ve buoc 1 qua "Lam lai tu dau" (co `ConfirmDialog`). **Khong** ve buoc 1 khi chua nop xong bai kiem tra.
3. `components/live/student-quiz-view.tsx`: neu `!document.documentElement.requestFullscreen` (iPhone Safari) thi **khong bao** trang thai toan man hinh len GV/TV; man cho doi giong "goi y" thay vi bat buoc. Khong doi giao thuc bao cao khi trinh duyet co ho tro.
4. `components/live/student-question-layout.tsx`: ra soat chu nho / vung cham 44px. **Khong doi** logic chia 65/35 o man dien thoai.

### File

`components/student/{tab3-drag-drop,tab4-quiz}.tsx`, `components/live/student-quiz-view.tsx`, `components/live/student-question-layout.tsx`.

### Bao cao phien 4 (dien sau khi code)

- Da lam: Tab 3 — tinh placement ngoai updater, bo tu cham 300ms, nut Kiem tra khi dien du, chip id `chip-${i}-${chip}`, tap-to-place (cham the → cham o), DropZone thanh button + KeyboardSensor, nut Dat lai, icon ✓/✗. Tab 4 — localStorage `edusync:tab4:{userId}:{lessonId}` (khoi phuc khi mo, xoa khi nop/co ket qua), thanh so cau, cho bo qua (khong khoa Cau tiep theo), ConfirmDialog nop khi con cau trong, man ket qua nut "On lai cac diem kien thuc lam sai" → ConfirmDialog lam lai tu dau. Live iPhone: khong bao fullscreen neu `!requestFullscreen`; man cho doi thanh goi y. student-quiz-view TF/MC min-h-11.
- File da sua/tao: `components/shared/confirm-dialog.tsx` (moi, dung truoc phien 5), `components/student/{tab3-drag-drop,tab4-quiz,lesson-study}.tsx`, `app/student/learn/[id]/page.tsx`, `components/live/student-quiz-view.tsx`.
- Viec chua lam / de phien sau: ConfirmDialog thay 7 `confirm()` GV (phien 5); header/tab/bang GV + popup phien (phien 5). student-question-layout khong doi logic 65/35. `pnpm lint` khong chay duoc (thieu eslint.config).
- Commit: `2dff359` `wip(ui): phien 4 - keo tha, quiz localStorage, live iPhone`

---

## Phien 5 — Giao vien: header, tab, bang, xac nhan, popup phien

### Muc tieu

Header khong bien mat, tab co aria va luu URL, bang khong buoc cuon ngang kho chiu, xoa co hop thoai dep, popup mo phien khong tran.

### Viec lam

1. Tao `components/shared/confirm-dialog.tsx` (props: `open`, `title`, `description`, `confirmLabel`, `destructive`, `onConfirm`, `pending`). Thay **7** `confirm()` (muc 2). Nut xac nhan ghi ro hanh dong ("Xoa bai giang"), mau `destructive`.
2. `teacher-shell.tsx`: header **co dinh**, co logo + `DropdownMenu` nguoi dung (Doi giao dien, Dang xuat). Bo `scheduleHide` o trang thuong; chi giu tu an o trang trinh chieu neu co. Hien tren ca dien thoai (`hidden md:block` → luon hien). Noi dung `mx-auto max-w-7xl px-4 md:px-6`.
3. `class-tabs.tsx`: them `role="tablist"`/`role="tab"`/`aria-selected`/focus ring; luu tab trong URL (`?tab=stats`).
4. `class-stats-panel.tsx`: tren man nho co dinh cot ten HS (`sticky left-0 bg-card`), cot con lai cuon; hoac the duoi `md:`. Bo `min-w-[860px]` cung neu doi duoc.
5. Dashboard (`app/teacher/page.tsx`): the so lieu thanh link, doi icon trung (`Users` dung 2 lan), nut "Quan ly lop hoc" bo dau `+` hoac doi "Tao lop moi". Loi chao: "Xin chao, {ten}".
6. `lesson-detail.tsx`: tren man nho cho trang cuon binh thuong thay vi chia doi chieu cao co dinh (`grid-rows-2` + `h-[calc(100svh-…)]`).
7. `teacher-console.tsx` (chi cot phai): rong khoang 200px, chu >= 12px, khong cat ten HS qua som. Man cho tren TV: them ten lop + huong dan tham gia / ma QR (`qrcode` da co) — **chi neu** phan nay thuoc `teacher-console`, khong dam `present-view.tsx`.
8. `EmptyState` cho: lop chua co HS, bai chua co cau hoi, chua co bai giao.
9. **Popup cau hinh phien (muc 2.1) — bat buoc trong phien nay:**
   - `session-control.tsx`: truyen `className` vao `DialogContent` (hoac sua dung chung `dialog.tsx`) de hop `max-h-[min(90dvh,640px)] overflow-hidden`, than cuon (`min-h-0 overflow-y-auto`), footer nut **khong** `whitespace-nowrap` / cho phep xuong dong (`flex-wrap`, `sm:max-w-md` neu can).
   - Nut chinh: cat ngan hoac wrap ("Bat dau chieu" / "Bat dau trinh chieu" xuong 2 dong), khong de icon+chu tran khoi `rounded-xl`.
   - Tieu de: `pr-10` tranh de nut X.
   - 2 o mode: `min-w-0`, chu phu `text-pretty` hoac an bot tren man hep.
   - Kiem tra 360px va desktop: khong chu, khong nut, khong vien nhay ra ngoai overlay.

### File

`components/shared/{confirm-dialog,empty-state}.tsx` (moi), `components/ui/dialog.tsx` (chi neu them class an toan), `components/teacher/{teacher-shell,class-tabs,class-stats-panel,lesson-detail,lesson-manager,question-editor,class-detail,session-control}.tsx`, `app/teacher/page.tsx`, `components/live/teacher-console.tsx`.

### Bao cao phien 5 (dien sau khi code)

- Da lam:
  - Tao ConfirmDialog; thay 7 `confirm()` (lesson-detail x3, lesson-manager x2, question-editor x1, teacher-console x1). Nut xac nhan ghi ro hanh dong, variant destructive.
  - teacher-shell: header sticky, logo EduSync, DropdownMenu (doi giao dien + dang xuat truc tiep, khong long SignOutButton). An header o live console / present TV.
  - class-tabs: role tablist/tab, aria-selected, focus ring; luu `?tab=` tren URL; Suspense o page lop.
  - class-stats-panel: cot ten HS sticky + bg theo at-risk; bo min-w 860px cung; EmptyState khi chua co HS.
  - Dashboard: the so lieu la link, icon khong trung, nut "Tao lop moi", loi chao "Xin chao, {ten}".
  - lesson-detail mobile: bo h svh + grid-rows-2; cuon binh thuong tren man nho.
  - teacher-console cot phai ~200px, chu >= 12px, khong cat ten HS bang font 9–11px.
  - EmptyState: lop chua HS, chua giao bai, chua cau hoi, chua chuong/bai giang, chua diem KT.
  - Popup cau hinh phien: max-h/overflow, than cuon, footer wrap, nut "Bat dau chieu", 2 o mode min-w-0 + text-pretty; DialogHeader pr-10 dung chung.
- File da sua/tao:
  - Tao: `components/shared/confirm-dialog.tsx`, `components/shared/empty-state.tsx`
  - Sua: `components/ui/dialog.tsx`, `components/teacher/{teacher-shell,class-tabs,class-stats-panel,lesson-detail,lesson-manager,question-editor,class-detail,class-assignments,session-control}.tsx`, `app/teacher/page.tsx`, `app/teacher/classes/[id]/page.tsx`, `components/live/teacher-console.tsx`
- Viec chua lam / de phien sau:
  - `useTheme()` can ThemeProvider (phien 1); hien chi doi theme local neu provider chua boc.
  - Man cho tren TV (ten lop + QR) nam o quiz-stage/present-view — khong sua (phien 5 chi cot phai teacher-console).
  - `pnpm lint` that bai vi chua cai `eslint` (khong them thu vien).
- Commit: `b00bbd9`

---

## Phien 6 — Dang nhap/dang ky, trang he thong, chat luong, chot

### Muc tieu

Luong tai khoan day du; khong con man hinh trang; app cai duoc len dien thoai; build bat loi kieu.

### Viec lam

1. `components/auth/auth-form.tsx`: nut hien/an mat khau, "Quen mat khau?", loi hien ngay duoi o nhap (`aria-invalid` + `aria-describedby`), nut co trang thai dang gui. Dang ky: toi thieu 8 ky tu, goi y do manh. Kiem tra luong reset (grep `app/`); neu chua → them trang yeu cau + trang dat lai theo nha cung cap auth **dang dung**, **khong doi schema** (neu bat buoc doi → ghi muc 6, dung lai, bao nguoi dung).
2. Vai tro: kiem tra `/onboarding` co hoi lai vai tro da chon luc dang ky khong; neu thua thi bo mot. Ghi ro tren form neu "Giao vien" can duoc duyet (chi them chu neu da co co che duyet).
3. Trang he thong: `app/loading.tsx`, `app/student/loading.tsx`, `app/teacher/loading.tsx` (`PageSkeleton`), `app/not-found.tsx`, `app/error.tsx` (tieng Viet, nut "Ve trang chu"/"Thu lai").
4. `StudentShell`: link "Bo qua toi noi dung". `aria-label` cho moi nut chi co icon (`grep size="icon"`).
5. Footer (`site-footer.tsx`): lien he, dieu khoan, chinh sach (`/terms`, `/privacy`; noi dung ngan, ban nhap can nguoi so huu duyet — **khong tu bia dieu khoan phap ly**).
6. PWA: `app/manifest.ts` (ten, mau, icon 192/512), them icon vao `public/`.
7. Mui gio: `lib/format-date.ts` voi `timeZone: "Asia/Ho_Chi_Minh"`; thay `toLocaleString("vi-VN")`; thong nhat "Qua han".
8. Chat luong: `pnpm exec tsc --noEmit`, sua loi; **bo** `typescript.ignoreBuildErrors` trong `next.config.mjs`. Don `next.config.mjs`: gop `serverActions` ve mot cho (dung khoa cua Next dang cai). **Giu** `allowedDevOrigins` / `monkeycode-ai.live` neu moi truong preview van can. Chuyen `*.md` ghi chu + 2 file `.docx` vao `docs/` (giu `BAI 1 - GENE…docx` o cho test neu co tham chieu). **Khong chuyen** `suaui.md` ra khoi goc repo.
9. `question-stem.tsx` dung `dangerouslySetInnerHTML`: xac nhan HTML da lam sach truoc khi luu. Neu chua, ghi muc 6 + bao nguoi dung, khong tu doi pipeline import.

### File

`components/auth/*`, `app/{loading,not-found,error,manifest}.ts(x)`, `app/{student,teacher}/loading.tsx`, `app/{terms,privacy}/page.tsx`, `components/landing/site-footer.tsx`, `components/student/student-shell.tsx`, `lib/format-date.ts` (moi), `next.config.mjs`, `docs/` (chuyen file).

### Bao cao phien 6 (dien sau khi code)

- Da lam:
  - Auth: hien/an mat khau, "Quen mat khau?", loi ngay duoi o (`aria-invalid`/`aria-describedby`), nut dang gui; dang ky min 8 ky tu + goi y do manh.
  - Reset: `/forgot-password` + `/reset-password` qua better-auth `requestPasswordReset`/`resetPassword`. Bang `verification` da co, khong doi schema. `sendResetPassword` chua SMTP — bao loi can cau hinh email (dung lai, khong them env).
  - Onboarding: khong hoi lai vai tro da chon luc dang ky; khong co co che duyet GV nen khong them chu.
  - Trang he thong: `loading` (root/HS/GV + PageSkeleton), `not-found`, `error` (tieng Viet, Ve trang chu / Thu lai).
  - StudentShell: "Bo qua toi noi dung". Nut icon da co `aria-label` (theme-toggle, class-detail, session-control).
  - Footer: lien he + Dieu khoan + Chinh sach (`/terms`, `/privacy` ban nhap can duyet).
  - PWA: `app/manifest.ts` + `public/icon-192.png` / `icon-512.png`.
  - `lib/format-date.ts` `Asia/Ho_Chi_Minh`; thay `toLocaleString("vi-VN")`; nhan "Quá hạn" da thong nhat.
  - Bo `typescript.ignoreBuildErrors`; gop `serverActions` vao `experimental` (Next 16). Giu `allowedDevOrigins` / monkeycode-ai.live.
  - Chuyen `*.md` ghi chu + `Ke-hoach-sua-loi-hien-thi-cau-hoi.docx` vao `docs/`. Giu `suaui.md` va `BAI 1 - GENE…docx` o goc.
  - `question-stem.tsx`: HTML **chua** lam sach luc luu; chi sanitize luc render. Khong doi pipeline import.
- Loi tsc da sua / con lai: `npx tsc --noEmit` sach. Khong sua logic. `pnpm lint` khong chay (thieu eslint, khong them thu vien). `pnpm` corepack loi — dung `npx tsc`.
- File da sua/tao:
  - Tao: `components/shared/page-skeleton.tsx`, `lib/format-date.ts`, `app/{loading,not-found,error,manifest}.ts(x)`, `app/{student,teacher}/loading.tsx`, `app/{forgot-password,reset-password,terms,privacy}/page.tsx`, `components/auth/{forgot-password-form,reset-password-form}.tsx`, `public/icon-192.png`, `public/icon-512.png`, `docs/`
  - Sua: `components/auth/{auth-form,onboarding-form}.tsx`, `lib/auth.ts`, `components/landing/site-footer.tsx`, `components/student/{student-shell,assigned-work}.tsx`, `components/teacher/class-assignments.tsx`, `lib/class-stats-ui.ts`, `next.config.mjs`, `suaui.md`
- Viec chua lam:
  - SMTP/env gui mail reset (can nguoi dung cau hinh).
  - Sanitize HTML luc luu import (chi sanitize luc render).
  - `pnpm lint` (thieu eslint).
- Commit:

---

## 4. Tieu chi hoan thanh

1. Mo app bang che do toi he thong: van thay mau xanh, nut doi sang/toi hoat dong, Sonner doi theo.
2. Landing khong con chu "B1/B2/B3" hay "Trang thai du an". Mot logo, tieu de tab dang "… · EduSync".
3. Trang dang nhap tren 360px: o nhap va nut cao >= 40px, co hien/an mat khau + "Quen mat khau?".
4. Khong con `text-[9|10|11px]` o UI chinh (tru TV tour). Noi dung bai giang 16px.
5. Thanh buoc hoc 4 vong so; ten buoc khop thong bao. Chi di tien. "Xem lai kien thuc" mo duoc o moi buoc, chi doc, dong lai van o dung buoc/cau. Goi `saveTab1Progress`/`submitTab1` sau khi da nop → bi tu choi. Luong tuan tu dung muc 1.8.
6. Keo tha: cham-the-cham-o duoc; ban phim duoc; khong cham tu dong; the trung chu khong nham.
7. Tab 4: tai lai giua chung van con dap an; nop bai co xac nhan khi con cau trong.
8. iPhone vao phien live: man TV khong hien "da thoat toan man hinh" cho HS do.
9. Header giao vien luon hien; khong con `confirm()` goc (grep ra 0).
10. Bang thong ke lop dung duoc tren 360px.
11. Popup "Cau hinh phien trinh chieu" tren 360px va desktop: khong chu/khung/nut nhay ra ngoai.
12. Co `loading.tsx`, `not-found.tsx`, `error.tsx`. App cai duoc len man hinh chinh.
13. `pnpm exec tsc --noEmit` sach, `ignoreBuildErrors` da bo, `pnpm lint` khong loi moi.

---

## 5. Luu y / rui ro (doc truoc khi sua)

- **Bo `ignoreBuildErrors` co the lo nhieu loi kieu.** Lam o phien 6; neu qua nhieu thi tach, khong cham logic.
- **Doi Button/Input toan cuc** co the vo cho da ep chieu cao. Sau phien 2 ra soat dashboard, bang, the lop, **console live**.
- **Nut/o lon hon tren dien thoai**: man san khau/console GV dung chung `components/ui` — khong de vo bo cuc cot dieu khien.
- **Luong tuan tu la thay doi hanh vi.** Test: (a) co "Biet" -> 2 -> 3 -> 4; (b) khong "Biet" -> 3 -> 4; (c) tab 2 rong; (d) tab 3 rong; (e) tai lai o tung buoc; (f) lam xong roi "Lam lai tu dau"; (g) HS cu da co `isLocked: true`.
- **Chi di tien + chi doc:** khong chuyen tab de xem lai. Neu Dialog chi doc gay giat iPhone, kiem tra overscroll cua `dialog.tsx`. DB khong ghi buoc 2/3 da xong — khong chan duoc `startQuiz` bang script; chi chan UI + khi tai lai. Chan that can doi schema — de phien khac.
- **Du lieu cu:** HS da nop Tab 1 truoc khi sua co the khong co quiz attempt -> vao buoc 2 (hoac 3).
- **localStorage Tab 4:** khoa `userId` + `lessonId`. Xoa khi nop.
- **Live iPhone:** can thu tren iPhone that.
- **Quen mat khau:** neu can SMTP/env moi thi dung lai, bao nguoi dung.
- **Dieu khoan/chinh sach:** khung + "can duyet", khong bia phap ly.
- **Muc 1.5** phai do thuc te.
- **Man TV/san khau:** chi sua `teacher-console` (cot phai + confirm + chu nho) va `session-control` (popup). Khong dam parser/cong thuc.

---

## 6. Quy trinh bat buoc sau moi phien

1. Cap nhat muc "Bao cao phien N" trong **file nay** (da lam, file, viec chua lam, hash commit).
2. Chay `pnpm exec tsc --noEmit` va `pnpm lint`. Kiem tra bang mat tren 360px va desktop, ca sang lan toi.
3. Commit + push. Message: `wip(ui): phien N - <tom tat>`. Khong commit `tsconfig.tsbuildinfo`.
4. Phien sau chi can doc file nay, khong doc lai toan repo.

Mau cap nhat trang thai (copy vao bao cao):

```
- Da lam: ...
- File da sua/tao: ...
- Viec chua lam / de phien sau: ...
- Commit: <hash> <message>
```

---

## Trang thai

- Phien hien tai: 6
- Phien 1: xong
- Phien 2: xong
- Phien 3: xong
- Phien 4: xong
- Phien 5: xong
- Phien 6: xong

Diem moc sau phien 1 (dien sau):

- ThemeProvider class + `.dark` xanh; khong con media prefers-color-scheme ghi de xam
- Logo dung chung; landing Cach hoat dong; metadata template
- `[v0]` da doi thanh log thuong; package name `edusync`
