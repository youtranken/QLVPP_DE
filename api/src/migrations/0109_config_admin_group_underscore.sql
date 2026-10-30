-- PMH ID không cho dấu '-' trong tên nhóm; chỉ đổi khi còn giá trị mặc định cũ
UPDATE config SET value = '"vpp_admin"', updated_at = now()
WHERE key = 'admin_group' AND value = '"vpp-admin"';
