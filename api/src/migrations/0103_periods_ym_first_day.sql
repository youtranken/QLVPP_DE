-- 0103: kỳ luôn định danh bằng ngày 1 của tháng (ymToDate)
ALTER TABLE periods
  ADD CONSTRAINT periods_ym_first_day_ck CHECK (extract(day FROM ym) = 1);
