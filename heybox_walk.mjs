// 逛小黑盒（按她 11-28 的规矩）：只刷 AI 分区和 DeepSeek 相关帖，五天前的老帖只看不碰。
// 用法：
//   node heybox_walk.mjs list                  # 列今日/近五天 AI 区的帖子
//   node heybox_walk.mjs list --days 5 --limit 20
//   node heybox_walk.mjs read <link_id>        # 帖子正文 + 评论
//   node heybox_walk.mjs reply <link_id> "文字" [--go]   # 回帖（没 --go 只预演）
//   node heybox_walk.mjs post "标题" "正文" [--go]       # 发帖（同样预演优先）
// 依赖 dsh-heybox 的签名客户端，路径写死在本机 profile 里。
import { pathToFileURL } from 'node:url'

const LIB = 'C:/Users/Administrator/.dsh/profiles/desktop/node_modules/dsh-heybox/tools/lib/http.mjs'
const { HeyboxClient } = await import(pathToFileURL(LIB).href)

const argv = process.argv.slice(2)
const cmd = argv[0] || 'list'
const flag = (name, def) => {
  const i = argv.indexOf(name)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def
}
const has = (name) => argv.includes(name)
const c = new HeyboxClient({ interval: 900 })
const DAY = 86400000
const now = Date.now()

function ts(v) {
  const n = Number(v)
  if (!n) return 0
  return n > 1e12 ? n : n * 1000
}

function pickLinks(v, out = []) {
  if (!v || typeof v !== 'object') return out
  if (Array.isArray(v)) { for (const x of v) pickLinks(x, out); return out }
  if (v.linkid && v.title !== undefined) out.push(v)
  for (const x of Object.values(v)) pickLinks(x, out)
  return out
}

function findComments(value, depth = 0) {
  if (!value || depth > 4) return []
  if (Array.isArray(value)) {
    if (value.length && value.every((v) => v && typeof v === 'object' && ('commentid' in v || 'comment_id' in v))) return value
    for (const v of value) { const r = findComments(v, depth + 1); if (r.length) return r }
    return []
  }
  if (typeof value === 'object') {
    for (const k of ['comments', 'comment_list', 'list', 'data']) {
      if (value[k]) { const r = findComments(value[k], depth + 1); if (r.length) return r }
    }
    for (const v of Object.values(value)) { const r = findComments(v, depth + 1); if (r.length) return r }
  }
  return []
}

async function list() {
  const days = Number(flag('--days', 5))
  const limit = Number(flag('--limit', 15))
  const cutoff = now - days * DAY
  const rows = []

  // 1) AI 分区（topic_id 806933）
  try {
    const d = await c.get('/bbs/app/topic/feeds', { topic_id: 806933, offset: 0, limit: 20 })
    for (const l of pickLinks(d.result)) rows.push({ ...l, _from: 'AI' })
  } catch (e) { console.error('AI 分区拉取失败：' + e.message) }

  // 2) DeepSeek 关键词搜帖
  for (const q of ['DeepSeek', 'deepseek']) {
    try {
      const d = await c.get('/bbs/app/api/search/links', { q, offset: 0, limit: 10 })
      for (const l of pickLinks(d.result)) rows.push({ ...l, _from: '搜索' })
    } catch { /* 搜不到就算了 */ }
  }

  const seen = new Set()
  const fresh = rows.filter((r) => {
    const id = String(r.linkid)
    if (seen.has(id)) return false
    seen.add(id)
    const t = ts(r.create_time ?? r.create_at ?? r.publish_time)
    return t === 0 || t >= cutoff
  })

  fresh.sort((a, b) => ts(b.create_time ?? b.create_at ?? b.publish_time) - ts(a.create_time ?? a.create_at ?? a.publish_time))
  for (const r of fresh.slice(0, limit)) {
    const t = ts(r.create_time ?? r.create_at ?? r.publish_time)
    const when = t ? new Date(t).toLocaleString('zh-CN') : '时间未知'
    const cmt = r.comment_num ?? r.comments_num ?? ''
    console.log(`[${r.linkid}] ${String(r.title ?? '').slice(0, 50)} · ${when}${cmt ? ` · ${cmt} 评` : ''} · ${r._from}`)
  }
  console.log(`共 ${fresh.length} 条（${days} 天内）`)
}

async function read(linkId) {
  const d = await c.get('/bbs/app/link/tree', {
    link_id: linkId, page: 1, is_first: 1, index: 1, owner_only: 0, offset: 0, limit: 20, sort_filter: 'hot',
  })
  const link = d.result?.link ?? {}
  const comments = findComments(d.result)
  console.log('标题:', link.title ?? '')
  console.log('时间:', link.create_time ? new Date(ts(link.create_time)).toLocaleString('zh-CN') : '')
  console.log('正文:', String(link.description ?? link.text ?? '').slice(0, 800))
  console.log(`评论 ${comments.length} 条`)
  for (const cm of comments.slice(0, 10)) {
    console.log(`- ${cm.user?.username ?? ''}: ${String(cm.text ?? '').slice(0, 120)}`)
  }
}

async function reply(linkId, text, go) {
  if (!text) { console.log('要回什么？'); return }
  if (!go) { console.log(`预演：回 ${linkId} → ${text}`); return }
  const out = await c.request({
    path: '/bbs/app/comment/post', method: 'POST', workshop: true,
    body: { link_id: linkId, text, reply_id: '', root_comment_id: '' },
  })
  console.log('已发', JSON.stringify(out).slice(0, 200))
}

async function post(title, text, go) {
  if (!go) { console.log(`预演：发帖「${title}」`); return }
  const out = await c.request({
    path: '/bbs/app/link/create', method: 'POST', workshop: true,
    body: { title, text, topic_id: 806933 },
  })
  console.log('已发', JSON.stringify(out).slice(0, 200))
}

if (cmd === 'list') await list()
else if (cmd === 'read') await read(argv[1])
else if (cmd === 'reply') await reply(argv[1], argv[2], has('--go'))
else if (cmd === 'post') await post(argv[1], argv[2], has('--go'))
else console.log('用法见文件头')
