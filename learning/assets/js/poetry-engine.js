
const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
let poem=null,current=0,playing=false,timer=null,voiceAudio=null,musicAudio=null;
function poemId(){const q=new URLSearchParams(location.search).get('id');if(q)return q;const a=location.pathname.split('/').filter(Boolean);return a[a.length-1]||'jing-ye-si'}
function schemaFor(p){return {"@context":"https://schema.org","@type":"CreativeWork","name":p.title,"author":{"@type":"Person","name":p.author},"inLanguage":"zh-Hant","description":p.summary,"keywords":p.tags.join(",")}}
async function loadPoem(){
 const id=poemId(); poem=(window.CALCBOX_POEMS||{})[id];
 if(!poem){document.body.innerHTML='<p style="padding:2rem">找不到詩詞資料。</p>';return}
 render();
}
function render(){
 document.title=poem.seo.title;document.querySelector('meta[name=description]').content=poem.seo.description;
 const ld=document.createElement('script');ld.type='application/ld+json';ld.textContent=JSON.stringify(schemaFor(poem));document.head.appendChild(ld);
 $('#title').textContent=poem.title;$('#summary').textContent=poem.summary;$('#author').textContent=`${poem.author}【${poem.dynasty}代】`;
 $('#title2').textContent=poem.title;$('#author2').textContent=`${poem.author}｜${poem.form}｜${poem.grade}`;
 $('#background').textContent=poem.background;$('#authorBio').textContent=poem.authorBio;$('#english').textContent=poem.lines.map(x=>x.english).join('\n');
 $('#poemLines').innerHTML=poem.lines.map((x,i)=>`<div class="poem-line ${i===0?'active':''}" onclick="goTo(${i})">${x.text}<span class="pinyin">${x.pinyin}</span></div>`).join('');
 $('#scenes').innerHTML=poem.lines.map((x,i)=>`<div class="scene fallback-${(i%4)+1} ${i===0?'active':''}"></div>`).join('');
 poem.lines.forEach((x,i)=>{const img=new Image();img.onload=()=>{$$('.scene')[i].style.backgroundImage=`url("${x.image}")`};img.src=x.image.replace(/^\/assets\//,'assets/')});
 musicAudio=new Audio(poem.music.replace(/^\/assets\//,'assets/'));musicAudio.loop=true;musicAudio.volume=.22; update();
}
function update(){$$('.scene').forEach((e,i)=>e.classList.toggle('active',i===current));$$('.poem-line').forEach((e,i)=>e.classList.toggle('active',i===current));$('#translation').textContent=poem.lines[current].translation;$('#explain').textContent=poem.lines[current].explain;$('#progress').style.width=((current+1)/poem.lines.length*100)+'%'}
function voice(){const v=speechSynthesis.getVoices();return v.find(x=>/zh-TW/i.test(x.lang))||v.find(x=>/zh-CN|zh-HK/i.test(x.lang))||v[0]}
function fallback(cb){const u=new SpeechSynthesisUtterance(poem.lines[current].text);u.lang='zh-TW';u.rate=.72;u.pitch=.92;const v=voice();if(v)u.voice=v;u.onend=()=>cb&&cb();u.onerror=()=>cb&&cb();speechSynthesis.speak(u)}
function speak(cb){if(voiceAudio){voiceAudio.pause();voiceAudio=null}const a=new Audio(poem.lines[current].audio.replace(/^\/assets\//,'assets/'));voiceAudio=a;let f=false;a.onended=()=>cb&&cb();a.onerror=()=>{if(!f){f=true;fallback(cb)}};a.play().catch(()=>fallback(cb))}
function goTo(i){current=Math.max(0,Math.min(poem.lines.length-1,i));update()}
function next(){if(!playing)return;speak(()=>{if(!playing)return;if(current<poem.lines.length-1){timer=setTimeout(()=>{current++;update();next()},850)}else{playing=false;$('#playBtn').textContent='▶ 自動播放'}})}
function togglePlay(){playing=!playing;$('#playBtn').textContent=playing?'❚❚ 暫停':'▶ 自動播放';if(playing)next();else{clearTimeout(timer);speechSynthesis.cancel();voiceAudio&&voiceAudio.pause()}}
function resetPoem(){playing=false;clearTimeout(timer);speechSynthesis.cancel();voiceAudio&&voiceAudio.pause();current=0;update();$('#playBtn').textContent='▶ 自動播放'}
function toggleMusic(){if(musicAudio.paused){musicAudio.play().catch(()=>{});$('#musicBtn').textContent='♫ 關閉配樂'}else{musicAudio.pause();$('#musicBtn').textContent='♫ 開啟配樂'}}
window.addEventListener('DOMContentLoaded',loadPoem);
