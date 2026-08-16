export type MenuIcon =
  | 'text'
  | 'image'
  | 'video'
  | 'compose'
  | 'director'
  | 'audio'
  | 'script'
  | 'upload'
  | 'history'
  | 'link'

export type ConnectMenuKey =
  | 'text'
  | 'image'
  | 'video'
  | 'compose'
  | 'director'
  | 'audio'
  | 'script'
  | 'reference'

export const CONNECT_GENERATE_MENU: Array<{
  key: ConnectMenuKey
  label: string
  icon: string
  badge?: 'Beta' | 'NEW'
  disabled?: boolean
}> = [
  { key: 'text', label: '文本', icon: 'icon-xingzhuang-wenzi' },
  { key: 'image', label: '图片', icon: 'icon-shangchuantupian1' },
  { key: 'video', label: '视频', icon: 'icon-shangchuanshipin2' },
]

export const ADD_NODE_GROUPS = [
  {
    title: '添加节点',
    items: [
      { kind: 'text' as const, label: '文本', desc: '脚本、广告词、品牌文案', action: 'upload-text' as const, icon: 'icon-xingzhuang-wenzi' },
      { kind: 'image' as const, label: '图片', desc: '海报、封面、素材图', action: 'upload-image' as const, icon: 'icon-shangchuantupian1' },
      { kind: 'video' as const, label: '视频', desc: '短视频、动画片段', action: 'upload-video' as const, icon: 'icon-shangchuanshipin2' },
    ],
  },
  {
    title: '添加资源',
    items: [
      { kind: 'image' as const, label: '上传', desc: '本地图片或视频', icon: 'upload' as MenuIcon, action: 'upload' as const },
      // { kind: 'image' as const, label: '从生成历史选择', desc: '复用历史结果', icon: 'history' as MenuIcon, action: 'history' as const },
    ],
  },
]

export const TEXT_PICKER_ACTIONS = [
  { key: 'write', label: '自己编写内容', icon: 'doc' },
  { key: 'text2image', label: '文生图', icon: 'image' },
  { key: 'text2video', label: '文生视频', icon: 'play' },
  // { key: 'text2music', label: '文字生音乐', icon: 'audio' },
]

export const TEXT_PICKER_TRY_ACTIONS = TEXT_PICKER_ACTIONS.filter(
  (action) => action.key === 'text2video' || action.key === 'text2image',
)

export const VIDEO_PICKER_TRY_ACTIONS = [
  { key: 'frames', label: '首尾帧生成视频', icon: 'frames' },
  { key: 'imageRef', label: '首帧生成视频', icon: 'spark' },
] as const

export const VIDEO_GEN_TABS: Array<{ key: string; label: string; disabled?: boolean; disabledHint?: string }> = [
  { key: 'text2video', label: '文生视频', disabled: true, disabledHint: '已接入媒体输入,无法使用纯文生视频' },
  { key: 'reference', label: '全能参考', disabled: false, disabledHint: '' },
  { key: 'img2video', label: '图生视频', disabled: false, disabledHint: '图生视频功能暂未开放' },
  { key: 'frames', label: '首尾帧', disabled: false, disabledHint: '首尾帧功能暂未开放' },
  { key: 'imageRef', label: '图片参考', disabled: false, disabledHint: '' },
]

export const VIDEO_GEN_QUICK_ACTIONS = [
  { key: 'mark', label: '标记', icon: 'mark' },
  { key: 'camera', label: '运镜', icon: 'camera' },
  { key: 'role', label: '角色库', icon: 'role' },
] as const

export const VIDEO_GEN_PROMPT_PLACEHOLDER = '描述你想要生成的画面内容，@引用素材'

export const IMAGE_GEN_ACTIONS = [
  { key: 'img2img' as const, label: '图生图', icon: 'img2img' },
  { key: 'hd' as const, label: '图片高清', icon: 'hd' },
]

export const IMG2IMG_PROMPT_PLACEHOLDER =
  '描述你想要生成的画面内容，按/呼出指令，@引用素材'

export const IMG2IMG_QUICK_TAGS = ['风格', '相似', '参考'] as const
