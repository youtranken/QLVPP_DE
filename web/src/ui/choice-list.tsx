import { useId } from 'react';

export interface Choice<T extends string> {
  value: T;
  label: string;
}

// Nhóm lựa chọn một-trong-nhiều dạng danh sách liền khối: cả hàng là vùng bấm, hàng đang chọn tô nền nhấn nhạt,
// vòng focus ôm hàng (không ôm riêng ô tròn). Dùng thay radio rời xếp lưới khi lựa chọn là việc chính của hộp.
export function ChoiceList<T extends string>({
  label,
  value,
  choices,
  required = false,
  onChange,
}: {
  label: string;
  value: T | null;
  choices: Choice<T>[];
  required?: boolean;
  onChange: (value: T) => void;
}) {
  const id = useId();
  return (
    <div className="ff choice-list">
      <span id={`${id}-label`} className="ff-label">
        {label}
        {required && <span className="ff-req" aria-hidden="true"> *</span>}
      </span>
      <div role="radiogroup" aria-labelledby={`${id}-label`} aria-required={required || undefined} className="choice-list__rows">
        {choices.map((c) => (
          <label key={c.value} className="choice-row">
            <input type="radio" name={`${id}-choice`} checked={value === c.value} onChange={() => onChange(c.value)} />
            <span>{c.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
