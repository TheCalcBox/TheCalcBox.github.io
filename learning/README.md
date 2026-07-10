# CalcBox Learning Engine V1

這個套件已包含：

1. 共用 Learning/Poetry Engine
2. 第一批 10 首精品唐詩資料
3. CalcBox Ink Style™ 插畫提示詞庫
4. CalcBox Audio Style™ 音效與語音規格
5. 唐詩目錄與單首劇場頁
6. JSON、SEO、Schema、拼音、白話、英文、逐句解析與 Story Mode

## 本機預覽
建議用任一靜態伺服器啟動，例如 VS Code Live Server。
首頁：`/poetry/`
單首模板：`/poetry.html?id=jing-ye-si`

## 正式素材
每首詩資料夾都已建立：
- `assets/images/<poem-id>/PROMPTS.md`
- `assets/audio/<poem-id>/README.md`

插畫與 MP3 尚需依提示詞生成或錄製。素材未放入時，頁面會使用 CSS 背景與瀏覽器語音作為備援。
