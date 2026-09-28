# Ke hoach parse cau hoi (4 phien)

Muc tieu: doi cach parse cau hoi khi giao vien nap file (.txt/.docx/.pdf).
Khong doi cu phap chuong/bai/kien thuc: `{Chuong}` `[Bai]` `- noi dung KP`.

## Quy tac parse moi (da chot)

### MC (trac nghiem)
- Dong de: `cau: ........`
- Moi lua chon 1 dong, chu cai dau nhap duoc: `a.` `a)` `A.` `A)` roi `b.`/`B.` ...
- Bo dau `+` va dau `*`.
- Dap an dung: gach chan ca dong hoac chi chu cai dau dong.
- Sau parse: chuan hoa nhan thanh `A.` `B.` `C.` `D.`
- Dung 4 lua chon, dung 1 dong dung.

### TF (dung/sai)
- Dong de: `cau: ........`
- Lua chon nhap giong MC: `a.` `a)` `A.` `A)` ...
- Dong gach chan = dung; khong gach chan = sai.
- Sau parse: chuan hoa nhan thanh `a)` `b)` `c)` `d)`
- Dung 4 y.

### SA (tra loi ngan)
```
cau: ........
dap an: ........
```
- Phan sau `dap an:` la dap an (tu hoac so).

### Phan biet loai cau (quyet dinh ky thuat)
MC va TF deu bat dau bang `cau:` + a/b/c/d nen van can marker loai:
- `#` ngay truoc khoi MC
- `##` ngay truoc khoi TF
- `###` ngay truoc khoi SA
Vi du:
```
#
cau: ADN co cau truc khong gian dang gi?
A. Mach thang
__B. Xoan kep__
C. Vong tron
D. Xoan ba

##
cau: Chon dung/sai ve ADN:
a. ADN co hai mach
__b. Don phan cua ADN la nucleotide__
c. ADN chi co mot mach don
d. ADN khong co trong nhan

###
cau: Don phan cua ADN duoc goi la gi?
dap an: nucleotide
```
Gach chan trong .txt/.pdf: `__...__`. Trong .docx: Word underline (extract-file da map `<u>` -> `__...__`).

## File se dam den

- `lib/worksheet-parser.ts` — parseTextContent, parseHtmlContent, validateDocument
- `lib/extract-file.ts` — chi dung lai, khong doi logic loai file
- `public/templates/mau-cau-hoi.txt` — mau txt
- `public/templates/mau-cau-hoi.docx` — mau word (phien 4)
- `components/teacher/worksheet-importer.tsx` — mo ta mau tren UI (phien 4)

Diem moc code hien tai (khong can doc lai toan file):
- Parse dong: `{` chuong, `[` bai, `-` KP, `###` SA, `##` TF, `#` MC, `+` option, `//` comment
- MC dung: `body.startsWith("*")`
- TF dung: `= Dung/Sai` o cuoi dong `+`
- SA: `### de = dap an` tren 1 dong
- Validate: MC 4 option + 1 dung; TF 4 y; SA co correctAnswer; KP phai co o trong `__tu__` hoac `"tu"`

---

## Phien 1 — Parse MC moi

### Muc tieu
Bo `+`/`*` o MC. Nhan `cau:` + dong a/b/c/d. Gach chan = dung. Chuan hoa nhan `A.` `B.` `C.` `D.`

### Viec lam
1. Them helper: nhan dong lua chon `^[a-dA-D][.)]\s*(.*)$`, tach letter + content.
2. Them helper: `stripUnderline(s)` va `hasUnderline(s)` (ca dong `__...__` hoac chu cai dau `__A__` / `__A.__`).
3. Khi gap `#`: doc de tu dong `# ...` hoac dong ke `cau: ...`; doc tiep cac dong option den khi gap marker moi.
4. Option MC: `isCorrect = hasUnderline(line)`; content bo delimiter; letter map A/B/C/D; content hien thi `A. ...`
5. Khong con parse `+ *` cho MC.
6. Validate giu: 4 lua chon, dung 1 dung.

### File
- Sua: `lib/worksheet-parser.ts`

### Bao cao phien 1 (dien sau khi code)

- Da lam:
  - Them helper `stripUnderline`, `hasUnderline`, `parseChoiceLine` (nhan `a.` `a)` `A.` `A)` va chu cai dau `__B__ noi dung`).
  - Parse MC: `#` hoac `# cau: ...`; dong `cau:` ben duoi dien de neu `#` dung mot minh.
  - Option MC khong con `+`/`*`; gach chan (`__...__`) = dung; content chuan hoa `A. B. C. D.`
  - Dong `+` sau MC bao loi cu phap. TF/SA van parse cu (phien 2/3).
  - Validate MC giu: 4 lua chon, dung 1 dung.
- File da sua/tao:
  - `lib/worksheet-parser.ts`
- Viec tiep theo (phien 2): parse TF theo format `cau:` + a/b/c/d, gach chan = dung, chuan hoa `a)` `b)` `c)` `d)`. Tai su dung helper da export. Khong doc lai toan parser; chi sua nhanh `##` + option TF, bo `+ = Dung/Sai`.

---

## Phien 2 — Parse TF moi

### Muc tieu
TF nhap giong MC (khong `+`, khong `= Dung/Sai`). Gach chan = dung. Sau parse nhan `a)` `b)` `c)` `d)`.

### Viec lam
1. Khi gap `##`: doc `cau:` (cung dong hoac dong duoi).
2. Doc option bang helper phien 1; `isCorrect = hasUnderline(line)`.
3. Chuan hoa content option thanh `a) ...` `b) ...` (chu thuong + dau `)`).
4. Bo parse `+ ... = Dung/Sai`.
5. Validate giu 4 y.

### File
- Sua: `lib/worksheet-parser.ts`

### Bao cao phien 2 (dien sau khi code)

- Da lam:
- File da sua/tao:
- Viec tiep theo (phien 3): parse SA 2 dong `cau:` / `dap an:`.

---

## Phien 3 — Parse SA moi

### Muc tieu
SA khong con `### de = dap an` 1 dong. Dung:

```
###
cau: ........
dap an: ........
```

### Viec lam
1. Khi gap `###`: doc dong `cau:` va dong `dap an:` (khong phan biet hoa thuong, cho phep `dap an:` / `Đáp án:`).
2. `content` = phan sau `cau:`; `correctAnswer` = phan sau `dap an:`.
3. Validate: thieu `dap an:` hoac rong thi loi kem so dong.
4. Bo `+` sau SA (SA khong co option).

### File
- Sua: `lib/worksheet-parser.ts`

### Bao cao phien 3 (dien sau khi code)

- Da lam:
- File da sua/tao:
- Viec tiep theo (phien 4): cap nhat file mau + huong dan UI + kiem tra validate/import.

---

## Phien 4 — Mau, UI, chot

### Muc tieu
Giao vien soan dung mau moi. Import bao loi cu phap cu neu con dung `+` `*`.

### Viec lam
1. Viet lai `public/templates/mau-cau-hoi.txt` theo mau moi (MC/TF/SA + huong dan `//`).
2. Cap nhat `public/templates/mau-cau-hoi.docx` neu co the; neu khong, ghi ro giao vien txt truoc.
3. Cap nhat text huong dan trong `components/teacher/worksheet-importer.tsx`.
4. Validate: dong `+` con sot -> loi cu phap ro so dong.
5. Kiem tra: file mau parse isValid; 1 file sai (thieu gach chan MC, thieu dap an SA) ra dung loi.

### File
- Sua: `public/templates/mau-cau-hoi.txt`
- Sua: `public/templates/mau-cau-hoi.docx` (neu duoc)
- Sua: `components/teacher/worksheet-importer.tsx`
- Sua: `lib/worksheet-parser.ts` (loi cu phap sot)

### Bao cao phien 4 (dien sau khi code)

- Da lam:
- File da sua/tao:
- Viec tiep theo: khong. Parse cau hoi xong.

---

## Quy trinh bat buoc sau moi phien

1. Cap nhat muc "Bao cao phien N" trong file nay (da lam, file, viec tiep theo).
2. Commit + push. Commit message: `wip(parse): phien N - <tom tat>`.
3. Phien sau chi can doc file nay, khong doc lai toan repo.

## Trang thai

- Phien hien tai: xong phien 1, cho phien 2
- Phien 1: xong
- Phien 2: chua
- Phien 3: chua
- Phien 4: chua

Diem moc sau phien 1:
- MC moi: `#` / `cau:` / A.B.C.D gach chan = dung
- TF cu: `##` + dong `+ y = Dung/Sai`
- SA cu: `### de = dap an`
- Helper dung chung nam tren `parseTextContent` trong `lib/worksheet-parser.ts`
