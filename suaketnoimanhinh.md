# Ke hoach chieu san khau GV len TV (HDMI / Miracast + tour nut TV)

Muc tieu: khi GV da cam HDMI hoac da Win+K / Screen Mirroring, nut TV tren console dan GV dat Windows/Mac o che do Mo rong (khong Nhan ban), roi day cua so CHI san khau sang man 2 (tivi). May GV giu thanh nut + cot HS. TV khong tu fit lai nhu mot QuizStage thu hai tren WiFi.

Trang thai: **chua xong**. Da co ban nhap tour + anh mo phong (xem truoc `/tv-tour-preview`). Day la nguon su that. Phien sau CHI doc file nay + dung file liet ke trong phien do. KHONG doc lai toan repo.

Lien quan: `sualoidodaicauhoi.md` (fit AdaptiveQuestion) — KHONG sua lai thuat toan fit o ke hoach nay.

---

## 0. Prompt mo dau (copy dan cho AI phien code)

Ban la ky su Next.js/TypeScript. Doc toan bo `suaketnoimanhinh.md`, lam DUNG phien duoc giao (khong lam truoc phien sau). Voi phien: (1) mo dung cac file liet ke, doi chieu code that; (2) sua dung pham vi phien; (3) chay `pnpm exec tsc --noEmit` va `pnpm lint`; (4) dien muc "Bao cao phien N" trong file nay; (5) commit + push. Khong them thu vien. Khong doi schema DB. Khong doi parser. Khong lam T7 dong bo scrollTop qua SSE. Khong WebRTC / captureStream. Khong tu goi Win+K hay doi Duplicate->Extend. Doc muc 6 truoc khi sua.

---

## 1. Quyet dinh da chot (khong hoi lai)

### 1.1 TV la man hinh Windows/Mac, khong phai trang web khac tren WiFi

- HDMI va Win+K (Miracast) / AirPlay: OS chieu pixel. App khong bat ket noi ho.
- Nhan ban (Duplicate / Mirror): TV = ca desktop GV (nut, cot HS). App KHONG tach duoc san khau. Tour phai bat GV doi sang Mo rong (Extend / Use as Separate Display).
- Mo rong: laptop = man 1 (console), TV = man 2. Nut TV mo cua so chi `QuizStage`, dat man 2, fullscreen.

### 1.2 Nut TV khong mo tab quiz tren WiFi

Cu: `window.open(/teacher/sessions/.../present)` — trang thu hai, tu `useLiveQuiz` + `QuizStage`, fit theo khung TV, KHONG dong bo cuon.

Moi: nut TV mo tour. Buoc cuoi: `getScreenDetails()` + `window.open` dat man phu. That bai thi bao, khong gia thanh cong.

### 1.3 Tour 4 buoc, phim tat + anh mo phong

Windows:

1. Ket noi: `Win+K` (Miracast) hoac cam HDMI.
2. Mo rong: `Win+P` -> chon **Mo rong**. Khong **Nhan ban**.
3. Chrome/Edge: Cho phep Window Management.
4. Mo san khau tren TV.

Mac:

1. Ket noi: HDMI, hoac Control Center -> Screen Mirroring. Phim `Ctrl+Cmd+F2`.
2. Displays: tat Mirror, chon Use as Separate Display. Phim `Opt+F2`.
3. Chrome/Edge: Cho phep Window Management. Safari thuong khong du — dung Chrome.
4. Mo san khau tren TV.

Tab Windows / Mac trong tour. Detect OS bang `navigator.userAgentData.platform` / `navigator.userAgent`, cho doi tay.

### 1.4 Cua so tren TV

- URL: `/teacher/sessions/{id}/present` (van PresentView + QuizStage).
- Feature: chi san khau (de, A/B/C/D, chip Cau x/y, dong ho, badge HS, canh bao fullscreen). Khong thanh Truoc/Dap an/Tiep, khong cot dung-sai-chua.
- Fit chay TRONG cua so do (kich thuoc TV). Khong phai guong pixel o nho tren laptop.
- Cuon theo neu GV cuon TRONG cua so dang nam tren TV (cung mot DOM). KHONG lam kenh SSE scroll.

### 1.5 Quyen trinh duyet

- `window.getScreenDetails()` (Window Management) — Chrome/Edge. Lan dau Chrome hoi; tour buoc 3 noi Bam Cho phep.
- Popup: phai mo trong click handler (buoc 4). Neu chan: bao cho phep popup.
- Fullscreen cua so TV: thu `requestFullscreen`; neu fail, GV F11 tren cua so do.

### 1.6 Khong lam

- Tu Win+K, tu doi Duplicate -> Extend.
- WebRTC / captureStream / phan chieu video.
- T7 dong bo `scrollTop` GV-TV qua `lib/realtime.ts`.
- Fit 16:9 ao tren o console GV (ke hoach khac; khong tron vao day).
- Them thu vien npm.
- Doi parser, schema DB, AdaptiveQuestion / StudentQuestionLayout.

### 1.7 localStorage

- `edusync-tv-tour-done` = "1" sau khi mo san khau thanh cong.
- `edusync-tv-os` = `win` | `mac`.
- Lan sau bam TV: dialog ngan "Mo tren TV" + link "Huong dan lai". Khong bat buoc di het 4 buoc.

---

## 2. Diem moc code hien tai

### Da co (ban nhap, chua chot)

- `components/live/tv-tour-illustrations.tsx` — KeyCap, Laptop, TvSet; 4 anh: ket noi Win/Mac, extend Win/Mac, quyen Chrome, day san khau.
- `components/live/tv-stage-tour.tsx` — Dialog 4 buoc, tab Win/Mac, `openOnTv` goi `getScreenDetails` + `window.open`.
- `components/live/teacher-console.tsx` — nut TV `setTvTourOpen(true)`; `<TvStageTour sessionId={sessionId} />`.
- `app/tv-tour-preview/page.tsx` — trang xem truoc tour, khong can dang nhap phien.

### Con thieu / lech

- `openOnTv` khi KHONG co `getScreenDetails`: van `window.open` o toa do uoc luong (`screenX + outerWidth`) — de mo nham man laptop. Phai FAIL neu khong thay man 2.
- Khi khong co `sessionId` (trang preview) mo `/tv-tour-preview` — dung cho demo; khong dung tren console.
- Chua `localStorage` skip tour.
- Chua nut "Tat TV" dong cua so present.
- `present-view.tsx` van nut fullscreen rieng — giu.
- Chua luu handle popup de dong lai.

### Khong dam

- `lib/realtime.ts`, `use-live-quiz.ts`, `adaptive-question.tsx`, parser, schema.

### Cong cu

- `pnpm exec tsc --noEmit`
- `pnpm lint` (eslint co the khong co — giong ke hoach cu, khong them thu vien)

---

## 3. File se dam den (toan bo phien)

- `components/live/tv-tour-illustrations.tsx` — phien 1 (anh)
- `components/live/tv-stage-tour.tsx` — phien 1-3
- `components/live/teacher-console.tsx` — phien 1 (gan nut), phien 3 (tat TV neu can)
- `app/tv-tour-preview/page.tsx` — phien 1 (xem truoc); phien 4 xoa hoac giu tuy nghiem thu
- `components/live/present-view.tsx` — chi neu phien 3 can nut thoat fullscreen / khong sua layout
- `suaketnoimanhinh.md` — moi phien cap nhat bao cao

Khong dam: QuizStage algorithm, student views, extract-file, worksheet-parser.

Thu tu: 1 -> 2 -> 3 -> 4.

---

## Phien 1 — Tour + anh mo phong + gan nut TV

### Muc tieu

Bam TV tren console mo tour 4 buoc. Anh mo phong + phim tat Win/Mac. Trang `/tv-tour-preview` de xem khong can phien live.

### Viec lam

1. Giu / chinh `tv-tour-illustrations.tsx`: tieng Viet co dau, phim Win+K, Win+P, Ctrl+Cmd+F2, Opt+F2. Menu gia Win+P highlight Mo rong, gach Nhan ban.
2. `TvStageTour`: 4 buoc, tab OS, detect OS.
3. Console: nut TV mo tour, khong `window.open` ngay.
4. `app/tv-tour-preview/page.tsx` cho nghiem thu.

### File

- `components/live/tv-tour-illustrations.tsx`
- `components/live/tv-stage-tour.tsx`
- `components/live/teacher-console.tsx`
- `app/tv-tour-preview/page.tsx`
- `suaketnoimanhinh.md`

### Nghiem thu

- Preview: doi Win/Mac, 4 anh dung phim tat.
- Console: bam TV ra tour, khong mo tab present ngay.

### Bao cao phien 1 (dien sau khi code)

- Da lam:
- File da sua/tao:
- Ket qua tsc/lint:
- Diem chua chac:
- Viec tiep theo: phien 2 chan mo khi chua co man 2.

---

## Phien 2 — Day cua so sang man 2, fail ro

### Muc tieu

Buoc 4 chi thanh cong khi Windows/Mac da Extend VA trinh duyet thay >= 2 man. Khong mo present tren man laptop.

### Viec lam

1. `openOnTv` (phai giu trong click):
   - Neu khong co `getScreenDetails`: setErr huong dan Chrome/Edge + buoc 3. KHONG open uoc luong.
   - Goi API; khong co man `!isPrimary`: setErr buoc 2 (Win+P / Displays).
   - Co man 2: `window.open(presentUrl, "edusync-tv-stage", left/top/width/height avail*)`, `moveTo` / `resizeTo`, thu fullscreen.
   - Popup null: setErr cho phep popup.
2. Khong dong tour khi fail. Thanh cong moi `close()` + ghi `edusync-tv-tour-done`.
3. Giu `sessionId` bat buoc khi goi tu console.

### File

- `components/live/tv-stage-tour.tsx`
- `suaketnoimanhinh.md`

### Nghiem thu

- 1 man: bam Mo san khau -> loi, khong tab moi tren laptop (hoac neu bi chan popup van o tour).
- 2 man Extend (Chrome): cua so present full man TV.
- Duplicate: van 1 man -> loi nhu tren.

### Bao cao phien 2 (dien sau khi code)

- Da lam:
- File da sua/tao:
- Ket qua tsc/lint:
- Diem chua chac:
- Viec tiep theo: phien 3 lan sau + tat TV.

---

## Phien 3 — Lan sau ngan, Tat TV, khong skip lan dau

### Muc tieu

Da chieu thanh cong 1 lan: bam TV -> dialog 1 cau + Mo ngay / Huong dan lai. Nut Tat TV dong cua so present (neu con mo).

### Viec lam

1. Doc `edusync-tv-tour-done`. Neu co: UI ngan, nut "Mo san khau tren TV" goi cung `openOnTv`.
2. "Huong dan lai" reset step=0, van trong dialog.
3. Luu `window` popup vao ref module/component. Nut "Tat TV" tren console (canh nut TV) `popup.close()`. An nut neu chua mo.
4. Khong sua PresentView layout.

### File

- `components/live/tv-stage-tour.tsx`
- `components/live/teacher-console.tsx`
- `suaketnoimanhinh.md`

### Nghiem thu

- Lan 1: 4 buoc. Lan 2: dialog ngan. Tat TV dong cua so man 2.

### Bao cao phien 3 (dien sau khi code)

- Da lam:
- File da sua/tao:
- Ket qua tsc/lint:
- Diem chua chac:
- Viec tiep theo: phien 4 ra soat.

---

## Phien 4 — Ra soat, xoa preview neu khong can, chot

### Muc tieu

Grep sot `window.open(.*present`. Tour khong vo man HS. tsc/lint. Bao cao rui ro muc 6.

### Viec lam

1. Grep `present`, `getScreenDetails`, `TvStageTour`, `tv-tour-preview`.
2. Quyet: giu `/tv-tour-preview` (tien demo) hoac xoa neu khong muon route cong khai — ghi trong bao cao. Mac dinh: giu.
3. Safari/Firefox: err ro, khong crash.
4. Dien bao cao phien 4 + Trang thai.

### File

- Chi neu grep ra sot
- `suaketnoimanhinh.md`

### Bao cao phien 4 (dien sau khi code)

- Da lam:
- File da sua/tao:
- Ket qua tsc/lint:
- Grep con sot:
- Rui ro 6.3 (bao cao, chua sua):
- Viec tiep theo: khong. Ke hoach xong.

---

## 4. Ke hoach kiem thu

1. Win, 1 man, Chrome: tour du 4 buoc, buoc 4 loi "chua thay man phu".
2. Win+P Mo rong + HDMI/Miracast, Chrome: cua so present full TV; laptop con console.
3. Win+P Nhan ban: van loi man phu (khong tach san khau).
4. Mac Mirror vs Separate Display: giong 2/3.
5. Chrome chan popup: loi ro, tour khong dong.
6. Chan Window Management: loi buoc 3/4.
7. Bam TV lan 2: dialog ngan, Mo ngay van day man 2.
8. Tat TV dong cua so; console con.
9. HS phone khong thay tour / khong anh huong fit.

---

## 5. Tieu chi hoan thanh

- tsc + lint khong loi moi.
- Nut TV khong con `window.open` ngay khi click.
- Mo san khau chi khi >= 2 man.
- TV chi QuizStage; GV giu nut + cot HS.
- Khong SSE scroll, khong WebRTC, khong them thu vien.

---

## 6. Luu y / rui ro (doc truoc khi sua)

### 6.1 App khong dieu khien OS

Khong Win+K, khong Win+P, khong doi Mirror. Tour + fail message. GV phai Extend truoc.

### 6.2 getScreenDetails

Chi Chrome/Edge (va Chromium). Khong co API = khong doan man 2. Tra ve 1 man khi Duplicate.

### 6.3 Cua so present van tu fit

Trang `/present` van AdaptiveQuestion theo `h-screen` cua SO DO. Khac "guong pixel o GV". Chap nhan: HDMI/Miracast + Extend = TV la man cua so do. Muon guong 16:9 o console la ke hoach khac.

### 6.4 Popup fullscreen

`requestFullscreen` tren popup de bi chan. Fallback: GV F11. Khong lap vong.

### 6.5 Preview route

`/tv-tour-preview` khong auth. Chi tour UI, khong data HS.

---

## 7. Quy trinh bat buoc sau moi phien

1. Dien "Bao cao phien N".
2. Cap nhat muc Trang thai.
3. Commit + push. Message: `wip(tv-stage): phien N - <tom tat>`.
4. Phien sau chi doc file nay.

---

## Trang thai

- Phien hien tai: chua (ban nhap tour da nam trong repo)
- Phien 1: chua chot (co file nhap)
- Phien 2: chua
- Phien 3: chua
- Phien 4: chua

Diem moc ban nhap:

- Nut TV mo `TvStageTour`, khong open present ngay
- 4 buoc + anh mo phong Win/Mac
- `openOnTv` van fallback mo khi khong co getScreenDetails — PHIEN 2 phai chan
- Trang `/tv-tour-preview`
