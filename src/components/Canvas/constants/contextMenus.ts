export type ImageContextMenuIcon =
  | 'send-model'
  | 'layer-top'
  | 'layer-bottom'
  | 'data-advisor'
  | 'parse'
  | 'icon-duihuaqipao'
  | 'send-agent'
  | 'preview'
  | 'download'
  | 'lock'
  | 'copy-image'
  | 'save'
  | 'delete'
  | 'icon-contact-customer-service'
  | 'icon-xiazai'
  | 'icon-yulan1'
  | 'icon-shanchu'
  | 'icon-baocun1'
  | 'icon-geren'

export type ImageContextMenuItem = {
  key: string
  label: string
  icon: ImageContextMenuIcon
  danger?: boolean
}

/** 图片节点右键菜单分组 */
export const IMAGE_CONTEXT_MENU_SECTIONS: ImageContextMenuItem[][] = [
  [
    { key: 'chat', label: '对话', icon: 'icon-duihuaqipao' },
    { key: 'send-agent', label: '添加到智能体', icon: 'icon-contact-customer-service' },
    { key: 'send-model', label: '添加到我的模特', icon: 'icon-geren' },
  ],
  [
    { key: 'preview', label: '预览', icon: 'icon-yulan1' },
    { key: 'download', label: '下载', icon: 'icon-xiazai' },
    // { key: 'copy-image', label: '复制图片', icon: 'copy-image' },
  ],
  [
    { key: 'save', label: '保存', icon: 'icon-baocun1' },
    { key: 'delete', label: '删除', icon: 'icon-shanchu', danger: true },
  ],
]

/** 视频节点右键菜单分组（与图片节点结构一致） */
export const VIDEO_CONTEXT_MENU_SECTIONS: ImageContextMenuItem[][] = [
  [
    { key: 'chat', label: '对话', icon: 'icon-duihuaqipao' },
    // { key: 'send-agent', label: '添加到智能体', icon: 'icon-contact-customer-service' },
  ],
  [
    { key: 'preview', label: '预览', icon: 'icon-yulan1' },
    { key: 'download', label: '下载', icon: 'icon-xiazai' },
    // { key: 'copy-video', label: '复制视频', icon: 'copy-image' },
  ],
  [
    { key: 'save', label: '保存', icon: 'icon-baocun1' },
    { key: 'delete', label: '删除', icon: 'icon-shanchu', danger: true },
  ],
]

export type MediaContextMenuKind = 'image' | 'video'

export function getMediaContextMenuSections(kind: MediaContextMenuKind) {
  return kind === 'video' ? VIDEO_CONTEXT_MENU_SECTIONS : IMAGE_CONTEXT_MENU_SECTIONS
}
