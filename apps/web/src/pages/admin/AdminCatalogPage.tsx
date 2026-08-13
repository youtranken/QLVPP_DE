import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { MAX_ITEM_QTY } from '@vpp/shared';
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Skeleton,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd';
import { useState } from 'react';
import { ApiError } from '../../lib/api';
import {
  useDeleteCategory,
  useDeleteItem,
  useSaveCategory,
  useSaveItem,
  type ItemInput,
} from '../../lib/admin-queries';
import { useCatalog } from '../../lib/queries';
import type { CatalogItem } from '../../lib/types';

interface ItemFormValues {
  name: string;
  unit: string;
  adminOnly: boolean;
  maxQty: number;
  active: boolean;
}

/** Quản lý danh mục VPP: nhóm và món (ADMIN-1/2). */
export function AdminCatalogPage() {
  const { message } = App.useApp();
  const { data: catalog, isPending } = useCatalog(true);
  const saveCategory = useSaveCategory();
  const deleteCategory = useDeleteCategory();
  const saveItem = useSaveItem();
  const deleteItem = useDeleteItem();

  const [categoryModal, setCategoryModal] = useState<{ id?: string; name: string } | null>(null);
  const [itemModal, setItemModal] = useState<{ categoryId: string; item?: CatalogItem } | null>(
    null,
  );
  const [itemForm] = Form.useForm<ItemFormValues>();

  const run = async (action: () => Promise<unknown>, successText: string) => {
    try {
      await action();
      message.success(successText);
      return true;
    } catch (error) {
      message.error(error instanceof ApiError ? error.displayMessage : 'Thao tác thất bại.');
      return false;
    }
  };

  if (isPending) return <Skeleton active />;

  return (
    <Flex vertical gap={16}>
      <Flex align="center" justify="space-between" wrap gap={8}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Danh mục văn phòng phẩm
        </Typography.Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCategoryModal({ name: '' })}
        >
          Thêm nhóm
        </Button>
      </Flex>

      <Alert
        type="info"
        showIcon
        title="Ngừng món thay vì xoá"
        description="Tắt “Đang dùng” để món không xuất hiện khi đăng ký nhưng vẫn giữ nguyên trong các đơn cũ. Chỉ xoá hẳn khi món chưa từng được dùng."
      />

      {(catalog ?? []).map((group) => (
        <Card
          key={group.id}
          size="small"
          title={
            <Flex align="center" gap={8} wrap>
              <span>{group.name}</span>
              {group.isOther && <Tag>nhóm “Khác”</Tag>}
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {group.items.length} món
              </Typography.Text>
            </Flex>
          }
          extra={
            <Flex gap={8} wrap>
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => setCategoryModal({ id: group.id, name: group.name })}
              >
                Sửa nhóm
              </Button>
              <Button
                size="small"
                icon={<PlusOutlined />}
                onClick={() => {
                  itemForm.resetFields();
                  setItemModal({ categoryId: group.id });
                }}
              >
                Thêm món
              </Button>
              <Popconfirm
                title="Xoá nhóm này?"
                description="Chỉ xoá được khi nhóm không còn món nào."
                okText="Xoá"
                cancelText="Không"
                onConfirm={() =>
                  void run(() => deleteCategory.mutateAsync(group.id), 'Đã xoá nhóm')
                }
              >
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </Flex>
          }
        >
          <div className="vpp-scroll-x">
            <Table<CatalogItem>
              rowKey="id"
              size="small"
              pagination={false}
              scroll={{ x: 620 }}
              dataSource={group.items}
              locale={{ emptyText: 'Nhóm này chưa có món' }}
              columns={[
                { title: 'Tên món', dataIndex: 'name', minWidth: 220 },
                { title: 'ĐVT', dataIndex: 'unit', width: 100 },
                { title: 'Tối đa', dataIndex: 'maxQty', width: 90, align: 'center' },
                {
                  title: 'Chỉ admin',
                  dataIndex: 'adminOnly',
                  width: 110,
                  align: 'center',
                  render: (value: boolean) => (value ? <Tag color="gold">có</Tag> : '—'),
                },
                {
                  title: 'Đang dùng',
                  dataIndex: 'active',
                  width: 110,
                  align: 'center',
                  render: (value: boolean, item) => (
                    <Switch
                      size="small"
                      checked={value}
                      onChange={(checked) =>
                        void run(
                          () => saveItem.mutateAsync({ id: item.id, values: { active: checked } }),
                          checked ? 'Đã bật lại món' : 'Đã ngừng món',
                        )
                      }
                    />
                  ),
                },
                {
                  title: '',
                  width: 100,
                  render: (_, item) => (
                    <Flex gap={4}>
                      <Button
                        size="small"
                        icon={<EditOutlined />}
                        aria-label={`Sửa ${item.name}`}
                        onClick={() => {
                          itemForm.setFieldsValue(item);
                          setItemModal({ categoryId: group.id, item });
                        }}
                      />
                      <Popconfirm
                        title="Xoá hẳn món này?"
                        description="Đơn cũ vẫn giữ tên món; cân nhắc dùng “Đang dùng” thay vì xoá."
                        okText="Xoá"
                        cancelText="Không"
                        onConfirm={() =>
                          void run(() => deleteItem.mutateAsync(item.id), 'Đã xoá món')
                        }
                      >
                        <Button
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          aria-label={`Xoá ${item.name}`}
                        />
                      </Popconfirm>
                    </Flex>
                  ),
                },
              ]}
            />
          </div>
        </Card>
      ))}

      <Modal
        open={categoryModal !== null}
        title={categoryModal?.id ? 'Sửa nhóm' : 'Thêm nhóm'}
        okText="Lưu"
        cancelText="Đóng"
        okButtonProps={{ loading: saveCategory.isPending }}
        onCancel={() => setCategoryModal(null)}
        onOk={() =>
          void (async () => {
            if (!categoryModal?.name.trim()) {
              message.warning('Tên nhóm không được để trống.');
              return;
            }
            const ok = await run(
              () =>
                saveCategory.mutateAsync({ id: categoryModal.id, name: categoryModal.name.trim() }),
              'Đã lưu nhóm',
            );
            if (ok) setCategoryModal(null);
          })()
        }
      >
        <Input
          autoFocus
          placeholder="Tên nhóm"
          value={categoryModal?.name ?? ''}
          onChange={(event) =>
            setCategoryModal((current) =>
              current ? { ...current, name: event.target.value } : current,
            )
          }
        />
      </Modal>

      <Modal
        open={itemModal !== null}
        title={itemModal?.item ? `Sửa món: ${itemModal.item.name}` : 'Thêm món'}
        okText="Lưu"
        cancelText="Đóng"
        okButtonProps={{ loading: saveItem.isPending }}
        onCancel={() => setItemModal(null)}
        onOk={() =>
          void (async () => {
            const values = await itemForm.validateFields().catch(() => null);
            if (!values || !itemModal) return;
            const payload: ItemInput = { ...values, categoryId: itemModal.categoryId };
            const ok = await run(
              () => saveItem.mutateAsync({ id: itemModal.item?.id, values: payload }),
              'Đã lưu món',
            );
            if (ok) setItemModal(null);
          })()
        }
      >
        <Form
          form={itemForm}
          layout="vertical"
          initialValues={{ adminOnly: false, active: true, maxQty: MAX_ITEM_QTY }}
        >
          <Form.Item
            name="name"
            label="Tên món"
            rules={[{ required: true, message: 'Nhập tên món' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="unit"
            label="Đơn vị tính"
            rules={[{ required: true, message: 'Nhập đơn vị tính' }]}
          >
            <Input placeholder="cây, hộp, ram…" />
          </Form.Item>
          <Form.Item
            name="maxQty"
            label="Số lượng tối đa mỗi đơn"
            rules={[{ required: true, message: 'Nhập số lượng tối đa' }]}
          >
            <InputNumber min={1} max={MAX_ITEM_QTY} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="adminOnly" valuePropName="checked">
            <Checkbox>Chỉ quản trị viên được đăng ký (như giấy A4)</Checkbox>
          </Form.Item>
          <Form.Item name="active" valuePropName="checked">
            <Checkbox>Đang dùng</Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </Flex>
  );
}
