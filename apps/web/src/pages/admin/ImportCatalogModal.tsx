import { InboxOutlined } from '@ant-design/icons';
import { Alert, App, Button, Flex, Modal, Table, Tag, Typography } from 'antd';
import { useState } from 'react';
import { api, ApiError } from '../../lib/api';
import {
  useApplyCatalogImport,
  type DongXemTruoc,
  type KetQuaXemTruoc,
} from '../../lib/admin-queries';

const NHAN: Record<DongXemTruoc['hanhDong'], { text: string; color: string }> = {
  them: { text: 'Thêm mới', color: 'green' },
  capNhat: { text: 'Cập nhật', color: 'blue' },
  khongDoi: { text: 'Không đổi', color: 'default' },
  loi: { text: 'Lỗi', color: 'red' },
};

/**
 * Nhập danh mục từ Excel/CSV (ADMIN-9).
 *
 * Luôn **xem trước rồi mới ghi**: ghi thẳng vào danh mục từ một file người ta vừa
 * chọn vội là cách nhanh nhất để hỏng dữ liệu của cả công ty. Bảng xem trước nói
 * rõ từng dòng sẽ thêm, sửa gì, hay hỏng ở đâu.
 */
export function ImportCatalogModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { message } = App.useApp();
  const [xemTruoc, setXemTruoc] = useState<KetQuaXemTruoc | null>(null);
  const [tenFile, setTenFile] = useState('');
  const [dangDoc, setDangDoc] = useState(false);
  const ghi = useApplyCatalogImport();

  const dong = () => {
    setXemTruoc(null);
    setTenFile('');
    onClose();
  };

  const chonFile = async (file: File) => {
    setDangDoc(true);
    try {
      setXemTruoc(await api.upload<KetQuaXemTruoc>('/admin/catalog/import/preview', file));
      setTenFile(file.name);
    } catch (error) {
      setXemTruoc(null);
      message.error(error instanceof ApiError ? error.displayMessage : 'Không đọc được file.');
    } finally {
      setDangDoc(false);
    }
  };

  const ghiVaoDanhMuc = async () => {
    if (!xemTruoc) return;
    try {
      const kq = await ghi.mutateAsync(xemTruoc.dong);
      message.success(
        `Đã thêm ${kq.daThem} món, cập nhật ${kq.daCapNhat} món` +
          (kq.nhomDaTao > 0 ? `, tạo ${kq.nhomDaTao} nhóm mới` : ''),
      );
      dong();
    } catch (error) {
      message.error(error instanceof ApiError ? error.displayMessage : 'Ghi danh mục thất bại.');
    }
  };

  const tomTat = xemTruoc?.tomTat;
  const coGiDeGhi = (tomTat?.them ?? 0) + (tomTat?.capNhat ?? 0) > 0;

  return (
    <Modal
      open={open}
      onCancel={dong}
      width={880}
      title="Nhập danh mục từ file"
      footer={
        <Flex justify="end" gap={8}>
          <Button onClick={dong}>Đóng</Button>
          <Button
            type="primary"
            disabled={!coGiDeGhi}
            loading={ghi.isPending}
            onClick={() => void ghiVaoDanhMuc()}
          >
            Ghi vào danh mục
          </Button>
        </Flex>
      }
    >
      <Flex vertical gap={12}>
        <Alert
          type="info"
          showIcon
          title="File cần có các cột: Nhóm · Tên món · Đơn vị tính · Mã · Tối đa · Chỉ admin"
          description="Ba cột Mã · Tối đa · Chỉ admin không bắt buộc (mặc định: không mã, tối đa 20, không phải chỉ-admin). File KHÔNG có cột Mã thì mã đang có được giữ nguyên. Nhận .xlsx và .csv. Việc nhập KHÔNG xoá món nào — file thiếu món nào thì món đó vẫn còn nguyên."
        />

        <label>
          <input
            type="file"
            accept=".xlsx,.csv"
            hidden
            style={{ display: 'none' }}
            onChange={(event) => {
              const file = event.target.files?.[0];
              // Xoá giá trị để chọn lại đúng file vừa rồi vẫn kích hoạt onChange.
              event.target.value = '';
              if (file) void chonFile(file);
            }}
          />
          <Button icon={<InboxOutlined />} loading={dangDoc} block>
            {tenFile || 'Chọn file Excel hoặc CSV…'}
          </Button>
        </label>

        {tomTat && (
          <Flex gap={8} wrap>
            <Tag color="green">Thêm mới: {tomTat.them}</Tag>
            <Tag color="blue">Cập nhật: {tomTat.capNhat}</Tag>
            <Tag>Không đổi: {tomTat.khongDoi}</Tag>
            <Tag color={tomTat.loi > 0 ? 'red' : 'default'}>Lỗi: {tomTat.loi}</Tag>
            {(xemTruoc?.nhomMoi.length ?? 0) > 0 && (
              <Tag color="purple">Nhóm mới: {xemTruoc?.nhomMoi.join(', ')}</Tag>
            )}
          </Flex>
        )}

        {tomTat && tomTat.loi > 0 && (
          <Alert
            type="warning"
            showIcon
            title={`${tomTat.loi} dòng bị bỏ qua`}
            description="Những dòng lỗi sẽ KHÔNG được ghi. Các dòng còn lại vẫn ghi bình thường — sửa file rồi nhập lại phần thiếu cũng được."
          />
        )}

        {xemTruoc && (
          <div className="vpp-scroll-x">
            <Table<DongXemTruoc>
              rowKey="dong"
              size="small"
              dataSource={xemTruoc.dong}
              scroll={{ x: 720, y: 320 }}
              pagination={false}
              locale={{ emptyText: 'File không có dòng dữ liệu nào' }}
              columns={[
                { title: 'Dòng', dataIndex: 'dong', width: 64, align: 'center' },
                {
                  title: '',
                  dataIndex: 'hanhDong',
                  width: 110,
                  render: (value: DongXemTruoc['hanhDong']) => (
                    <Tag color={NHAN[value].color}>{NHAN[value].text}</Tag>
                  ),
                },
                {
                  title: 'Mã',
                  dataIndex: 'ma',
                  width: 110,
                  render: (value: string) => value || '—',
                },
                { title: 'Nhóm', dataIndex: 'nhom', width: 140 },
                { title: 'Tên món', dataIndex: 'ten', minWidth: 160 },
                { title: 'ĐVT', dataIndex: 'donVi', width: 80 },
                { title: 'Tối đa', dataIndex: 'toiDa', width: 76, align: 'center' },
                {
                  title: 'Chỉ admin',
                  dataIndex: 'chiAdmin',
                  width: 90,
                  align: 'center',
                  render: (value: boolean) => (value ? 'có' : '—'),
                },
                {
                  title: 'Ghi chú',
                  dataIndex: 'ghiChu',
                  minWidth: 200,
                  render: (value: string, row) => (
                    <Typography.Text type={row.hanhDong === 'loi' ? 'danger' : 'secondary'}>
                      {value || '—'}
                    </Typography.Text>
                  ),
                },
              ]}
            />
          </div>
        )}
      </Flex>
    </Modal>
  );
}
