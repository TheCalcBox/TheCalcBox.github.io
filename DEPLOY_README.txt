# CalcBox 部署說明（v13 完整版）

## 這個壓縮檔是什麼

這是 CalcBox 網站的**完整部署版**——解壓縮後的所有檔案直接放上
GitHub Pages 就能運作，不需要執行任何程式或建置步驟。

---

## 檔案結構總覽

```
（根目錄）
├── index.html          ← 首頁（工具目錄）
├── 404.html            ← 找不到頁面時自動顯示（GitHub Pages 自動偵測）
├── favicon.ico         ← 瀏覽器分頁圖示
├── robots.txt          ← 搜尋引擎爬蟲規則
├── sitemap.xml         ← 網站地圖（含全部 29 頁 + OG 圖片索引）
├── llms.txt            ← AI 爬蟲說明檔
│
├── icons/              ← 全套 App 圖示（16~512px，未來 PWA 可直接用）
├── og/                 ← 21 張社群分享圖片（LINE/FB 分享時顯示）
│
├── loan/ health/ tax/ ...（21 個工具頁資料夾）
│   └── index.html      ← 每個資料夾一個計算器頁面
│
├── guide/              ← 比較指南（內容文章）
│   ├── buy-vs-rent/        買房 vs 租屋
│   └── prepay-vs-invest/   提前還款 vs 投資
│
├── about/              ← 關於我們
├── privacy/            ← 隱私權政策（AdSense 審核必要）
├── disclaimer/         ← 免責聲明（AdSense 審核必要）
├── contact/            ← 聯絡我們
└── US/                 ← 美國版（建置中頁面，已設 noindex）
```

---

## 部署步驟（GitHub 網頁版，最簡單）

1. 解壓縮這個 zip
2. 開啟你的 repository：github.com/thecalcbox/thecalcbox.github.io
3. **先刪除 repo 裡的舊檔案**（或全部覆蓋）：
   點 repo 裡的舊資料夾 → 右上「⋯」→ Delete directory
   （保險起見也可以先下載備份）
4. 點「Add file → Upload files」，把解壓縮後的**全部內容**拖進去
   ⚠️ 注意是拖「資料夾裡面的東西」，不是拖整個資料夾
5. 下方 commit 訊息填「v13 deploy」→ Commit changes
6. 等 1–2 分鐘，開 https://thecalcbox.github.io 確認生效

## 部署步驟（Git 指令版）

```bash
git clone https://github.com/thecalcbox/thecalcbox.github.io
cd thecalcbox.github.io
# 刪掉舊檔（保留 .git）
find . -maxdepth 1 ! -name '.git' ! -name '.' -exec rm -rf {} +
# 把解壓縮的檔案全部複製進來
cp -r /path/to/解壓縮資料夾/* .
git add -A
git commit -m "v13: ads, guides, legal pages, favicon, 404"
git push
```

---

## 部署後必做檢查清單

### 第 1 天
- [ ] 開 https://thecalcbox.github.io 確認首頁正常
- [ ] 手機開幾個工具頁，確認計算功能正常
- [ ] 確認瀏覽器分頁有出現金色 C 圖示（favicon）
- [ ] 隨便打一個不存在的網址（如 /xxx/）確認 404 頁出現
- [ ] 開 GA 即時報告（analytics.google.com → 即時），
      自己用手機逛網站，確認有看到 1 位使用者

### 第 2–3 天
- [ ] Google Search Console 重新提交 sitemap：
      https://search.google.com/search-console
      → Sitemaps → 輸入 sitemap.xml → 提交
- [ ] 用 Facebook 分享偵錯工具測試 OG 圖片：
      https://developers.facebook.com/tools/debug/
      輸入 https://thecalcbox.github.io/loan/ → 確認深藍金圖片出現
- [ ] 用 Rich Results Test 測 FAQ Schema：
      https://search.google.com/test/rich-results
      輸入任一工具頁網址 → 確認偵測到 FAQ

### AdSense 送審
- [ ] 確認以上都正常後，到 AdSense 後台按「要求審查」
- [ ] 審核通常 1 天到 2 週

---

## 重要提醒

### 廣告位編號是占位的
每個計算按鈕下方的廣告位使用占位編號（data-ad-slot="6010" 等）。
AdSense **過審後**有兩個選擇：
- **簡單做法**：AdSense 後台開啟「自動廣告」，Google 自動接管所有版位
- **手動做法**：後台逐一建立廣告單元，把真實 slot ID 換進 HTML

### 聯絡信箱
/contact/ 頁面信箱已設定為 alonsolu0204@gmail.com，無需再改。

### 內容更新時
任何頁面都是獨立的 HTML 檔，改完直接上傳覆蓋即可，
不影響其他頁面。

### 國際化架構（另一包）
CalcBox_arch_source_v5.zip 是未來多國擴展用的來源架構
（content JSON + templates + build.py），**現在不需要上傳**。
等你準備做日本版/美國版時再啟用，操作說明在那包的 README.md。

---

## 本版（v13）包含的所有功能

- 首頁：深藍+琥珀金品牌、SVG 圖示、featured 大卡、熱搜捷徑
- 21 個工具頁：統一品牌 header/footer、返回按鈕、
  相關工具推薦卡（4 標籤 chip）、資料來源標註、
  計算按鈕下方廣告位（共 108 個，含「廣告」標示）
- 2 篇比較指南：買房vs租屋、提前還款vs投資（含三層 Schema）
- 4 個法務頁：關於/隱私/免責/聯絡（AdSense 審核必要）
- SEO：og:image 社群圖 ×21、sitemap 圖片索引、
  FAQ/Breadcrumb/Article Schema、hreflang 預留
- GA4：全站追蹤 + calculate/copy_result 事件
- 其他：404 頁、favicon 全套、US 建置中頁、
  WCAG AA 對比度、安全期計算 bug 修復

最後更新：2026-06-12
