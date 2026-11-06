-- Danh sách người đóng băng lúc khóa sổ, cùng giao dịch với headcount; NULL = kỳ mở hoặc kỳ cũ (đếm sống)
ALTER TABLE periods ADD COLUMN headcount_subs text[];
