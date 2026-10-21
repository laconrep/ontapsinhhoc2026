// SEC-01: rà soát tài khoản có role='teacher' sau khi khóa đường tự cấp
// quyền giáo viên (sualogic.md mục 12).
//
// CHỈ ĐỌC — script này KHÔNG tự hạ quyền bất kỳ ai. Quản trị viên xem
// danh sách, xác nhận từng tài khoản với thực tế (giáo viên thật của
// trường), rồi mới hạ các tài khoản không hợp lệ về 'student' bằng tay
// (sau khi đã sao lưu DB).
//
// Cách dùng:
//   DATABASE_URL=<url> node scripts/audit-teachers.mjs
// Không có DATABASE_URL -> in bỏ qua (giống các backfill khác).

const url = process.env.DATABASE_URL
if (!url) {
  console.log("Khong co DATABASE_URL — bo qua audit teachers")
  process.exit(0)
}

const pg = await import("pg")
const Pool = pg.Pool ?? pg.default?.Pool ?? pg.default
const pool = new Pool({ connectionString: url })
try {
  const { rows } = await pool.query(
    `SELECT id, name, email, "isOnboarded", "createdAt"
       FROM "user"
      WHERE role = 'teacher'
      ORDER BY "createdAt" ASC`,
  )
  console.log(`Tổng số tài khoản role='teacher': ${rows.length}`)
  for (const r of rows) {
    console.log(
      `- ${r.id} | ${r.name} | ${r.email} | onboarded=${r.isOnboarded} | created=${new Date(r.createdAt).toISOString()}`,
    )
  }
  console.log(
    "\nViệc cần làm: đối chiếu từng tài khoản với danh sách giáo viên thật.",
  )
  console.log(
    "Tài khoản không hợp lệ -> hạ về student THỦ CÔNG sau khi sao lưu DB, ví dụ:",
  )
  console.log(`  UPDATE "user" SET role='student' WHERE id='<id>';`)
} finally {
  await pool.end()
}
