import { LockOutlined, RedoOutlined, SearchOutlined, SendOutlined } from '@ant-design/icons';
import { checkRequestLines, khongDau, type CatalogItemRule } from '@vpp/shared';
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Flex,
  Image,
  Input,
  InputNumber,
  Result,
  Row,
  Skeleton,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { routes } from '../App';
import { OtherItemsCard, type OtherLine } from './register/OtherItemsCard';
import { dungLaiDon } from './register/reuse';
import { ApiError } from '../lib/api';
import {
  useCatalog,
  useCreateRequest,
  useMe,
  useMyRequests,
  useRegistrationStatus,
} from '../lib/queries';
import type { VppRequest } from '../lib/types';

/**
 * Màn Đăng ký VPP (SDD §8 màn 2 · CORE-2…6).
 * Quy tắc dùng CHUNG với backend qua `@vpp/shared` để báo lỗi sớm; backend vẫn
 * kiểm lại khi nhận đơn nên giao diện không phải là hàng rào bảo mật.
 */
export function RegisterPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: me } = useMe();
  const { data: myRequests } = useMyRequests();
  const { data: status } = useRegistrationStatus();
  const { data: catalog, isPending } = useCatalog();
  const createRequest = useCreateRequest();

  /** Số lượng đã chọn theo itemId; 0/không có = chưa chọn. */
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [otherLines, setOtherLines] = useState<OtherLine[]>([]);
  const [note, setNote] = useState('');
  const [timKiem, setTimKiem] = useState('');
  /** Những gì bị bỏ/sửa khi dùng lại đơn cũ — hiện cho người dùng đọc. */
  const [thayDoi, setThayDoi] = useState<string[]>([]);

  const isAdmin = me?.role === 'admin';
  const locked = !status?.canRegister;

  const setQuantity = (itemId: string, value: number | null) =>
    setQuantities((current) => {
      const next = { ...current };
      if (!value) delete next[itemId];
      else next[itemId] = value;
      return next;
    });

  const allItems = useMemo(() => catalog?.flatMap((group) => group.items) ?? [], [catalog]);

  /**
   * Danh mục sau khi lọc theo ô tìm. Khớp cả tên nhóm — gõ "mực" thì hiện cả nhóm
   * "Mực & Toner" chứ không chỉ những món có chữ "mực" trong tên.
   * Nhóm không còn món nào thì ẩn hẳn để không phải cuộn qua các thẻ rỗng.
   */
  const catalogHienThi = useMemo(() => {
    const tu = khongDau(timKiem);
    const nhom = (catalog ?? []).filter((group) => !group.isOther);
    if (!tu) return nhom;
    return nhom
      .map((group) =>
        khongDau(group.name).includes(tu)
          ? group
          : { ...group, items: group.items.filter((item) => khongDau(item.name).includes(tu)) },
      )
      .filter((group) => group.items.length > 0);
  }, [catalog, timKiem]);

  /** Gộp món đã chọn + dòng "Khác" thành payload gửi lên. */
  const lines = useMemo(() => {
    const fromCatalog = Object.entries(quantities).map(([itemId, quantity]) => ({
      itemId,
      name: allItems.find((item) => item.id === itemId)?.name ?? '',
      unit: allItems.find((item) => item.id === itemId)?.unit ?? '',
      quantity,
    }));
    const fromOther = otherLines.map((line) => ({
      itemId: null,
      name: line.name.trim(),
      unit: line.unit.trim(),
      quantity: line.quantity,
      attachmentPath: line.attachmentPath,
    }));
    return [...fromCatalog, ...fromOther];
  }, [quantities, otherLines, allItems]);

  /** Kiểm bằng ĐÚNG hàm backend dùng — nguồn sự thật duy nhất cho quy tắc. */
  const violations = useMemo(() => {
    if (lines.length === 0) return [];
    const rules = new Map<string, CatalogItemRule>(
      allItems.map((item) => [
        item.id,
        { id: item.id, adminOnly: item.adminOnly, maxQty: item.maxQty, active: item.active },
      ]),
    );
    const problems = checkRequestLines(lines, me?.role ?? 'member', rules);
    const missingUnit = otherLines.some((line) => line.name.trim() && !line.unit.trim());
    return missingUnit
      ? [...problems, { code: 'VALIDATION', message: 'Dòng ngoài danh mục phải nhập đơn vị tính.' }]
      : problems;
  }, [lines, allItems, me?.role, otherLines]);

  const canSubmit = lines.length > 0 && violations.length === 0 && !locked;

  /**
   * Đổ nội dung một đơn cũ vào giỏ. Dùng cho cả nút "Dùng lại đơn kỳ trước" và
   * nút "Gửi lại" ở màn Đơn của tôi (điều hướng sang đây kèm id đơn bị từ chối).
   */
  const dungLai = useCallback(
    (don: VppRequest) => {
      const kq = dungLaiDon({ lines: don.items, catalog: allItems, isAdmin });
      setQuantities(kq.quantities);
      setOtherLines(kq.otherLines);
      setNote(don.note ?? '');

      // Nói rõ đã bỏ/sửa gì. Dùng cảnh báo đứng yên chứ không phải toast thoáng
      // qua: người dùng cần đọc kỹ rồi mới bấm Gửi.
      setThayDoi([...kq.boQua, ...kq.giamSoLuong]);
      message.success(`Đã lấy nội dung đơn ${don.code}`);
    },
    [allItems, isAdmin, message],
  );

  // Đến từ nút "Gửi lại": lấy luôn nội dung đơn bị từ chối, chỉ làm MỘT lần để
  // người dùng sửa xong không bị ghi đè khi component vẽ lại.
  const daTuDongLay = useRef(false);
  useEffect(() => {
    const id = (location.state as { copyFromRequestId?: string } | null)?.copyFromRequestId;
    if (!id || daTuDongLay.current || !myRequests || allItems.length === 0) return;
    const don = myRequests.find((item) => item.id === id);
    if (!don) return;
    daTuDongLay.current = true;
    dungLai(don);
  }, [location.state, myRequests, allItems, dungLai]);

  /** Đơn gần nhất của chính mình, bất kể trạng thái — để "dùng lại". */
  const donGanNhat = myRequests?.[0];

  const submit = async () => {
    try {
      const created = await createRequest.mutateAsync({
        note: note.trim() || null,
        lines: lines.map((line) => ({
          itemId: line.itemId,
          name: line.name,
          unit: line.unit,
          quantity: line.quantity,
          attachmentPath: 'attachmentPath' in line ? line.attachmentPath : null,
        })),
      });
      message.success(`Đã gửi đơn ${created.code}`);
      navigate(routes.myRequests);
    } catch (error) {
      message.error(error instanceof ApiError ? error.displayMessage : 'Gửi đơn thất bại.');
    }
  };

  if (isPending) return <Skeleton active />;
  if (!catalog || catalog.length === 0) {
    return <Result status="info" title="Chưa có danh mục văn phòng phẩm" />;
  }

  return (
    <Flex vertical gap={16}>
      <Flex align="center" justify="space-between" wrap gap={8}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Đăng ký văn phòng phẩm
        </Typography.Title>
        {/* Dùng Tag thay Badge: badge tràn ra ngoài mép phải và bị cắt trên màn hẹp. */}
        <Tag color={lines.length > 0 ? 'blue' : 'default'}>Đã chọn: {lines.length} món</Tag>
      </Flex>

      {locked && (
        <Alert
          type="warning"
          showIcon
          title="Đã đóng đăng ký"
          description={`Hệ thống chỉ nhận đăng ký ${status?.windowLabel} hằng tháng.`}
        />
      )}

      {thayDoi.length > 0 && (
        <Alert
          type="warning"
          showIcon
          closable
          onClose={() => setThayDoi([])}
          title="Đơn cũ có vài chỗ không giữ nguyên được"
          description={
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {thayDoi.map((dong, index) => (
                <li key={index}>{dong}</li>
              ))}
            </ul>
          }
        />
      )}

      <Flex gap={8} wrap align="center">
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="Tìm món (gõ không dấu cũng được)"
          aria-label="Tìm món"
          value={timKiem}
          onChange={(event) => setTimKiem(event.target.value)}
          style={{ maxWidth: 320 }}
        />
        {/* VPP hằng tháng gần như giống nhau — chép lại đơn cũ nhanh hơn chọn lại
            từ đầu rất nhiều. Không có đơn nào thì không hiện nút cho đỡ rối. */}
        {donGanNhat && (
          <Button icon={<RedoOutlined />} disabled={locked} onClick={() => dungLai(donGanNhat)}>
            Dùng lại đơn gần nhất
          </Button>
        )}
      </Flex>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Flex vertical gap={16}>
            {catalogHienThi.length === 0 && (
              <Card size="small">
                <Typography.Text type="secondary">
                  Không có món nào khớp “{timKiem}”. Món ngoài danh mục thì khai ở mục “Khác” bên
                  dưới.
                </Typography.Text>
              </Card>
            )}
            {catalogHienThi.map((group) => (
              <Card key={group.id} title={group.name} size="small">
                {group.items.length === 0 ? (
                  <Typography.Text type="secondary">Nhóm này chưa có món</Typography.Text>
                ) : (
                  <Flex vertical>
                    {group.items.map((item) => {
                      // A4 khoá với nhân viên; admin vẫn chọn được (CORE-4, CORE-16).
                      const blocked = item.adminOnly && !isAdmin;
                      return (
                        <Flex
                          key={item.id}
                          align="center"
                          justify="space-between"
                          gap={12}
                          style={{ padding: '8px 0', borderTop: '1px solid rgba(0,0,0,.06)' }}
                        >
                          <Flex gap={10} align="center" style={{ minWidth: 0 }}>
                            {/* Ảnh minh hoạ do admin tải lên, giúp nhân viên
                                  nhận ra đúng món mình cần. */}
                            {item.imagePath && (
                              <Image
                                src={item.imagePath}
                                width={44}
                                height={44}
                                style={{ objectFit: 'cover', borderRadius: 6, flex: '0 0 auto' }}
                                alt={item.name}
                              />
                            )}
                            <Flex vertical style={{ minWidth: 0 }}>
                              <Flex gap={8} align="center" wrap>
                                <Typography.Text>{item.name}</Typography.Text>
                                {item.adminOnly && <Tag color="gold">chỉ admin</Tag>}
                              </Flex>
                              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                Đơn vị: {item.unit} · tối đa {item.maxQty}
                              </Typography.Text>
                            </Flex>
                          </Flex>

                          {blocked ? (
                            <Tooltip title="Món này chỉ quản trị viên được đăng ký">
                              <LockOutlined aria-label="chỉ quản trị viên" />
                            </Tooltip>
                          ) : (
                            <InputNumber
                              aria-label={`Số lượng ${item.name}`}
                              min={0}
                              max={item.maxQty}
                              disabled={locked}
                              value={quantities[item.id] ?? 0}
                              onChange={(value) => setQuantity(item.id, value)}
                              style={{ width: 88, flex: '0 0 auto' }}
                            />
                          )}
                        </Flex>
                      );
                    })}
                  </Flex>
                )}
              </Card>
            ))}

            <OtherItemsCard lines={otherLines} onChange={setOtherLines} disabled={locked} />
          </Flex>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="Giỏ đăng ký" style={{ position: 'sticky', top: 16 }}>
            <Flex vertical gap={12}>
              {lines.length === 0 ? (
                <Typography.Text type="secondary">Chưa chọn món nào.</Typography.Text>
              ) : (
                <Flex vertical>
                  {lines.map((line, index) => (
                    <Flex
                      key={`${line.itemId ?? 'other'}-${index}`}
                      justify="space-between"
                      gap={8}
                      style={{ padding: '6px 0', borderTop: '1px solid rgba(0,0,0,.06)' }}
                    >
                      <Typography.Text ellipsis style={{ flex: 1 }}>
                        {line.name || <em>(chưa đặt tên)</em>}
                      </Typography.Text>
                      <Typography.Text strong style={{ whiteSpace: 'nowrap' }}>
                        {line.quantity} {line.unit}
                      </Typography.Text>
                    </Flex>
                  ))}
                </Flex>
              )}

              {violations.length > 0 && (
                <Alert
                  type="error"
                  showIcon
                  title="Cần sửa trước khi gửi"
                  description={
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {violations.map((violation, index) => (
                        <li key={index}>{violation.message}</li>
                      ))}
                    </ul>
                  }
                />
              )}

              <Input.TextArea
                rows={2}
                placeholder="Ghi chú cho quản trị viên (không bắt buộc)"
                value={note}
                disabled={locked}
                maxLength={500}
                onChange={(event) => setNote(event.target.value)}
              />

              <Button
                type="primary"
                icon={<SendOutlined />}
                size="large"
                block
                disabled={!canSubmit}
                loading={createRequest.isPending}
                onClick={() => void submit()}
              >
                Gửi đơn
              </Button>
            </Flex>
          </Card>
        </Col>
      </Row>
    </Flex>
  );
}
