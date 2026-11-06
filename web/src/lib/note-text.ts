// Server đếm ghi chú theo mã điểm sau NFC + trim: bộ đếm và cắt ở web dùng cùng cách để số hiện khớp số bị từ chối
export const noteLength = (note: string) => [...note.normalize('NFC').trim()].length;

export const cutNote = (note: string, max: number) => [...note.normalize('NFC')].slice(0, max).join('');
