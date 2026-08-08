export type OfficialContact = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  avatar: string;
  tone: string;
};

export const OFFICIAL_CONTACTS: OfficialContact[] = [
  { id: "lin", name: "林屿", tagline: "安静听你说", description: "擅长接住日常的情绪和碎片，陪你把话慢慢说完。", avatar: "林", tone: "温和、克制、耐心" },
  { id: "mori", name: "森语", tagline: "一起发散想象", description: "喜欢从一件小事出发，陪你探索故事、灵感和新鲜视角。", avatar: "森", tone: "轻快、好奇、富有想象力" },
  { id: "yue", name: "月白", tagline: "给夜晚留盏灯", description: "适合在夜晚进行轻松的聊天，分享心情与生活片段。", avatar: "月", tone: "柔和、简洁、陪伴感" }
];
