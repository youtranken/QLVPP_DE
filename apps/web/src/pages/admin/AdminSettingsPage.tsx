import { SaveOutlined } from '@ant-design/icons';
import { describeWindow, isRegistrationOpen, periodForDate, REG_WINDOW_MAX_DAY } from '@vpp/shared';
import { Alert, App, Button, Card, Flex, Form, InputNumber, Skeleton, Typography } from 'antd';
import { useEffect } from 'react';
import { useAppSettings, useUpdateRegistrationWindow } from '../../lib/admin-queries';
import { formatDateTime, periodLabel } from '../../lib/format';

interface WindowForm {
  startDay: number;
  endDay: number;
}

/**
 * Cài đặt hệ thống (ADMIN-8) — hiện chỉ có khung ngày đăng ký.
 *
 * Đổi khung ngày là việc **ảnh hưởng cả công ty**: nó quyết định lúc nào nhân
 * viên gửi được đơn, lúc nào huỷ được, và đơn rơi vào KỲ nào. Vì vậy màn này
 * luôn hiện trước hậu quả của con số đang gõ, trước khi bấm lưu.
 */
export function AdminSettingsPage() {
  const { message } = App.useApp();
  const { data, isPending } = useAppSettings();
  const update = useUpdateRegistrationWindow();
  const [form] = Form.useForm<WindowForm>();

  // Giá trị về sau khi tải xong / sau khi lưu ⇒ đổ lại vào form.
  useEffect(() => {
    if (data) form.setFieldsValue({ startDay: data.startDay, endDay: data.endDay });
  }, [data, form]);

  // Theo dõi giá trị đang gõ để xem trước, kể cả khi chưa lưu.
  const dangGo = Form.useWatch([], form);
  const xemTruoc =
    dangGo?.startDay && dangGo?.endDay && dangGo.startDay <= dangGo.endDay
      ? { startDay: dangGo.startDay, endDay: dangGo.endDay }
      : null;

  const luu = async (values: WindowForm) => {
    try {
      await update.mutateAsync(values);
      message.success('Đã lưu khung ngày đăng ký.');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không lưu được cài đặt.');
    }
  };

  // Cả lúc đang tải lẫn lúc lỗi đều chưa có số để hiện — không dựng form rỗng
  // rồi để admin lưu đè lên cài đặt thật bằng giá trị mặc định của form.
  if (isPending || !data) return <Skeleton active />;

  return (
    <Flex vertical gap={16}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        Cài đặt
      </Typography.Title>

      <Card size="small" title="Khung ngày đăng ký">
        <Form form={form} layout="vertical" onFinish={luu} requiredMark={false}>
          <Flex gap={16} wrap align="flex-start">
            <Form.Item
              name="startDay"
              label="Mở đăng ký từ ngày"
              rules={[{ required: true, message: 'Nhập ngày mở đăng ký' }]}
            >
              <InputNumber min={1} max={REG_WINDOW_MAX_DAY} aria-label="Ngày mở đăng ký" />
            </Form.Item>

            <Form.Item
              name="endDay"
              label="Đóng đăng ký sau ngày"
              rules={[
                { required: true, message: 'Nhập ngày đóng đăng ký' },
                // Kiểm ngay tại chỗ thay vì để server trả lỗi: người dùng thấy sai
                // lúc đang gõ, không phải sau khi bấm lưu.
                ({ getFieldValue }) => ({
                  validator: (_, value: number) =>
                    !value || value >= getFieldValue('startDay')
                      ? Promise.resolve()
                      : Promise.reject(new Error('Ngày đóng phải sau hoặc bằng ngày mở')),
                }),
              ]}
            >
              <InputNumber min={1} max={REG_WINDOW_MAX_DAY} aria-label="Ngày đóng đăng ký" />
            </Form.Item>
          </Flex>

          <Typography.Paragraph type="secondary" style={{ marginTop: -8 }}>
            Đặt ngày đóng là <strong>{REG_WINDOW_MAX_DAY}</strong> nghĩa là nhận đến{' '}
            <strong>hết tháng</strong>: tháng 2 tự hiểu là ngày 28 (hoặc 29 năm nhuận), tháng 30
            ngày là ngày 30.
          </Typography.Paragraph>

          {xemTruoc && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              title={`Nhận đăng ký ${describeWindow(xemTruoc)} hằng tháng`}
              description={
                <>
                  Đơn gửi hôm nay sẽ thuộc kỳ{' '}
                  <strong>{periodLabel(periodForDate(xemTruoc))}</strong>. Hôm nay cửa sổ đang{' '}
                  <strong>{isRegistrationOpen(xemTruoc) ? 'MỞ' : 'ĐÓNG'}</strong> với nhân viên.
                </>
              }
            />
          )}

          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            title="Đổi khung ngày có hiệu lực ngay"
            description="Đơn đã gửi vẫn giữ nguyên kỳ cũ, nhưng nhân viên có thể mất hoặc có thêm quyền gửi/huỷ đơn ngay sau khi lưu."
          />

          <Flex gap={12} align="center" wrap>
            <Button
              type="primary"
              htmlType="submit"
              icon={<SaveOutlined />}
              loading={update.isPending}
            >
              Lưu
            </Button>
            {data.updatedAt && (
              <Typography.Text type="secondary">
                Sửa lần cuối {formatDateTime(data.updatedAt)}
                {data.updatedByName ? ` bởi ${data.updatedByName}` : ''}
              </Typography.Text>
            )}
          </Flex>
        </Form>
      </Card>
    </Flex>
  );
}
