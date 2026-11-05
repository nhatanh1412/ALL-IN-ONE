# N_AnhVN Ultimate Discord Bot — giai đoạn 1

## Đã triển khai

- `/help` và `/whitelist add|remove|list`; whitelist lưu riêng cho từng server trong PostgreSQL.
- `/warn` lưu cảnh cáo và `/warnings` xem 10 cảnh cáo gần nhất, riêng theo server; cần quyền Moderate Members. Lịch sử lưu lý do, người cảnh cáo và thời điểm, không tự động xử phạt.
- ID `1329340429207863317` được sử dụng lệnh whitelist, luôn nằm trong whitelist hiệu lực và không thể bị xóa khỏi đó. Các lệnh cảnh cáo vẫn yêu cầu quyền Discord và tuân thủ thứ bậc vai trò.
- Chống spam cơ bản: từ tin thứ 6 trong 10 giây, bot thử xóa tin nhắn của người không nằm trong whitelist. Bộ đếm nằm trong bộ nhớ và đặt lại khi khởi động lại; bot cần quyền Manage Messages.

Bot không thể ngăn quản trị viên khác kick hoặc ban người dùng trực tiếp hoặc thông qua bot khác. Các cơ chế anti-raid, anti-toxic và phần lớn lệnh quản trị chưa được triển khai; whitelist chưa có tác dụng với chúng.

## Chạy bot

1. Cài Node.js 20 trở lên và PostgreSQL, tạo database.
2. Chạy `npm install`, sao chép `.env.example` thành `.env`, điền token và chuỗi kết nối PostgreSQL. Không chia sẻ file `.env`.
3. Trong Discord Developer Portal, bật **Message Content Intent** tại Bot → Privileged Gateway Intents. Mời bot với phạm vi `bot` và `applications.commands`, cấp quyền xem kênh và Manage Messages.
4. Chạy `npm start`. Migration được áp dụng tự động trước khi bot đăng nhập; tài khoản PostgreSQL cần quyền tạo bảng. Slash commands được đăng ký toàn cục và có thể mất thời gian xuất hiện.

## Kiến trúc và kế hoạch

Bot dùng Node.js, discord.js v14 và PostgreSQL. Entry point hiện tại là `src/index.js`; migration nằm tại `src/database/migrations.js`. Các module sau sẽ được tách thành lệnh, xử lý sự kiện, service và repository, với kiểm tra quyền ở ranh giới Discord. Cấu hình và bí mật nằm trong biến môi trường, không đưa `.env` lên GitHub.

Schema hiện có: `schema_migrations` lưu phiên bản đã áp dụng; `security_whitelist_users` lưu người dùng tin cậy theo cặp khóa `(guild_id, user_id)`. Migration đầu tiên giữ lại dữ liệu whitelist từ phiên bản trước. Mỗi thay đổi schema tiếp theo cần một migration mới; sao lưu PostgreSQL trước khi nâng cấp.

Thiết kế dữ liệu dự kiến: cấu hình và nhật ký theo server; nhân vật, ví, kho và tiến trình gắn với `(guild_id, user_id)`; sổ giao dịch và khóa idempotency để chống xử lý trùng; tông môn, pet, dungeon và boss có bảng riêng cùng khóa ngoại và chỉ mục. Chuyển tiền, trao đổi vật phẩm và phát thưởng phải nằm trong transaction, khóa các bản ghi liên quan và ghi nhật ký cùng transaction. Các bảng này chưa được tạo cho tới khi module tương ứng được triển khai.

Thứ tự dự kiến: (1) nền tảng và migration; (2) quản trị, bảo mật, anti-toxic; (3) economy và tu tiên, sau đó tông môn, pet, dungeon, bí cảnh, boss, câu cá, chế tạo và giao dịch; (4) XP, ticket, welcome, log, NPC và giải trí; (5) dashboard OAuth2, kiểm thử tích hợp và hoàn thiện vận hành. Mỗi giai đoạn phải chạy độc lập và chỉ công bố tính năng thực sự đã hoàn thành.

## Đóng gói ZIP trên Windows

Chạy `powershell -ExecutionPolicy Bypass -File .\create-zip.ps1` trong thư mục dự án để tạo `N_AnhVN-bot.zip`. ZIP chứa `.env.example`, không chứa `.env` hoặc `node_modules` để tránh lộ bí mật. Sau khi giải nén trên máy khác, sao chép `.env.example` thành `.env`, điền thông tin và chạy `npm install` trước khi khởi động.

## Chưa triển khai

Ngoài `/warn` và `/warnings`, các lệnh quản trị khác, anti-raid/nuke, anti-toxic, economy, tu tiên, tông môn, pet, dungeon, bí cảnh, boss, câu cá, trang bị, chế tạo, giao dịch, mini game, XP, giải trí, ticket, welcome, log, NPC, dashboard, backup và các hệ thống mở rộng đều chưa có. Chưa có kiểm thử tự động và chưa chạy kiểm thử.