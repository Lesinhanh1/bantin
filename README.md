# 📰 bantin — Trợ lý tin tức cá nhân (Cloudflare, miễn phí)

Kéo tin từ RSS/Atom, Hacker News, Reddit, GitHub Releases → lọc thô → LLM miễn phí chấm điểm + tóm tắt tiếng Việt → xem trên web, nhận bản tin sáng qua Telegram, xuất `.md` sang Obsidian.

```
Cron 15' ─► Worker ─► kéo 3 nguồn đến hạn ─► lọc thô ─► D1
                   └► lấy 15 tin chưa chấm ─► LLM (Groq → Gemini → Mistral → Workers AI) ─► D1
Cron 7:00 VN ─► gửi top 10 qua Telegram ─► xoá tin cũ > 30 ngày
Trình duyệt ─► GET /  (giao diện) ─► /api/* (cần ACCESS_TOKEN)
```

## Cấu trúc

| File | Vai trò |
|---|---|
| `src/sources.ts` | **Danh sách nguồn** — sửa ở đây |
| `src/profile.ts` | **Hồ sơ sở thích**, từ khoá chặn, bộ tag — sửa ở đây |
| `src/fetchers.ts` | Kéo & parse RSS/Atom/HN, chuẩn hoá URL |
| `src/llm.ts` | Lớp gọi LLM có dự phòng nhiều nhà cung cấp |
| `src/score.ts` | Chấm điểm/tóm tắt theo lô, học từ Lưu/Bỏ qua |
| `src/pipeline.ts` | Vòng cron: chọn nguồn đến hạn → lưu → chấm |
| `src/digest.ts` | Bản tin Telegram + dọn dữ liệu |
| `src/index.ts` | Router API + xuất Markdown |
| `src/ui.ts` | Giao diện web một trang |
| `schema.sql` | Schema D1 |

## Cài đặt (khoảng 15 phút)

Cần: Node.js 18+, tài khoản Cloudflare (gói Free).

```bash
npm install
npx wrangler login

# 1. Tạo database, chép database_id in ra vào wrangler.toml
npx wrangler d1 create bantin

# 2. Tạo bảng
npm run db:init

# 3. Đặt secrets (mỗi lệnh sẽ hỏi giá trị)
npx wrangler secret put ACCESS_TOKEN        # tự đặt 1 chuỗi dài ngẫu nhiên — dùng để đăng nhập giao diện
npx wrangler secret put GROQ_API_KEY        # https://console.groq.com/keys
npx wrangler secret put GEMINI_API_KEY      # https://aistudio.google.com/apikey
npx wrangler secret put MISTRAL_API_KEY     # https://console.mistral.ai  (nên tắt "train on data" trong Admin)
npx wrangler secret put TELEGRAM_BOT_TOKEN  # tuỳ chọn, xem bên dưới
npx wrangler secret put TELEGRAM_CHAT_ID    # tuỳ chọn

# 4. Deploy
npm run deploy
```

Mở URL `https://bantin.<tài-khoản>.workers.dev`, nhập `ACCESS_TOKEN`, bấm **⟳ Chạy** vài lần để kéo tin lần đầu (mỗi lần kéo 3 nguồn).

> Không bắt buộc có đủ cả 3 key LLM — có 1 key là chạy được. Thiếu key nào thì lớp LLM tự bỏ qua. Workers AI luôn có sẵn làm phương án cuối (10.000 neurons/ngày).

### Tạo token ngẫu nhiên
```bash
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

### Telegram
1. Chat với **@BotFather** → `/newbot` → lấy token.
2. Nhắn một tin bất kỳ cho bot vừa tạo.
3. Mở `https://api.telegram.org/bot<TOKEN>/getUpdates` → lấy `"chat":{"id": ...}`.
4. Đặt 2 secret ở bước 3, rồi thử: trong giao diện chưa có nút, gọi trực tiếp
   `curl -X POST -H "Authorization: Bearer <ACCESS_TOKEN>" https://bantin.<...>.workers.dev/api/digest`

## Tuỳ chỉnh

- **Thêm nguồn**: thêm object vào `src/sources.ts`. Dùng `include`/`exclude` để lọc thô bằng từ khoá (tiết kiệm LLM), `intervalMin` để giãn tần suất.
- **Điểm sát hơn**: viết lại `INTEREST_PROFILE` trong `src/profile.ts` càng cụ thể càng tốt. Ngoài ra, các tin anh bấm **Lưu / Bỏ qua** gần đây được đưa vào prompt làm ví dụ — dùng càng nhiều, lọc càng đúng khẩu vị.
- **Đổi thứ tự / model LLM**: `LLM_ORDER`, `*_MODEL` trong `wrangler.toml`. Model và hạn mức free thay đổi thường xuyên — xem hạn mức thật trong console từng nhà cung cấp.
- **Giờ gửi bản tin**: cron `0 0 * * *` (UTC) = 7:00 sáng VN. Nếu đổi, sửa cả `DIGEST_CRON` trong `src/index.ts`.

## API

Tất cả cần header `Authorization: Bearer <ACCESS_TOKEN>`.

| Method | Path | |
|---|---|---|
| GET | `/api/items?view=top\|new\|saved&cat=dev-ai\|trading\|pkm&days=3` | Danh sách tin |
| POST | `/api/items/:id/action` body `{"action":"saved"\|"dismissed"\|null}` | Lưu / bỏ qua |
| GET | `/api/items/:id/md` | Tải file Markdown (frontmatter cho Obsidian) |
| GET | `/api/sources` | Trạng thái & lỗi từng nguồn |
| POST | `/api/run?force=1` | Chạy một vòng ngay |
| POST | `/api/digest` | Gửi bản tin Telegram ngay |

## Chạy thử local

```bash
npm run db:init:local
echo "ACCESS_TOKEN=test" > .dev.vars      # thêm các key LLM vào đây nếu muốn
npm run dev
# giả lập cron:
curl "http://localhost:8787/cdn-cgi/local/scheduled?cron=*/15+*+*+*+*"
# (wrangler bản cũ: /__scheduled?cron=...)
```

## Lưu ý khi chạy gói Free

- **CPU 10 ms/lần chạy**: thời gian chờ mạng không tính, nhưng parse XML có tính. Nếu log báo *exceeded CPU*, giảm `FETCH_BATCH` xuống 2 hoặc 1 (cron 15 phút vẫn đủ đi hết 12 nguồn).
- **Reddit** đôi khi chặn IP của Cloudflare (lỗi 403/429) — xem `/api/sources`. Nếu bị chặn thường xuyên, bỏ nguồn Reddit hoặc chuyển phần đó sang GitHub Actions.
- **URL RSS** của báo Việt Nam có thể đổi; nguồn nào lỗi sẽ hiện `last_error` ở `/api/sources`.
- **Bảo mật**: giao diện công khai nhưng dữ liệu cần token. Muốn chặt hơn, bật **Cloudflare Access** (Zero Trust, miễn phí tới 50 người) cho domain `workers.dev` của Worker.
- Chỉ đưa vào đây tin tức công khai — gói free của Gemini/Mistral có thể dùng dữ liệu gửi lên để huấn luyện.

## Lộ trình tiếp

- [ ] Nút "Gửi bản tin" và trang trạng thái nguồn trong giao diện
- [ ] Tìm kiếm toàn văn (D1 FTS5)
- [ ] Gom tin trùng chủ đề từ nhiều nguồn
- [ ] Đồng bộ trực tiếp vào vault Obsidian (qua GitHub repo hoặc plugin)
