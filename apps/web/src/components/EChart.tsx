import { BarChart, PieChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { useEffect, useRef } from 'react';

/**
 * Chỉ đăng ký đúng những thành phần ECharts đang dùng (`echarts/core` thay vì
 * `echarts` trọn gói) để không kéo cả thư viện vào bundle.
 */
echarts.use([
  BarChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  CanvasRenderer,
]);

/** Bọc ECharts thành component React: tự vẽ lại khi option đổi và khi đổi kích thước. */
export function EChart({
  option,
  height = 300,
}: {
  option: echarts.EChartsCoreOption;
  height?: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!container.current) return;
    chart.current = echarts.init(container.current);

    // Biểu đồ canvas không tự co giãn ⇒ phải theo dõi kích thước phần tử cha (NFR-1).
    const observer = new ResizeObserver(() => chart.current?.resize());
    observer.observe(container.current);

    return () => {
      observer.disconnect();
      chart.current?.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    chart.current?.setOption(option, true);
  }, [option]);

  return <div ref={container} style={{ width: '100%', height }} />;
}
