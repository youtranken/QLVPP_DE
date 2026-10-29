-- 0108: thứ tự chèn ổn định cho lịch sử đợt giao (hai đợt cùng mili-giây; id là uuid ngẫu nhiên)

ALTER TABLE line_deliveries
  ADD COLUMN IF NOT EXISTS seq bigint GENERATED ALWAYS AS IDENTITY;
