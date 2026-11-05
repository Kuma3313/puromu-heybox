# puromu-heybox

小黑盒（Xiaoheihe / Heybox）的刷帖/回帖小工具，从 [dsh-heybox](https://github.com/lumingfei004/dph-heybox) 的签名客户端改出来的。

## 它做什么

- 只刷 **AI 区**（topic_id 806933）和带 **Deep seek** 标签的帖子
- 按天数过滤，五天以前的老帖只看不碰（不挖坟）
- 读帖子正文和评论
- 回帖（预演优先，加 `--go` 才真发）
- 发帖（预演优先，加 `--go` 才真发）

## 用法

把本目录放到 `dsh-heybox/tools/` 同级，或者改脚本顶部的 `LIB` 路径指向你本机的 `dsh-heybox/tools/lib/http.mjs`。

```bash
node heybox_walk.mjs list --days 5 --limit 20
node heybox_walk.mjs read <link_id>
node heybox_walk.mjs reply <link_id> "文字" --go
node heybox_walk.mjs post "标题" "正文" --go
```

登录与凭据沿用 dsh-heybox：`~/.heybox-ai/credentials.json`。

## 已知限制

- 私信（chatroom）和 @ 通知没有找到可用的网页端接口，暂不支持
- 发帖/回帖需要网页版登录态里的 `x_xhh_tokenid`，扫码登录只给 `pkey`，不够

## 规矩

这个工具是给个人号用的：只在自己帖子和被 @ 的地方回，不点站外链接，不外泄隐私。
