-- Chủ dự án chốt 18/11/2026: bỏ khối liên hệ Adm D&E (câu cố định trong web) và công tắc chuông sắp hết (luôn bật)
DELETE FROM config WHERE key IN ('admin_contact', 'low_stock_notify');
