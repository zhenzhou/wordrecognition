/**
 * 课程数据加载与查询。
 * 数据由 tools/build_data.py 生成：data/chars.json、data/curriculum.json。
 */

/** 全局课程数据（加载后只读）。 */
export const D = {
    chars: {}, // 字 -> {p 拼音, r 部首, n 笔画, g 分组, m 释义, x 例句, w 组词, alt 多音}
    stages: [], // 阶段列表
    groups: [], // 全部分组（按学习顺序，下标 = id - 1）
    groupMap: new Map(),
    order: [], // 按推荐学习顺序排列的全部汉字
    total: 0,
};

async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`加载 ${url} 失败（${res.status}）`);
    return res.json();
}

/** 加载课程数据。 */
export async function loadData() {
    const [chars, curriculum] = await Promise.all([
        fetchJson('data/chars.json'),
        fetchJson('data/curriculum.json'),
    ]);
    D.chars = chars;
    D.stages = curriculum.stages;
    D.total = curriculum.total;
    D.groups = [];
    D.order = [];
    for (const stage of D.stages) {
        for (const group of stage.groups) {
            group.stage = stage.id;
            group.list = [...group.chars];
            D.groups.push(group);
            D.groupMap.set(group.id, group);
            D.order.push(...group.list);
        }
    }
}

/** 获取字的详细信息。 */
export function getChar(ch) {
    return D.chars[ch];
}

/** 获取分组。 */
export function getGroup(id) {
    return D.groupMap.get(Number(id));
}

/** 获取字所属阶段。 */
export function stageOfGroup(group) {
    return D.stages.find((s) => s.id === group.stage);
}

/** 阶段的全部汉字。 */
export function stageChars(stage) {
    return stage.groups.flatMap((g) => g.list);
}
