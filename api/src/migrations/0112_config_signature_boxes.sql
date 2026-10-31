-- Mẫu D&E chỉ có 2 ô ký: head → Chủ quản đơn vị, preparer → Người yêu cầu, approver bỏ (review-spec.md)
INSERT INTO config (key, value)
SELECT 'signature_boxes', jsonb_build_array(
  jsonb_build_object('title', 'Chủ quản đơn vị', 'title_en', 'Head of Dept.',
                     'name', COALESCE(old.value ->> 'head', '')),
  jsonb_build_object('title', 'Người yêu cầu', 'title_en', 'Applicant',
                     'name', COALESCE(old.value ->> 'preparer', ''))
)
FROM (SELECT (SELECT value FROM config WHERE key = 'signers') AS value) old
ON CONFLICT (key) DO NOTHING;

DELETE FROM config WHERE key = 'signers';

-- 3 = hành vi cũ; luật mới reminder ≤ registration_last_day − 1 nên hạn ngày 3 thì seed 2
INSERT INTO config (key, value)
SELECT 'reminder_days_left', to_jsonb(LEAST(3, COALESCE(
  (SELECT (value #>> '{}')::int FROM config WHERE key = 'registration_last_day'), 10) - 1))
ON CONFLICT (key) DO NOTHING;
