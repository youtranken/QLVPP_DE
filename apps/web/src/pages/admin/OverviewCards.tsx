import {
  AppstoreOutlined,
  CarryOutOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import type { RequestStatus } from '@vpp/shared';
import { Card, Flex, Skeleton, Typography } from 'antd';
import { formatPeriod } from '@vpp/shared';
import type { AdminOverview } from '../../lib/admin-queries';

/**
 * Hàng thẻ số liệu mở đầu Bảng điều khiển.
 *
 * Mỗi thẻ vừa là **số liệu** vừa là **bộ lọc**: bấm "Đơn chờ duyệt" là bảng duyệt
 * đơn bên dưới chỉ còn đơn chờ duyệt. Con số mà không bấm được thì admin đọc xong
 * vẫn phải tự đi tìm — đúng cái làm dashboard cũ trở nên vô dụng.
 *
 * Mỗi thẻ ghi rõ PHẠM VI ở dòng phụ, vì chúng không cùng phạm vi: việc tồn đọng
 * tính mọi kỳ, còn việc đã xong và số người tính theo kỳ đang nhận.
 */
export interface TheSoLieu {
  khoa: string;
  nhan: string;
  gioiThieu?: string;
  giaTri: string | number;
  mau: string;
  icon: React.ReactNode;
  /** Trạng thái sẽ lọc khi bấm. Không có = thẻ chỉ để đọc. */
  loc?: RequestStatus;
}

const MAU = {
  cho: '#d46b08', // cam — việc đang chờ mình
  giao: '#389e0d', // xanh lá — đã duyệt, chờ giao
  xong: '#08979c', // xanh mòng két — đã xong, khác hẳn "chờ giao"
  nguoi: '#1d68b5', // xanh thương hiệu
  mon: '#531dab', // tím — số liệu thuần
};

export function danhSachThe(tongQuan: AdminOverview): TheSoLieu[] {
  const nhanKy = `kỳ ${formatPeriod(tongQuan.period)}`;
  return [
    {
      khoa: 'choDuyet',
      nhan: 'Đơn chờ duyệt',
      gioiThieu: 'mọi kỳ · bấm để lọc',
      giaTri: tongQuan.choDuyet,
      mau: MAU.cho,
      icon: <ClockCircleOutlined />,
      loc: 'submitted',
    },
    {
      khoa: 'choGiao',
      nhan: 'Đơn chờ giao',
      gioiThieu: 'mọi kỳ · đã duyệt, chưa giao',
      giaTri: tongQuan.choGiao,
      mau: MAU.giao,
      icon: <CarryOutOutlined />,
      loc: 'approved',
    },
    {
      khoa: 'daGiao',
      nhan: 'Đã giao',
      gioiThieu: 'mọi kỳ · đã phát xong',
      giaTri: tongQuan.daGiao,
      mau: MAU.xong,
      icon: <CheckCircleOutlined />,
      loc: 'delivered',
    },
    {
      khoa: 'chuaDangKy',
      nhan: 'Chưa đăng ký',
      gioiThieu: nhanKy,
      // Hiện cả mẫu số: "2" một mình không nói lên điều gì, "2/6" thì có.
      giaTri: `${tongQuan.chuaDangKy}/${tongQuan.tongNguoi}`,
      mau: MAU.nguoi,
      icon: <TeamOutlined />,
    },
    {
      khoa: 'tongMon',
      nhan: 'Tổng số lượng',
      gioiThieu: nhanKy,
      giaTri: tongQuan.tongMon,
      // Đây là số của MỘT kỳ; nếu bấm vào lại hiện mọi kỳ thì con số và bảng nói
      // hai chuyện khác nhau. Để thuần thông tin — bỏ lọc đã có nút "Xoá lọc".
      mau: MAU.mon,
      icon: <AppstoreOutlined />,
    },
  ];
}

export function OverviewCards({
  tongQuan,
  dangLoc,
  onLoc,
}: {
  tongQuan?: AdminOverview;
  dangLoc: RequestStatus | undefined;
  onLoc: (status: RequestStatus | undefined) => void;
}) {
  if (!tongQuan) return <Skeleton active paragraph={{ rows: 2 }} />;

  return (
    /*
      Năm thẻ không chia chẵn lưới 24 cột của AntD, nên dùng CSS grid.
      `auto-fill` chứ không phải `auto-fit`: auto-fit gộp cột trống lại, khiến thẻ
      lẻ ở dòng cuối phình ra chiếm trọn chiều ngang — nhìn như một khối lỗi.
      Với bề ngang 1100px của trang, 200px cho ra đúng năm cột trên máy tính, rồi
      tự giảm còn bốn / ba / hai / một khi màn hẹp dần.
    */
    <div
      style={{
        display: 'grid',
        gap: 12,
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
      }}
    >
      {danhSachThe(tongQuan).map((the) => {
        const bamDuoc = the.loc !== undefined;
        const dangChon = bamDuoc && the.loc === dangLoc;

        return (
          <Card
            key={the.khoa}
            size="small"
            hoverable={bamDuoc}
            aria-label={the.nhan}
            // Bấm lại thẻ đang chọn thì bỏ lọc — đỡ phải đi tìm nút "Xoá lọc".
            onClick={bamDuoc ? () => onLoc(dangChon ? undefined : the.loc) : undefined}
            style={{
              cursor: bamDuoc ? 'pointer' : 'default',
              // Dải màu bên trái thay cho viền cả khối: đủ để nhận ra nhóm số
              // liệu mà không biến trang thành năm ô sặc sỡ.
              borderLeft: `3px solid ${the.mau}`,
              // Thẻ đang lọc phải NHÌN RA NGAY, nếu không admin quên mất mình
              // đang xem một tập con và tưởng hệ thống mất dữ liệu.
              background: dangChon ? `${the.mau}0f` : undefined,
              boxShadow: dangChon ? `inset 0 0 0 1px ${the.mau}` : undefined,
            }}
          >
            <Flex vertical gap={2}>
              <Flex align="center" gap={6}>
                <span style={{ color: the.mau }}>{the.icon}</span>
                <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                  {the.nhan}
                </Typography.Text>
              </Flex>
              <Typography.Text
                style={{ fontSize: 30, lineHeight: 1.15, fontWeight: 700, color: the.mau }}
              >
                {the.giaTri}
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 12, minHeight: 18 }}>
                {the.gioiThieu ?? ' '}
              </Typography.Text>
            </Flex>
          </Card>
        );
      })}
    </div>
  );
}
