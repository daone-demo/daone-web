export type HistoryRecordKind = 'image' | 'video' | 'text' | 'custom'

export type HistoryRecordTab = 'all' | HistoryRecordKind

export type HistoryRecord = {
  id: string
  kind: HistoryRecordKind
  summary: string
  time: string
  dateKey: string
  dateLabel: string
}

export const HISTORY_RECORD_TABS: { key: HistoryRecordTab; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'image', label: '图片' },
  { key: 'video', label: '视频' },
  { key: 'text', label: '文字' },
  { key: 'custom', label: '自定义' },
]

/** 演示用历史记录数据 */
export const CANVAS_HISTORY_RECORDS: HistoryRecord[] = [
  {
    id: '1',
    kind: 'image',
    summary:
      '提取图片中的主体，适合换背景：画面中有一条形态优美、色彩鲜艳的锦鲤，周围环绕着粉色、白色的荷花与荷叶，整体氛围清新雅致。',
    time: '22:07',
    dateKey: '2026-06-02',
    dateLabel: '2026年6月2日星期二',
  },
  {
    id: '2',
    kind: 'image',
    summary: '提取图片中的主体，适合换背景',
    time: '22:07',
    dateKey: '2026-06-02',
    dateLabel: '2026年6月2日星期二',
  },
  {
    id: '3',
    kind: 'image',
    summary:
      '一位年轻女性，长发自然披散，五官精致，眼神明亮，皮肤白皙，身着简约白色上衣，背景为柔和的自然光环境，整体风格清新写实。',
    time: '16:39',
    dateKey: '2026-06-02',
    dateLabel: '2026年6月2日星期二',
  },
  {
    id: '4',
    kind: 'text',
    summary: '这幅画，颜色厚重到位，阳光温暖明亮，人物表情生动，整体构图平衡，适合作为宣传海报主视觉。',
    time: '16:39',
    dateKey: '2026-06-02',
    dateLabel: '2026年6月2日星期二',
  },
  {
    id: '5',
    kind: 'image',
    summary: '一位女性上半身肖像，真实皮肤细腻，柔和侧光，浅景深背景虚化，电影感色调。',
    time: '16:39',
    dateKey: '2026-06-02',
    dateLabel: '2026年6月2日星期二',
  },
  {
    id: '6',
    kind: 'video',
    summary: '图生视频：镜头缓慢推进，主体轻微转头，光影随云层变化，时长 5 秒。',
    time: '14:12',
    dateKey: '2026-06-01',
    dateLabel: '2026年6月1日星期一',
  },
  {
    id: '7',
    kind: 'custom',
    summary: '自定义工作流 · 批量抠图导出',
    time: '11:05',
    dateKey: '2026-06-01',
    dateLabel: '2026年6月1日星期一',
  },
]
