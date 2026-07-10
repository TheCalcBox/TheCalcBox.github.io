# TheCalcBox Learning 部署說明

## 建議網址
正式建議使用：

https://thecalcbox.com/learning/

目前使用的 `/learing/` 拼字少了 n。這份版本採相對路徑，因此兩種資料夾名稱都能運作，但建議現在就改成 `/learning/`，避免未來 SEO 與網址重導問題。

## GitHub 配置

將 ZIP 解壓後的所有內容放進：

learning/

應看到：

learning/
├── index.html
├── poetry.html
├── assets/
├── data/
├── poetry/
├── README.md
├── CALCBOX_INK_STYLE.md
└── CALCBOX_AUDIO_STYLE.md

請不要再多包一層 `calcbox_learning_deploy_ready/`。

## 測試網址

目錄：
https://thecalcbox.com/learning/

靜夜思：
https://thecalcbox.com/learning/poetry.html?id=jing-ye-si

春曉：
https://thecalcbox.com/learning/poetry.html?id=chun-xiao

獨立入口：
https://thecalcbox.com/learning/poetry/jing-ye-si/

## 若仍顯示純文字

請確認 GitHub 中存在：

learning/assets/css/poetry.css
learning/assets/js/poems-inline.js
learning/assets/js/poetry-engine.js

並清除 Cloudflare 快取或等待新部署完成。
