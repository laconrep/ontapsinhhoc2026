# Spec sửa logic chấm điểm — EduSync (ontapsinhhoc2026)

*Rà soát ngày 09/10/2026 · Nguồn: ontapsinhhoc2026-master.zip · Dành cho dev / AI coding agent thực hiện sửa code*

## 1. Kết luận nhanh

Lõi chấm trắc nghiệm cơ bản chạy được, nhưng phần **điền khuyết / kéo thả** có hai lỗi nặng làm sai nội dung câu hỏi (FD-01, FD-02), một lỗi cho phép **điểm Tab 4 vượt 10** (QZ-01), và nhiều lỗ hổng về toàn vẹn dữ liệu, lộ đáp án, đồng thời. Luồng 'điền sai → chuyển sang kéo thả' gần như không bao giờ chạy trong UI hiện tại, kéo theo thống kê 'tự tin quá mức' sai (FD-09).

Điểm đã tốt, giữ nguyên: import ép MC đúng 4 lựa chọn / 1 đáp án, TF đúng 4 ý; xáo trộn có seed ổn định; khoá Tab 1 sau khi nộp; trạng thái 'correct' không bị hạ; Tab 4 không gửi cờ isCorrect xuống client; live quiz che đáp án tới lúc GV reveal.

## 2. Phạm vi và cách xác nhận

- **Đã chạy thử**: chạy hàm thật (`gradeSlots`, `normalizeAnswer`, `renderSlots`, `extractBlanks`, `renderMarkedContent`) bằng Node 22 với input ghi ngay trong từng mục. Kết quả là kết quả thực, không suy đoán.
- **Đọc code**: lần theo luồng gọi, chưa chạy UI hay DB thật.
- Đã rà: `lib/grading.ts`, `slot-render.ts`, `kp-render.ts`, `worksheet-parser.ts` (extractBlanks), `app/actions/student-learn.ts` (Tab 1–4), `tab2-fill-in.tsx`, `tab3-drag-drop.tsx`, `tab4-quiz.tsx`, `live-quiz.ts`, `live-session-state.ts`, `questions.ts`, `class-stats*.ts`, `student-stats.ts`, `assignments.ts`, `schema.ts`.
- **Chưa rà sâu**: đọc công thức Word (OMML), import docx/pdf, đăng nhập better-auth, SSE stream route, giao diện ngoài phần chấm. Chưa test trên trình duyệt/thiết bị thật. Bảng `worksheet_attempts` / `worksheet_answers` không có code nào dùng (xem OP-04), nên không có logic chấm worksheet để kiểm tra.

## 3. Bảng tổng hợp

Mức độ: **P0** sửa ngay · **P1** sửa trong đợt này · **P2** đợt sau · **P3** dọn dẹp.

| ID | Mức | Vấn đề | Xác nhận |
| --- | --- | --- | --- |
| FD-01 | P0 | Ô trống đặt sai vị trí, đáp án lộ ngay trong câu | Đã chạy thử |
| FD-02 | P0 | GV mở lại KP để sửa là nội dung bị hỏng | Đã chạy thử |
| FD-03 | P1 | Kéo thả: hai chip trùng chữ (5', 3'...) không thể điền cùng lúc, HS kẹt | Đọc code |
| FD-04 | P1 | `gradeSlots` ghép tham lam, chấm sai khi có từ đồng nghĩa | Đã chạy thử |
| FD-05 | P1 | Nhóm hoán đổi quá rộng, nhận đáp án sai nghĩa | Đã chạy thử |
| FD-06 | P2 | `normalizeAnswer` thiếu nhiều chuẩn hoá (dấu nháy iPhone, khoảng trắng, số) | Đã chạy thử |
| FD-07 | P1 | Tab 2/3 và Tab 1 thiếu kiểm tra quyền / điều kiện ở server | Đọc code |
| FD-08 | P1 | Lộ đáp án qua payload; Tab 3 hiện đáp án ngay lần sai đầu | Đọc code |
| FD-09 | P1 | Nhánh 'điền sai → kéo thả' chết; chỉ số overconfident sai | Đọc code |
| FD-10 | P2 | Thiếu ràng buộc UNIQUE và giao dịch ở progress / Tab 1 | Đọc code |
| FD-11 | P2 | Reset để `overallStatus` lệch với `selfAssessment` | Đọc code |
| QZ-01 | P0 | Điểm Tab 4 có thể > 10 (nhận đáp án câu ngoài đề) | Đọc code |
| QZ-02 | P1 | Câu bỏ trống không ghi nhận; ý TF bỏ trống được điểm | Đọc code |
| QZ-03 | P1 | Nộp bài không giao dịch, nộp đồng thời chèn trùng | Đọc code |
| QZ-04 | P2 | `startQuiz` tạo attempt mới mỗi lần gọi (F5 sinh attempt rác) | Đọc code |
| QZ-05 | P2 | SA chỉ 1 đáp án, so khớp yếu với số / đơn vị | Đã chạy thử (một phần) |
| QZ-06 | P2 | Thang điểm TF tuyến tính, cần chốt với chuyên môn | Cần quyết định |
| QZ-07 | P2 | GV sửa câu hỏi xoá và tạo lại option, làm hỏng bài đang làm | Đọc code |
| QZ-08 | P2 | Chọn đề theo KP không giới hạn số câu, bỏ qua mức nắm vững | Đọc code |
| LV-01 | P1 | Thời gian mỗi câu live chỉ kiểm ở client | Đọc code |
| LV-02 | P1 | `submitLiveAnswer` không kiểm tra HS thuộc lớp | Đọc code |
| LV-03 | P1 | Kết quả live không lưu, mất khi restart / nhiều instance | Đọc code |
| LV-04 | P2 | Cách chấm TF / SA live khác Tab 4 | Đọc code |
| ST-01 | P1 | Bài tập báo 'hoàn thành' khi HS mới tự đánh giá xong | Đọc code |
| ST-02 | P2 | Streak và hoạt động tuần tính theo múi giờ server | Đọc code |
| OP-01…06 | P2–P3 | Tối ưu hiệu năng, mã chết, test (mục 8) | — |

## 4. Điền khuyết và kéo thả (Tab 2 / Tab 3)

### FD-01 · P0 · Ô trống đặt sai vị trí

**Vị trí**: `lib/slot-render.ts` (`renderSlots`), `lib/worksheet-parser.ts` (`extractBlanks`), `types/index.ts` (`UnderlinedTerm`).

**Hiện trạng**: `extractBlanks` có tính `cleanStart` (vị trí ô trong nội dung sạch) nhưng **không lưu vào DB**. Khi hiển thị, `renderSlots` tìm lại bằng `content.indexOf(term.text)` rồi lấy lần xuất hiện đầu tiên chưa bị chiếm. Nếu chữ đáp án đã xuất hiện trước đó trong câu, hoặc nằm trong một từ khác, ô trống bị đặt sai chỗ và chữ đáp án vẫn hiện nguyên ở vị trí thật.

**Bằng chứng** (đã chạy; `[[x]]` là ô trống):

- Nhập `Trong ADN, A liên kết với __T__ bằng 2 liên kết hydro.` → hiển thị `[[T]]rong ADN, A liên kết với T bằng 2 liên kết hydro.` (ô nằm ở chữ T của 'Trong', đáp án lộ).
- Nhập `Mạch ADN gồm các nucleotit; chuỗi __nucleotit__ liên kết...` → `...gồm các [[nucleotit]]; chuỗi nucleotit liên kết...`.
- Nhập `Enzim ADN polimeraza ...; ADN gồm hai mạch, __ADN__ có cấu trúc...` → ô rơi vào chữ ADN đầu tiên.

Sinh học có rất nhiều từ ngắn và lặp (A, T, G, X, 5', 3', ADN, mạch), nên lỗi này xảy ra thường xuyên.

**Yêu cầu sửa**

1. Thêm vào `UnderlinedTerm` hai trường `start: number` và `end: number` (offset UTF-16 trong `knowledge_points.content` đúng như đang lưu, sau khi `trim`). Bất biến: `content.slice(start, end) === text`.
2. `extractBlanks`: tính offset từ `cleanStart`, trừ phần khoảng trắng đầu bị `trim()` cuối hàm (`lead = content.length - content.trimStart().length`). Trả về `start = cleanStart - lead`, `end = start + text.length`.
3. `renderSlots`: nếu mọi term đều có `start/end` và thoả bất biến thì cắt chuỗi theo offset, **không** dùng `indexOf`, và **không** gọi `cleanContentDisplay` (hàm này đổi độ dài chuỗi làm lệch offset; nội dung lưu đã được `extractBlanks` bỏ dấu đánh dấu rồi). Nếu thiếu offset hoặc vi phạm bất biến thì dùng đường dẫn cũ (legacy) và `console.warn` kèm `kpId`.
4. **Dữ liệu cũ**: viết `scripts/backfill-term-offsets.mjs`. Với mỗi KP và mỗi chuỗi `T`, đếm số lần `T` xuất hiện trong content (n\_occ) và số term có `text = T` (n\_term). Nếu n\_occ = n\_term thì gán offset theo thứ tự `slotIndex`. Nếu n\_occ > n\_term thì **không đoán**: ghi KP vào danh sách `needsReview` (xuất CSV) và đánh dấu để GV xác nhận lại.
5. Trang bài giảng của GV hiện huy hiệu 'Cần xác nhận ô trống' cho KP thuộc `needsReview`. Khi GV lưu lại KP (qua `extractBlanks`) thì có offset chuẩn và huy hiệu biến mất.
6. Trình soạn KP (`kp-content-editor.tsx`) hiện cảnh báo khi một ô trống có chữ trùng với chữ khác trong câu: 'Chữ này xuất hiện n lần; ô trống được xác định theo vị trí bạn đánh dấu.'

**Nghiệm thu**: ba ví dụ trên hiển thị `[[T]]` / `[[nucleotit]]` / `[[ADN]]` đúng vị trí đã đánh dấu và chữ đáp án không còn xuất hiện ở chỗ ô trống. Test đơn vị cho 20 câu có chữ lặp, chữ nằm trong từ khác, câu bắt đầu bằng khoảng trắng.

### FD-02 · P0 · Mở KP để sửa làm hỏng nội dung

**Vị trí**: `lib/kp-render.ts` (`renderMarkedContent`), dùng ở `components/teacher/lesson-detail.tsx` khi bấm sửa KP.

**Hiện trạng**: cùng cách tìm bằng `indexOf(term.text, cursor)`, nên ký hiệu `__ __` được chèn vào **lần xuất hiện đầu**, không phải chỗ ô thật. Nếu GV bấm Lưu, nội dung hỏng được ghi đè vào DB.

**Bằng chứng** (đã chạy): từ KP lưu từ `Trong ADN, A liên kết với __T__ bằng...` mở lại thành `__T__rong ADN, A liên kết với T bằng...`. KP `Mạch ADN gồm các nucleotit; chuỗi __nucleotit__ liên kết.` mở lại thành `Mạch ADN gồm các __nucleotit__; chuỗi nucleotit liên kết.`

**Yêu cầu sửa**: `renderMarkedContent` đi theo `start/end` của FD-01 (sắp xếp theo `start`, chèn `__` hoặc `__"..."__` và phần `|đồng nghĩa`). Với term thiếu offset (dữ liệu cũ chưa backfill) hiển thị cảnh báo và **khoá nút Lưu** cho tới khi GV xác nhận lại vị trí.

**Nghiệm thu**: thêm `scripts/check-kp-roundtrip.mjs` chạy trên toàn bộ KP trong DB: `extractBlanks(renderMarkedContent(c, t))` phải cho đúng `content = c` và các term giống `t` (text, slotIndex, allowSwap, swapGroupId, synonyms, start, end). Chạy trong CI.

### FD-03 · P1 · Kéo thả: chip trùng chữ không thể điền hai ô

**Vị trí**: `components/student/tab3-drag-drop.tsx` (`placeChip`), `getTab3Questions`.

**Hiện trạng**: `chips` là mảng chuỗi. `placeChip` trước khi đặt chip vào ô mới sẽ **xoá mọi ô đang chứa cùng chuỗi đó**. Nếu KP có hai ô cùng chữ (ví dụ `5'` hai lần, `3'` hai lần, `liên kết hydro` hai lần) thì đặt chip thứ hai làm ô thứ nhất trống. Không bao giờ điền đủ nên nút Kiểm tra không bật, HS kẹt ở Tab 3 (Tab 3 chỉ cho qua khi đúng hết).

**Yêu cầu sửa**

1. Server trả `chips: { id: string, text: string }[]`; `id` duy nhất trong câu (ví dụ `${kpId}:${index}` sau khi xáo).
2. Client: `placement: Record<slotIndex, chipId | null>`; `placeChip` chỉ gỡ ô đang giữ **cùng `chipId`**; ID kéo thả của dnd-kit là `chip.id`. `availableChips` = chip chưa nằm trong ô nào.
3. Khi chấm, client gửi `answers[slotIndex] = chip.text` (map từ id sang text).
4. Khôi phục nháp localStorage lưu `chipId`; nếu id không còn tồn tại thì bỏ nháp.
5. Chip nhiễu: loại chip có chuẩn hoá (`normalizeAnswer`) trùng bất kỳ đáp án chấp nhận (text, synonyms, extraAccepted) của câu này; loại trùng lặp giữa các chip nhiễu.

**Nghiệm thu**: KP `5'`,`3'`,`5'`,`3'` điền đủ 4 ô và chấm đúng. Kéo chip lần hai vào ô khác chỉ làm ô cũ của chính chip đó trống.

### FD-04 · P1 · Ghép tham lam sai khi có từ đồng nghĩa

**Vị trí**: `lib/grading.ts` (`gradeSlots`, nhánh swap-group).

**Hiện trạng**: với mỗi đáp án HS, code lấy term đầu tiên còn lại mà `accepts` rồi loại term đó khỏi danh sách. Không thử cách ghép khác nên kết quả phụ thuộc thứ tự.

**Bằng chứng** (đã chạy): nhóm hoán đổi gồm term A = `đơn phân` (synonyms `nucleotit`) và term B = `nucleotit`. HS điền `[đơn phân, nucleotit]` → đúng; HS điền `[nucleotit, đơn phân]` (cũng đúng về nghĩa) → `allCorrect = false`.

**Yêu cầu sửa**: thay bằng ghép cặp cực đại (bipartite matching). Kích thước nhóm nhỏ (khuyến nghị tối đa 8, parser báo lỗi nếu vượt), dùng DFS có quay lui:

```ts
function maxMatching(terms: UnderlinedTerm[], values: string[]): number[] {
  // trả về mảng matchOfValue[i] = chỉ số term được ghép với đáp án i, hoặc -1
  const matchOfTerm = new Array(terms.length).fill(-1)
  const tryAssign = (i: number, seen: boolean[]): boolean => {
    for (let j = 0; j < terms.length; j++) {
      if (seen[j] || !accepts(terms[j], values[i])) continue
      seen[j] = true
      if (matchOfTerm[j] === -1 || tryAssign(matchOfTerm[j], seen)) {
        matchOfTerm[j] = i
        return true
      }
    }
    return false
  }
  for (let i = 0; i < values.length; i++) tryAssign(i, new Array(terms.length).fill(false))
  const out = new Array(values.length).fill(-1)
  matchOfTerm.forEach((vi, tj) => { if (vi !== -1) out[vi] = tj })
  return out
}
```

Kết quả theo ô: ô **đúng** nếu đáp án của ô đó nằm trong ghép cực đại; `allCorrect` khi mọi ô được ghép. Nhờ vậy UI chỉ tô đỏ ô sai (hiện tại một ô sai làm cả nhóm đỏ, và nút 'Thử lại ô sai' xoá cả ô đúng). Với ô sai trong nhóm hoán đổi, `correctAnswer` trả về chữ của term chưa được ghép (không gắn cứng theo vị trí).

**Nghiệm thu**: ví dụ trên cho `true` ở cả hai thứ tự. Test: nhóm 3–4 ô với synonyms chéo; điền trùng một đáp án hai lần phải sai; điền ba đúng một sai thì chỉ ô sai bị đỏ.

### FD-05 · P1 · Nhóm hoán đổi quá rộng

**Vị trí**: `extractBlanks`, đoạn gán `swapGroupId`.

**Hiện trạng**: mọi ô hoán đổi nằm liền nhau (không có `. ! ? ;` hoặc xuống dòng xen giữa) đều vào **một nhóm**, dù cách nhau cả mệnh đề.

**Bằng chứng** (đã chạy): `Adenin liên kết với "timin" bằng 2 liên kết hydro, còn guanin liên kết với "xitozin" bằng 3 liên kết` → `timin` và `xitozin` cùng nhóm g1. HS điền đảo `[xitozin, timin]` → `allCorrect = true` (sai về sinh học).

Ngoài ra, mọi chuỗi trong ngoặc kép thường (không có `__`) tự thành ô hoán đổi. Câu như `gọi là "nhân đôi" ADN` (ngoặc kép chỉ để trích dẫn) bị biến thành ô trống mà GV không để ý.

**Yêu cầu sửa**

1. Hai ô liền kề chỉ vào cùng nhóm khi đoạn chữ giữa chúng **chỉ chứa khoảng trắng** và tối đa **một từ nối** thuộc: `,` `và` `hoặc` `/` `-` `–` `→`. Mọi trường hợp khác tách nhóm mới.
2. Nhóm tối đa 8 ô; vượt thì parser báo lỗi có số dòng.
3. Trình xem trước KP hiển thị nhóm (huy hiệu 'Nhóm 1', 'Nhóm 2' trên từng ô) để GV kiểm tra trước khi lưu.
4. Preview và validate import cảnh báo (không chặn) khi phát hiện ô hình thành từ ngoặc kép thường: 'Chuỗi "nhân đôi" được coi là ô hoán đổi; dùng dấu ngoặc kép kèm gạch chân nếu đúng ý.' Quyết định cuối về việc bỏ hẳn quy tắc 'ngoặc kép thường = ô trống' xem mục 10.
5. (Tuỳ chọn, giai đoạn sau) cú pháp nhóm tường minh, ví dụ `__"timin"@1__`, cho các câu mà quy tắc tự động không đủ.

**Nghiệm thu**: ví dụ timin / xitozin tạo hai nhóm riêng; đảo vị trí bị chấm sai. `A, T, G và X` (bốn ô liền) vẫn là một nhóm. Test cho các kết nối `và`, `hoặc`, `/`, `→`.

### FD-06 · P2 · Chuẩn hoá đáp án chưa đủ

**Vị trí**: `lib/grading.ts` (`normalizeAnswer`), dùng ở Tab 2, 3, 4 (SA) và live quiz.

**Hiện trạng** (đã chạy; mỗi cặp so sánh sau `normalizeAnswer`):

| Cặp so sánh | Kết quả hiện tại |
| --- | --- |
| `tế  bào` (2 dấu cách) với `tế bào` | khác nhau |
| `tế\u00a0bào` (NBSP) với `tế bào` | khác nhau |
| `5’` (U+2019, iPhone tự đổi dấu nháy) với `5'` | khác nhau |
| `5′` (U+2032) với `5'` | khác nhau |
| `0,5` với `0.5` | khác nhau |
| `1 500` với `1500` | khác nhau |
| `ADN.` với `ADN` | giống nhau (đúng) |

Riêng `5'` và `3'` rất phổ biến trong bài ADN; HS dùng iPhone bật 'smart punctuation' sẽ bị chấm sai dù gõ đúng.

**Yêu cầu sửa**: viết lại `normalizeAnswer(input)` theo đúng thứ tự: (1) NFC; (2) đổi NBSP, narrow NBSP và khoảng trắng đặc biệt thành dấu cách, xoá ký tự độ rộng 0 (U+200B–U+200D, U+FEFF); (3) đổi các dấu nháy ‘ ’ ʹ ′ ´ `thành`'` ; (4) đổi các loại gạch ngang ‐ ‑ ‒ – — − thành  `-` ; (5) gộp mọi chuỗi khoảng trắng thành một dấu cách; (6) cắt dấu câu hai đầu như hiện tại; (7)  `toLowerCase()` . Dùng chung hàm này cho Tab 2, 3, 4 và live. Không bỏ dấu tiếng Việt mặc định (ví dụ  `nuclêôtit`khác`nucleotit\` là có chủ ý); nếu muốn nhận đáp án không dấu, xem câu hỏi mở số 1 ở mục 10.

**Nghiệm thu**: bảng trên cho 'giống nhau' ở 5 dòng đầu (không áp cho `0,5` / `1 500`: số được xử lý riêng ở QZ-05). Test đơn vị với các biến thể dấu nháy và khoảng trắng.

### FD-07 · P1 · Thiếu kiểm tra ở server (Tab 1, 2, 3)

**Vị trí**: `student-learn.ts`: `submitTab2Question`, `submitTab3Question`, `submitTab1`.

**Hiện trạng**: `submitTab2Question` và `submitTab3Question` chỉ gọi `requireRole('student')`, **không** gọi `assertLessonAccess`, không kiểm tra KP thuộc bài HS được học, không kiểm tra HS đã nộp Tab 1, không kiểm tra điều kiện của tab (Tab 2 chỉ cho KP 'Biết'; Tab 3 chỉ cho 'Chưa biết' hoặc điền chưa đúng). HS biết UUID của một KP bất kỳ có thể ghi trạng thái cho nó (kể cả khác lớp / khác giáo viên). `submitTab1` không kiểm tra các `kpId` gửi lên có thuộc `lessonId`.

**Yêu cầu sửa** (thứ tự kiểm tra trong mỗi action):

1. `requireRole('student')`; nạp KP → lấy `lessonId`; `assertLessonAccess`.
2. Tab 1 của bài đã nộp (có dòng trong `student_tab1_submissions`); nếu chưa thì báo lỗi.
3. Tab 2: dòng `student_progress` có `selfAssessment = 'known'` và `fillStatus != 'correct'`. Tab 3: đủ điều kiện kéo thả (theo FD-09) và `dragStatus != 'correct'`. Nếu đã đúng rồi thì trả kết quả đã lưu, **không tăng `*Attempts`**.
4. Kiểm tra `answers`: khoá phải là `slotIndex` thuộc KP; giá trị là chuỗi tối đa 200 ký tự; khoá lạ thì từ chối.
5. `submitTab1`: mọi khoá của `assessments` phải là KP của `lessonId`; giá trị thuộc `'known' | 'unknown'`; yêu cầu phủ đủ mọi KP của bài (hoặc báo rõ KP thiếu).

**Nghiệm thu**: gọi `submitTab2Question` với `kpId` của giáo viên khác trả lỗi quyền; gọi Tab 3 cho KP 'Biết' chưa điền sai trả lỗi; `submitTab1` với kpId ngoài bài trả lỗi.

### FD-08 · P1 · Lộ đáp án

**Vị trí**: `getTab2Questions`, `getTab3Questions`, `submitTab2Question`, `submitTab3Question`, `tab2-fill-in.tsx`, `tab3-drag-drop.tsx`.

**Hiện trạng**

- Payload Tab 2 và 3 chứa `content` (nguyên văn có đáp án) và `terms` (kèm `text`, `synonyms`). Mở tab Network là thấy hết.
- Server luôn trả `correctAnswer` cho mọi ô sai. Tab 2 chỉ **ẩn ở client** (gợi ý chữ đầu trong 2 lần đầu, rồi hiện). Tab 3 hiện đáp án ngay sau lần sai đầu. HS chép đáp án, thử lại là xong, trạng thái 'mastered' không phản ánh kiến thức.

**Yêu cầu sửa**

1. Server dựng sẵn `parts: ({type:'text', value} | {type:'slot', slotIndex, groupId})[]`. Phần `slot` **không** chứa chữ đáp án. Content thô và `terms` không gửi xuống client ở Tab 2 / Tab 3. Với kéo thả, `chips` (FD-03) vẫn gửi chữ nhưng đáp án và chip nhiễu không phân biệt được.
2. Kết quả chấm chỉ trả `isCorrect` theo ô. Server chỉ thêm `hint` / `correctAnswer` theo bộ đếm lượt sai **lưu ở DB** (`fillAttempts` / `dragAttempts` từ lần reset gần nhất): Tab 2 gợi ý chữ đầu từ lượt sai thứ 1, hiện đáp án từ lượt sai thứ 3; Tab 3 chỉ hiện ✓/✗ ở lượt sai thứ 1, hiện đáp án từ lượt sai thứ 2. Ngưỡng đặt trong một hằng số cấu hình.
3. Giới hạn tần suất chấm: từ chối nếu lượt chấm trước của cùng KP cách dưới 1 giây.
4. Ghi nhận **đã xem đáp án trước khi đúng** (cột mới `fillRevealed`, `dragRevealed`, boolean). Chưa đổi quy tắc 'mastered' (xem câu hỏi mở số 2) nhưng dữ liệu phải có để thống kê.

**Nghiệm thu**: response `getTab2Questions` / `getTab3Questions` không chứa chuỗi đáp án ngoài `chips`; lượt sai đầu của Tab 3 không trả `correctAnswer`.

### FD-09 · P1 · Nhánh 'điền sai → kéo thả' chết, thống kê 'tự tin quá mức' sai

**Vị trí**: `resolveStudyStage`, `getTab2Questions`, `submitTab2Question`, `computeOverallStatus`, `class-stats.ts` (các chỗ tính `overconfident`).

**Hiện trạng**

- Điền sai một lần là `fillStatus = 'incorrect'`; `resolveStudyStage` giữ HS ở Tab 2 vì điều kiện `fill !== 'correct'`; UI chỉ cho sang câu tiếp khi **đúng hết**. Vậy HS không có đường nào đi từ 'điền sai' sang kéo thả. Nhánh `fillStatus = 'incorrect' → Tab 3` và nhánh bước 1 của `computeOverallStatus` thực tế chỉ xảy ra với HS bỏ giữa chừng.
- Hệ quả thống kê: `overconfident = selfAssessment 'known' && fillStatus 'incorrect'`. HS thử sai rồi sửa đúng thì `fillStatus` thành 'correct' và **biến khỏi** chỉ số. Cột `fillAttempts` có thông tin nhưng không được dùng. Các chỉ số `isAtRisk`, `isWeakKp`, `isHardKp`, `reinforcedCount` đều phụ thuộc.

**Yêu cầu sửa** (phương án A, khuyến nghị; cần chủ sản phẩm xác nhận ở mục 10):

1. Thêm cột `fillFirstTry`, `dragFirstTry` (`'correct' | 'incorrect' | null`), ghi **một lần** ở lượt chấm đầu tiên của chu kỳ học.
2. Thêm cột `fillGaveUp` (boolean, mặc định false). Sau khi hiện đáp án ở Tab 2 (FD-08, lượt sai thứ 3), hiện nút 'Chuyển sang Kéo thả' gọi action `giveUpFill(kpId)` (kiểm tra như FD-07), đặt `fillGaveUp = true`, `fillStatus = 'incorrect'`.
3. `submitTab2Question`: lượt sai bình thường **không** đặt `fillStatus = 'incorrect'` nữa (để nguyên null); chỉ đặt 'correct' khi đúng hết hoặc 'incorrect' khi `giveUpFill`.
4. `resolveStudyStage` / `getTab2Questions`: Tab 2 còn việc khi `sa = 'known' && fill != 'correct' && !fillGaveUp`. Tab 3 đủ điều kiện khi `sa = 'unknown' || fillGaveUp`.
5. `class-stats.ts`, `student-stats.ts`: `overconfident = selfAssessment 'known' && fillFirstTry 'incorrect'`; `weak` và `reinforced` tính lại theo cột mới.
6. Migration backfill: `fillFirstTry = 'incorrect'` nếu `fillStatus = 'incorrect'` hoặc (`fillStatus = 'correct'` và `fillAttempts > 1`); `'correct'` nếu `fillStatus = 'correct'` và `fillAttempts = 1`; còn lại null. Tương tự `dragFirstTry`.

**Nghiệm thu**: HS 'Biết', sai ba lần, bấm 'Chuyển sang Kéo thả' → KP xuất hiện ở Tab 3, `overallStatus = 'unknown'`; thống kê lớp đếm HS này là overconfident cho KP đó. HS sai một lần rồi sửa đúng cũng được đếm overconfident (first try sai) nhưng không bị đẩy sang Tab 3.

### FD-10 · P2 · Ràng buộc DB và đồng thời

**Hiện trạng**: mọi action Tab 1/2/3 làm 'đọc dòng hiện có rồi INSERT hoặc UPDATE'. Hai request đồng thời lần đầu → một request lỗi khoá chính; hai request cùng KP → trạng thái tính từ dữ liệu cũ (mất cập nhật). `student_tab1_submissions` **không có UNIQUE** `(studentId, lessonId)` nên bấm nộp hai lần tạo hai dòng, và `resetLessonProgress` / `resolveStudyStage` lấy một dòng bất kỳ.

**Yêu cầu sửa**

1. Migration: xoá dòng trùng của `student_tab1_submissions` (giữ dòng `submittedAt` mới nhất), rồi `ALTER TABLE student_tab1_submissions ADD CONSTRAINT s1_student_lesson_unique UNIQUE ("studentId", "lessonId")`. Insert dùng `onConflictDoNothing` và coi như đã nộp.
2. Mỗi lượt chấm / lưu progress chạy trong `db.transaction`: `insert ... on conflict do nothing` tạo dòng rỗng, rồi `select ... for update` dòng `(studentId, knowledgePointId)`, tính trạng thái, rồi `update`. Tăng attempts bằng SQL (`col + 1`) như hiện tại.
3. `submitTab1`: bỏ vòng lặp N truy vấn; lấy toàn bộ dòng progress một lần, rồi một lệnh `insert ... on conflict (studentId, knowledgePointId) do update set selfAssessment, overallStatus`.

**Nghiệm thu**: script chạy 20 request song song `submitTab2Question` cùng KP không có lỗi và `fillAttempts` đúng 20; hai lần `submitTab1` song song còn đúng một dòng submission.

### FD-11 · P2 · Reset để lại trạng thái không nhất quán

**Vị trí**: `resetLessonProgress`.

**Hiện trạng**: giữ `selfAssessment` nhưng ghi `overallStatus = 'not_started'`, trong khi `computeOverallStatus` với `selfAssessment` đó sẽ trả 'known' hoặc 'unknown'. Thống kê lớp (dựa vào `overallStatus`) và Tab 1 (dựa vào `selfAssessment`) hiển thị khác nhau.

**Yêu cầu sửa**: khi reset, đặt `overallStatus` theo `selfAssessment` còn lưu (SQL `CASE`: known → 'known', unknown → 'unknown', còn lại → 'not\_started'), xoá `fillStatus`, `dragStatus`, `*Attempts`, `*FirstTry`, `*GaveUp`, `*Revealed`. Ghi rõ trong code rằng lịch sử điểm Tab 4 được giữ.

**Nghiệm thu**: sau reset, `overallStatus` bằng kết quả `computeOverallStatus({selfAssessment, fillStatus: null, dragStatus: null})` với mọi dòng.

*(Phần tiếp theo: Tab 4, Live quiz, Thống kê, Tối ưu, Migration, Test, Thứ tự triển khai, Câu hỏi mở.)*

## 5. Tab 4: Kiểm tra tổng hợp

### QZ-01 · P0 · Điểm có thể vượt 10

**Vị trí**: `startQuiz`, `submitQuiz` trong `student-learn.ts`.

**Hiện trạng**: `submitQuiz` lấy danh sách câu từ **khoá của `answers` do client gửi** (`Object.keys(answers)` rồi `select ... where id in`), không đối chiếu với đề đã phát. `startQuiz` không lưu câu nào đã phát, chỉ lưu `totalSlots`. Gửi thêm `questionId` của câu ngoài đề (câu cùng bài chưa được rút ở chế độ ngẫu nhiên, hoặc câu bài khác) thì `correctSlots` có thể lớn hơn `totalSlots`, điểm vượt 10 và `percentage` vượt 100.

Điều kiện khai thác: HS cần biết ID câu. Sau mỗi lần nộp, kết quả trả đáp án đúng và ID các câu đã phát; đề ngẫu nhiên các lần sau khác nhau nên HS gom được thêm ID. Khai thác khả thi bằng một script nhỏ. Đây là suy luận từ code, chưa chạy thử trên DB thật.

**Yêu cầu sửa**

1. Bảng mới `quiz_attempt_questions(attemptId, questionId, position, optionOrder jsonb, snapshot jsonb)`, PK `(attemptId, questionId)`. `optionOrder` là thứ tự optionId đã hiển thị. `snapshot` lưu cờ đúng/sai của từng option (và danh sách đáp án chấp nhận của SA) **tại thời điểm phát**. `startQuiz` chèn bảng này trong cùng transaction với việc tạo attempt.
2. `submitQuiz` nạp danh sách câu từ bảng này theo `attemptId`; `questionId` không thuộc đề thì bị bỏ qua hoặc từ chối; chấm theo `snapshot`.
3. Chốt chặn: `correctSlots <= totalSlots`, `score = min(10, ...)`.

**Nghiệm thu**: gửi `answers` kèm `questionId` ngoài đề thì bị từ chối hoặc bỏ qua, điểm không đổi. Điểm luôn nhỏ hơn hoặc bằng 10.

### QZ-02 · P1 · Câu bỏ trống và TF mặc định 'Sai'

**Hiện trạng**

- Câu không có trong `answers` không tạo dòng `quiz_answers`. Thống kê theo KP (`firstTryPercentForKp`) bỏ qua câu đó thay vì tính là sai, làm tỉ lệ đúng lần đầu cao ảo.
- TF: `const studentValue = map[o.id] ?? 'S'`. Ý HS không chọn bị coi là 'Sai'. Nếu ý đó thật sự sai thì HS **được điểm** mà không trả lời. Client cho nộp khi còn câu chưa làm (có hộp thoại xác nhận).

**Yêu cầu sửa**

1. Mỗi câu thuộc đề (theo QZ-01) đều có dòng `quiz_answers`; chưa trả lời thì `studentAnswer = NULL`, `isCorrect = false`.
2. TF lưu **mỗi ý một dòng** (cột `optionId`). Ý không có trong `map` hoặc giá trị ngoài {'D','S'} là chưa trả lời, `isCorrect = false`. Bỏ `?? 'S'`.
3. Validate: MC chọn optionId phải thuộc câu; SA tối đa 200 ký tự.
4. UI: TF không mặc định chọn 'Sai', ý chưa chọn hiển thị rõ.

**Nghiệm thu**: bỏ trống một câu TF có 2 ý sai thì câu đó 0 điểm. Câu bỏ trống có dòng `quiz_answers` với `isCorrect = false`.

### QZ-03 · P1 · Nộp bài không giao dịch

**Hiện trạng**: đọc attempt, kiểm tra `completedAt`, rồi ba bước ghi rời nhau: update attempt, insert `quiz_answers`, vòng lặp select+insert seed `spaced_repetition`. Hai lần nộp đồng thời cùng qua kiểm tra thì chèn đôi `quiz_answers` và ghi đè điểm. Lỗi giữa chừng để lại attempt đã hoàn tất nhưng thiếu đáp án.

**Yêu cầu sửa**

1. Toàn bộ trong `db.transaction`.
2. Khoá lượt nộp bằng `UPDATE quiz_attempts SET completedAt = now(), score = ... WHERE id = ? AND studentId = ? AND completedAt IS NULL RETURNING id`. Không có dòng trả về thì báo 'Bài kiểm tra đã nộp'.
3. UNIQUE trên `quiz_answers` theo `(attemptId, questionId, coalesce(optionId, zero-uuid))`.
4. Seed `spaced_repetition` bằng một lệnh `insert ... on conflict (studentId, knowledgePointId) do nothing`.

**Nghiệm thu**: 10 request nộp song song cùng attempt chỉ 1 request thành công, không có dòng đáp án trùng.

### QZ-04 · P2 · `startQuiz` tạo attempt rác

**Hiện trạng**: mỗi lần gọi `startQuiz` chèn một attempt mới. F5, lỗi mạng hoặc mở hai tab sinh nhiều attempt `completedAt = NULL`. `resolveStudyStage` coi attempt chưa xong là 'đang làm Tab 4'. Seed theo `attemptNumber = số attempt đã xong + 1` nên đề giống nhau, nhưng DB tích attempt rác.

**Yêu cầu sửa**: `startQuiz` tìm attempt chưa xong của (HS, bài) sau mốc `submittedAt`; có thì trả đúng đề đã lưu (QZ-01) cùng đáp án nháp nếu có, chưa có mới tạo. Dọn attempt chưa xong và không có đáp án quá 7 ngày bằng migration hoặc job. Dùng bảng `quiz_autosave` đang bỏ không (OP-04) để lưu nháp phía server, đổi thiết bị không mất bài.

**Nghiệm thu**: gọi `startQuiz` 3 lần liên tiếp chỉ tạo 1 attempt, câu hỏi giống hệt.

### QZ-05 · P2 · Câu trả lời ngắn (SA)

**Hiện trạng**: `validateOptions` ép SA có đúng 1 đáp án; chấm lấy option đúng đầu tiên rồi so bằng `normalizeAnswer`. Không chấp nhận nhiều dạng (0,5 hoặc 1/2), không so số. Đã chạy: `0,5` khác `0.5` và `1 500` khác `1500` sau chuẩn hoá hiện tại.

**Yêu cầu sửa**

1. Cho phép SA có từ 1 option `isCorrect` trở lên (đáp án chấp nhận); sửa `validateOptions` và giao diện soạn câu.
2. Hàm `gradeShortAnswer(input, accepted[], opts)`. Nếu đáp án chấp nhận parse được thành số: bỏ khoảng trắng, đổi `,` thành `.`, không chấp nhận dấu phân cách hàng nghìn, so `Math.abs(a - b) <= tolerance` (mặc định 0; cột mới `questions.tolerance`). Ngược lại so chuỗi bằng `normalizeAnswer` mới (FD-06).
3. Đúng với **bất kỳ** đáp án chấp nhận. Dùng chung cho Tab 4 và live.

**Nghiệm thu**: đáp án `0.5`, HS nhập `0,5` hoặc `0.50` thì đúng. `1/2` chỉ đúng khi GV thêm `1/2` làm đáp án chấp nhận.

### QZ-06 · P2 · Thang điểm (cần chuyên môn xác nhận)

**Hiện trạng**: `pointPerSlot = 10 / totalSlots`, mỗi slot (MC = 1, SA = 1, mỗi ý TF = 1) bằng nhau. Cấu trúc 18 MC + 4 TF + 6 SA của chế độ ngẫu nhiên khớp cấu trúc đề tham khảo. Cách chấm TF tuyến tính (0,25 điểm mỗi ý) khác cách chấm câu Đúng/Sai thường dùng ở đề thi tốt nghiệp THPT (1 ý đúng 0,1; 2 ý 0,25; 3 ý 0,5; 4 ý 1,0). Chế độ theo KP không giới hạn số câu nên trọng số mỗi câu đổi theo bài. Mình chưa đối chiếu quy chế hiện hành; cần giáo viên chuyên môn xác nhận.

**Yêu cầu sửa** (cấu hình, mặc định giữ hành vi cũ): thêm `scoringMode: 'linear' | 'thpt'`. Chế độ `thpt`: MC 0,25 mỗi câu, SA 0,25 mỗi câu, TF theo bậc 0 / 0,1 / 0,25 / 0,5 / 1,0, rồi **chuẩn hoá về thang 10 theo tổng điểm tối đa của đề đã phát** (không giả định đủ 18/4/6). Lưu `scoringMode` và `maxScore` vào attempt.

**Nghiệm thu**: bảng test theo số ý TF đúng; đề 18/4/6 làm đúng hết cho 10,0.

### QZ-07 · P2 · GV sửa câu hỏi làm hỏng bài đang làm

**Hiện trạng**: `updateQuestion` xoá toàn bộ `question_options` rồi chèn lại với **ID mới**. HS đang làm (nháp localStorage giữ optionId cũ) hoặc phiên live đang chạy (state in-memory giữ optionId cũ) nộp thì optionId không còn, bị chấm sai. Ngoài ra `validateOptions` (MC ít nhất 2 lựa chọn, TF ít nhất 1 ý) lỏng hơn kiểm tra import (MC đúng 4, TF đúng 4), nên câu soạn tay và câu import theo hai chuẩn khác nhau.

**Yêu cầu sửa**

1. `updateQuestion` cập nhật tại chỗ, giữ id option (thêm, xoá, sửa theo id).
2. Nhờ snapshot (QZ-01), bài đang làm chấm theo snapshot nên không bị ảnh hưởng.
3. Dùng chung một hàm validate giữa import và soạn tay (MC 4 lựa chọn / 1 đúng, TF 4 ý).

**Nghiệm thu**: GV sửa chữ một lựa chọn khi HS đang làm; HS nộp, optionId cũ vẫn chấm đúng theo snapshot.

### QZ-08 · P2 · Chọn đề

**Hiện trạng** (`selectQuizQuestions`): nếu **có bất kỳ** câu nào gắn KP thì đề là **toàn bộ** câu (nhóm theo KP, rồi các câu chưa gắn KP), không giới hạn số câu, không ưu tiên KP HS còn yếu. Chỉ khi không câu nào gắn KP mới rút ngẫu nhiên 18/4/6. Ngưỡng 18/4/6 viết cứng.

**Yêu cầu sửa**

1. Cấu hình theo bài: `quizSize` hoặc cấu trúc `{mc, tf, sa}` (mặc định 18/4/6).
2. Chế độ theo KP: tối thiểu 1 câu mỗi KP, phần còn lại ưu tiên KP có `overallStatus = 'unknown'` hoặc `fillFirstTry = 'incorrect'`.
3. Giữ seed ổn định. Trả về UI số câu dự kiến trước khi bắt đầu.

**Nghiệm thu**: bài có 60 câu gắn KP chỉ phát đúng số câu đã cấu hình, mỗi KP có ít nhất 1 câu.

## 6. Live quiz

### LV-01 · P1 · Thời gian chỉ kiểm ở client

**Hiện trạng**: `timeLimitSec` chỉ để client hiển thị đồng hồ. `submitLiveAnswer` chỉ kiểm tra `phase === 'question'`, nên HS trả lời được đến khi GV bấm hiện đáp án, kể cả sau khi hết giờ.

**Yêu cầu sửa**: tính `elapsed = Date.now() - state.questionStartedAt`; nếu `elapsed > timeLimitSec * 1000 + 1500` (ân hạn mạng) thì từ chối 'Đã hết thời gian'. Tuỳ chọn: tự chuyển phase sang 'revealed' khi hết giờ.

**Nghiệm thu**: đáp án gửi sau hạn bị từ chối, trong hạn được nhận.

### LV-02 · P1 · Không kiểm tra HS thuộc lớp

**Hiện trạng**: `joinQuiz` kiểm tra HS thuộc lớp của phiên, nhưng `submitLiveAnswer` chỉ gọi `requireRole('student')`. Biết `sessionId` (lộ khi chia sẻ link hoặc QR) và `questionId` hiện tại thì HS lớp khác trả lời được và bị thêm vào `joined`. `answer` cũng không được kiểm tra thuộc lựa chọn của câu.

**Yêu cầu sửa**: trước khi chấm, kiểm tra HS thuộc lớp của phiên (cache một `Set` trong state khi join, tra DB nếu thiếu). MC: `answer` phải là optionId thuộc câu. TF: mọi id trong chuỗi phải thuộc câu. SA: tối đa 200 ký tự.

### LV-03 · P1 · Kết quả live không được lưu

**Hiện trạng**: `state.answers` (Map trong RAM) bị `clear()` mỗi lần `goToQuestion`. Sự kiện `answer_submitted` chỉ lưu `correct` và `index`, không lưu đáp án đã chọn hay thời gian trả lời. Hệ quả:

- GV quay lại câu trước thì HS trả lời lại được và ghi đè.
- Restart server, cold start hoặc nhiều instance làm mất đáp án, lobby và danh sách `joined`. `package.json` có `@vercel/analytics`, và comment trong `lib/realtime.ts` đã ghi bus chỉ chạy một tiến trình.
- Không có thống kê live theo từng HS sau phiên.

**Yêu cầu sửa**

1. Bảng `live_answers(sessionId, questionId, studentId, round, answer, isCorrect, answeredAt, responseMs)`, PK gồm `(sessionId, questionId, studentId, round)`. `round` tăng mỗi lần GV vào lại câu.
2. `submitLiveAnswer` ghi bảng này (`ON CONFLICT DO NOTHING` thì báo 'Bạn đã trả lời'). RAM chỉ là cache.
3. `ensureLiveState` dựng lại đáp án của câu hiện tại từ DB.
4. Nếu triển khai nhiều instance: thay `realtime.ts` bằng Postgres LISTEN/NOTIFY hoặc Redis pub/sub. Việc này lớn, tách ticket riêng.

**Nghiệm thu**: restart server giữa câu, HS đã trả lời vẫn bị chặn trả lời lại. GV xem được đáp án từng HS sau phiên.

### LV-04 · P2 · Chấm TF / SA live khác Tab 4

**Hiện trạng**: TF live chỉ đúng khi tập ý 'Đúng' khớp hoàn toàn (được hết hoặc mất hết); SA live dùng `correctText` của option đúng đầu tiên. Tab 4 chấm TF theo từng ý.

**Yêu cầu sửa**: đưa chấm điểm vào module thuần `lib/scoring.ts` (`gradeMC`, `gradeTF`, `gradeSA`) dùng cho cả Tab 4 và live; live TF theo cùng `scoringMode`; SA theo QZ-05.

## 7. Thống kê và trạng thái bài tập

### ST-01 · P1 · 'Hoàn thành' khi mới tự đánh giá xong

**Vị trí**: `lib/assignment-status.ts`, `assignments.ts` (khoảng dòng 255–275), `class-stats.ts` (khoảng dòng 276–290 và 372–395).

**Hiện trạng**: `deriveStudentAssignmentStatus` coi là 'completed' khi `hasCompletedQuiz` **hoặc** `touchedKp >= totalKp`, trong đó `touched` là KP có `overallStatus != 'not_started'`. `submitTab1` đã đặt `overallStatus` thành 'known' hoặc 'unknown' cho mọi KP, nên HS chỉ cần xong Tab 1 là bài giao thành 'Hoàn thành' với tiến độ 100% dù chưa làm Tab 2–4. Bảng thống kê lớp cũng đếm 'completed' và chia đúng hạn / trễ từ đó. Thêm nữa, `hasCompletedQuiz` đếm mọi attempt từ trước, kể cả trước lần reset hiện tại. Đây là suy luận từ code, chưa chạy trên dữ liệu thật.

**Yêu cầu sửa**

1. `completed` khi và chỉ khi có attempt hoàn tất **sau** mốc `submittedAt` của chu kỳ hiện tại (cùng điều kiện `stage === 'done'` của `resolveStudyStage`; dùng chung một hàm).
2. `in_progress` khi đã nộp Tab 1 hoặc đã có tiến độ.
3. `progressPercent` tính theo các bước đã xong (Tab 1, 2, 3, 4) thay vì số KP đã chạm.
4. `completedAt` lấy từ attempt hoàn tất, dùng để chia đúng hạn / trễ.
5. Đổi tên chỉ số `completionRate` (hiện là tỉ lệ HS có hoạt động) thành `activeRate`, hoặc tính đúng nghĩa hoàn thành.

**Nghiệm thu**: HS chỉ xong Tab 1 thì trạng thái 'Đang làm', tiến độ dưới 100%. Chỉ sau khi nộp Tab 4 mới 'Hoàn thành'.

### ST-02 · P2 · Múi giờ của streak và hoạt động tuần

**Hiện trạng**: `computeActivityStreak` và `weeklyProgress` (`student-stats.ts`) dùng `getDate()` / `setHours(0,0,0,0)` theo múi giờ của server (thường là UTC khi deploy). HS Việt Nam học từ 00:00 đến 07:00 bị tính vào ngày hôm trước; chuỗi ngày và biểu đồ tuần lệch.

**Yêu cầu sửa**: một hàm `dayKey(date)` dùng `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })`; mọi chỗ gom theo ngày và mốc 'hôm nay' đều dùng hàm này. Múi giờ đặt trong một hằng số cấu hình.

**Nghiệm thu**: thời điểm 23:30 UTC ngày D (06:30 ngày D+1 ở Việt Nam) được tính vào ngày D+1.

## 8. Tối ưu và dọn dẹp

- **OP-01 · Hiệu năng**: `submitTab1` chạy N truy vấn tuần tự (xem FD-10). `submitQuiz` seed `spaced_repetition` mỗi KP một cặp select + insert (đổi thành một lệnh `insert ... on conflict do nothing`). `resolveStudyStage` làm 3–4 truy vấn mỗi lần mở bài, nên gộp thành một truy vấn tổng hợp. `getTab3Questions` nạp toàn bộ KP của bài chỉ để lấy chip nhiễu.
- **OP-02 · Tách module chấm điểm**: gom `normalizeAnswer`, `gradeSlots`, `gradeMC/TF/SA` và tính điểm vào `lib/scoring.ts` thuần (không phụ thuộc DB), để test được và dùng chung cho Tab 2/3/4 và live.
- **OP-03 · DDL lúc chạy request**: `ensureSchema()` chạy `ALTER TABLE ... IF NOT EXISTS` ngay trong request (`startQuiz`, `loadQuizQuestions`). Chuyển sang migration chính thức (drizzle-kit) và bỏ khỏi đường request.
- **OP-04 · Mã chết**: `quiz_autosave` (không code nào dùng; nháp Tab 4 chỉ ở localStorage nên mất khi đổi máy), `spaced_repetition` (chỉ seed, không bao giờ cập nhật theo kết quả, chưa có màn ôn tập), `worksheet_attempts` và `worksheet_answers` (không có code chấm). Quyết định hoặc triển khai hoặc xoá bảng để tránh hiểu nhầm.
- **OP-05 · Chống dò đáp án**: ngoài FD-08, giới hạn số lượt chấm mỗi KP mỗi phút theo học sinh.
- **OP-06 · Cảnh báo khi soạn bài**: cảnh báo khi lưu KP nếu chữ đáp án ngắn hơn 2 ký tự (dễ trùng, dễ lẫn), nếu một nhóm hoán đổi có hai ô trùng chữ, hoặc nếu đáp án chứa dấu nháy cong.

## 9. Migration, thứ tự triển khai, kiểm thử

### 9.1 Migration (một file, chạy lại được)

```sql
-- FD-10
DELETE FROM student_tab1_submissions a USING student_tab1_submissions b
  WHERE a."studentId" = b."studentId" AND a."lessonId" = b."lessonId"
    AND (a."submittedAt", a.id) < (b."submittedAt", b.id);
ALTER TABLE student_tab1_submissions
  ADD CONSTRAINT s1_student_lesson_unique UNIQUE ("studentId", "lessonId");

-- FD-08, FD-09
ALTER TABLE student_progress
  ADD COLUMN IF NOT EXISTS "fillFirstTry" text,
  ADD COLUMN IF NOT EXISTS "dragFirstTry" text,
  ADD COLUMN IF NOT EXISTS "fillGaveUp" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "fillRevealed" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "dragRevealed" boolean NOT NULL DEFAULT false;

-- QZ-01
CREATE TABLE IF NOT EXISTS quiz_attempt_questions (
  "attemptId" uuid NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  "questionId" uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  position integer NOT NULL,
  "optionOrder" jsonb,
  snapshot jsonb NOT NULL,
  PRIMARY KEY ("attemptId", "questionId"));

-- QZ-03, QZ-05, QZ-06
ALTER TABLE quiz_answers ADD COLUMN IF NOT EXISTS "optionId" uuid;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS tolerance double precision;
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS "scoringMode" text NOT NULL DEFAULT 'linear';

-- LV-03
CREATE TABLE IF NOT EXISTS live_answers (
  "sessionId" uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  "questionId" uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  "studentId" text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  round integer NOT NULL DEFAULT 1,
  answer text,
  "isCorrect" boolean NOT NULL,
  "answeredAt" timestamptz NOT NULL DEFAULT now(),
  "responseMs" integer,
  PRIMARY KEY ("sessionId", "questionId", "studentId", round));
```

Các cột `startedAt`, `completedAt`, `submittedAt` hiện là `timestamp` không múi giờ. Giữ nguyên trong đợt này (không đổi kiểu cùng lúc), chỉ cần ST-02 xử lý khi gom ngày. Backfill `fillFirstTry` / `dragFirstTry` theo công thức ở FD-09 bước 6.

### 9.2 Thứ tự triển khai đề xuất

1. **Đợt 1 (P0)**: FD-01, FD-02 (kèm backfill và script roundtrip), QZ-01 (làm cùng QZ-02 vì cùng chạm `submitQuiz`).
2. **Đợt 2 (tính đúng và chặn gian lận)**: FD-03, FD-04, FD-05, FD-07, QZ-03, LV-01, LV-02, ST-01.
3. **Đợt 3 (cần chốt mục 10 trước)**: FD-06, FD-08, FD-09, QZ-05, QZ-06, LV-03, LV-04.
4. **Đợt 4**: FD-10, FD-11, QZ-04, QZ-07, QZ-08, ST-02, OP-01 đến OP-06.

### 9.3 Bộ test bắt buộc

Đặt trong `scripts/` theo kiểu `check-*.mjs` hiện có, hoặc dùng `node --test`. Hiện repo chưa có test nào cho chấm điểm.

| Nhóm | Ca kiểm | Kỳ vọng |
| --- | --- | --- |
| renderSlots | 3 ví dụ FD-01; câu bắt đầu bằng khoảng trắng; ô trùng chữ 2 lần | Ô đúng vị trí đã đánh dấu |
| roundtrip | Mọi KP trong DB | `extractBlanks(render(c, t))` trả đúng c và t |
| gradeSlots | synonyms chéo; điền trùng 1 đáp án 2 lần; 3 đúng 1 sai | true; false; chỉ ô sai bị đỏ |
| nhóm hoán đổi | timin / xitozin; `A, T, G và X` | 2 nhóm; 1 nhóm |
| normalize | 5 dòng đầu bảng FD-06 | Bằng nhau |
| SA | `0,5`, `0.50`, `1/2`; nhiều đáp án chấp nhận | Theo QZ-05 |
| submitQuiz | questionId ngoài đề; bỏ trống TF; 10 lần nộp song song | Bỏ qua hoặc lỗi; 0 điểm; đúng 1 lần nộp |
| chấm điểm | Đề 18/4/6 toàn đúng; TF 1/2/3/4 ý đúng | 10,0; theo `scoringMode` |
| quyền | kpId của GV khác; submitTab1 với kpId ngoài bài | Lỗi quyền |
| live | Nộp sau hạn; HS lớp khác; restart giữa câu | Từ chối; từ chối; không trả lời lại được |
| thống kê | Chỉ xong Tab 1; 23:30 UTC | in\_progress; tính ngày Việt Nam |

## 10. Câu hỏi cần chủ sản phẩm / chuyên môn quyết trước

1. **Đáp án không dấu**: có chấp nhận `nucleotit` cho `nuclêôtit` không? Nếu có, thêm cờ `answerMatching = 'ignore-diacritics'` theo bài (chữ đ cần xử lý riêng vì chuẩn hoá NFD không tách được). Đề xuất mặc định: không.
2. **Xem đáp án rồi mới đúng** (FD-08): có còn tính 'mastered' không? Đề xuất: vẫn tính, nhưng thống kê hiển thị riêng nhóm 'đã xem đáp án'.
3. **Nhánh 'điền sai → kéo thả'** (FD-09): phương án A (nút chuyển sang Kéo thả sau 3 lần sai) hay B (bỏ nhánh, Tab 3 chỉ dành cho KP 'Chưa biết').
4. **Quy tắc ngoặc kép thường là ô hoán đổi** (FD-05): giữ (kèm cảnh báo) hay bỏ, chỉ nhận `__"từ"__`.
5. **Thang điểm** (QZ-06): giữ tuyến tính hay theo bậc thang của đề thi; áp dụng toàn hệ thống hay theo bài.
6. **Hoàn thành bài tập** (ST-01): chỉ cần xong Tab 4 hay phải đạt điểm tối thiểu; và làm lại sau reset có tính 'hoàn thành' mới không.
7. **Triển khai**: ứng dụng chạy một tiến trình hay serverless / nhiều instance? Quyết định phạm vi LV-03 (Redis hay Postgres LISTEN/NOTIFY).

Tài liệu này dựng từ việc đọc code và chạy các hàm thuần. Các mục ghi 'Đọc code' nên có test xác nhận trước khi sửa, đặc biệt QZ-01, ST-01 và LV-03.
