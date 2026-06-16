# 台銀匯率自動更新部署說明

這包檔案會讓網站改成讀取自己的台銀牌告 JSON：

- `/rates/latest.json`
- `/public/rates/latest.json`

GitHub Actions 會每 5 分鐘嘗試抓一次台灣銀行牌告資料，並更新這兩份 JSON。前端 `index.html` 會優先讀 `/rates/latest.json`，如果部署環境不同，也會嘗試 `./rates/latest.json` 與 `/public/rates/latest.json`。

## 要上傳的檔案

把這些檔案放進你的 GitHub 專案：

```text
index.html
scripts/fetch-bot-rates.js
.github/workflows/update-fx.yml
rates/latest.json
public/rates/latest.json
```

## 第一次啟用

1. Commit 並 push 到 GitHub。
2. 到 GitHub 專案的 `Actions`。
3. 點 `Update FX Rates`。
4. 點 `Run workflow` 手動跑一次。
5. 成功後打開：
   - `https://你的網域/rates/latest.json`
   - 或 `https://你的網域/public/rates/latest.json`

看到 `details.USD` 有現金/即期買賣價，就代表成功。

## 前端邏輯

- 只用台灣銀行牌告資料。
- 不再混用市場中間價。
- 手機和電腦都讀同一份 JSON。
- 每 5 分鐘自動重新讀取。
- 切回分頁或手機喚醒時會重新讀取。
- 如果讀取失敗，會保留最後一次成功資料。
- 舊牌告不會覆蓋新牌告。

## 注意

GitHub Actions 的 5 分鐘排程不保證秒級準時，GitHub 可能延遲幾分鐘執行。但這仍能避免手機和電腦各自讀到不同 CDN 快取的問題。
