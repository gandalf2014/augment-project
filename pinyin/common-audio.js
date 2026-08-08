// ============================================================
// 公共音频模块 — 拼音学习 / 连连看 / 汉字消消乐 共用
// 提供：静音开关、TTS 兜底、烟花音效、配对提示音、音频权限
// 依赖：无（纯 Web Audio API + Web Speech API）
// 用法：<script src="common-audio.js"></script> 在游戏脚本之前加载
// ============================================================

// ===== 静音开关（跨游戏共享 localStorage）=====
let soundEnabled = localStorage.getItem('pinyinSoundEnabled') !== 'off';

function toggleSound() {
    soundEnabled = !soundEnabled;
    localStorage.setItem('pinyinSoundEnabled', soundEnabled ? 'on' : 'off');
    updateSoundBtn();
}

function updateSoundBtn() {
    const btn = document.getElementById('soundToggle');
    if (btn) {
        btn.textContent = soundEnabled ? '\u{1F50A}' : '\u{1F507}';
    }
}

// ===== Web Audio 音频上下文（烟花/提示音）=====
let fireworkAudioCtx = null;

// 确保音频上下文已解锁（须在用户手势中调用）
function ensureFireworkAudio() {
    if (!fireworkAudioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) {
            fireworkAudioCtx = new AC();
        }
    }
    if (fireworkAudioCtx && fireworkAudioCtx.state === 'suspended') {
        fireworkAudioCtx.resume();
    }
}

// 烟花爆炸低频轰鸣
function playBoom(startTime, pan) {
    const ctx = fireworkAudioCtx;
    const dur = 0.9;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110 + Math.random() * 30, startTime);
    osc.frequency.exponentialRampToValueAtTime(35, startTime + dur);
    gain.gain.setValueAtTime(0.5, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);
    if (ctx.createStereoPanner) {
        const p = ctx.createStereoPanner();
        p.pan.value = pan;
        osc.connect(p);
        p.connect(gain);
    } else {
        osc.connect(gain);
    }
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + dur + 0.05);
}

// 鞭炮噼啪声（短促白噪声 burst）
function playCrackle(startTime) {
    const ctx = fireworkAudioCtx;
    const dur = 0.03 + Math.random() * 0.07;
    const n = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < n; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1200 + Math.random() * 2800;
    const gain = ctx.createGain();
    gain.gain.value = 0.2 + Math.random() * 0.4;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(startTime);
}

// 播放烟花爆竹音效
function playFireworkSound() {
    if (!soundEnabled) return;
    try {
        ensureFireworkAudio();
        if (!fireworkAudioCtx) return;
        const now = fireworkAudioCtx.currentTime;
        playBoom(now, -0.6);
        playBoom(now + 0.35, 0.6);
        playBoom(now + 0.75, 0);
        for (let i = 0; i < 36; i++) {
            playCrackle(now + Math.random() * 2.0);
        }
    } catch (e) {
        console.warn('烟花爆竹音效播放失败:', e);
    }
}

// 配对成功提示音（清脆的"叮"）
function playMatchSound() {
    if (!soundEnabled) return;
    try {
        ensureFireworkAudio();
        if (!fireworkAudioCtx) return;
        const ctx = fireworkAudioCtx;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(660, now + 0.18);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.4);
    } catch (e) {
        console.warn('配对提示音播放失败:', e);
    }
}

// 翻卡“哒”音效（短促高频点击）
function playFlipSound() {
    if (!soundEnabled) return;
    try {
        ensureFireworkAudio();
        if (!fireworkAudioCtx) return;
        const ctx = fireworkAudioCtx;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(1800, now);
        osc.frequency.exponentialRampToValueAtTime(900, now + 0.05);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.07);
    } catch (e) {
        console.warn('翻卡音效播放失败:', e);
    }
}

// ===== TTS 兜底发音 =====

// 处理拼音以改善TTS发音
function processPinyinForTTS(pinyin) {
    const pinyinMap = {
        'zh': '知', 'ch': '吃', 'sh': '诗', 'r': '日',
        'z': '资', 'c': '次', 's': '思',
        'ü': '鱼', 'üe': '月', 'ün': '云', 'er': '儿'
    };
    return pinyinMap[pinyin] || pinyin;
}

// 备用TTS方案（改进的Web Speech API）
function playPinyinWithTTS(pinyin) {
    if (!soundEnabled) return;
    if (!window.speechSynthesis) {
        showAudioTip();
        return;
    }
    speechSynthesis.cancel();
    const processedPinyin = processPinyinForTTS(pinyin);
    const utterance = new SpeechSynthesisUtterance(processedPinyin);
    const voices = speechSynthesis.getVoices();
    const chineseVoice = voices.find(voice =>
        voice.lang === 'zh-CN' ||
        voice.lang === 'zh' ||
        voice.name.includes('Chinese') ||
        voice.name.includes('中文') ||
        voice.name.includes('Mandarin')
    );
    if (chineseVoice) {
        utterance.voice = chineseVoice;
    }
    utterance.lang = 'zh-CN';
    utterance.rate = 0.6;
    utterance.pitch = 1.1;
    utterance.volume = 1;
    speechSynthesis.speak(utterance);
}

// ===== 音频权限提示 =====

function showAudioPermissionTip() {
    const tip = document.createElement('div');
    tip.style.cssText = `
        position: fixed;
        top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        background: #ff9800;
        color: white;
        padding: 20px;
        border-radius: 10px;
        font-size: 1.1rem;
        text-align: center;
        z-index: 1000;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        max-width: 400px;
    `;
    tip.innerHTML = `
        <div>🔊 需要音频播放权限</div>
        <div style="font-size: 0.9rem; margin: 15px 0;">
            浏览器阻止了自动音频播放。<br>
            请点击下面的按钮启用音频播放功能。
        </div>
        <button onclick="enableAudio(this.parentElement)"
                style="margin: 10px 5px; padding: 10px 20px; border: none;
                       border-radius: 5px; background: white; color: #ff9800;
                       cursor: pointer; font-weight: bold;">
            启用音频播放
        </button>
        <button onclick="this.parentElement.remove()"
                style="margin: 10px 5px; padding: 10px 20px; border: none;
                       border-radius: 5px; background: rgba(255,255,255,0.3); color: white;
                       cursor: pointer;">
            稍后再说
        </button>
    `;
    document.body.appendChild(tip);
}

function enableAudio(tipElement) {
    const silentAudio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT');
    silentAudio.volume = 0;
    silentAudio.play().then(() => {
        tipElement.remove();
        const successTip = document.createElement('div');
        successTip.style.cssText = `
            position: fixed; top: 20px; right: 20px;
            background: #4CAF50; color: white;
            padding: 15px; border-radius: 8px;
            z-index: 1000; font-weight: bold;
        `;
        successTip.textContent = '✅ 音频播放已启用！现在可以点击拼音卡片听发音了';
        document.body.appendChild(successTip);
        setTimeout(() => successTip.remove(), 3000);
    }).catch(() => {});
}

function showAudioTip() {
    const tip = document.createElement('div');
    tip.style.cssText = `
        position: fixed; top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        background: #ff6b6b; color: white;
        padding: 20px; border-radius: 10px;
        font-size: 1.1rem; text-align: center;
        z-index: 1000;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    `;
    tip.innerHTML = `
        <div>🔊 音频功能需要音频文件支持</div>
        <div style="font-size: 0.9rem; margin-top: 10px;">
            请在项目根目录创建 audio 文件夹，<br>
            并添加对应的拼音音频文件（如 a.mp3, b.mp3 等）
        </div>
        <button onclick="this.parentElement.remove()"
                style="margin-top: 15px; padding: 8px 16px; border: none;
                       border-radius: 5px; background: white; color: #ff6b6b;
                       cursor: pointer; font-weight: bold;">
            知道了
        </button>
    `;
    document.body.appendChild(tip);
    setTimeout(() => {
        if (tip.parentElement) {
            tip.remove();
        }
    }, 5000);
}

// 静音音频解锁（HTMLAudio 自动播放策略）
function initAudioContext() {
    const silentAudio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT');
    silentAudio.volume = 0;
    silentAudio.play().catch(() => {});
}
