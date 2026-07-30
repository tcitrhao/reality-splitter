export const LONGFORM_CHECK_SKILL = {
  id: "longform-check",
  version: 1,
  objective: "把长文中的可核查主张与观点分开，并保守说明证据支持与缺口。",
  boundaries: [
    "不把链接字符串假装成已读取的来源",
    "没有权威来源直接支持时必须说明证据不足",
    "不把观点伪装成事实",
    "不替用户做最终决策"
  ],
  successCriteria: [
    "主张相对完整",
    "事实与观点分开",
    "每条判断包含证据说明",
    "每条判断包含来源提示"
  ]
} as const;
