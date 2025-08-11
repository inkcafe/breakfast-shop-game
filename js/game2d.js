// 早餐店游戏主类

class BreakfastShop2D {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        if (!this.canvas) {
            console.error('Canvas element not found!');
            return;
        }
        this.ctx = this.canvas.getContext('2d');
        
        // 设置主画布为像素完美渲染，保持像素风格
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.webkitImageSmoothingEnabled = false;
        this.ctx.mozImageSmoothingEnabled = false;
        this.ctx.msImageSmoothingEnabled = false;

        // 预加载 hu 与 hu2 图片
        this.huImage = new Image();
        this.huImage.onload = () => {
            console.log('✅ hu.png loaded');
        };
        this.huImage.onerror = () => {
            console.warn('❌ Failed to load hu image: images/hu.png');
        };
        this.huImage.src = 'images/hu.png?t=' + Date.now();

        this.hu2Image = new Image();
        this.hu2Image.onload = () => {
            console.log('✅ hu2.png loaded');
        };
        this.hu2Image.onerror = () => {
            console.warn('❌ Failed to load hu2 image: images/hu2.png');
        };
        this.hu2Image.src = 'images/hu2.png?t=' + Date.now();
        
        this.gameState = {
            money: 100,
            reputation: 50,
            shopLevel: 1, // 店铺等级：1-5级
            shopName: '普通店', // 店铺名称
            day: 1,
            phase: 'morning',
            isRunning: false,
            isPaused: false,
            customers: [],
            orders: [],
            // 🎯 新增：完成订单计数
            completedOrdersToday: 0,
            pendingOrders: [], // 🎯 待处理订单列表
            cookingItems: [],
            completedFood: [],
            currentPlate: [],
            tables: [],
            currentView: 'main', // 'main', 'youtiao', 'doujiang', 'congee'
            // 🎯 重新设计的粥制作状态
            congeeState: {
                currentStep: 'idle', // 'idle', 'dianfanbao_clicked', 'zhou_ready', 'selecting_sides', 'completed'
                selectedSides: [], // 已选择的配菜
                congeeInProgress: null, // 当前制作中的粥
                completedCongee: [], // 完成的粥（可拖拽到餐盘）
                sideSelectionMode: false // 是否在配菜选择模式
            },
            // 新增油条制作状态
            youtiaoState: {
                isPreparingYoutiao: false,
                currentStep: 'idle', // 'idle', 'kneading', 'stretching', 'frying'
                doughCircles: 0, // 画圈次数
                stretchMoves: 0, // 拉伸次数
                youtiaoInOil: [], // 油锅中的油条
                youtiaoId: null,
                lastMouseX: 0,
                lastMouseY: 0,
                circleProgress: 0,
                stretchDirection: 0, // 1向上, -1向下, 0无
                // 🎯 新增：基于移动距离的收集状态
                collectingState: {
                    isTracking: false, // 是否正在跟踪鼠标移动
                    startX: 0,
                    startY: 0,
                    targetYoutiao: null, // 目标油条对象
                    targetIndex: -1, // 目标油条索引
                    moveThreshold: 30 // 移动阈值（像素）
                },
                // 🎯 新增：待放置的油条系统（在bucket内部上方显示2秒）
                pendingYoutiao: [] // 存储待放置的油条，每个包含：{youtiao, startTime, position}
            },
            // 豆浆壶状态（hu2 选中与位置）
            doujiangState: {
                kettleSelected: false,
                kettleX: 0,
                kettleY: 0
            },
            // 卷帘门状态
            juanLianMenState: {
                isVisible: true, // 卷帘门是否可见
                isAnimating: false, // 是否正在播放动画
                position: 0, // 卷帘门位置 (0=完全遮挡, 1=完全打开)
                animationStartTime: 0, // 动画开始时间
                animationDuration: 500, // 动画持续时间（0.5秒 = 500毫秒）
                animationType: 'up', // 动画类型: 'up' 或 'viewSwitch'
                phase: 'down', // 界面切换动画的阶段: 'down', 'pause', 'up'
                downDuration: 300, // 下降持续时间（0.3秒）
                pauseDuration: 50, // 停顿持续时间（0.05秒）
                upDuration: 300, // 上升持续时间（0.3秒）
                targetView: null, // 目标界面（界面切换时使用）
                viewSwitched: false // 是否已经执行了界面切换
            }
        };

        // 拖拽状态
        this.dragState = {
            isDragging: false,
            draggedItem: null,
            draggedElement: null,
            startX: 0,
            startY: 0,
            // 拖动跟随监控
            pointerScreenX: null,
            pointerScreenY: null,
            followRafId: null
        };

        this.config = {
            dayDuration: 180,
            maxCustomers: 2, // 进一步降低最大顾客数
            customerSpawnRate: 0.2, // 进一步降低生成率
            foodPrices: {
                youtiao: 3,
                doujiang: 5,
                congee: 8
            },
            cookTimes: {
                youtiao: 6, // 调整油条炸制时间为6秒
                doujiang: 2, // 从5秒减少到2秒，加快豆浆制作速度
                congee: 1.5 // 比豆浆更快的盛粥时间
            },
            // 🎯 新增：按单量结束开关与目标
            useOrderTargetEnd: true,
            dailyOrderTarget: 8
        };

        this.sprites = {};
        this.timeLeft = this.config.dayDuration;
        this.lastUpdate = 0;
        
        this.debug = false; // 关闭高频日志以提升性能
        this.useLegacyUIScaling = false; // 关闭旧的JS缩放，改用index2d.html的fitWrapper统一缩放
        // 资源准备标记：卷帘门与开始营业按钮素材
        this.assetsReady = {
            juanlianmen: false,
            yingye: false
        };
        // 设置：声音总开关（本地存储）
        try {
            const savedAudio = localStorage.getItem('audioEnabled');
            this.audioEnabled = savedAudio === null ? true : savedAudio === 'true';
        } catch (_) {
            this.audioEnabled = true;
        }
        
        this.init();
    }

    // 🎯 通过达成订单目标结束一天（先完整播放卷帘门遮挡动画，再显示结算界面）
    triggerEndOfDayByOrders() {
        if (!this.gameState.isRunning) return;
        this.gameState.isRunning = false;
        // 触发卷帘门"界面切换"动画，但目标为结算占位视图
        const j = this.gameState.juanLianMenState;
        j.isVisible = true;
        j.isAnimating = true;
        j.animationType = 'viewSwitch';
        j.phase = 'down';
        j.targetView = 'summary';
        j.viewSwitched = false;
        j.animationStartTime = Date.now();

        // 在卷帘门完全遮挡且处于暂停阶段时显示结算
        // 我们监听一个一次性标记，在 updateJuanLianMenAnimation 的 pause 阶段触发
        this._pendingShowSummaryAfterShutter = true;
    }

    // 🎯 显示结算界面：今日收入、名誉变化与满意度
    showDaySummaryModal() {
        const earnings = 0; // 已直接计入money，这里可另行统计，如需可累积每日收入
        const reputation = this.gameState.reputation;
        const orders = this.gameState.completedOrdersToday || 0;
        const avgSatisfaction = this.calculateAverageSatisfaction();
        const modalId = 'daySummaryModal';
        let modal = document.getElementById(modalId);
        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.style.position = 'fixed';
            modal.style.left = '50%';
            modal.style.top = '50%';
            modal.style.transform = 'translate(-50%, -50%)';
            modal.style.background = 'rgba(0,0,0,0.85)';
            modal.style.color = '#fff';
            modal.style.padding = '20px 28px';
            modal.style.border = '2px solid #fff';
            modal.style.zIndex = '9999';
            modal.style.fontFamily = 'Arial, sans-serif';
            modal.style.textAlign = 'center';
            modal.style.minWidth = '360px';
            document.body.appendChild(modal);
        }
        const cacheBust = Date.now();
        modal.innerHTML = `
            <div id="jiesuanContent" style="position:relative; display:inline-block; image-rendering: pixelated;">
                <img id="jiesuanImg" src="images/jiesuan.png?t=${cacheBust}" alt="结算" style="display:block; width:680px; height:auto; image-rendering: pixelated; image-rendering: crisp-edges;">
                <div style="position:absolute; left:50%; bottom:16%; transform: translateX(-50%); width:80%; text-align:center; font-weight:bold; font-size:20px; color:#fff; text-shadow: 1px 1px 0 #000; image-rendering: pixelated;">
                    <div style="margin:4px 0;">完成单量：<strong>${orders}</strong></div>
                    <div style="margin:4px 0;">当前资金：<strong>¥${this.gameState.money.toFixed(0)}</strong></div>
                    <div style="margin:4px 0;">当前名誉：<strong>${reputation}</strong></div>
                    <div style="margin:4px 0;">顾客满意度：<strong>${avgSatisfaction}%</strong></div>
                </div>
                <button id="nextDayBtn" style="position:absolute; right:6%; bottom:6%; width:180px; height:64px; background:url('images/xiayitian.png?t=${cacheBust}') no-repeat center center; background-size: contain; border:none; outline:none; cursor:pointer; color:transparent; image-rendering: pixelated;"></button>
            </div>
        `;
        modal.style.display = 'block';
        // 保证结算时不被卷帘门遮挡（避免黑屏）
        if (this.gameState && this.gameState.juanLianMenState) {
            this.gameState.juanLianMenState.isAnimating = false;
            this.gameState.juanLianMenState.isVisible = false; // 隐藏卷帘门
        }
        // 恢复UI层可见与交互
        const ui = document.getElementById('ui');
        if (ui) ui.style.zIndex = '450';
        const viewControls = document.getElementById('viewControls');
        if (viewControls) { viewControls.style.pointerEvents = 'auto'; viewControls.style.visibility = ''; }
        const mainUI = document.getElementById('mainUI');
        if (mainUI) mainUI.style.visibility = '';
        // 停止背景音乐
        if (this.bgmAudio) {
            try { this.bgmAudio.pause(); } catch(_) {}
            try { this.bgmAudio.currentTime = 0; } catch(_) {}
        }
        // 重置顾客与时间（为下一天准备）
        try {
            this.gameState.customers = [];
            this.gameState.orders = [];
            this.gameState.cookingItems = [];
            this.timeLeft = this.config.dayDuration;
            this._elapsedDayMs = 0;
        } catch(_) {}
        const btn = document.getElementById('nextDayBtn');
        if (btn) {
            btn.onclick = () => {
                // 仅关闭结算，下一天需要玩家点击“开始营业”
                modal.style.display = 'none';
                // 确保结算关闭后仍不显示卷帘门（等待玩家手动开始）
                if (this.gameState && this.gameState.juanLianMenState) {
                    this.gameState.juanLianMenState.isAnimating = false;
                    this.gameState.juanLianMenState.isVisible = false;
                }
                this.prepareNextDay();
                // 不自动拉起卷帘门、不自动生成顾客
            };
        }
    }

    calculateAverageSatisfaction() {
        const sats = this.gameState.customers
            .filter(c => c.satisfaction !== undefined)
            .map(c => c.satisfaction);
        if (sats.length === 0) return 100;
        const avg = sats.reduce((a, b) => a + b, 0) / sats.length;
        return Math.round(avg);
    }

    prepareNextDay() {
        // 重置到“未开始”状态，等待玩家点击“开始营业”
        this.gameState.completedOrdersToday = 0;
        this.timeLeft = this.config.dayDuration;
        this.gameState.isRunning = false;
        // 恢复并居中“开始营业”按钮
        const startBtn = document.getElementById('startDay');
        const topControls = document.getElementById('topGameControls');
        if (startBtn) {
            startBtn.disabled = false;
            startBtn.textContent = '🌅 开始营业';
            startBtn.style.display = '';
        }
        if (topControls) topControls.style.display = '';
        // UI 更新
        this.updateUI();
    }

    // 音乐控制：开始营业后播放背景音乐
    playBackgroundMusic() {
        try {
            if (!this.bgmAudio) {
                // 随机选择 jianggu 音轨（若不存在则回退 background.mp3）
                const tracks = [
                    'audio/background.mp3', // 回退
                    'audio/jianggu1.mp3',
                    'audio/jianggu2.mp3',
                    'audio/jianggu3.mp3'
                ];
                const pick = () => {
                    const idx = Math.floor(Math.random() * tracks.length);
                    return tracks[idx];
                };
                this.bgmAudio = new Audio(pick());
                this.bgmAudio.loop = true;
                this.bgmAudio.volume = 0.0; // 先静音，做淡入
                this.bgmAudio.muted = !this.isAudioEnabled();
            }
            const playPromise = this.bgmAudio.play();
            if (playPromise && typeof playPromise.catch === 'function') {
                playPromise.catch(err => console.log('BGM 播放被浏览器策略阻止或失败：', err));
            }
            // 淡入至目标音量
            this.fadeInBGM();
        } catch (e) {
            console.error('BGM 初始化/播放失败:', e);
        }
    }

    // 根据当前视图调节背景音乐音量：大厅略大，其他界面略小
    updateBGMVolume() {
        try {
            if (!this.bgmAudio) return;
            const isMain = this.gameState && this.gameState.currentView === 'main';
            const target = isMain ? 0.65 : 0.35; // 略微调大/调小
            this._bgmTargetVolume = target;
            this.bgmAudio.volume = Math.min(this.bgmAudio.volume, target);
        } catch (_) {}
    }

    // 背景音乐淡入
    fadeInBGM(durationMs = 800) {
        if (!this.bgmAudio) return;
        this.updateBGMVolume();
        const target = this._bgmTargetVolume ?? 0.5;
        const start = this.bgmAudio.volume || 0.0;
        const startTime = performance.now();
        const step = (now) => {
            const t = Math.min(1, (now - startTime) / durationMs);
            const v = start + (target - start) * t;
            this.bgmAudio.volume = v;
            if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }

    // 背景音乐淡出并停止
    fadeOutAndStopBGM(durationMs = 600) {
        if (!this.bgmAudio) return;
        const start = this.bgmAudio.volume || 0.0;
        const startTime = performance.now();
        const step = (now) => {
            const t = Math.min(1, (now - startTime) / durationMs);
            const v = start * (1 - t);
            this.bgmAudio.volume = v;
            if (t < 1) {
                requestAnimationFrame(step);
            } else {
                try { this.bgmAudio.pause(); } catch(_) {}
                try { this.bgmAudio.currentTime = 0; } catch(_) {}
                this.bgmAudio = null;
            }
        };
        requestAnimationFrame(step);
    }

    // 卷帘门音效
    playShutterSFX() {
        try {
            if (!this.shutterAudio) {
                this.shutterAudio = new Audio('audio/juanlianmen.mp3');
                this.shutterAudio.volume = 0.9;
                this.shutterAudio.muted = !this.isAudioEnabled();
            }
            this.shutterAudio.currentTime = 0;
            const p = this.shutterAudio.play();
            if (p && typeof p.catch === 'function') {
                p.catch(err => console.log('卷帘门音效播放失败：', err));
            }
        } catch (e) {
            console.error('卷帘门音效初始化失败:', e);
        }
    }
    init() {
        try {
            
            
            // 延迟后再进行完整初始化
            setTimeout(() => {
                try {
                    this.createSprites();
                    this.setupEventListeners();
                    this.createGameObjects();
                    this.updateShopLevel();
                    
                    // 🎯 UI缩放：默认改由 fitWrapper 统一处理
                    if (this.useLegacyUIScaling) {
                    this.setupUIScaling();
                    }

                    
                    this.updateUI();
                    this.updateCompletedFoodArea();
                    this.updatePlateDisplay();
                    
                    // 🎯 绑定侧边栏按钮事件
                    this.bindSidebarEvents();

                    // 🎵 预加载与绑定常用UI按钮按下音效
                    this.preloadButtonClickBuffer();
                    this.bindButtonClickSFX();

                    // 🎛 绑定设置面板事件
                    this.bindSettingsEvents();
                    
                    this.render();
                    this.gameLoop();
                } catch (error) {
                    console.error('Delayed initialization error:', error);
                }
            }, 1000);
            
        } catch (error) {
            console.error('Game initialization error:', error);
        }
    }

    // 是否开启声音
    isAudioEnabled() { return !!this.audioEnabled; }

    // 设置声音开关
    setAudioEnabled(enabled) {
        this.audioEnabled = !!enabled;
        try { localStorage.setItem('audioEnabled', String(this.audioEnabled)); } catch(_){}
        // 应用到现有音频元素
        const applyMute = (el) => { if (el) el.muted = !this.audioEnabled; };
        applyMute(this.bgmAudio);
        applyMute(this.shutterAudio);
        applyMute(this.youguoAudio);
        applyMute(this.doujiangAudio);
        // Web Audio 的按钮声由逻辑短路控制

        // 若关闭声音并且有循环声，立即暂停
        if (!this.audioEnabled) {
            if (this.bgmAudio) { try { this.bgmAudio.pause(); } catch(_){} }
            if (this.youguoAudio) { try { this.youguoAudio.pause(); } catch(_){} }
        } else {
            // 开启声音时，如果在营业中，确保BGM播放
            if (this.gameState && this.gameState.isRunning) {
                this.playBackgroundMusic();
            }
        }
        // 同步设置面板UI
        const chk = document.getElementById('audioToggle');
        if (chk) chk.checked = this.audioEnabled;
    }

    // 绑定设置面板事件
    bindSettingsEvents() {
        const modal = document.getElementById('settingsModal');
        const closeBtn = document.getElementById('settingsClose');
        const audioToggle = document.getElementById('audioToggle');
        if (closeBtn) closeBtn.onclick = () => this.closeSettings();
        if (audioToggle) {
            audioToggle.checked = this.isAudioEnabled();
            audioToggle.addEventListener('change', (e) => {
                this.setAudioEnabled(e.target.checked);
            });
        }
    }

    openSettings() {
        const modal = document.getElementById('settingsModal');
        if (modal) {
            modal.style.display = 'flex';
            const audioToggle = document.getElementById('audioToggle');
            if (audioToggle) audioToggle.checked = this.isAudioEnabled();
        } else {
            this.showNotification('设置界面不可用');
        }
    }

    closeSettings() {
        const modal = document.getElementById('settingsModal');
        if (modal) modal.style.display = 'none';
    }

    // 绑定常用UI按钮的按下音效
    bindButtonClickSFX() {
        const bind = (selector) => {
            document.querySelectorAll(selector).forEach(el => {
                if (el && !el._btnSfxBound) {
                    el.addEventListener('pointerdown', () => {
                        this.playButtonClickSFX();
                    }, { passive: true });
                    el._btnSfxBound = true;
                }
            });
        };
        // 仅绑定游戏内按钮（开始界面按钮由 StartScreen 处理）
        bind('#startDay');
        bind('#viewControls .view-btn');
        bind('#clearPlate');
        bind('#gameControls button');
        bind('#actionButtons button');
    }

    // 预加载按钮短促点击音（用于裁剪播放 0.08s~0.25s 的片段）
    async preloadButtonClickBuffer() {
        try {
            if (!window.AudioContext && !window.webkitAudioContext) return;
            if (!this._btnAudioCtx) this._btnAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
            if (this._btnBuffer) return;
            const res = await fetch('audio/anniu.mp3?t=' + Date.now());
            const arr = await res.arrayBuffer();
            this._btnBuffer = await this._btnAudioCtx.decodeAudioData(arr);
        } catch (_) { /* 忽略失败，运行时走回退 */ }
    }

    // 按钮按下音效：只播放 80~250ms 片段
    playButtonClickSFX() {
        try {
            // 优先使用 Web Audio 精确裁剪
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (Ctx) {
                if (!this._btnAudioCtx) this._btnAudioCtx = new Ctx();
                // 若处于suspended，尝试在用户手势内恢复
                if (this._btnAudioCtx.state === 'suspended') {
                    this._btnAudioCtx.resume().catch(()=>{});
                }
                const buffer = this._btnBuffer;
                if (buffer) {
                    const source = this._btnAudioCtx.createBufferSource();
                    source.buffer = buffer;
                    const gain = this._btnAudioCtx.createGain();
                    gain.gain.value = 0.8;
                    source.connect(gain).connect(this._btnAudioCtx.destination);
                    const offset = 0.08; // 80ms
                    const duration = 0.17; // 170ms -> 250ms结束
                    source.start(0, offset, duration);
                    return;
                }
            }
            // 回退：使用 <audio>，从0.08s播放并在0.17s后停止
            const a = new Audio('audio/anniu.mp3');
            a.volume = 0.8;
            a.currentTime = 0.08;
            a.play().then(() => {
                setTimeout(() => { try { a.pause(); a.currentTime = 0; } catch(_){} }, 170);
            }).catch(()=>{});
        } catch (_) { /* 忽略 */ }
    }

    // 根据素材加载状态启用/禁用“开始营业”按钮
    updateStartButtonEnabledState() {
        const startBtn = document.getElementById('startDay');
        if (!startBtn) return;
        const ready = !!(this.assetsReady && this.assetsReady.juanlianmen && this.assetsReady.yingye);
        startBtn.disabled = !ready;
        startBtn.style.filter = ready ? 'none' : 'grayscale(0.7)';
        startBtn.style.cursor = ready ? 'pointer' : 'not-allowed';
        if (!ready) {
            startBtn.title = '素材加载中，请稍候...';
        } else {
            startBtn.title = '';
        }
    }

    // 🎯 设置UI缩放以适应非全屏模式
    setupUIScaling() {
        if (!this.useLegacyUIScaling) return; // 交由 fitWrapper 处理
        try {
            // 计算当前窗口与设计分辨率的比例
            const designWidth = 1920;
            const designHeight = 1080;
            const currentWidth = window.innerWidth;
            const currentHeight = window.innerHeight;
            
            // 计算缩放比例（使用较小的比例以保持长宽比）
            const scaleX = currentWidth / designWidth;
            const scaleY = currentHeight / designHeight;
            const scale = Math.min(scaleX, scaleY);
            
            if (this.debug) console.log(`🔧 UI缩放计算: 设计分辨率=${designWidth}x${designHeight}, 当前窗口=${currentWidth}x${currentHeight}, 缩放比例=${scale.toFixed(3)}`);
            
            // 如果是非全屏模式（缩放比例小于0.9），应用UI缩放
            if (scale < 0.9) {
                this.applyUIScaling(scale);
            } else {
                if (this.debug) console.log('🔧 全屏模式，无需UI缩放');
            }
            
            // 监听窗口大小变化
            window.addEventListener('resize', () => {
                setTimeout(() => {
                    this.setupUIScaling();
                }, 100);
            });
            
            // 🎯 实时监听页面缩放变化
            this.startRealTimeScaleMonitoring();
            
        } catch (error) {
            console.error('UI缩放设置错误:', error);
        }
    }
    
    // 🎯 应用UI缩放
    applyUIScaling(scale) {
        if (!this.useLegacyUIScaling) return; // 交由 fitWrapper 处理
        try {
            if (this.debug) console.log(`🔧 应用UI缩放: ${scale.toFixed(3)}`);
            
            // 底部四个按钮的缩放
            const viewControls = document.getElementById('viewControls');
            if (viewControls) {
                viewControls.style.transform = `translateX(-50%) scale(${scale})`;
                viewControls.style.transformOrigin = 'center bottom';
                if (this.debug) console.log('✅ 底部按钮缩放已应用');
            }
            
            // 侧边栏的缩放
            const mainUI = document.getElementById('mainUI');
            if (mainUI) {
                mainUI.style.transform = `scale(${scale})`;
                mainUI.style.transformOrigin = 'top right';
                // 调整位置以适应缩放
                const rightOffset = 4 * (1 - scale);
                mainUI.style.right = `${4 + rightOffset}%`;
                if (this.debug) console.log('✅ 侧边栏缩放已应用');
            }
            
            // 其他UI元素的缩放
            const gameInfo = document.getElementById('gameInfo');
            if (gameInfo) {
                gameInfo.style.transform = `scale(${scale})`;
                gameInfo.style.transformOrigin = 'top left';
                if (this.debug) console.log('✅ 游戏信息面板缩放已应用');
            }
            
            const cookingPanel = document.getElementById('cookingPanel');
            if (cookingPanel) {
                cookingPanel.style.transform = `scale(${scale})`;
                cookingPanel.style.transformOrigin = 'bottom left';
                if (this.debug) console.log('✅ 制作进度面板缩放已应用');
            }
            
            const topGameControls = document.getElementById('topGameControls');
            if (topGameControls) {
                topGameControls.style.transform = `translateX(-50%) scale(${scale})`;
                topGameControls.style.transformOrigin = 'center bottom';
                if (this.debug) console.log('✅ 顶部控制按钮缩放已应用');
            }
            
        } catch (error) {
            console.error('应用UI缩放错误:', error);
        }
    }
    
    // 🎯 实时监听页面缩放变化
    startRealTimeScaleMonitoring() {
        if (!this.useLegacyUIScaling) return; // 交由 fitWrapper 处理
        // 保存上一次的窗口尺寸和设备像素比
        let lastWidth = window.innerWidth;
        let lastHeight = window.innerHeight;
        let lastDevicePixelRatio = window.devicePixelRatio;
        let lastVisualViewportScale = window.visualViewport ? window.visualViewport.scale : 1;
        
        // 使用requestAnimationFrame进行实时监控
        const monitorScale = () => {
            const currentWidth = window.innerWidth;
            const currentHeight = window.innerHeight;
            const currentDevicePixelRatio = window.devicePixelRatio;
            const currentVisualViewportScale = window.visualViewport ? window.visualViewport.scale : 1;
            
            // 检查是否有变化
            if (currentWidth !== lastWidth || 
                currentHeight !== lastHeight || 
                currentDevicePixelRatio !== lastDevicePixelRatio ||
                Math.abs(currentVisualViewportScale - lastVisualViewportScale) > 0.01) {
                
                if (this.debug) console.log(`🔧 检测到缩放变化: 
                    窗口: ${lastWidth}x${lastHeight} → ${currentWidth}x${currentHeight}
                    设备像素比: ${lastDevicePixelRatio} → ${currentDevicePixelRatio}
                    视口缩放: ${lastVisualViewportScale.toFixed(3)} → ${currentVisualViewportScale.toFixed(3)}`);
                
                // 更新UI缩放
                this.updateUIScaling();
                
                // 更新记录的值
                lastWidth = currentWidth;
                lastHeight = currentHeight;
                lastDevicePixelRatio = currentDevicePixelRatio;
                lastVisualViewportScale = currentVisualViewportScale;
            }
            
            // 继续监控
            requestAnimationFrame(monitorScale);
        };
        
        // 开始监控
        requestAnimationFrame(monitorScale);
        
        // 额外监听Visual Viewport API事件（如果支持）
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', () => {
                setTimeout(() => {
                    this.updateUIScaling();
                }, 10);
            });
            
            window.visualViewport.addEventListener('scroll', () => {
                setTimeout(() => {
                    this.updateUIScaling();
                }, 10);
            });
        }
        
        // 监听设备方向变化
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.updateUIScaling();
            }, 200);
        });
        
        console.log('✅ 实时缩放监控已启动');
    }
    
    // 🎯 更新UI缩放（优化版本，避免重复计算）
    updateUIScaling() {
        if (!this.useLegacyUIScaling) return; // 交由 fitWrapper 处理
        try {
            // 计算当前窗口与设计分辨率的比例
            const designWidth = 1920;
            const designHeight = 1080;
            const currentWidth = window.innerWidth;
            const currentHeight = window.innerHeight;
            
            // 计算缩放比例（使用较小的比例以保持长宽比）
            const scaleX = currentWidth / designWidth;
            const scaleY = currentHeight / designHeight;
            const scale = Math.min(scaleX, scaleY);
            
            // 考虑浏览器缩放
            const browserZoom = window.devicePixelRatio || 1;
            const visualViewportScale = window.visualViewport ? window.visualViewport.scale : 1;
            const finalScale = scale / (browserZoom * visualViewportScale);
            
            if (this.debug) console.log(`🔧 实时UI缩放更新: 
                基础缩放=${scale.toFixed(3)}, 
                浏览器缩放=${browserZoom.toFixed(3)}, 
                视口缩放=${visualViewportScale.toFixed(3)}, 
                最终缩放=${finalScale.toFixed(3)}`);
            
            // 应用缩放
            this.applyUIScaling(Math.max(0.3, Math.min(2.0, finalScale))); // 限制缩放范围
            
        } catch (error) {
            console.error('实时UI缩放更新错误:', error);
        }
    }

    // 🎯 绑定侧边栏按钮事件
    bindSidebarEvents() {
            if (this.debug) console.log('🔧 开始绑定侧边栏按钮事件');
        
        // 立即尝试绑定，并进行详细检查
        this.attemptBindSidebarEvents();
        
        // 延迟绑定作为备份
        setTimeout(() => {
            if (this.debug) console.log('🔄 500ms后重新尝试绑定事件');
            this.attemptBindSidebarEvents();
        }, 500);
        
        // 再次延迟绑定
        setTimeout(() => {
            if (this.debug) console.log('🔄 2秒后最终尝试绑定事件');
            this.attemptBindSidebarEvents();
        }, 2000);
    }
    
    // 🎯 尝试绑定侧边栏事件的实际逻辑
    attemptBindSidebarEvents() {
            if (this.debug) console.log('🔍 检查DOM元素状态...');
        
        // 检查所有相关DOM元素
        const servePlateBtn = document.getElementById('servePlate');
        const clearPlateBtn = document.getElementById('clearPlate');
        const completedFoodSlots = document.getElementById('completedFoodSlots');
        const plateItems = document.getElementById('plateItems');
        const orderList = document.getElementById('orderList');
        
            if (this.debug) console.log('🔍 DOM元素检查结果:', {
            servePlateBtn: !!servePlateBtn,
            clearPlateBtn: !!clearPlateBtn,
            completedFoodSlots: !!completedFoodSlots,
            plateItems: !!plateItems,
            orderList: !!orderList
        });
        
        // 绑定查看餐盘按钮
        if (servePlateBtn) {
            // 检查是否已经绑定过事件
            if (!servePlateBtn.dataset.eventBound) {
                servePlateBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🍽️ 查看餐盘按钮被点击 - onclick方式');
                    this.showPlateDetails();
                };
                servePlateBtn.dataset.eventBound = 'true';
                console.log('✅ 查看餐盘按钮事件已绑定 (onclick)');
            } else {
                console.log('⚠️ 查看餐盘按钮事件已经绑定过了');
            }
        } else {
            console.error('❌ servePlate按钮未找到，DOM可能还没有加载完成');
        }
        
        // 绑定清空餐盘按钮
        if (clearPlateBtn) {
            // 检查是否已经绑定过事件
            if (!clearPlateBtn.dataset.eventBound) {
                clearPlateBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🗑️ 清空餐盘按钮被点击 - onclick方式');
                    this.clearPlate();
                };
                clearPlateBtn.dataset.eventBound = 'true';
                console.log('✅ 清空餐盘按钮事件已绑定 (onclick)');
            } else {
                console.log('⚠️ 清空餐盘按钮事件已经绑定过了');
            }
        } else {
            console.error('❌ clearPlate按钮未找到，DOM可能还没有加载完成');
        }
        
        // 强制刷新侧边栏内容
        this.updateSidebar();
        
        console.log('🎯 尝试绑定侧边栏事件完成');
    }
    
    // 🎯 显示餐盘详情
    showPlateDetails() {
        const plateItems = this.gameState.currentPlate;
        if (plateItems.length === 0) {
            this.showNotification('餐盘是空的', 2000);
            return;
        }
        
        const itemsList = plateItems.map(item => {
            const name = this.getFoodName(item.type);
            const sides = item.sides ? ` (${item.sides.join('、')})` : '';
            return `${this.getFoodIcon(item)} ${name}${sides}`;
        }).join('\n');
        
        this.showNotification(`餐盘内容：\n${itemsList}`, 4000);
    }
    
    // 🎯 清空餐盘
    clearPlate() {
        if (this.gameState.currentPlate.length === 0) {
            this.showNotification('餐盘已经是空的', 2000);
            return;
        }
        
        // 将餐盘内容返回到完成食物列表
        this.gameState.currentPlate.forEach(food => {
            this.gameState.completedFood.push(food);
        });
        
        // 清空餐盘
        this.gameState.currentPlate = [];
        
        // 更新UI
        this.updateSidebar();
        
        this.showNotification('餐盘已清空，食物已放回成品区', 2000);
    }

    createSprites() {
        // 先预加载背景图片和youguo图片
        this.loadBackgroundImage();
        this.loadBackground1Image();
        this.loadFrontImage();
        this.loadDeskImage();
        this.loadYouguoImage();
        this.loadMiantuanImage();
        this.loadMianImages(); // 加载面团状态图片
        this.loadYoutiaoImages(); // 加载油条炸制状态图片
        this.loadBucketImage();
        this.loadQianImage(); // 加载钱币图片
        this.loadJuanLianMenImage(); // 加载卷帘门图片
        // 预加载开始营业按钮背景图以减少首帧闪烁
        this.preloadYingyeImage();
        this.loadGuke1Image(); // 加载顾客图片 guke1
        this.loadGuke2Image(); // 加载顾客图片 guke2
        this.loadGuke3Image(); // 加载顾客图片 guke3
        this.loadWooImage(); // 加载提示气泡 woo
        this.loadHuImage(); // 加载豆浆倒入提示 hu
        this.loadDoujiangzhuo2Image(); // 预加载豆浆桌第二图
        // 预加载配菜1版本覆盖图（像素完美）
        this.loadCongeeSideOverlays();

        this.sprites = {
            background: this.createBackground(),
            kitchen: this.createKitchen(),
            counter: this.createCounter(),
            table: this.createTable(),
            customer: this.createCustomer(),
            youtiaoWorkspace: this.createYoutiaoWorkspace(),
            doujiangWorkspace: this.createDoujiangWorkspace(),
            congeeWorkspace: this.createCongeeWorkspace()
        };

    }

    // 加载 hu.png（豆浆倒入提示）
    loadHuImage() {
        this.huImage = new Image();
        this.huImage.onload = () => {
            if (this.debug) console.log('✅ hu image loaded');
        };
        this.huImage.onerror = () => {
            console.warn('❌ Failed to load hu image: images/hu.png');
        };
        this.huImage.style.imageRendering = 'pixelated';
        this.huImage.src = 'images/hu.png?t=' + Date.now();
    }

    // 预加载“开始营业”按钮素材，采用Image对象以拿到onload
    preloadYingyeImage() {
        try {
            const img = new Image();
            img.onload = () => {
                this.assetsReady.yingye = true;
                this.updateStartButtonEnabledState();
            };
            img.onerror = () => {
                console.warn('yingye.png 预加载失败');
            };
            img.src = 'images/yingye.png?t=' + Date.now();
            this._preloadedYingye = img;
        } catch (e) {
            console.error('预加载yingye.png失败:', e);
        }
    }

    loadCongeeSideOverlays() {
        const keys = [
            { prop: 'xiancai1Image', src: 'images/xiancai1.png' },
            { prop: 'huangdou1Image', src: 'images/huangdou1.png' },
            { prop: 'doufu1Image', src: 'images/doufu1.png' },
            { prop: 'xiandan1Image', src: 'images/xiandan1.png' }
        ];
        keys.forEach(({ prop, src }) => {
            const img = new Image();
            img.onload = () => { try { this.refreshCongeeWorkspace(); } catch (e) {} };
            img.onerror = () => { console.warn('未找到配菜覆盖素材:', src); };
            img.style.imageRendering = 'pixelated';
            img.src = `${src}?t=${Date.now()}`;
            this[prop] = img;
        });
    }

    // 🎯 从已加载的顾客素材中随机选择一个
    pickCustomerSprite() {
        const pool = [];
        if (this.guke1Image && this.guke1Image.complete) pool.push({ key: 'guke1', img: this.guke1Image });
        if (this.guke2Image && this.guke2Image.complete) pool.push({ key: 'guke2', img: this.guke2Image });
        if (this.guke3Image && this.guke3Image.complete) pool.push({ key: 'guke3', img: this.guke3Image });
        if (pool.length === 0) {
            // 触发重试加载
            this.retryLoadAsset('guke1Image');
            this.retryLoadAsset('guke2Image');
            this.retryLoadAsset('guke3Image');
            return { key: 'placeholder', img: null };
        }
        const choice = pool[Math.floor(Math.random() * pool.length)];
        return { key: choice.key, img: choice.img };
    }

    // 通用图片加载（带指数退避重试与防抖）
    loadImageWithRetry(propertyName, src, onLoadCallback, options = {}) {
        const { maxAttempts = 5, baseDelayMs = 500 } = options;
        if (!this.assetRetryInfo) this.assetRetryInfo = {};
        if (!this.assetRetryInfo[propertyName]) this.assetRetryInfo[propertyName] = { attempts: 0, lastRetryAt: 0 };

        const attemptLoad = () => {
            const info = this.assetRetryInfo[propertyName];
            const attemptIndex = info.attempts + 1;
            // 创建新的 Image 实例，避免挂死在同一对象上
            this[propertyName] = new Image();
            const img = this[propertyName];
            img.decoding = 'sync';
            img.loading = 'eager';
            img.style.imageRendering = 'pixelated';
            img.onload = () => {
                info.attempts = 0; // 成功后清零
                try { onLoadCallback && onLoadCallback(); } catch (e) { /* 忽略渲染期异常 */ }
            };
            img.onerror = () => {
                info.attempts = attemptIndex;
                if (attemptIndex >= maxAttempts) {
                    console.error(`❌ ${propertyName} 加载失败，已达最大重试次数(${maxAttempts})：`, src);
                    return;
                }
                const delay = Math.round(baseDelayMs * Math.pow(2, attemptIndex - 1) + Math.random() * 200);
                console.warn(`⚠️ ${propertyName} 第${attemptIndex}次加载失败，${delay}ms 后重试…`);
                setTimeout(() => attemptLoad(), delay);
            };
            const cacheBuster = (src.includes('?') ? '&' : '?') + 't=' + Date.now() + '&try=' + attemptIndex;
            img.src = src + cacheBuster;
        };

        attemptLoad();
    }

    loadBackgroundImage() {
        this.loadImageWithRetry(
            'backgroundImage',
            'images/background.png',
            () => {
            console.log('Background image loaded successfully');
            console.log('Background dimensions:', this.backgroundImage.width, 'x', this.backgroundImage.height);
            this.sprites.background = this.createBackground();
            this.sprites.youtiaoWorkspace = this.createYoutiaoWorkspace();
            this.sprites.doujiangWorkspace = this.createDoujiangWorkspace();
            this.sprites.congeeWorkspace = this.createCongeeWorkspace();
            this.render();
            },
            { maxAttempts: 6, baseDelayMs: 400 }
        );
    }

    // 强制重新加载背景图片的函数
    forceReloadBackground() {
        console.log('强制重新加载背景图片...');
        this.loadBackgroundImage();
        this.loadBackground1Image();
        this.loadDeskImage();
        this.loadMianImages();
        this.loadYoutiaoImages();
        this.loadBucketImage();
        this.showNotification('所有背景图片已重新加载！', 3000);
    }
    
    // 单独重新加载background1的函数
    forceReloadBackground1() {
        console.log('强制重新加载background1图片...');
        this.loadBackground1Image();
        this.showNotification('Background1图片已重新加载！', 3000);
    }

    // 单独重新加载front的函数
    forceReloadFront() {
        console.log('强制重新加载front图片...');
        this.loadFrontImage();
        this.showNotification('Front图片已重新加载！', 3000);
    }

    loadBackground1Image() {
        this.loadImageWithRetry(
            'background1Image',
            'images/background1.png',
            () => {
            console.log('Background1 image loaded successfully');
            console.log('Background1 dimensions:', this.background1Image.width, 'x', this.background1Image.height);
            this.sprites.youtiaoWorkspace = this.createYoutiaoWorkspace();
            this.sprites.doujiangWorkspace = this.createDoujiangWorkspace();
            this.sprites.congeeWorkspace = this.createCongeeWorkspace();
            this.render();
            },
            { maxAttempts: 6, baseDelayMs: 400 }
        );
    }

    loadFrontImage() {
        this.loadImageWithRetry(
            'frontImage',
            'images/front.png',
            () => {
            console.log('Front image loaded successfully');
            console.log('Front dimensions:', this.frontImage.width, 'x', this.frontImage.height);
            this.sprites.youtiaoWorkspace = this.createYoutiaoWorkspace();
            this.sprites.doujiangWorkspace = this.createDoujiangWorkspace();
            this.sprites.congeeWorkspace = this.createCongeeWorkspace();
            this.render();
            },
            { maxAttempts: 6, baseDelayMs: 400 }
        );
    }

    loadDeskImage() {
        this.loadImageWithRetry(
            'deskImage',
            'images/desk.png',
            () => {
            console.log('Desk image loaded successfully');
            console.log('Desk dimensions:', this.deskImage.width, 'x', this.deskImage.height);
            this.sprites.background = this.createBackground();
            this.gameState.tables = this.initializeTables();
            this.render();
            },
            { maxAttempts: 6, baseDelayMs: 400 }
        );
    }

    loadYouguoImage() {
        this.youguoImage = new Image();
        this.youguoImage.onload = () => {
            console.log('Youguo image loaded successfully');
            console.log('Youguo dimensions:', this.youguoImage.width, 'x', this.youguoImage.height);
            // 重新创建油条工作区以包含图片
            this.sprites.youtiaoWorkspace = this.createYoutiaoWorkspace();
        };
        this.youguoImage.onerror = () => {
            console.error('Failed to load youguo image');
        };
        // 保持像素艺术效果
        this.youguoImage.style.imageRendering = 'pixelated';
        this.youguoImage.src = 'images/youguo.png?t=' + Date.now();
    }

    loadMiantuanImage() {
        this.miantuanImage = new Image();
        this.miantuanImage.onload = () => {
            console.log('Miantuan image loaded successfully');
            // 重新创建youtiao工作空间
            this.sprites.youtiaoWorkspace = this.createYoutiaoWorkspace();
        };
        this.miantuanImage.onerror = () => {
            console.error('Failed to load miantuan image');
        };
        // 保持像素艺术效果
        this.miantuanImage.style.imageRendering = 'pixelated';
        this.miantuanImage.src = 'images/miantuan.png?t=' + Date.now();
    }

    // 加载面团状态图片
    loadMianImages() {
        // 加载mian1.png (揉面状态)
        this.mian1Image = new Image();
        this.mian1Image.onload = () => {
            console.log('Mian1 image loaded successfully');
            this.refreshYoutiaoWorkspace(); // 重新创建油条工作空间
        };
        this.mian1Image.onerror = () => {
            console.error('Failed to load mian1 image');
        };
        this.mian1Image.style.imageRendering = 'pixelated';
        this.mian1Image.src = 'images/mian1.png?t=' + Date.now();

        // 加载mian2.png (拉伸状态)
        this.mian2Image = new Image();
        this.mian2Image.onload = () => {
            console.log('Mian2 image loaded successfully');
            this.refreshYoutiaoWorkspace(); // 重新创建油条工作空间
        };
        this.mian2Image.onerror = () => {
            console.error('Failed to load mian2 image');
        };
        this.mian2Image.style.imageRendering = 'pixelated';
        this.mian2Image.src = 'images/mian2.png?t=' + Date.now();

        // 加载mian3.png (炸制准备状态)
        this.mian3Image = new Image();
        this.mian3Image.onload = () => {
            console.log('Mian3 image loaded successfully');
            this.refreshYoutiaoWorkspace(); // 重新创建油条工作空间
        };
        this.mian3Image.onerror = () => {
            console.error('Failed to load mian3 image');
        };
        this.mian3Image.style.imageRendering = 'pixelated';
        this.mian3Image.src = 'images/mian3.png?t=' + Date.now();

        // 🎯 加载miantuantiao.png (面团条拖拽状态)
        this.miantuantiaoImage = new Image();
        this.miantuantiaoImage.onload = () => {
            console.log('Miantuantiao image loaded successfully');
            console.log('Miantuantiao dimensions:', this.miantuantiaoImage.width, 'x', this.miantuantiaoImage.height);
        };
        this.miantuantiaoImage.onerror = () => {
            console.error('Failed to load miantuantiao image');
        };
        this.miantuantiaoImage.style.imageRendering = 'pixelated';
        this.miantuantiaoImage.src = 'images/miantuantiao.png?t=' + Date.now();

        // 🎯 加载豆浆制作区图片
        // 加载doujiangzhuo.png (豆浆桌)
        this.doujiangzhuoImage = new Image();
        this.doujiangzhuoImage.onload = () => {
            console.log('✅ Doujiangzhuo image loaded successfully');
            console.log('Doujiangzhuo尺寸:', this.doujiangzhuoImage.width, 'x', this.doujiangzhuoImage.height);
        };
        this.doujiangzhuoImage.onerror = () => {
            console.error('❌ Failed to load doujiangzhuo image');
        };
        this.doujiangzhuoImage.style.imageRendering = 'pixelated';
        this.doujiangzhuoImage.src = 'images/doujiangzhuo.png?t=' + Date.now();

        // 🎯 加载豆浆碗分级素材：doujiang1-4（1空碗，4满碗）
        this.doujiangBowlImages = {};
        for (let i = 1; i <= 4; i++) {
            const key = `doujiang${i}Image`;
            this.doujiangBowlImages[key] = new Image();
            this.doujiangBowlImages[key].onload = () => {
                console.log(`✅ doujiang${i}.png loaded`);
            };
            this.doujiangBowlImages[key].onerror = () => {
                console.error(`❌ Failed to load doujiang${i}.png`);
            };
            this.doujiangBowlImages[key].style.imageRendering = 'pixelated';
            this.doujiangBowlImages[key].src = `images/doujiang${i}.png?t=` + Date.now();
        }

        // 加载wandui.png (碗堆)
        this.wanduiImage = new Image();
        this.wanduiImage.onload = () => {
            console.log('Wandui image loaded successfully');
        };
        this.wanduiImage.onerror = () => {
            console.error('Failed to load wandui image');
        };
        this.wanduiImage.style.imageRendering = 'pixelated';
        this.wanduiImage.src = 'images/wandui.png?t=' + Date.now();

        // 🎯 加载粥菜制作区图片
        // 加载zhoucaizhuo.png (粥菜桌)
        this.zhoucaizhuoImage = new Image();
        this.zhoucaizhuoImage.onload = () => {
            console.log('✅ Zhoucaizhuo image loaded successfully');
            console.log('Zhoucaizhuo尺寸:', this.zhoucaizhuoImage.width, 'x', this.zhoucaizhuoImage.height);
        };
        this.zhoucaizhuoImage.onerror = () => {
            console.error('❌ Failed to load zhoucaizhuo image');
        };
        this.zhoucaizhuoImage.style.imageRendering = 'pixelated';
        this.zhoucaizhuoImage.src = 'images/zhoucaizhuo.png?t=' + Date.now();

        // 加载zhou.png (粥)
        this.zhouImage = new Image();
        this.zhouImage.onload = () => {
            console.log('✅ Zhou image loaded successfully');
        };
        this.zhouImage.onerror = () => {
            console.error('❌ Failed to load zhou image');
        };
        this.zhouImage.style.imageRendering = 'pixelated';
        this.zhouImage.src = 'images/zhou.png?t=' + Date.now();

        // 加载kongzhou.png (空粥)
        this.kongzhouImage = new Image();
        this.kongzhouImage.onload = () => {
            console.log('✅ Kongzhou image loaded successfully');
        };
        this.kongzhouImage.onerror = () => {
            console.error('❌ Failed to load kongzhou image');
        };
        this.kongzhouImage.style.imageRendering = 'pixelated';
        this.kongzhouImage.src = 'images/kongzhou.png?t=' + Date.now();

        // 加载dianfanbao.png (点饭包)
        this.dianfanbaoImage = new Image();
        this.dianfanbaoImage.onload = () => {
            console.log('✅ Dianfanbao image loaded successfully');
        };
        this.dianfanbaoImage.onerror = () => {
            console.error('❌ Failed to load dianfanbao image');
        };
        this.dianfanbaoImage.style.imageRendering = 'pixelated';
        this.dianfanbaoImage.src = 'images/dianfanbao.png?t=' + Date.now();

        // 加载xiancai.png (咸菜)
        this.xiancaiImage = new Image();
        this.xiancaiImage.onload = () => {
            console.log('✅ Xiancai image loaded successfully');
        };
        this.xiancaiImage.onerror = () => {
            console.error('❌ Failed to load xiancai image');
        };
        this.xiancaiImage.style.imageRendering = 'pixelated';
        this.xiancaiImage.src = 'images/xiancai.png?t=' + Date.now();

        // 加载xiandan.png (咸蛋)
        this.xiandanImage = new Image();
        this.xiandanImage.onload = () => {
            console.log('✅ Xiandan image loaded successfully');
        };
        this.xiandanImage.onerror = () => {
            console.error('❌ Failed to load xiandan image');
        };
        this.xiandanImage.style.imageRendering = 'pixelated';
        this.xiandanImage.src = 'images/xiandan.png?t=' + Date.now();

        // 加载huangdou.png (黄豆)
        this.huangdouImage = new Image();
        this.huangdouImage.onload = () => {
            console.log('✅ Huangdou image loaded successfully');
        };
        this.huangdouImage.onerror = () => {
            console.error('❌ Failed to load huangdou image');
        };
        this.huangdouImage.style.imageRendering = 'pixelated';
        this.huangdouImage.src = 'images/huangdou.png?t=' + Date.now();

        // 加载doufu.png (豆腐)
        this.doufuImage = new Image();
        this.doufuImage.onload = () => {
            console.log('✅ Doufu image loaded successfully');
        };
        this.doufuImage.onerror = () => {
            console.error('❌ Failed to load doufu image');
        };
        this.doufuImage.style.imageRendering = 'pixelated';
        this.doufuImage.src = 'images/doufu.png?t=' + Date.now();

        // 🎯 加载标题图片
        this.biaoTiImage = new Image();
        this.biaoTiImage.onload = () => {
            console.log('✅ BiaoTi image loaded successfully');
            console.log('BiaoTi尺寸:', this.biaoTiImage.width, 'x', this.biaoTiImage.height);
        };
        this.biaoTiImage.onerror = () => {
            console.error('❌ Failed to load biaoti image');
        };
        this.biaoTiImage.style.imageRendering = 'pixelated';
        this.biaoTiImage.src = 'images/biaoti.png?t=' + Date.now();
    }

    // 🎯 预加载豆浆桌的第二张图片（点击碗时切换）
    loadDoujiangzhuo2Image() {
        this.doujiangzhuo2Image = new Image();
        this.doujiangzhuo2Image.onload = () => {
            console.log('✅ Doujiangzhuo2 image loaded successfully');
        };
        this.doujiangzhuo2Image.onerror = () => {
            console.error('❌ Failed to load doujiangzhuo2 image');
        };
        this.doujiangzhuo2Image.style.imageRendering = 'pixelated';
        this.doujiangzhuo2Image.src = 'images/doujiangzhuo2.png?t=' + Date.now();
    }

    // 加载油条炸制状态图片
    loadYoutiaoImages() {
        // 加载youtiao1.1-1.6图片
        for (let i = 1; i <= 6; i++) {
            const imageProperty = `youtiao1_${i}Image`;
            this[imageProperty] = new Image();
            this[imageProperty].onload = () => {
                console.log(`Youtiao1.${i} image loaded successfully`);
            };
            this[imageProperty].onerror = () => {
                console.error(`Failed to load youtiao1.${i} image`);
            };
            this[imageProperty].style.imageRendering = 'pixelated';
            this[imageProperty].src = `images/youtiao1.${i}.png?t=` + Date.now();
        }
        
        // 🎯 加载shuyoutiao1.2.3图片（熟油条状态素材）
        for (let i = 1; i <= 3; i++) {
            const imageProperty = `shuyoutiao${i}Image`;
            this[imageProperty] = new Image();
            this[imageProperty].onload = () => {
                console.log(`✅ Shuyoutiao${i} image loaded successfully`);
                console.log(`🔍 Shuyoutiao${i} 尺寸:`, this[imageProperty].width, 'x', this[imageProperty].height);
                console.log(`🔍 Shuyoutiao${i} src:`, this[imageProperty].src);
            };
            this[imageProperty].onerror = (e) => {
                console.error(`❌ Failed to load shuyoutiao${i} image:`, e);
                console.error(`🔍 尝试加载的路径:`, this[imageProperty].src);
            };
            this[imageProperty].style.imageRendering = 'pixelated';
            this[imageProperty].src = `images/shuyoutiao${i}.png?t=` + Date.now();
        }
    }

    // 🎯 重新加载shuyoutiao素材的开发者功能
    reloadShuyoutiaoImages() {
        for (let i = 1; i <= 3; i++) {
            const imageProperty = `shuyoutiao${i}Image`;
            if (this[imageProperty]) {
                this[imageProperty].src = `images/shuyoutiao${i}.png?reload=` + Date.now();
                console.log(`🔄 重新加载 shuyoutiao${i} 素材`);
            }
        }
        this.showNotification('🔄 shuyoutiao素材已重新加载！');
    }

    // 🎯 检查所有shuyoutiao图片的加载状态
    checkShuyoutiaoImagesStatus() {
        console.log('🔍 检查所有shuyoutiao图片加载状态:');
        for (let i = 1; i <= 3; i++) {
            const imageProperty = `shuyoutiao${i}Image`;
            const image = this[imageProperty];
            
            console.log(`🔍 shuyoutiao${i}:`, {
                exists: !!image,
                complete: image ? image.complete : false,
                naturalWidth: image ? image.naturalWidth : 0,
                naturalHeight: image ? image.naturalHeight : 0,
                src: image ? image.src : 'N/A',
                readyState: image ? (image.complete ? 'loaded' : 'loading') : 'not_created'
            });
        }
    }

    // 🎯 一键重新加载面团相关素材（mian1/mian2/mian3/miantuantiao/miantuan）
    reloadDoughImages() {
        try {
            // 重新加载面团状态图与面团条
            this.loadMianImages();
            // 重新加载面团底图（如有）
            this.loadMiantuanImage();
            this.showNotification('🔄 面团素材已重新加载');
        } catch (e) {
            console.error('重新加载面团素材失败:', e);
            this.showNotification('❌ 面团素材重载失败');
        }
    }

    loadBucketImage() {
        this.bucketImage = new Image();
        this.bucketImage.onload = () => {
            console.log('Bucket image loaded successfully');
            console.log('Bucket dimensions:', this.bucketImage.width, 'x', this.bucketImage.height);
            // 重新创建油条工作空间
            this.sprites.youtiaoWorkspace = this.createYoutiaoWorkspace();
            this.render();
        };
        this.bucketImage.onerror = () => {
            console.error('Failed to load bucket image:', 'images/bucket.png');
        };
        // 保持像素艺术效果
        this.bucketImage.style.imageRendering = 'pixelated';
        this.bucketImage.src = 'images/bucket.png?t=' + Date.now();
    }

    loadQianImage() {
        this.qianImage = new Image();
        this.qianImage.onload = () => {
            console.log('Qian image loaded successfully');
            console.log('Qian dimensions:', this.qianImage.width, 'x', this.qianImage.height);
            this.render();
        };
        this.qianImage.onerror = () => {
            console.error('Failed to load qian image:', 'images/qian.png');
        };
        // 保持像素艺术效果
        this.qianImage.style.imageRendering = 'pixelated';
        this.qianImage.src = 'images/qian.png?t=' + Date.now();
    }

    loadJuanLianMenImage() {
        this.juanLianMenImage = new Image();
        this.juanLianMenImage.onload = () => {
            console.log('JuanLianMen image loaded successfully');
            console.log('JuanLianMen dimensions:', this.juanLianMenImage.width, 'x', this.juanLianMenImage.height);
            this.assetsReady.juanlianmen = true;
            this.updateStartButtonEnabledState();
            this.render();
        };
        this.juanLianMenImage.onerror = () => {
            console.error('Failed to load juanlianmen image:', 'images/juanlianmen.png');
        };
        // 保持像素艺术效果
        this.juanLianMenImage.style.imageRendering = 'pixelated';
        this.juanLianMenImage.src = 'images/juanlianmen.png?t=' + Date.now();
    }

    // 🎯 加载woo提示图片
    loadWooImage() {
        this.wooImage = new Image();
        this.wooImage.onload = () => {
            console.log('✅ Woo image loaded successfully');
            this.render();
        };
        this.wooImage.onerror = () => {
            console.error('❌ Failed to load woo image:', 'images/woo.png');
        };
        this.wooImage.style.imageRendering = 'pixelated';
        this.wooImage.src = 'images/woo.png?t=' + Date.now();
    }

    // 🎯 加载guke1图片（顾客素材）
    loadGuke1Image() {
        this.guke1Image = new Image();
        this.guke1Image.onload = () => {
            console.log('✅ Guke1 image loaded successfully');
            console.log('Guke1 dimensions:', this.guke1Image.width, 'x', this.guke1Image.height);
            // 重新创建顾客素材
            this.sprites.customer = this.createCustomer();
            // 强制重新渲染
            this.render();
        };
        this.guke1Image.onerror = () => {
            console.error('❌ Failed to load guke1 image:', 'images/guke1.png');
        };
        this.guke1Image.style.imageRendering = 'pixelated';
        this.guke1Image.src = 'images/guke1.png?t=' + Date.now();
    }

    // 🎯 加载guke2图片（顾客素材）
    loadGuke2Image() {
        this.guke2Image = new Image();
        this.guke2Image.onload = () => {
            console.log('✅ Guke2 image loaded successfully');
            console.log('Guke2 dimensions:', this.guke2Image.width, 'x', this.guke2Image.height);
            // 顾客素材可用后刷新
            this.render();
        };
        this.guke2Image.onerror = () => {
            console.error('❌ Failed to load guke2 image:', 'images/guke2.png');
        };
        this.guke2Image.style.imageRendering = 'pixelated';
        this.guke2Image.src = 'images/guke2.png?t=' + Date.now();
    }

    // 🎯 加载guke3图片（顾客素材）
    loadGuke3Image() {
        this.guke3Image = new Image();
        this.guke3Image.onload = () => {
            console.log('✅ Guke3 image loaded successfully');
            console.log('Guke3 dimensions:', this.guke3Image.width, 'x', this.guke3Image.height);
            // 顾客素材可用后刷新
            this.render();
        };
        this.guke3Image.onerror = () => {
            console.error('❌ Failed to load guke3 image:', 'images/guke3.png');
        };
        this.guke3Image.style.imageRendering = 'pixelated';
        this.guke3Image.src = 'images/guke3.png?t=' + Date.now();
    }

    // 通用函数：绘制背景图片并计算缩放比例（仅在游戏区域内）
    drawBackgroundImage(ctx, canvas, useBackground1 = false) {
        // UI面板宽度
        const uiPanelWidth = 280;
        const gameAreaWidth = canvas.width - uiPanelWidth;
        
        // 分层绘制背景：底层背景 + front覆盖层
        const hasFront = this.frontImage && this.frontImage.complete;
        
        // 首先绘制底层背景
        let baseBackgroundImg;
        if (useBackground1) {
            // 制作区域使用background1作为底层
            baseBackgroundImg = this.background1Image;
        } else {
            // 主界面使用主背景作为底层
            baseBackgroundImg = this.backgroundImage;
        }
        
        // 绘制底层背景
        if (baseBackgroundImg && baseBackgroundImg.complete) {
            // 保持像素艺术效果
            ctx.imageSmoothingEnabled = false;
            ctx.webkitImageSmoothingEnabled = false;
            ctx.mozImageSmoothingEnabled = false;
            ctx.msImageSmoothingEnabled = false;
            
            let bg1Width, bg1Height, bg1X, bg1Y;
            
                    if (hasFront) {
            // 如果有front，background1需要适配空白区域并往左下放大
                // 往左上放大background1
                const targetWidth = gameAreaWidth * 0.98;
                const targetHeight = canvas.height * 1.05;
                
                // 计算保持长宽比的缩放
                const scaleX = targetWidth / baseBackgroundImg.width;
                const scaleY = targetHeight / baseBackgroundImg.height;
                const scale = Math.min(scaleX, scaleY); // 使用较小的缩放保持长宽比
                
                bg1Width = baseBackgroundImg.width * scale;
                bg1Height = baseBackgroundImg.height * scale;
                
                // 右上角放大定位，往下微调
                bg1X = gameAreaWidth - bg1Width - (gameAreaWidth * 0.01) + 10; // 右对齐，留1%右边距，往右10px
                bg1Y = canvas.height * 0.05 - 10; // 上对齐，留5%上边距（往下微调），往上10px
                
                // 存储background1的缩放比例和偏移（供素材使用）
                this.backgroundScaleX = scale;
                this.backgroundScaleY = scale;
                this.background1OffsetX = bg1X;
                this.background1OffsetY = bg1Y;
                this.background1Width = bg1Width;
                this.background1Height = bg1Height;
                    } else {
            // 没有front时，background1填满整个区域
                const baseScaleX = gameAreaWidth / baseBackgroundImg.width;
                const baseScaleY = canvas.height / baseBackgroundImg.height;
                
                bg1Width = gameAreaWidth;
                bg1Height = canvas.height;
                bg1X = 0;
                bg1Y = 0;
                
                // 存储缩放比例供其他元素使用（基于底层背景）
                this.backgroundScaleX = baseScaleX;
                this.backgroundScaleY = baseScaleY;
                this.background1OffsetX = 0;
                this.background1OffsetY = 0;
                this.background1Width = bg1Width;
                this.background1Height = bg1Height;
            }
            
            // 绘制底层背景
            ctx.drawImage(baseBackgroundImg, bg1X, bg1Y, bg1Width, bg1Height);
        } else {
            // 设置默认缩放比例
            this.backgroundScaleX = gameAreaWidth / 1920;
            this.backgroundScaleY = canvas.height / 1080;
            this.background1OffsetX = 0;
            this.background1OffsetY = 0;
            this.background1Width = gameAreaWidth;
            this.background1Height = canvas.height;
        }
        
        // 绘制front覆盖层（如果存在）
        if (hasFront) {
            // 保持像素艺术效果
            ctx.imageSmoothingEnabled = false;
            ctx.webkitImageSmoothingEnabled = false;
            ctx.mozImageSmoothingEnabled = false;
            ctx.msImageSmoothingEnabled = false;
            
            // front布满整个页面
            const frontWidth = canvas.width;  // 布满整个页面宽度（包括UI面板）
            const frontHeight = canvas.height; // 布满整个页面高度
            
            // 绘制front覆盖层，布满整个页面
            ctx.drawImage(this.frontImage, 0, 0, frontWidth, frontHeight);
        } else {
            // 如果图片未加载，使用备用背景色
            ctx.fillStyle = '#f0f0f0';
            ctx.fillRect(0, 0, gameAreaWidth, canvas.height);
            
            // 设置默认缩放比例
            this.backgroundScaleX = gameAreaWidth / 1920; // 假设原始背景是1920宽
            this.backgroundScaleY = canvas.height / 1080; // 假设原始背景是1080高
        }
    }

    // 绘制桌子图片（在大厅中作为背景）
    drawDeskImage(ctx, canvas) {
        const hasFront = this.frontImage && this.frontImage.complete;
        
        // UI面板宽度
        const uiPanelWidth = 280;
        const gameAreaWidth = canvas.width - uiPanelWidth;
        
        // 首先绘制底层desk图片
        if (this.deskImage && this.deskImage.complete) {
            // 保持像素艺术效果
            ctx.imageSmoothingEnabled = false;
            ctx.webkitImageSmoothingEnabled = false;
            ctx.mozImageSmoothingEnabled = false;
            ctx.msImageSmoothingEnabled = false;
            
            let deskWidth, deskHeight, deskX, deskY;
            
                    if (hasFront) {
            // 如果有front，desk绑定background1相同的设置
                // 与background1完全相同的尺寸设置（98%x105%左上放大）
                const targetWidth = gameAreaWidth * 0.98;
                const targetHeight = canvas.height * 1.05;
                
                // 计算保持长宽比的缩放
                const scaleX = targetWidth / this.deskImage.width;
                const scaleY = targetHeight / this.deskImage.height;
                const scale = Math.min(scaleX, scaleY); // 使用较小的缩放保持长宽比
                
                deskWidth = this.deskImage.width * scale;
                deskHeight = this.deskImage.height * scale;
                
                // 与background1完全绑定的右上角定位，往下微调
                deskX = gameAreaWidth - deskWidth - (gameAreaWidth * 0.01) + 10; // 右对齐，留1%右边距，往右10px
                deskY = canvas.height * 0.05 - 10; // 上对齐，留5%上边距（往下微调），往上10px
                
                // 存储desk的缩放比例和偏移（供素材使用）
                this.backgroundScaleX = scale;
                this.backgroundScaleY = scale;
                this.background1OffsetX = deskX;
                this.background1OffsetY = deskY;
                this.background1Width = deskWidth;
                this.background1Height = deskHeight;
                    } else {
            // 没有front时，desk填满整个区域
                const deskScaleX = gameAreaWidth / this.deskImage.width;
                const deskScaleY = canvas.height / this.deskImage.height;
                
                deskWidth = gameAreaWidth;
                deskHeight = canvas.height;
                deskX = 0;
                deskY = 0;
                
                // 存储缩放比例供其他元素使用（基于desk图片）
                this.backgroundScaleX = deskScaleX;
                this.backgroundScaleY = deskScaleY;
                this.background1OffsetX = 0;
                this.background1OffsetY = 0;
                this.background1Width = deskWidth;
                this.background1Height = deskHeight;
            }
            
            // 绘制底层desk图片
            ctx.drawImage(this.deskImage, deskX, deskY, deskWidth, deskHeight);

        // 更新“开始营业”按钮至屏幕正中心
        try {
            this.positionStartDayButtonAtScreenCenter();
        } catch (e) {
            // 忽略布局异常，避免打断渲染
        }
        } else {
            // desk图片未加载时的备用背景色
            ctx.fillStyle = '#87CEEB';
            ctx.fillRect(0, 0, gameAreaWidth, canvas.height);
            
            // 设置默认缩放比例
            this.backgroundScaleX = gameAreaWidth / 1920;
            this.backgroundScaleY = canvas.height / 1080;
            this.background1OffsetX = 0;
            this.background1OffsetY = 0;
            this.background1Width = gameAreaWidth;
            this.background1Height = canvas.height;
        }
        
        // 绘制front覆盖层（如果存在）
        if (hasFront) {
            // 保持像素艺术效果
            ctx.imageSmoothingEnabled = false;
            ctx.webkitImageSmoothingEnabled = false;
            ctx.mozImageSmoothingEnabled = false;
            ctx.msImageSmoothingEnabled = false;
            
            // front布满整个页面，覆盖在desk图片上方
            ctx.drawImage(this.frontImage, 0, 0, canvas.width, canvas.height);
        }
    }

    // 将“开始营业”按钮（#startDay）放到屏幕正中心，使用 yingye 图作为素材
    positionStartDayButtonAtScreenCenter() {
        const container = document.getElementById('topGameControls');
        const startBtn = document.getElementById('startDay');
        if (!container || !startBtn) return;

        // 基于画布基准(1920x1080)进行尺寸定义，外层由 fitWrapper 统一缩放
        const desiredWidth = 400;  // 基准 400x160，与素材比例一致
        const desiredHeight = 160;

        // 定位容器到desk中心
        container.style.position = 'absolute';
        container.style.left = '50%';
        container.style.top = '50%';
        container.style.bottom = 'auto';
        container.style.transform = 'translate(-50%, -50%)';
        container.style.zIndex = '700';
        container.style.gap = '0';

        // 样式化按钮为图片素材
        startBtn.style.background = "url('images/yingye.png') no-repeat center center";
        startBtn.style.backgroundSize = 'contain';
        startBtn.style.color = 'transparent';
        startBtn.style.borderRadius = '0';
        startBtn.style.boxShadow = 'none';
        startBtn.style.border = 'none';
        startBtn.style.padding = '0';
        startBtn.style.minWidth = desiredWidth + 'px';
        startBtn.style.minHeight = desiredHeight + 'px';
        startBtn.style.width = desiredWidth + 'px';
        startBtn.style.height = desiredHeight + 'px';

        // 初始禁用，待素材就绪后启用
        startBtn.disabled = true;
        startBtn.style.filter = 'grayscale(0.7)';
        startBtn.style.cursor = 'not-allowed';
        // 由于此处以CSS背景图形式设置，无法直接监听onload，这里先标记布局已就位
        this.assetsReady.yingye = true;
        this.updateStartButtonEnabledState();
    }

    // 初始化桌子数据（基于desk图片中的桌子位置）
    initializeTables() {
        // 基于desk图片中的实际桌子位置（假设原图是1920x1080）
        const basePositions = [
            { x: 400, y: 600, width: 150, height: 100 },   // 左桌
            { x: 850, y: 600, width: 150, height: 100 },   // 中桌  
            { x: 1300, y: 600, width: 150, height: 100 }   // 右桌
        ];

        // 应用缩放比例
        return basePositions.map((pos, index) => ({
            id: index,
            x: pos.x * this.backgroundScaleX,
            y: pos.y * this.backgroundScaleY,
            width: pos.width * this.backgroundScaleX,
            height: pos.height * this.backgroundScaleY,
            occupied: false,
            needsCleaning: false,
            customer: null
        }));
    }

    // 计算miantuan面团台的实际位置和尺寸
    getMiantuanPosition() {
        if (this.miantuanImage && this.miantuanImage.complete && this.backgroundScaleX && this.backgroundScaleY) {
            const originalWidth = this.miantuanImage.width;
            const originalHeight = this.miantuanImage.height;
            
            // 素材缩小系数，让素材稍微小一点，更密集排布
            const assetScale = 0.85;
            
            // 使用与背景相同的缩放比例，再乘以素材缩小系数
            const scaledWidth = originalWidth * this.backgroundScaleX * assetScale;
            const scaledHeight = originalHeight * this.backgroundScaleY * assetScale;
            
            // UI面板宽度
            const uiPanelWidth = 280;
            const gameAreaWidth = 1920 - uiPanelWidth; // background1的实际宽度区域
            
            // 计算位置（相对于background1的偏移位置）
            const bg1OffsetX = this.background1OffsetX || 0;
            const bg1OffsetY = this.background1OffsetY || 0;
            const bg1Height = this.background1Height || 1080;
            
            const drawX = bg1OffsetX + 15; // 左边对齐background1左边，往右15px
            const drawY = bg1OffsetY + bg1Height - scaledHeight - 3; // 底部对齐background1底部，往上3px
            
            return {
                x: drawX,
                y: drawY,
                width: scaledWidth,
                height: scaledHeight
            };
        }
        
        // 如果图片未加载，返回默认位置
        return {
            x: 0,
            y: 880,
            width: 500,
            height: 200
        };
    }

    // 🎯 计算豆浆桌的实际位置和尺寸（background1中间下沿）
    getDoujiangzhuoPosition() {
        if (this.doujiangzhuoImage && this.doujiangzhuoImage.complete && this.backgroundScaleX && this.backgroundScaleY) {
            // 素材缩小系数，与其他素材保持一致
            const assetScale = 0.85;
            
            // 计算豆浆桌的位置和尺寸
            const tableWidth = this.doujiangzhuoImage.width * this.backgroundScaleX * assetScale;
            const tableHeight = this.doujiangzhuoImage.height * this.backgroundScaleY * assetScale;
            
            // 🎯 水平位置：background1的中间（水平居中）
            const bg1OffsetX = this.background1OffsetX || 0;
            const bg1Width = this.background1Width || 1920;
            const tableX = bg1OffsetX + (bg1Width - tableWidth) / 2; // 在background1范围内水平居中
            
            // 🎯 垂直位置：background1的下沿（底部对齐）
            const bg1OffsetY = this.background1OffsetY || 0;
            const bg1Height = this.background1Height || 1080;
            const tableY = bg1OffsetY + bg1Height - tableHeight - 5; // 往上5px
            
            return {
                x: tableX,
                y: tableY,
                width: tableWidth,
                height: tableHeight
            };
        }
        
        // 备用位置（background1中间下沿）
        return {
            x: (1920 - 800) / 2,
            y: 1080 - 300,
            width: 800,
            height: 300
        };
    }

    // 🎯 获取粥菜桌位置（使用统一缩放比例保持原始长宽比，增加高度）
    getZhoucaizhuoPosition() {
        if (this.zhoucaizhuoImage && this.zhoucaizhuoImage.complete && this.backgroundScaleX && this.backgroundScaleY) {
            const assetScale = 0.95; // 🎯 从0.85增加到0.95，让桌子整体更大一些
            
            // 🎯 使用统一的缩放比例，取X和Y缩放的较小值以确保图片不会超出边界
            const uniformScale = Math.min(this.backgroundScaleX, this.backgroundScaleY);
            const heightMultiplier = 1.2; // 🎯 高度增加到1.2倍
            const tableWidth = this.zhoucaizhuoImage.width * uniformScale * assetScale;
            const tableHeight = this.zhoucaizhuoImage.height * uniformScale * assetScale * heightMultiplier;

            // 🎯 参考油条制作区的排列方式，左侧靠近但留出一定边距
            const bg1OffsetX = this.background1OffsetX || 0;
            const bg1Width = this.background1Width || 1920;
            const leftMargin = bg1Width * 0.15; // 左边距15%
            const tableX = bg1OffsetX + leftMargin;

            const bg1OffsetY = this.background1OffsetY || 0;
            const bg1Height = this.background1Height || 1080;
            const tableY = bg1OffsetY + bg1Height - tableHeight - 5; // 🎯 桌子下沿完全对齐background1的下沿，往上5px

            return { 
                x: tableX, 
                y: tableY, 
                width: tableWidth, 
                height: tableHeight,
                uniformScale: uniformScale,
                assetScale: assetScale, // 保存资产缩放比例供其他素材使用
                heightMultiplier: heightMultiplier // 保存高度倍数供其他素材使用
            };
        }
        return { x: 300, y: 1080 - 300, width: 800, height: 300, uniformScale: 1, assetScale: 0.95, heightMultiplier: 1.2 }; // 备用位置
    }

    // 🎯 获取配菜位置（重新布局：四个配菜在右侧，dianfanbao在左上，zhou在dianfanbao右下）
    getSideItemPositions() {
        const tablePos = this.getZhoucaizhuoPosition();
        const uniformScale = tablePos.uniformScale || Math.min(this.backgroundScaleX, this.backgroundScaleY);
        const tableAssetScale = tablePos.assetScale || 0.95;
        const heightMultiplier = tablePos.heightMultiplier || 1.2; // 🎯 高度倍数
        const spacing = 15;

        // 🎯 分组配菜：四个配菜在桌子右侧，dianfanbao和zhou特殊位置
        const rightSideItems = [
            { name: '咸菜', image: 'xiancaiImage' },
            { name: '咸蛋', image: 'xiandanImage' },
            { name: '黄豆', image: 'huangdouImage' },
            { name: '豆腐', image: 'doufuImage' }
        ];

        // 🎯 根据当前粥制作状态选择不同的图片
        const currentStep = this.gameState.congeeState.currentStep;
        const zhouImageName = (currentStep === 'idle' || currentStep === 'dianfanbao_clicked') ? 'kongzhouImage' : 'zhouImage';

        const specialItems = [
            { name: '点饭包', image: 'dianfanbaoImage' },
            { name: '粥', image: zhouImageName }
        ];

        // 🎯 计算所有物品的尺寸
        const calculateItemDimensions = (items) => {
            return items.map((item) => {
                const image = this[item.image];
                let itemWidth, itemHeight;
                
                if (image && image.complete) {
                    // 🎯 宽度不变，高度增加到1.2倍
                    itemWidth = image.width * uniformScale * tableAssetScale;
                    itemHeight = image.height * uniformScale * tableAssetScale * heightMultiplier;
                } else {
                    // 备用尺寸
                    itemWidth = 100 * uniformScale * tableAssetScale;
                    itemHeight = 120 * uniformScale * tableAssetScale * heightMultiplier;
                }
                
                return {
                    ...item,
                    width: itemWidth,
                    height: itemHeight
                };
            });
        };

        const rightSideItemsWithDimensions = calculateItemDimensions(rightSideItems);
        const specialItemsWithDimensions = calculateItemDimensions(specialItems);

        // 🎯 四个配菜2x2排列，放在桌子内部右侧
        const rightSideMargin = 20; // 距离桌子右边界的边距
        const itemSpacingX = 10; // 配菜水平间距
        const itemSpacingY = 10; // 配菜垂直间距
        
        // 计算2x2网格的起始位置（桌子内部右侧）
        const gridWidth = rightSideItemsWithDimensions[0].width * 2 + itemSpacingX;
        const gridHeight = rightSideItemsWithDimensions[0].height * 2 + itemSpacingY;
        const gridStartX = tablePos.x + tablePos.width - gridWidth - rightSideMargin;
        const upwardOffset = 125; // 🎯 所有素材向上偏移125px（100+25）
        const gridStartY = tablePos.y + (tablePos.height - gridHeight) / 2 - upwardOffset;
        
        const rightSidePositions = rightSideItemsWithDimensions.map((item, index) => {
            const row = Math.floor(index / 2); // 每行2个
            const col = index % 2;
            
            return {
                ...item,
                x: gridStartX + col * (item.width + itemSpacingX) - 20, // 配菜整体左移20px
                y: gridStartY + row * (item.height + itemSpacingY)
            };
        });

        // 🎯 特殊位置：dianfanbao和zhou在桌子内部左侧
        const leftSideMargin = 20; // 距离桌子左边界的边距
        const dianfanbaoItem = specialItemsWithDimensions[0];
        const zhouItem = specialItemsWithDimensions[1];
        
        // dianfanbao在桌子内部左上
        const dianfanbaoPos = {
            ...dianfanbaoItem,
            x: tablePos.x + leftSideMargin,
            y: tablePos.y + 20 - upwardOffset // 🎯 向上偏移
        };

        // zhou在桌子内部左下（dianfanbao下方）
        const zhouPos = {
            ...zhouItem,
            x: tablePos.x + leftSideMargin + 160, // 再向右移动30px（合计较大右移以便与配菜重合）
            y: tablePos.y + tablePos.height - zhouItem.height - 20 - upwardOffset // 🎯 向上偏移
        };

        // 🎯 合并所有位置
        return [...rightSidePositions, dianfanbaoPos, zhouPos];
    }

    // 🎯 获取zhou图片的位置（用于粥碗渲染）
    // 保持与 getSideItemPositions() 中的粥位置完全一致，避免叠加偏移导致不重合
    getZhouImagePosition() {
        const allItems = this.getSideItemPositions();
        const zhouItem = allItems.find(item => item.name === '粥');
        if (!zhouItem) return null;
        return { ...zhouItem };
    }

    // 计算youguo锅的实际位置和尺寸（紧贴miantuan右边）
    getYouguoPosition() {
        if (this.youguoImage && this.youguoImage.complete && this.backgroundScaleX && this.backgroundScaleY) {
            const originalWidth = this.youguoImage.width;
            const originalHeight = this.youguoImage.height;
            
            // 素材缩小系数，与miantuan保持一致，更密集排布
            const assetScale = 0.85;
            
            // 使用与背景相同的缩放比例，再乘以素材缩小系数
            const scaledWidth = originalWidth * this.backgroundScaleX * assetScale;
            const scaledHeight = originalHeight * this.backgroundScaleY * assetScale;
            
            // 获取miantuan的位置
            const miantuanPos = this.getMiantuanPosition();
            
            // 计算位置（面团台最右侧与油锅最左侧贴着，底部对齐background1底部）
            const bg1OffsetY = this.background1OffsetY || 0;
            const bg1Height = this.background1Height || 1080;
            
            const drawX = miantuanPos.x + miantuanPos.width + 15; // 面团台最右侧与油锅最左侧贴着，往右15px
            const drawY = bg1OffsetY + bg1Height - scaledHeight - 3; // 底部对齐background1底部，往上3px
            
            return {
                x: drawX,
                y: drawY,
                width: scaledWidth,
                height: scaledHeight
            };
        }
        
        // 如果图片未加载，返回默认位置（紧贴默认miantuan右边，顶部对齐）
        const miantuanPos = this.getMiantuanPosition();
        return {
            x: miantuanPos.x + miantuanPos.width,
            y: miantuanPos.y,
            width: 400,
            height: miantuanPos.height
        };
    }

    // 计算bucket的实际位置和尺寸（在油锅右边，底部对齐）
    getBucketPosition() {
        if (this.bucketImage && this.bucketImage.complete && this.backgroundScaleX && this.backgroundScaleY) {
            const originalWidth = this.bucketImage.width;
            const originalHeight = this.bucketImage.height;
            
            // 素材缩小系数，与其他素材保持一致，更密集排布
            const assetScale = 0.85;
            
            // 使用与背景相同的缩放比例，再乘以素材缩小系数
            const scaledWidth = originalWidth * this.backgroundScaleX * assetScale;
            const scaledHeight = originalHeight * this.backgroundScaleY * assetScale;
            
            // 获取油锅的位置
            const youguoPos = this.getYouguoPosition();
            
            // 计算位置（紧贴油锅右边，底部对齐background1底部）
            const bg1OffsetY = this.background1OffsetY || 0;
            const bg1Height = this.background1Height || 1080;
            
            const drawX = youguoPos.x + youguoPos.width + 10 + 15; // 油锅右边减少间距到10像素，更密集，往右15px
            const drawY = bg1OffsetY + bg1Height - scaledHeight - 3; // 底部对齐background1底部，往上3px
            
            return {
                x: drawX,
                y: drawY,
                width: scaledWidth,
                height: scaledHeight
            };
        }
        
        // 如果图片未加载，返回默认位置
        const youguoPos = this.getYouguoPosition();
        return {
            x: youguoPos.x + youguoPos.width + 20,
            y: 1080 - 200,
            width: 200,
            height: 200
        };
    }

    createBackground() {
        const canvas = document.createElement('canvas');
        canvas.width = 1920;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d');
        
        // 大厅直接使用desk图片作为背景
        this.drawDeskImage(ctx, canvas);
        
        return canvas;
    }

    createYoutiaoWorkspace() {
        const canvas = document.createElement('canvas');
        canvas.width = 1920;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d');
        
        // 保持像素艺术效果
        ctx.imageSmoothingEnabled = false;
        ctx.webkitImageSmoothingEnabled = false;
        ctx.mozImageSmoothingEnabled = false;
        ctx.msImageSmoothingEnabled = false;
        
        // 使用background1图片
        this.drawBackgroundImage(ctx, canvas, true);
        
        // 使用youguo图片作为油锅，如果已加载的话
        if (this.youguoImage && this.youguoImage.complete && this.backgroundScaleX && this.backgroundScaleY) {
            const youguoPos = this.getYouguoPosition();
            
            // 保持像素艺术效果
            ctx.imageSmoothingEnabled = false;
            ctx.webkitImageSmoothingEnabled = false;
            ctx.mozImageSmoothingEnabled = false;
            ctx.msImageSmoothingEnabled = false;
            
            ctx.drawImage(this.youguoImage, youguoPos.x, youguoPos.y, youguoPos.width, youguoPos.height);
        } else {
            // 如果图片未加载，使用动态位置的矩形作为备用
            const youguoPos = this.getYouguoPosition();
        ctx.fillStyle = '#2F4F4F';
            ctx.fillRect(youguoPos.x, youguoPos.y, youguoPos.width, youguoPos.height);
        ctx.fillStyle = '#FFD700';
            ctx.fillRect(youguoPos.x + 20, youguoPos.y + 20, youguoPos.width - 40, youguoPos.height - 40);
        }
        
        // 使用miantuan图片作为面团准备台，如果已加载的话
        if (this.miantuanImage && this.miantuanImage.complete && this.backgroundScaleX && this.backgroundScaleY) {
            const miantuanPos = this.getMiantuanPosition();
            
            // 保持像素艺术效果
            ctx.imageSmoothingEnabled = false;
            ctx.webkitImageSmoothingEnabled = false;
            ctx.mozImageSmoothingEnabled = false;
            ctx.msImageSmoothingEnabled = false;
            
            ctx.drawImage(this.miantuanImage, miantuanPos.x, miantuanPos.y, miantuanPos.width, miantuanPos.height);
        } else {
            // 如果图片未加载，使用原来的矩形作为备用
        ctx.fillStyle = '#D2691E';
            ctx.fillRect(0, 880, 500, 200);
        ctx.fillStyle = '#F4A460';
            ctx.fillRect(0, 880, 500, 30);
        }
        
        // 使用bucket图片作为成品收集区
        if (this.bucketImage && this.bucketImage.complete && this.backgroundScaleX && this.backgroundScaleY) {
            const bucketPos = this.getBucketPosition();
            
            // 保持像素艺术效果
            ctx.imageSmoothingEnabled = false;
            ctx.webkitImageSmoothingEnabled = false;
            ctx.mozImageSmoothingEnabled = false;
            ctx.msImageSmoothingEnabled = false;
            
            ctx.drawImage(this.bucketImage, bucketPos.x, bucketPos.y, bucketPos.width, bucketPos.height);
        } else {
            // 如果图片未加载，使用动态位置的矩形作为备用
            const bucketPos = this.getBucketPosition();
        ctx.fillStyle = '#8B4513';
            ctx.fillRect(bucketPos.x, bucketPos.y, bucketPos.width, bucketPos.height);
        }
        
        // 油条制作区标题已移除
        // ctx.fillStyle = '#2F4F4F';
        // ctx.font = 'bold 36px Arial';
        // ctx.fillText('🥖 油条制作区', 800, 100);
        
        return canvas;
    }

    // 🎯 重新创建油条工作空间（当图片加载完成后）
    refreshYoutiaoWorkspace() {
        if (this.sprites && this.backgroundScaleX && this.backgroundScaleY) {
            console.log('🔄 重新创建油条工作空间...');
            this.sprites.youtiaoWorkspace = this.createYoutiaoWorkspace();
            console.log('✅ 油条工作空间已更新');
        }
    }

    // 🎯 重新创建粥菜工作空间（当状态改变时）
    refreshCongeeWorkspace() {
        if (this.sprites && this.backgroundScaleX && this.backgroundScaleY) {
            console.log('🔄 重新创建粥菜工作空间...');
            this.sprites.congeeWorkspace = this.createCongeeWorkspace();
            console.log('✅ 粥菜工作空间已更新');
        }
    }

    createDoujiangWorkspace() {
        const canvas = document.createElement('canvas');
        canvas.width = 1920;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d');
        
        // 保持像素艺术效果
        ctx.imageSmoothingEnabled = false;
        ctx.webkitImageSmoothingEnabled = false;
        ctx.mozImageSmoothingEnabled = false;
        ctx.msImageSmoothingEnabled = false;
        
        // 使用background1图片
        this.drawBackgroundImage(ctx, canvas, true);
        
        // 🎯 使用豆浆桌图片（支持切换到 doujiangzhuo2）
        const activeDoujiangzhuo = (this.gameState && this.gameState.doujiangzhuoUseAlt && this.doujiangzhuo2Image && this.doujiangzhuo2Image.complete)
            ? this.doujiangzhuo2Image
            : this.doujiangzhuoImage;
        if (activeDoujiangzhuo && activeDoujiangzhuo.complete) {
            // 🎯 使用统一的位置计算函数
            const tablePos = this.getDoujiangzhuoPosition();
            console.log('🎯 绘制豆浆桌:', tablePos.x, tablePos.y, tablePos.width, tablePos.height);
            ctx.drawImage(activeDoujiangzhuo, tablePos.x, tablePos.y, tablePos.width, tablePos.height);
        } else {
            console.warn('⚠️ 豆浆桌图片未加载或加载失败，尝试重新加载');
            this.retryLoadAsset('doujiangzhuoImage');
        }
        

        
        // 制作说明 - 豆浆制作区标题已移除
        // ctx.fillStyle = '#2F4F4F';
        // ctx.font = 'bold 36px Arial';
        // ctx.fillText('🥛 豆浆制作区', 800, 100);
        
        // 提示文案已移除
        
        return canvas;
    }

    createCongeeWorkspace() {
        const canvas = document.createElement('canvas');
        canvas.width = 1920;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d');
        
        // 保持像素艺术效果
        ctx.imageSmoothingEnabled = false;
        ctx.webkitImageSmoothingEnabled = false;
        ctx.mozImageSmoothingEnabled = false;
        ctx.msImageSmoothingEnabled = false;
        
        // 使用background1图片
        this.drawBackgroundImage(ctx, canvas, true);
        
        // 🎯 使用zhoucaizhuo图片替换制作台
        if (this.zhoucaizhuoImage && this.zhoucaizhuoImage.complete) {
            const tablePos = this.getZhoucaizhuoPosition();
            console.log('🎯 绘制粥菜桌:', tablePos.x, tablePos.y, tablePos.width, tablePos.height);
            ctx.drawImage(this.zhoucaizhuoImage, tablePos.x, tablePos.y, tablePos.width, tablePos.height);
        } else {
            console.warn('⚠️ 粥菜桌图片未加载或加载失败，使用备用绘制');
            // 备用绘制：粥锅
        ctx.fillStyle = '#2F4F4F';
        ctx.fillRect(200, 300, 300, 200);
        ctx.fillStyle = '#F5DEB3';
        ctx.fillRect(220, 320, 260, 160);
        }
        
        // 🎯 使用新图片绘制配菜
        const sideItemPositions = this.getSideItemPositions();
        
        sideItemPositions.forEach(item => {
            const image = this[item.image];
            if (image && image.complete) {
                ctx.drawImage(image, item.x, item.y, item.width, item.height);
            } else {
                console.warn(`⚠️ 配菜图片未加载: ${item.image}，尝试重新加载`);
                this.retryLoadAsset(item.image);
            }
        });

        // 🎯 选中配菜后，仅叠加“已选中的”素材到粥位置，尺寸与粥一致，且覆盖在粥之上
        const zhouPos = this.getZhouImagePosition();
        const congee = this.gameState.congeeState && this.gameState.congeeState.congeeInProgress;
        if (zhouPos && congee && Array.isArray(congee.sides) && congee.sides.length > 0) {
            const baseKeyMap = {
                '咸菜': 'xiancaiImage',
                '黄豆': 'huangdouImage',
                '豆腐': 'doufuImage',
                '咸蛋': 'xiandanImage'
            };

            // 尝试优先使用带“1”后缀的覆盖素材（如 xiancai1.png），不存在则回退原素材
            const filenameMap = {
                xiancaiImage: 'xiancai',
                huangdouImage: 'huangdou',
                doufuImage: 'doufu',
                xiandanImage: 'xiandan'
            };

            congee.sides.forEach(sideName => {
                const baseKey = baseKeyMap[sideName];
                if (!baseKey) return;

                const overlayKey = baseKey.replace('Image', '1Image');
                let img = this[overlayKey];
                if (!img) {
                    // 按需尝试加载 1 后缀素材
                    const baseName = filenameMap[baseKey];
                    if (baseName) {
                        const candidate = new Image();
                        candidate.onload = () => {
                            // 加载完成后立即刷新粥工作区以显示叠加
                            try { this.refreshCongeeWorkspace(); } catch (e) {}
                        };
                        candidate.onerror = () => { /* 若失败则回退到原素材 */ };
                        candidate.style = candidate.style || {};
                        candidate.style.imageRendering = 'pixelated';
                        candidate.src = `images/${baseName}1.png?t=${Date.now()}`;
                        this[overlayKey] = candidate;
                        img = candidate;
                    }
                }

                // 仅使用 1 后缀覆盖素材；未加载完成则暂不显示，不回退基础图
                if (img && img.complete) {
                    ctx.drawImage(img, zhouPos.x, zhouPos.y, zhouPos.width, zhouPos.height);
                }
            });
         }
        
        // 粥配菜制作区标题已移除
        // ctx.fillStyle = '#2F4F4F';
        // ctx.font = 'bold 36px Arial';
        // ctx.fillText('🍚 粥配菜制作区', 750, 100);
        
        return canvas;
    }

    createKitchen() {
        const canvas = document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 220;
        const ctx = canvas.getContext('2d');
        
        // 厨房背景
        ctx.fillStyle = '#696969';
        ctx.fillRect(0, 0, 200, 150);
        
        // 炉灶
        ctx.fillStyle = '#2F4F4F';
        ctx.fillRect(10, 80, 80, 60);
        
        // 火焰
        ctx.fillStyle = '#FF6347';
        ctx.fillRect(15, 85, 15, 20);
        ctx.fillRect(35, 85, 15, 20);
        ctx.fillRect(55, 85, 15, 20);
        
        // 油锅
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(20, 75, 50, 10);
        
        // 工作台
        ctx.fillStyle = '#D2691E';
        ctx.fillRect(100, 90, 80, 50);
        ctx.fillStyle = '#F4A460';
        ctx.fillRect(100, 90, 80, 15);
        
        return canvas;
    }

    createCounter() {
        const canvas = document.createElement('canvas');
        canvas.width = 150;
        canvas.height = 100;
        const ctx = canvas.getContext('2d');
        
        // 收银台
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(0, 30, 150, 70);
        
        // 台面
        ctx.fillStyle = '#D2691E';
        ctx.fillRect(0, 30, 150, 15);
        
        // 收银机
        ctx.fillStyle = '#2F2F2F';
        ctx.fillRect(60, 10, 30, 25);
        ctx.fillStyle = '#00FF00';
        ctx.fillRect(65, 15, 20, 8);
        
        return canvas;
    }

    createTable() {
        const canvas = document.createElement('canvas');
        canvas.width = 120;
        canvas.height = 80;
        const ctx = canvas.getContext('2d');
        
        // 桌腿阴影
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(15, 65, 12, 18);
        ctx.fillRect(93, 65, 12, 18);
        
        // 桌腿
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(10, 60, 12, 20);
        ctx.fillRect(88, 60, 12, 20);
        ctx.fillRect(30, 60, 12, 20);
        ctx.fillRect(68, 60, 12, 20);
        
        // 桌面阴影
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.fillRect(2, 52, 116, 12);
        
        // 桌面
        ctx.fillStyle = '#D2691E';
        ctx.fillRect(0, 50, 120, 15);
        
        // 桌面高光
        ctx.fillStyle = '#DEB887';
        ctx.fillRect(0, 50, 120, 5);
        
        // 桌面纹理
        ctx.strokeStyle = '#A0522D';
        ctx.lineWidth = 1;
        for (let i = 10; i < 110; i += 20) {
            ctx.beginPath();
            ctx.moveTo(i, 50);
            ctx.lineTo(i + 10, 65);
            ctx.stroke();
        }
        
        return canvas;
    }

    createCustomer() {
        // 🎯 随机选择guke1或guke2作为顾客素材
        const candidates = [];
        if (this.guke1Image && this.guke1Image.complete) candidates.push(this.guke1Image);
        if (this.guke2Image && this.guke2Image.complete) candidates.push(this.guke2Image);
        if (this.guke3Image && this.guke3Image.complete) candidates.push(this.guke3Image);
        if (candidates.length > 0) {
            const pick = candidates[Math.floor(Math.random() * candidates.length)];
            return pick;
        }
        // 图片未就绪时返回占位canvas，同时触发重试
        const canvas = document.createElement('canvas');
        canvas.width = 180;
        canvas.height = 360;
        console.warn('⚠️ 顾客图片未加载，使用临时canvas并重试加载');
        this.retryLoadAsset('guke1Image');
        this.retryLoadAsset('guke2Image');
        this.retryLoadAsset('guke3Image');
        return canvas;
    }

    createFoodSprites() {
        const foods = {};
        
        // 油条
        const youtiaoCanvas = document.createElement('canvas');
        youtiaoCanvas.width = 30;
        youtiaoCanvas.height = 15;
        const youtiaoCtx = youtiaoCanvas.getContext('2d');
        // 设置像素完美渲染
        youtiaoCtx.imageSmoothingEnabled = false;
        youtiaoCtx.fillStyle = '#DAA520';
        youtiaoCtx.fillRect(0, 5, 30, 8);
        youtiaoCtx.fillStyle = '#FFD700';
        youtiaoCtx.fillRect(0, 5, 30, 3);
        foods.youtiao = youtiaoCanvas;
        
        // 豆浆
        const doujiangCanvas = document.createElement('canvas');
        doujiangCanvas.width = 20;
        doujiangCanvas.height = 25;
        const doujiangCtx = doujiangCanvas.getContext('2d');
        // 设置像素完美渲染
        doujiangCtx.imageSmoothingEnabled = false;
        doujiangCtx.fillStyle = '#DCDCDC';
        doujiangCtx.fillRect(2, 5, 16, 20);
        doujiangCtx.fillStyle = '#FFFACD';
        doujiangCtx.fillRect(4, 7, 12, 16);
        foods.doujiang = doujiangCanvas;
        
        // 粥
        const congeeCanvas = document.createElement('canvas');
        congeeCanvas.width = 25;
        congeeCanvas.height = 15;
        const congeeCtx = congeeCanvas.getContext('2d');
        // 设置像素完美渲染
        congeeCtx.imageSmoothingEnabled = false;
        congeeCtx.fillStyle = '#8B4513';
        congeeCtx.fillRect(0, 5, 25, 10);
        congeeCtx.fillStyle = '#F5F5DC';
        congeeCtx.fillRect(2, 7, 21, 6);
        foods.congee = congeeCanvas;
        
        // 蛋
        const eggCanvas = document.createElement('canvas');
        eggCanvas.width = 18;
        eggCanvas.height = 18;
        const eggCtx = eggCanvas.getContext('2d');
        eggCtx.fillStyle = '#FFFFE0';
        eggCtx.beginPath();
        eggCtx.arc(9, 9, 8, 0, Math.PI * 2);
        eggCtx.fill();
        eggCtx.fillStyle = '#FFD700';
        eggCtx.beginPath();
        eggCtx.arc(9, 9, 4, 0, Math.PI * 2);
        eggCtx.fill();
        foods.egg = eggCanvas;
        
        return foods;
    }

    createGameObjects() {
        // 初始化桌子（基于desk图片）
        this.gameState.tables = this.initializeTables();

        // 厨房区域
        this.kitchen = {
            x: 100, y: 600, width: 300, height: 220,
            stove: { x: 100, y: 600, width: 150, height: 110 },
            counter: { x: 250, y: 600, width: 150, height: 110 }
        };

        // 收银台
        this.cashier = { x: 1500, y: 650, width: 220, height: 150 };
    }

    setupEventListeners() {
        if (this.debug) console.log('Setting up event listeners...');
        
        // 统一使用 Pointer Events，兼容鼠标/触摸/触控笔
        this.canvas.style.touchAction = 'none';
        const toCanvasPoint = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
            const y = (e.clientY - rect.top) * (this.canvas.height / rect.height);
            return { x, y };
        };

        this.canvas.addEventListener('pointerdown', (e) => {
            const p = toCanvasPoint(e);
            e.preventDefault();
            try { this.canvas.setPointerCapture(e.pointerId); } catch (_) {}
            this.handleMouseDown({ ...e, normalizedX: p.x, normalizedY: p.y, isNormalized: true });
        });
        this.canvas.addEventListener('pointermove', (e) => {
            const p = toCanvasPoint(e);
            e.preventDefault();
            this.handleMouseMove({ ...e, normalizedX: p.x, normalizedY: p.y, isNormalized: true });
            // 确保拖拽元素在指针捕获到canvas时也能跟随
            this.handleDragMouseMove({ ...e, normalizedX: p.x, normalizedY: p.y, isNormalized: true });
            // 记录屏幕坐标用于跟随校验
            this.dragState.pointerScreenX = e.clientX;
            this.dragState.pointerScreenY = e.clientY;
        });
        this.canvas.addEventListener('pointerup', (e) => {
            const p = toCanvasPoint(e);
            e.preventDefault();
            try { this.canvas.releasePointerCapture(e.pointerId); } catch (_) {}
            this.handleMouseUp({ ...e, normalizedX: p.x, normalizedY: p.y, isNormalized: true });
        });
        // 点击事件保留
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        
        // 键盘事件（用于豆浆倒制）
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));

        // 拖拽事件（指针）
        document.addEventListener('pointermove', (e) => {
            const p = toCanvasPoint(e);
            this.handleDragMouseMove({ ...e, normalizedX: p.x, normalizedY: p.y, isNormalized: true });
            // 记录全局屏幕坐标（指针离开画布时也持续更新）
            this.dragState.pointerScreenX = e.clientX;
            this.dragState.pointerScreenY = e.clientY;
        });
        document.addEventListener('pointerup', (e) => {
            const p = toCanvasPoint(e);
            this.handleDragEnd({ ...e, normalizedX: p.x, normalizedY: p.y, isNormalized: true });
        });
        
        // 🎯 新的简洁侧边栏初始化
        this.initSidebar();
    }

    handleMouseDown(e) {
        if (this.gameState.isPaused) return;
        
        // 若已标准化（pointer → 画布坐标），直接使用
        let adjustedX, adjustedY;
        if (e.isNormalized) {
            adjustedX = e.normalizedX;
            adjustedY = e.normalizedY;
        } else {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
            adjustedX = x * scaleX;
            adjustedY = y * scaleY;
        }
        
        // 🎯 粥菜拖拽检测
        if (this.gameState.currentView === 'congee') {
            const congeeResult = this.checkCompletedCongeeClick(adjustedX, adjustedY);
            if (congeeResult) {
                this.startCongeeDrag(e, congeeResult.congee, congeeResult.index);
                return;
            }
        }

        // 已取消“收集桶”点击逻辑

        // 🎯 优先检查面团台区域（点击并按住-拖动-放开 逻辑起点）
        if (this.gameState.currentView === 'youtiao') {
            const miantuanPos = this.getMiantuanPosition();
            const doughAreaX = miantuanPos.x;
            const doughAreaY = miantuanPos.y;
            const doughAreaWidth = miantuanPos.width;
            const doughAreaHeight = miantuanPos.height * 0.6; // 上 60%

            const inDoughArea = adjustedX >= doughAreaX && adjustedX <= doughAreaX + doughAreaWidth &&
                                adjustedY >= doughAreaY && adjustedY <= doughAreaY + doughAreaHeight;

            if (inDoughArea) {
                // 起始动作：若未开始，点击即开始揉面；若已 ready_to_fry，则直接进入拖拽
                if (this.gameState.youtiaoState.currentStep === 'idle') {
                    this.startYoutiaoPreparation();
                    return;
                }
                if (this.gameState.youtiaoState.currentStep === 'ready_to_fry') {
                    this.startDoughDrag(adjustedX, adjustedY);
                    return;
                }
                // kneading / stretching 阶段，记录当前点，配合 move 检测形态切换
                this.gameState.youtiaoState.lastMouseX = adjustedX;
                this.gameState.youtiaoState.lastMouseY = adjustedY;
                return; // 阻止后续收集油条逻辑
            }
        }

        // 🎯 油条收集检测 - 只在有油条在锅里时进行，且不在面团台区域
        if (this.gameState.currentView === 'youtiao' && this.gameState.youtiaoState.youtiaoInOil.length > 0) {
            const youtiaoResult = this.checkYoutiaoClickForCollection(adjustedX, adjustedY);
            if (youtiaoResult) {
                this.gameState.youtiaoState.collectingState = {
                    isTracking: true,
                    startX: adjustedX,
                    startY: adjustedY,
                    targetYoutiao: youtiaoResult.youtiao,
                    targetIndex: youtiaoResult.index,
                    moveThreshold: 30
                };
                console.log(`🎯 开始跟踪油条收集 - 索引: ${youtiaoResult.index}`);
                return;
            }
        }
        
        // 豆浆制作区交互：点击hu2选中/取消；仅在选中壶时点击碗开始倒
        if (this.gameState.currentView === 'doujiang') {
            // 先允许点击 hu2 进行选中/取消
            if (this.checkHu2Click(adjustedX, adjustedY)) {
                this.gameState.doujiangState.kettleSelected = !this.gameState.doujiangState.kettleSelected;
                // 选中时立即将壶位置置于鼠标处
                this.gameState.doujiangState.kettleX = adjustedX;
                this.gameState.doujiangState.kettleY = adjustedY;
                this.showNotification(this.gameState.doujiangState.kettleSelected ? '已选中豆浆壶（hu2）' : '已取消选中豆浆壶');
                return;
            }

            // 仅当选中壶时，点击碗开始倒豆浆
            const bowlResult = this.checkDoujiangBowlClick(adjustedX, adjustedY);
            if (bowlResult && this.gameState.doujiangState.kettleSelected) {
                this.startDoujiangPouring(bowlResult.bowl, bowlResult.index);
                return;
            }
        }
    }

    handleMouseUp(e) {
        // 松开停止倒豆浆
        this.stopDoujiangPouring();
        
        // 重置揉面/拉伸的最后坐标，避免下一次误差
        if (this.gameState && this.gameState.youtiaoState) {
            this.gameState.youtiaoState.lastMouseX = 0;
            this.gameState.youtiaoState.lastMouseY = 0;
        }

        // 🎯 若正在拖拽收集油条：已取消“收集桶”逻辑，抬起即收集
        const collectingState = this.gameState.youtiaoState.collectingState;
        if (collectingState && collectingState.isTracking) {
            this.collectYoutiaoByMovement(collectingState.targetYoutiao, collectingState.targetIndex);
            this.gameState.youtiaoState.collectingState = {
                isTracking: false,
                startX: 0,
                startY: 0,
                targetYoutiao: null,
                targetIndex: -1,
                moveThreshold: 30
            };
        }
    }

    handleKeyDown(e) {
        if (this.gameState.isPaused) return;
        
        // 空格键制作豆浆 - 已移除，改为鼠标长按碗的位置
        // if (e.code === 'Space' && this.gameState.currentView === 'doujiang') {
        //     e.preventDefault();
        //     this.startDoujiangMaking();
        // }
        
        // 空格键盛粥
        if (e.code === 'Space' && this.gameState.currentView === 'congee') {
            e.preventDefault();
            this.startCongeeServing();
        }
        
        // F5键强制重新加载背景图片
        if (e.key === 'F5') {
            e.preventDefault(); // 防止页面刷新
            this.forceReloadBackground();
            this.showNotification('背景图片已重新加载！', 2000);
        }
        
        // F6键重新加载shuyoutiao素材
        if (e.key === 'F6') {
            e.preventDefault();
            this.reloadShuyoutiaoImages();
        }
        
        // F7键检查shuyoutiao图片加载状态
        if (e.key === 'F7') {
            e.preventDefault();
            this.checkShuyoutiaoImagesStatus();
        }
    }

    handleKeyUp(e) {
        if (e.code === 'Space' && this.gameState.currentView === 'doujiang') {
            e.preventDefault();
            this.stopDoujiangMaking();
        }
        
        if (e.code === 'Space' && this.gameState.currentView === 'congee') {
            e.preventDefault();
            this.stopCongeeServing();
        }
    }
    
    // 🎯 侧边栏系统初始化
    initSidebar() {
        if (this.debug) console.log('🎮 初始化侧边栏系统');
        
        // 等待DOM完全加载
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupSidebar());
        } else {
            this.setupSidebar();
        }
    }
    
    // 🎯 设置侧边栏系统
    setupSidebar() {
        // 绑定按钮事件
        this.bindSidebarButtons();
        
        // 初始化三个区域
        this.initializeSidebarAreas();
        // 允许完成食物栏滚轮滚动
        const completed = document.getElementById('completedFoodSlots');
        if (completed) {
            completed.addEventListener('wheel', (e) => {
                // 独立滚动，不影响整个页面
                const delta = e.deltaY;
                completed.scrollTop += delta;
                e.preventDefault();
                e.stopPropagation();
            }, { passive: false });
        }
        
        if (this.debug) console.log('✅ 侧边栏系统设置完成');
    }
    
    // 🎯 绑定侧边栏按钮
    bindSidebarButtons() {
        const buttons = {
            'servePlate': () => this.handleServePlate(),
            'clearPlate': () => this.clearPlate(),
            'viewMain': () => this.switchView('main'),
            'viewYoutiao': () => this.switchAndStartCooking('youtiao'),
            'viewDoujiang': () => this.switchAndStartCooking('doujiang'),
            'viewCongee': () => this.switchAndStartCooking('congee'),
            'cleanTables': () => this.cleanTables(),
            'startDay': () => this.startDay(),
        // 'pauseGame': () => this.togglePause()
        };
        
        Object.entries(buttons).forEach(([buttonId, handler]) => {
            const button = document.getElementById(buttonId);
            if (button) {
                // 清理旧事件
                const newButton = button.cloneNode(true);
                button.parentNode.replaceChild(newButton, button);
                
                // 绑定新事件
                newButton.addEventListener('click', (e) => {
                e.preventDefault();
                    e.stopPropagation();
                    try {
                        handler();
                    } catch (error) {
                        console.error(`❌ ${buttonId} 错误:`, error);
                    }
                });
                
                console.log(`✅ ${buttonId} 绑定成功`);
            }
        });
    }
    
    // 🎯 初始化侧边栏三个区域
    initializeSidebarAreas() {
        // 立即更新所有区域
        this.updateCompletedFoodArea();
        this.updatePlateArea();
        this.updateOrderArea();
    }
    
    // 🎯 更新完成食物区域 (kuang3)
    updateCompletedFoodArea() {
        const container = document.getElementById('completedFoodSlots');
        console.log('🍽️ 更新完成食物区域，容器：', container);
        if (!container) {
            console.error('❌ completedFoodSlots容器未找到！');
            return;
        }
        
        container.innerHTML = '';
        
        console.log('🍽️ 当前完成食物数量：', this.gameState.completedFood.length);
        console.log('🍽️ 完成食物列表：', this.gameState.completedFood);
        
        if (this.gameState.completedFood.length === 0) {
            container.innerHTML = '<div class="empty-message">暂无完成的食物</div>';
            return;
        }
        
        this.gameState.completedFood.forEach((food, index) => {
            console.log('🍽️ 创建食物槽：', food, 'index:', index);
            const slot = this.createFoodSlot(food, index, 'completed');
            console.log('🍽️ 食物槽创建完成：', slot);
            container.appendChild(slot);
            console.log('🍽️ 食物槽已添加到容器');
        });
    }
    
    // 🎯 更新餐盘区域 (kuang2)
    updatePlateArea() {
        const container = document.getElementById('plateItems');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (this.gameState.currentPlate.length === 0) {
            // 空消息不显示，让plate-base处理提示
            return;
        }
        
        // 计算圆形分布位置
        this.gameState.currentPlate.forEach((food, index) => {
            const slot = this.createFoodSlot(food, index, 'plate');
            
            // 按圆形分布食物
            const positions = this.calculateCircularPositions(this.gameState.currentPlate.length);
            const position = positions[index];
            
            slot.style.position = 'absolute';
            slot.style.left = position.x + 'px';
            slot.style.top = position.y + 'px';
            slot.style.width = '40px';
            slot.style.height = '40px';
            slot.style.fontSize = '16px';
            slot.style.transform = 'translate(-50%, -50%)'; // 确保以食物中心定位
            
            container.appendChild(slot);
        });
    }
    
    // 🎯 计算餐盘中食物的圆形分布位置
    calculateCircularPositions(count) {
        const positions = [];
        const plateRadius = 80; // 餐盘有效半径
        const centerX = 100; // 餐盘中心X (200px宽度的一半)
        const centerY = 100; // 餐盘中心Y (200px高度的一半)
        
        if (count === 1) {
            // 单个食物放在中心
            positions.push({ x: centerX, y: centerY });
        } else if (count === 2) {
            // 两个食物对称分布
            positions.push({ x: centerX - 30, y: centerY });
            positions.push({ x: centerX + 30, y: centerY });
        } else {
            // 多个食物按圆形分布
            const radius = Math.min(50, plateRadius - 20); // 避免超出餐盘边缘
            for (let i = 0; i < count; i++) {
                const angle = (i * 2 * Math.PI) / count - Math.PI / 2; // 从顶部开始
                const x = centerX + radius * Math.cos(angle);
                const y = centerY + radius * Math.sin(angle);
                positions.push({ x: Math.round(x), y: Math.round(y) });
            }
        }
        
        return positions;
    }
    
    // 🎯 更新订单区域 (kuang1)
    updateOrderArea() {
        const container = document.getElementById('orderList');
        if (!container) {
            console.error('orderList容器未找到！');
            return;
        }
        
        container.innerHTML = '';
        
        const orders = this.gameState.pendingOrders || [];
        console.log('更新订单区域，订单数量：', orders.length, orders);
        
        if (orders.length === 0) {
            container.innerHTML = '<div class="empty-message">暂无待处理订单</div>';
            return;
        }
        
        orders.forEach((order, index) => {
            console.log('创建订单元素：', index, order);
            const orderElement = this.createOrderElement(order, index);
            container.appendChild(orderElement);
        });
        
        // 强制显示容器
        container.style.display = 'block';
        container.style.visibility = 'visible';
    }
    
    // 🎯 创建食物槽
    createFoodSlot(food, index, source) {
        const slot = document.createElement('div');
        slot.className = 'food-slot';
        slot.dataset.index = index;
        slot.dataset.source = source;
        
        const foodIcon = this.getFoodIcon(food);
        const foodName = this.getFoodName(food.type);
        const sidesText = food.sides ? `<br><small>${food.sides.join(',')}</small>` : '';
        // 若是油条，优先用图片素材替代emoji
        let youtiaoImgHtml = '';
        if (food.type === 'youtiao') {
            let shuyoutiaoImageIndex;
            if (food.overcooked) shuyoutiaoImageIndex = 3; else if (food.perfectTiming) shuyoutiaoImageIndex = 1; else shuyoutiaoImageIndex = 2;
            const imgObj = this[`shuyoutiao${shuyoutiaoImageIndex}Image`];
            if (imgObj && imgObj.complete) {
                const src = imgObj.src;
                // 缩小：完成食物栏略大于emoji；餐盘更小
                const sizeCompleted = 22; // px，略大于 1.5em emoji
                const sizePlate = 18;     // 餐盘更小
                const imgTagCompleted = `<img src="${src}" alt="油条" style="width:${sizeCompleted}px;height:auto;image-rendering:pixelated;">`;
                const imgTagPlate = `<img src="${src}" alt="油条" style="width:${sizePlate}px;height:auto;image-rendering:pixelated;">`;
                youtiaoImgHtml = JSON.stringify({ completed: imgTagCompleted, plate: imgTagPlate });
            }
        }
        
        if (source === 'plate') {
            // 餐盘中只显示图标，不显示名称
            const imgs = youtiaoImgHtml ? JSON.parse(youtiaoImgHtml) : null;
            slot.innerHTML = `
                <div class="food-content" style="justify-content: center; align-items: center;">
                    ${imgs ? imgs.plate : `<span class=\"food-icon\" style=\"font-size: 1.5em; margin: 0;\">${foodIcon}</span>`}
                </div>
            `;
        } else {
            // 完成食物区域显示完整信息
        const imgs = youtiaoImgHtml ? JSON.parse(youtiaoImgHtml) : null;
        slot.innerHTML = `
            <div class="food-content">
                ${imgs ? imgs.completed : `<span class=\"food-icon\">${foodIcon}</span>`}
                <span class="food-name">${foodName}${sidesText}</span>
            </div>
        `;
        }
        
            // 🎯 点击交互 - 取消拖拽，改为点击
    if (source === 'completed') {
        // 已完成餐食：点击放到餐盘
        slot.style.cursor = 'pointer';
        slot.style.backgroundColor = 'rgba(76, 175, 80, 0.1)'; // 淡绿色背景提示可点击
        slot.style.pointerEvents = 'auto'; // 确保可以接收点击事件
        slot.style.zIndex = '100'; // 确保在其他元素之上
        slot.addEventListener('click', (e) => {
            console.log('🥘 点击完成餐食，准备移动到餐盘：', food, index);
            e.stopPropagation();
            e.preventDefault();
            
            // 🎯 确保食物有ID，如果没有就分配一个
            if (!food.id) {
                food.id = Date.now() + Math.random();
                console.log('⚠️ 食物缺少ID，已分配:', food.id);
            }
            
            // 重新获取当前索引，防止索引过期
            const currentIndex = this.gameState.completedFood.findIndex(f => 
                f.type === food.type && 
                f.id === food.id
            );
            console.log('🔍 查找食物索引结果：', currentIndex, '匹配条件:', {type: food.type, id: food.id});
            if (currentIndex !== -1) {
                this.moveCompletedFoodToPlate(food, currentIndex);
            } else {
                console.error('❌ 未找到食物，可能已被移动:', food);
                console.error('❌ 当前completedFood数组:', this.gameState.completedFood);
                this.updateSidebar(); // 刷新UI
            }
        });
        console.log('✅ 完成餐食点击事件已绑定:', food.type, 'index:', index, 'id:', food.id);
        // 调试：检查food对象的完整结构
        console.log('🔍 完成餐食对象结构:', food);
    } else if (source === 'plate') {
        // 餐盘食物：点击放回成品槽
        slot.style.cursor = 'pointer';
        slot.style.backgroundColor = 'transparent'; // 去掉背景色
        slot.style.border = 'none'; // 去掉边框
        slot.style.boxShadow = 'none'; // 去掉阴影
        slot.addEventListener('click', (e) => {
            console.log('🍽️ 点击餐盘食物，准备移回成品槽：', food, index);
            e.stopPropagation();
            e.preventDefault();
            // 重新获取当前索引，防止索引过期
            const currentIndex = this.gameState.currentPlate.findIndex(f => 
                f.type === food.type && 
                f.id === food.id
            );
            if (currentIndex !== -1) {
                this.movePlateFoodToCompleted(food, currentIndex);
            } else {
                console.error('未找到餐盘食物，可能已被移动:', food);
                this.updateSidebar(); // 刷新UI
            }
        });
        console.log('✅ 餐盘食物点击事件已绑定:', food.type, 'index:', index);
    }
        
        return slot;
    }
    
    // 🎯 创建订单元素
    createOrderElement(order, index) {
        console.log('创建订单元素开始：', order, index);
        
        const orderDiv = document.createElement('div');
        orderDiv.className = 'order-item';
        orderDiv.dataset.orderIndex = index;
        orderDiv.style.display = 'block';
        orderDiv.style.visibility = 'visible';
        
        const items = order.items.map(item => {
            let itemText = `${this.getFoodIcon(item)} ${this.getFoodName(item.type)}`;
            
            // 🎯 如果是粥且有配菜，显示详细配菜信息
            if (item.type === 'congee' && item.sides && item.sides.length > 0) {
                itemText = `${this.getFoodIcon(item)} 粥+${item.sides.join('+')}`;
            }
            
            return `${itemText} ×${item.quantity}`;
        }).join('<br>');
        
        // 🎯 计算耐心值百分比
        const patiencePercent = Math.max(0, (order.currentPatience / order.maxPatience) * 100);
        const patienceColor = patiencePercent > 50 ? '#4CAF50' : patiencePercent > 25 ? '#FFA500' : '#FF4444';
        
        orderDiv.innerHTML = `
            <div class="order-content" style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                <div class="order-info" style="flex: 1; margin-right: 8px;">
                    <div class="order-header">顾客 #${order.customerId}</div>
                    <div class="order-items">${items}</div>
                    <div class="patience-bar-container" style="width: 100%; height: 8px; background: #e0e0e0; border-radius: 4px; margin-top: 5px; overflow: hidden;">
                        <div class="patience-bar" style="width: ${patiencePercent}%; height: 100%; background: ${patienceColor}; transition: width 0.3s ease, background-color 0.3s ease;"></div>
                    </div>
                    <div class="patience-text" style="font-size: 10px; color: #666; margin-top: 2px;">耐心值: ${Math.ceil(order.currentPatience / 1000)}s</div>
                </div>
                <button class="fulfill-btn-square" data-order-index="${index}" style="width: 40px; height: 40px; background: #4CAF50; border: none; border-radius: 6px; color: white; font-size: 10px; font-weight: bold; cursor: pointer; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                    交餐
                </button>
            </div>
        `;
        
        console.log('订单HTML创建完成：', orderDiv.innerHTML);
        
        // 🎯 强化交餐按钮事件绑定
        const fulfillBtn = orderDiv.querySelector('.fulfill-btn-square');
        console.log('找到交餐按钮：', fulfillBtn);
        
        if (fulfillBtn) {
            // 确保按钮可点击
            fulfillBtn.style.pointerEvents = 'auto';
            fulfillBtn.style.zIndex = '1000';
            fulfillBtn.style.position = 'relative';
            
            // 使用onclick方式绑定事件
            fulfillBtn.onclick = (e) => {
                console.log('🎯 交餐按钮被点击：', index, '餐盘内容:', this.gameState.currentPlate.length);
                e.stopPropagation();
                e.preventDefault();
                
                // 交餐逻辑由fulfillOrderFromPlate函数处理
                
                this.fulfillOrderFromPlate(index);
                return false;
            };
            
            // 添加额外的事件监听器作为备用
            fulfillBtn.addEventListener('click', (e) => {
                console.log('🎯 交餐按钮addEventListener触发：', index);
                e.stopPropagation();
                e.preventDefault();
                this.fulfillOrderFromPlate(index);
            }, true); // 使用捕获阶段
            
            // 指针事件验证（兼容触摸）
            fulfillBtn.addEventListener('pointerdown', (e) => {
                console.log('🎯 交餐按钮pointerdown：', index);
            });
            
            fulfillBtn.addEventListener('pointerup', (e) => {
                console.log('🎯 交餐按钮pointerup：', index);
            });
            
            // 添加悬停效果
            fulfillBtn.addEventListener('mouseenter', () => {
                fulfillBtn.style.background = '#45a049';
                fulfillBtn.style.transform = 'scale(1.05)';
                console.log('🎯 交餐按钮悬停');
            });
            
            fulfillBtn.addEventListener('mouseleave', () => {
                fulfillBtn.style.background = '#4CAF50';
                fulfillBtn.style.transform = 'scale(1)';
            });
            
            console.log('✅ 交餐按钮事件绑定完成，onclick和addEventListener都已设置');
        } else {
            console.error('❌ 交餐按钮未找到！');
        }
        
        console.log('订单元素创建完成：', orderDiv);
        return orderDiv;
    }
    
    // 🎯 获取食物图标
    getFoodIcon(food) {
        // 如果传入的是字符串类型，兼容旧版本调用
        if (typeof food === 'string') {
            const type = food;
            const icons = {
                'youtiao': '🥖',
                'doujiang': '🥛',
                'congee': '🍚',
                'egg': '🥚'
            };
            return icons[type] || '🍽️';
        }
        
        // 如果传入的是对象，根据具体状态返回图标
        const type = food.type;
        if (type === 'youtiao') {
            if (food.perfectTiming) {
                return '🥨'; // 刚好熟的油条使用椒盐脆饼表示
            } else if (food.overcooked) {
                return '🍞'; // 过熟的油条使用面包表示
            } else {
                return '🥖'; // 普通油条
            }
        }
        
        const icons = {
            'doujiang': '🥛',
            'congee': '🍚',
            'egg': '🥚'
        };
        return icons[type] || '🍽️';
    }
    
    // 🎯 获取食物名称
    getFoodName(type) {
        const names = {
            'youtiao': '油条',
            'doujiang': '豆浆', 
            'congee': '粥',
            'egg': '蛋'
        };
        return names[type] || '未知';
    }
    
    // 🎯 更新所有侧边栏区域
    // 🎯 更新侧边栏
    updateSidebar() {
        this.updateCompletedFoodArea();
        this.updatePlateArea();
        this.updateOrderArea();
        
        // 强制显示订单面板
        const orderPanel = document.getElementById('orderPanel');
        const orderList = document.getElementById('orderList');
        
        if (orderPanel) {
            orderPanel.style.display = 'block';
            orderPanel.style.visibility = 'visible';
        }
        
        if (orderList) {
            orderList.style.display = 'block';
            orderList.style.visibility = 'visible';
        }
        
        console.log('侧边栏更新完成，当前待处理订单：', this.gameState.pendingOrders?.length || 0);
    }
    
    // 🎯 检查餐盘是否能满足订单要求
    checkPlateCanFulfillOrder(order) {
        const plateItems = this.gameState.currentPlate.slice(); // 复制餐盘内容
        
        for (const requiredItem of order.items) {
            let foundCount = 0;
            
            // 计算餐盘中对应食物的数量
            for (let i = plateItems.length - 1; i >= 0; i--) {
                const plateItem = plateItems[i];
                
                if (this.isFoodItemMatch(plateItem, requiredItem)) {
                    foundCount++;
                    plateItems.splice(i, 1); // 移除已匹配的项目
                    
                    if (foundCount >= requiredItem.quantity) {
                        break;
                    }
                }
            }
            
            // 如果任何一种食物数量不足，返回false
            if (foundCount < requiredItem.quantity) {
                return false;
            }
        }
        
        return true;
    }
    
    // 🎯 检查餐盘中的食物是否匹配订单要求
    isFoodItemMatch(plateFood, requiredItem) {
        if (plateFood.type !== requiredItem.type) {
            return false;
        }
        
        // 如果是粥，检查配菜是否匹配
        if (plateFood.type === 'congee' && requiredItem.sides) {
            if (!plateFood.sides || plateFood.sides.length !== requiredItem.sides.length) {
                return false;
            }
            
            // 检查所有配菜是否匹配
            const plateSides = plateFood.sides.slice().sort();
            const requiredSides = requiredItem.sides.slice().sort();
            
            return plateSides.every((side, index) => side === requiredSides[index]);
        }
        
        return true;
    }
    
    // 🎯 从餐盘提交订单
    fulfillOrderFromPlate(orderIndex) {
        console.log(`🍽️ 交餐方法被调用 - 订单索引: ${orderIndex}, 餐盘内容数量: ${this.gameState.currentPlate.length}`);
        
        const order = this.gameState.pendingOrders[orderIndex];
        if (!order) {
            this.showNotification('订单不存在！', 2000);
            return;
        }
        
        // 🎯 无论餐食是否满足都能提交，直接提交餐盘内容
        
        // 找到对应的顾客
        const customer = this.gameState.customers.find(c => c.id === order.customerId);
        if (!customer) {
            // 找不到顾客：删除该订单
            this.showNotification('找不到对应的顾客，已删除订单', 2000);
            // 从待处理订单移除
            this.gameState.pendingOrders.splice(orderIndex, 1);
            // 同步从主订单列表移除
            const orderInMainListIdx = this.gameState.orders.findIndex(o => o.id === order.id);
            if (orderInMainListIdx >= 0) {
                this.gameState.orders.splice(orderInMainListIdx, 1);
            }
            this.updateSidebar();
            return;
        }
        
        // 🎯 检查餐盘是否为空
        const plateItemsUsed = this.gameState.currentPlate.slice(); // 复制所有餐盘内容
        console.log(`🍽️ 准备交餐 - 餐盘中有 ${plateItemsUsed.length} 个食物：`, plateItemsUsed);
        
        // 🎯 如果餐盘为空，提示用户并返回，不完成订单
        if (plateItemsUsed.length === 0) {
            console.log('❌ 餐盘为空，无法交餐');
            this.showNotification('❌ 餐盘是空的！请先将食物添加到餐盘中。', 3000);
            return;
        }
        
        // 清空餐盘
        this.gameState.currentPlate = [];
        console.log('🍽️ 餐盘已清空');
        
        // 完成订单
        this.completeOrder(customer, order, plateItemsUsed);
        
        // 移除订单
        this.gameState.pendingOrders.splice(orderIndex, 1);
        
        // 也从orders数组中移除
        const orderInMainList = this.gameState.orders.findIndex(o => o.id === order.id);
        if (orderInMainList >= 0) {
            this.gameState.orders.splice(orderInMainList, 1);
        }
        
        // 更新UI
        this.updateSidebar();
        
        const foodNames = plateItemsUsed.map(food => this.getFoodName(food.type)).join(', ');
        this.showNotification(`✅ 成功为顾客 #${order.customerId} 提供了 ${foodNames}！`, 3000);
    }
    
    // 🎯 完成订单处理
    completeOrder(customer, order, providedFood) {
        // 计算收入
        let totalPrice = 0;
        const foodPrices = {
            'youtiao': 3,
            'doujiang': 2,
            'congee': 4,
            'egg': 2
        };
        
        providedFood.forEach(food => {
            totalPrice += foodPrices[food.type] || 2;
        });
        
        // 更新游戏状态
        this.gameState.money += totalPrice;
        this.gameState.reputation += 5;
        // 🎯 记录完成订单数并检查是否达成目标
        this.gameState.completedOrdersToday = (this.gameState.completedOrdersToday || 0) + 1;
        if (this.config.useOrderTargetEnd && this.gameState.completedOrdersToday >= this.config.dailyOrderTarget) {
            this.triggerEndOfDayByOrders();
        }
        
        // 更新顾客状态
        customer.satisfaction = 100;
        customer.state = 'leaving';
        customer.hasOrdered = false;
        customer.patience = customer.maxPatience;
        
        // 设置离开目标（直接向左离开屏幕）
        customer.targetX = -200;
        customer.targetY = customer.y;
        
        console.log(`✅ 订单完成 - 顾客 #${customer.id}, 收入: ¥${totalPrice}`);
        console.log(`🎯 顾客 #${customer.id} 状态已设置为离开, 当前位置: (${customer.x}, ${customer.y}), 目标位置: (${customer.targetX}, ${customer.targetY})`);
    }
    
    // 🎯 将已完成餐食移动到餐盘
    moveCompletedFoodToPlate(food, index) {
        console.log('🍽️ 开始移动餐食到餐盘：', food, 'index:', index);
        console.log('🍽️ 当前completedFood数组长度：', this.gameState.completedFood.length);
        console.log('🍽️ 当前completedFood数组：', this.gameState.completedFood);
        console.log('🍽️ 当前餐盘数组长度：', this.gameState.currentPlate.length);
        console.log('🍽️ 当前餐盘数组：', this.gameState.currentPlate);
        
        // 检查索引是否有效
        if (index < 0 || index >= this.gameState.completedFood.length) {
            console.error('无效的餐食索引：', index);
            this.showNotification('移动餐食失败：索引无效', 2000);
            return;
        }
        
        // 从成品槽移除
        this.gameState.completedFood.splice(index, 1);
        console.log('餐食已从completedFood移除，剩余：', this.gameState.completedFood);
        
        // 添加到餐盘
        this.gameState.currentPlate.push(food);
        console.log('餐食已添加到餐盘，当前餐盘：', this.gameState.currentPlate);
        
        // 更新UI
        this.updateSidebar();
    }
    
    // 🎯 将餐盘食物移回成品槽
    movePlateFoodToCompleted(food, index) {
        // 从餐盘移除
        this.gameState.currentPlate.splice(index, 1);
        
        // 添加到成品槽
        this.gameState.completedFood.push(food);
        
        // 更新UI
        this.updateSidebar();
    }
    
    // 处理查看餐盘功能
    handleServePlate() {
        if (this.gameState.currentView !== 'main') {
                this.switchView('main');
            this.showNotification('已切换到大厅，拖拽餐盘到顾客身上交餐！');
        } else {
            this.showNotification('在大厅界面拖拽餐盘到顾客身上交餐！');
        }
    }

    switchView(viewName) {
        // 🎯 如果点击的是当前界面，直接返回，不触发卷帘门动画
        if (viewName === this.gameState.currentView) {
            return;
        }

        // 🎯 如果是在四个界面之间切换，启动卷帘门动画并延迟界面切换
        const validViews = ['main', 'youtiao', 'doujiang', 'congee'];
        if (validViews.includes(viewName) && validViews.includes(this.gameState.currentView)) {
            // 存储目标界面名称，稍后在停顿阶段进行切换
            this.gameState.juanLianMenState.targetView = viewName;
            this.startJuanLianMenViewSwitchAnimation();
            return; // 立即返回，不执行界面切换
        }
        
        // 执行实际的界面切换
        this.performViewSwitch(viewName);
    }

    // 🎯 新增：执行实际的界面切换逻辑
    performViewSwitch(viewName) {
        // 🎯 删除视图切换日志
        // console.log('Switching view from', this.gameState.currentView, 'to', viewName);
        this.gameState.currentView = viewName;
        
        // 更新按钮状态
        document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.getElementById('view' + viewName.charAt(0).toUpperCase() + viewName.slice(1));
        if (activeBtn) {
            activeBtn.classList.add('active');
            console.log('Active button updated:', activeBtn.id);
        } else {
            console.error('Active button not found for view:', viewName);
        }
        
        // 显示/隐藏相关UI
        this.updateViewUI();

        // 切换视图后更新背景音乐音量
        this.updateBGMVolume();
        
        // 当切换到大厅界面时，提示交餐方式
        if (viewName === 'main') {
            const waitingCustomers = this.gameState.customers.filter(c => 
                c.hasOrdered && c.state === 'waiting'
            );
            const plateItems = this.gameState.currentPlate.length;
            
            if (waitingCustomers.length > 0 && plateItems > 0) {
                this.showNotification(`现在可以拖拽餐盘中的食物到顾客身上交餐了！(${waitingCustomers.length}位顾客等待, 餐盘中${plateItems}个食物)`);
            } else if (waitingCustomers.length > 0) {
                this.showNotification(`有${waitingCustomers.length}位顾客在等待！请先制作食物并添加到餐盘，再拖拽到顾客身上交餐。`);
            }
        }
        
        // 强制重新渲染
        this.render();
        // 🎯 删除视图切换确认日志
        // console.log('View switched to:', this.gameState.currentView);
    }

    // 豆浆界面进入提示/环境音效（每次进入都强制从头播放）
    playDoujiangSFX() {
        try {
            if (!this.isAudioEnabled()) return;
            if (!this.doujiangAudio) {
                this.doujiangAudio = new Audio('audio/doujiang.mp3');
                this.doujiangAudio.volume = 0.8;
            }
            // 确保非静音，并强制从头播放
            this.doujiangAudio.muted = !this.isAudioEnabled();
            try { this.doujiangAudio.pause(); } catch(_) {}
            try { this.doujiangAudio.currentTime = 0; } catch(_) {}
            // Safari 某些情况下需要 load() 以重设解码
            try { if (this.doujiangAudio.readyState < 2) this.doujiangAudio.load(); } catch(_) {}
            const p = this.doujiangAudio.play();
            if (p && typeof p.catch === 'function') p.catch(()=>{});
        } catch (_) {}
    }

    switchAndStartCooking(foodType) {
        // 如果已在该视图，直接返回，不触发卷帘门动画
        if (this.gameState.currentView === foodType) {
            return;
        }
        // 首先切换到对应视图
        this.switchView(foodType);
        
        // 粥制作不自动开始，需要玩家手动点击
        if (foodType === 'congee') {
            this.showNotification('请点击粥锅开始制作', 3000);
            return;
        }
        
        // 其他食物延迟开始制作
        setTimeout(() => {
            this.startCooking(foodType);
        }, 100); // 短暂延迟确保视图切换完成
    }

    updateViewUI() {
        const actionButtons = document.getElementById('actionButtons');
        
        if (this.gameState.currentView === 'main') {
            if (actionButtons) actionButtons.style.display = 'flex';
        } else {
            if (actionButtons) actionButtons.style.display = 'none';
        }
    }

    handleClick(e) {
        if (this.gameState.isPaused) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // 调整坐标比例以匹配画布分辨率
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const adjustedX = x * scaleX;
        const adjustedY = y * scaleY;
        
        // 🎯 详细的坐标调试信息
        console.log(`🖱️ 鼠标坐标调试:`);
        console.log(`   原始点击: (${e.clientX}, ${e.clientY})`);
        console.log(`   Canvas边界: left=${rect.left.toFixed(1)}, top=${rect.top.toFixed(1)}, width=${rect.width.toFixed(1)}, height=${rect.height.toFixed(1)}`);
        console.log(`   相对坐标: (${x.toFixed(1)}, ${y.toFixed(1)})`);
        console.log(`   缩放比例: scaleX=${scaleX.toFixed(3)}, scaleY=${scaleY.toFixed(3)}`);
        console.log(`   最终坐标: (${adjustedX.toFixed(1)}, ${adjustedY.toFixed(1)})`);
        console.log(`   Canvas尺寸: ${this.canvas.width} x ${this.canvas.height}`);
        
        if (this.gameState.currentView === 'main') {
            this.checkCustomerClick(adjustedX, adjustedY);
            this.checkTableClick(adjustedX, adjustedY);
            this.checkKitchenClick(adjustedX, adjustedY);
        } else {
            // 在制作区界面的特殊交互
            this.handleWorkspaceClick(adjustedX, adjustedY);
        }
    }

    handleWorkspaceClick(x, y) {
        const view = this.gameState.currentView;
        
        if (view === 'youtiao') {
            // 油条制作区的特殊交互
            // 动态计算面团台区域（基于miantuan图片的偏上位置）
            const miantuanPos = this.getMiantuanPosition();
            const doughAreaX = miantuanPos.x;
            const doughAreaY = miantuanPos.y;
            const doughAreaWidth = miantuanPos.width;
            const doughAreaHeight = miantuanPos.height * 0.6; // 只使用上部分60%的区域
            
            if (x >= doughAreaX && x <= doughAreaX + doughAreaWidth && 
                y >= doughAreaY && y <= doughAreaY + doughAreaHeight) {
                // 面团准备台区域（贴合miantuan图片偏上位置）
                if (this.gameState.youtiaoState.currentStep === 'idle') {
                    this.startYoutiaoPreparation();
                } else if (this.gameState.youtiaoState.currentStep === 'kneading') {
                    this.showNotification('请用鼠标画圈揉面团（需要2圈）');
                } else if (this.gameState.youtiaoState.currentStep === 'stretching') {
                    this.showNotification('请用鼠标上下移动拉伸面团');
                } else if (this.gameState.youtiaoState.currentStep === 'ready_to_fry') {
                    // 🎯 面团制作完成，可以拖拽到油锅
                    this.startDoughDrag(x, y);
                }
                } else {
                // 动态计算油锅区域
                const youguoPos = this.getYouguoPosition();
                if (x >= youguoPos.x && x <= youguoPos.x + youguoPos.width && 
                    y >= youguoPos.y && y <= youguoPos.y + youguoPos.height) {
                // 油锅区域 - 🎯 修改为不再直接点击下锅
                if (this.gameState.youtiaoState.youtiaoInOil.length > 0) {
                    // 检查是否点击了熟透的油条来拖拽
                    this.handleYoutiaoClick(x, y);
                } else {
                    this.showNotification('请先制作面团，然后拖拽到油锅下锅');
                }
                } else {
                    // 🎯 移除批量收集功能 - 只保留单个收集
                    this.showNotification('请拖拽单根油条收集，或制作新的面团');
                }
            }
        } else if (view === 'doujiang') {
            // 豆浆制作区的特殊交互
            if (x >= 400 && x <= 1200 && y >= 780 && y <= 1080) {
                this.showNotification('请长按空格键制作豆浆', 2000);
            } else {
                // 检查bucket收集区域（动态位置）
                const bucketPos = this.getBucketPosition();
                if (x >= bucketPos.x && x <= bucketPos.x + bucketPos.width && 
                    y >= bucketPos.y && y <= bucketPos.y + bucketPos.height) {
                    this.showNotification('收集桶 - 制作完成的豆浆会自动放到成品槽', 2000);
                }
            }
        } else if (view === 'congee') {
            // 🎯 重新设计的粥制作区交互逻辑
            this.handleCongeeClick(x, y);
        }
    }

    // 🎯 新的粥菜制作点击处理逻辑
    handleCongeeClick(x, y) {
        const sideItemPositions = this.getSideItemPositions();
        const dianfanbaoItem = sideItemPositions.find(item => item.name === '点饭包');
        const zhouItem = sideItemPositions.find(item => item.name === '粥');
        const configItems = sideItemPositions.filter(item => 
            ['咸菜', '咸蛋', '黄豆', '豆腐'].includes(item.name)
        );

        const currentStep = this.gameState.congeeState.currentStep;

        // 步骤1：点击电饭煲 (dianfanbao)
        if (currentStep === 'idle' && dianfanbaoItem && this.isPointInRect(x, y, dianfanbaoItem)) {
            this.gameState.congeeState.currentStep = 'dianfanbao_clicked';
            this.showNotification('✅ 电饭煲已启动！现在点击粥开始制作', 2000);
            return;
        }

        // 步骤2：点击粥 (zhou)
        if (currentStep === 'dianfanbao_clicked' && zhouItem && this.isPointInRect(x, y, zhouItem)) {
            this.gameState.congeeState.currentStep = 'zhou_ready';
            this.gameState.congeeState.congeeInProgress = {
                id: Date.now(),
                sides: []
            };
            // 🎯 刷新粥菜工作空间以更新粥的显示状态（从kongzhou切换为zhou）
            this.refreshCongeeWorkspace();
            this.showNotification('✅ 粥底已准备！现在点击配菜进行选择', 2000);
            return;
        }

        // 步骤3&4：点击选择配菜
        if (currentStep === 'zhou_ready' || currentStep === 'selecting_sides') {
            for (const configItem of configItems) {
                if (this.isPointInRect(x, y, configItem)) {
                    this.addSideToCongee(configItem.name);
                    return;
                }
            }
        }

                 // 🎯 检查完成按钮点击（界面下方的完成按钮）
         if (currentStep === 'selecting_sides') {
             const tablePos = this.getZhoucaizhuoPosition();
             const buttonWidth = 80;
             const buttonHeight = 35;
             const buttonX = tablePos.x + (tablePos.width - buttonWidth) / 2;
             const buttonY = tablePos.y + tablePos.height + 15;
             
             if (x >= buttonX && x <= buttonX + buttonWidth && 
                 y >= buttonY && y <= buttonY + buttonHeight) {
                 this.finalizeCongee();
                 return;
             }
         }

         // 点击粥完成制作（备用方式）
         if (currentStep === 'selecting_sides' && zhouItem && this.isPointInRect(x, y, zhouItem)) {
             this.finalizeCongee();
             return;
         }

        // 错误的点击顺序提示
        if (currentStep === 'idle') {
            this.showNotification('请先点击电饭煲开始制作！', 2000);
        } else if (currentStep === 'dianfanbao_clicked') {
            this.showNotification('请点击粥开始制作粥底！', 2000);
        } else if (currentStep === 'zhou_ready') {
                         this.showNotification('请选择配菜，然后点击完成按钮制作！', 2000);
        }
    }

    // 🎯 检查点是否在矩形区域内
    isPointInRect(x, y, item) {
        return x >= item.x && x <= item.x + item.width && 
               y >= item.y && y <= item.y + item.height;
    }

    // 🎯 添加配菜到粥中
    addSideToCongee(sideName) {
        const congee = this.gameState.congeeState.congeeInProgress;
        if (!congee) return;

        // 检查是否已经添加过这个配菜
        if (congee.sides.includes(sideName)) {
            this.showNotification(`${sideName}已经添加过了！`, 1500);
            return;
        }

        // 添加配菜
        congee.sides.push(sideName);
        this.gameState.congeeState.currentStep = 'selecting_sides';
        this.showNotification(`✅ 添加了${sideName}！点击粥完成制作或继续添加配菜`, 2000);
        // 立即刷新以显示叠加效果
        this.refreshCongeeWorkspace();
    }

    // 🎯 完成粥的制作
    finalizeCongee() {
        const congee = this.gameState.congeeState.congeeInProgress;
        if (!congee) return;

        if (congee.sides.length === 0) {
            this.showNotification('请至少选择一种配菜！', 2000);
            return;
        }

        // 将完成的粥添加到完成列表
        const completedCongee = {
            id: congee.id,
            type: 'congee',
            sides: congee.sides.slice(), // 复制数组
            createdAt: Date.now(),
            draggable: true
        };

        this.gameState.congeeState.completedCongee.push(completedCongee);
        
        // 🎯 将完成的粥菜添加到主要的完成食物列表（侧边栏显示）
        this.gameState.completedFood.push(completedCongee);
        
        // 重置状态
        this.gameState.congeeState.currentStep = 'idle';
        this.gameState.congeeState.congeeInProgress = null;
        
        // 🎯 刷新粥菜工作空间以更新粥的显示状态（从zhou切换为kongzhou）
        this.refreshCongeeWorkspace();
        
        // 更新侧边栏显示
        this.updateCompletedFoodArea();
        
        this.showNotification(`✅ 粥制作完成！配菜：${congee.sides.join('、')}。已放入成品区！`, 3000);
    }

    // 🎯 检查点击的是否是完成的粥
    checkCompletedCongeeClick(x, y) {
        const completedCongee = this.gameState.congeeState.completedCongee;
        if (completedCongee.length === 0) return null;

        const zhouImagePos = this.getZhouImagePosition();
        if (!zhouImagePos) return null;

        for (let index = 0; index < completedCongee.length; index++) {
            const congee = completedCongee[index];
            const offsetX = index * 60;
            const offsetY = index * 30;
            const congeeX = zhouImagePos.x + offsetX;
            const congeeY = zhouImagePos.y - 50 + offsetY;
            const congeeWidth = 40;
            const congeeHeight = 30;

            if (x >= congeeX && x <= congeeX + congeeWidth && 
                y >= congeeY && y <= congeeY + congeeHeight) {
                return { congee, index };
            }
        }
        return null;
    }

    // 🎯 开始拖拽完成的粥
    startCongeeDrag(e, congee, index) {
        this.dragState.isDragging = true;
        this.dragState.draggedItem = { 
            congee, 
            index, 
            source: 'completed_congee',
            type: 'congee'
        };
        this.dragState.startX = e.clientX;
        this.dragState.startY = e.clientY;

        // 创建拖拽的视觉元素
        const dragElement = document.createElement('div');
        dragElement.style.cssText = `
            position: fixed;
            pointer-events: none;
            z-index: 9999;
            width: 40px;
            height: 30px;
            background: linear-gradient(to bottom, #F5F5DC, #DDD);
            border: 2px solid #8B4513;
            border-radius: 5px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            color: #000;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        `;
        dragElement.style.left = (e.clientX - 20) + 'px';
        dragElement.style.top = (e.clientY - 15) + 'px';
        dragElement.classList.add('dragging');
        dragElement.innerHTML = '🍚';

        document.body.appendChild(dragElement);
        this.dragState.draggedElement = dragElement;

        this.showNotification(`拖拽粥配菜到餐盘！配菜：${congee.sides.join('、')}`, 2000);
    }

    // 🎯 处理粥拖拽到餐盘
    handleCongeeDropToPlate(draggedItem) {
        const congee = draggedItem.congee;
        const index = draggedItem.index;

        // 创建餐盘食物对象
        const plateFood = {
            type: 'congee',
            sides: congee.sides.slice(), // 复制配菜数组
            id: congee.id,
            createdAt: Date.now()
        };

        // 添加到餐盘
        this.gameState.currentPlate.push(plateFood);

        // 从完成列表中移除
        this.gameState.congeeState.completedCongee.splice(index, 1);

        // 更新餐盘显示
        this.updatePlateDisplay();
        
        // 更新侧边栏
        this.updateSidebar();

        this.showNotification(`✅ 粥配菜已添加到餐盘！配菜：${congee.sides.join('、')}`, 2500);
        }
    
    // 🎯 检查点击位置是否在豆浆碗上
    checkDoujiangBowlClick(x, y) {
        // 🎯 直接使用renderDoujiangEffects中绘制绿色方块的坐标作为判定区域
        const tablePos = this.getDoujiangzhuoPosition();
        const doujiangItems = this.gameState.cookingItems.filter(item => item.type === 'doujiang');
        
        const cupSpacing = 150;
        const leftOffset = 50;
        const startX = tablePos.x + leftOffset;
        
        // 🎯 支持两行x三列布局的点击检测，最多6个
        const maxToCheck = Math.min(doujiangItems.length, 6);
        for (let i = 0; i < maxToCheck; i++) {
            const item = doujiangItems[i];
            const row = Math.floor(i / 3);
            const col = i % 3;
            const cupX = startX + col * cupSpacing;
            const baseY = tablePos.y - 15;
            const rowGap = 110;
            const cupY = baseY + row * rowGap;
            
            // 🎯 使用分级素材 doujiang1-4（1空，4满）
            let level = 1;
            if (item.progress >= 0.75) level = 4; else if (item.progress >= 0.5) level = 3; else if (item.progress >= 0.25) level = 2; else level = 1;
            const key = `doujiang${level}Image`;
            const currentImage = this.doujiangBowlImages && this.doujiangBowlImages[key];
            
            if (!currentImage || !currentImage.complete) {
                console.warn(`豆浆碗图片 ${key} 未正确加载，跳过判定`);
                continue; // 跳过未加载的豆浆碗
            }
            
            const assetScale = 0.85;
            const bowlWidth = currentImage.width * this.backgroundScaleX * assetScale;
            const bowlHeight = currentImage.height * this.backgroundScaleY * assetScale;
            
            // 🎯 判定区域与绿框完全一致
            const greenBoxLeft = cupX;
            const greenBoxRight = cupX + bowlWidth;
            const greenBoxTop = cupY;
            const greenBoxBottom = cupY + bowlHeight;
            
            console.log(`🔍 豆浆碗${i} 判定区域: [${greenBoxLeft.toFixed(1)}, ${greenBoxRight.toFixed(1)}, ${greenBoxTop.toFixed(1)}, ${greenBoxBottom.toFixed(1)}], 点击位置: [${x.toFixed(1)}, ${y.toFixed(1)}]`);
            
            // 🎯 使用与绿框完全一致的判定区域
            if (x >= greenBoxLeft && x <= greenBoxRight && 
                y >= greenBoxTop && y <= greenBoxBottom && 
                item.progress < 1.0) {
                console.log(`✅ 成功点击豆浆碗${i}判定区域！`);
                // 🎯 切换豆浆桌材质为 doujiangzhuo2
                this.gameState.doujiangzhuoUseAlt = true;
                this.sprites.doujiangWorkspace = this.createDoujiangWorkspace();
                this.render();
                return { bowl: item, index: i };
            }
        }
        
        // 🎯 检查wandui点击，用于添加新的空碗
        const wanduiResult = this.checkWanduiClick(x, y);
        if (wanduiResult) {
            if (doujiangItems.length < 6) {
                return { bowl: null, index: doujiangItems.length }; // 新碗（最多6个）
            } else {
                // 已达到最大碗数，给出提示但不添加新碗
                console.log('已达到最大碗数(6个)，无法添加新碗');
                return null;
            }
        }
        
        // 未点中任何碗：恢复豆浆桌到默认材质
        if (this.gameState.doujiangzhuoUseAlt) {
            this.gameState.doujiangzhuoUseAlt = false;
            this.sprites.doujiangWorkspace = this.createDoujiangWorkspace();
            this.render();
        }
        return null;
    }

    // 🎯 检查wandui（碗堆）点击
    checkWanduiClick(x, y) {
        // 只有在豆浆界面才能检测wandui点击
        if (this.gameState.currentView !== 'doujiang') {
            return false;
        }
        
        // 检查wandui图片是否加载完成
        if (!this.wanduiImage || !this.wanduiImage.complete) {
            console.warn('Wandui图片未加载完成，跳过点击检测');
            return false;
        }
        
        // 计算wandui的位置：第四个碗的右边35px，位于第一排旁（两排布局仍参考第一排）
        const tablePos = this.getDoujiangzhuoPosition();
        const cupSpacing = 150;
        const leftOffset = 50;
        const startX = tablePos.x + leftOffset;
        
        // 第四个碗的位置（index 3，第一排）
        const fourthBowlX = startX + 3 * cupSpacing;
        const fourthBowlY = tablePos.y - 15;
        
        // wandui的位置
        const wanduiX = fourthBowlX + 35; // 右边35px
        const wanduiY = fourthBowlY - 110; // 上方110px
        
        // 计算wandui的尺寸
        const assetScale = 0.85;
        const wanduiWidth = this.wanduiImage.width * this.backgroundScaleX * assetScale;
        const wanduiHeight = this.wanduiImage.height * this.backgroundScaleY * assetScale;
        
        // 判定区域
        const wanduiLeft = wanduiX;
        const wanduiRight = wanduiX + wanduiWidth;
        const wanduiTop = wanduiY;
        const wanduiBottom = wanduiY + wanduiHeight;
        
        console.log(`🔍 Wandui点击检测: [${wanduiLeft.toFixed(1)}, ${wanduiRight.toFixed(1)}, ${wanduiTop.toFixed(1)}, ${wanduiBottom.toFixed(1)}], 点击位置: [${x.toFixed(1)}, ${y.toFixed(1)}]`);
        
        // 检查点击是否在wandui范围内
        if (x >= wanduiLeft && x <= wanduiRight && 
            y >= wanduiTop && y <= wanduiBottom) {
            console.log('✅ 成功点击wandui！');
            return true;
        }
        
        return false;
    }

    startPouring(item) {
        if (!item.isPourHeld) {
            item.isPourHeld = true;
            item.pourStartTime = Date.now();
            this.showNotification('正在倒豆浆...松开鼠标停止', 1000);
        }
    }

    // 🎯 开始长按添加豆浆
    startDoujiangPouring(bowl, index) {
        if (bowl === null) {
            // 🎯 通过wandui点击添加新的空碗
            const newItem = {
                id: Date.now() + Math.random(),
                type: 'doujiang',
                startTime: Date.now(),
                cookTime: 0, // 即时完成，不需要制作时间
                progress: 0.01, // 从1%开始，显示为空碗
                status: 'empty',
                isMaking: false,
                isPourHeld: false, // 🎯 不立即开始制作
                pourStartTime: null,
                quality: 'perfect'
            };
            this.gameState.cookingItems.push(newItem);
            // 开始倒豆浆音效
            this.playDoujiangSFX();
            this.showNotification('添加了一个新碗！点击碗开始制作豆浆', 2000);
        } else {
            // 继续添加到现有碗
            if (bowl.progress <= 0.02) {
                // 🎯 空碗首次点击，开始制作豆浆
                bowl.progress = 0.1; // 从10%开始
                bowl.status = 'cooking';
            }
            bowl.isPourHeld = true;
            bowl.pourStartTime = Date.now();
            // 开始倒豆浆音效
            this.playDoujiangSFX();
            this.showNotification('继续添加豆浆...松开鼠标停止', 1000);
        }
    }
    
    // 🎯 停止添加豆浆
    stopDoujiangPouring() {
        // 先收集要完成的豆浆项目
        const completedItems = [];
        
        this.gameState.cookingItems.forEach(item => {
            if (item.type === 'doujiang' && item.isPourHeld) {
                item.isPourHeld = false;
                
                // 检查是否已满（100%）
                if (item.progress >= 1.0) {
                    completedItems.push(item);
                }
            }
        });
        
        // 处理完成的豆浆项目（直接加入完成餐食）
        completedItems.forEach(item => {
            // 豆浆已满，移动到完成食物
            item.status = 'completed';
            this.gameState.completedFood.push(item);
        });

        // 停止并重置豆浆音效，便于下次再次播放
        if (this.doujiangAudio) {
            try { this.doujiangAudio.pause(); } catch(_) {}
            try { this.doujiangAudio.currentTime = 0; } catch(_) {}
        }
        
        // 安全地从cookingItems中移除所有完成的豆浆（使用反向循环）
        for (let i = this.gameState.cookingItems.length - 1; i >= 0; i--) {
            const item = this.gameState.cookingItems[i];
            if (completedItems.includes(item)) {
                this.gameState.cookingItems.splice(i, 1);
                console.log(`🍽️ 豆浆制作完成，已移除cookingItem索引: ${i}, 剩余: ${this.gameState.cookingItems.length}`);
            }
        }
        
        // 统一更新UI和通知
        if (completedItems.length > 0) {
            this.showNotification(`豆浆制作完成！${completedItems.length}碗已加入完成食物`, 2000);
            this.updateSidebar();
        }
    }

    stopPouring() {
        this.gameState.cookingItems.forEach(item => {
            if (item.type === 'doujiang' && item.isPourHeld) {
                item.isPourHeld = false;
            }
        });
    }

    checkCustomerClick(x, y) {
        this.gameState.customers.forEach(customer => {
            const customerWidth = customer.width || 180;
            const customerHeight = customer.height || 360;
            
            console.log(`Checking customer at (${customer.x}, ${customer.y}) size ${customerWidth}x${customerHeight} vs click (${x}, ${y})`);
            console.log(`Customer state: ${customer.state}, hasOrdered: ${customer.hasOrdered}, id: ${customer.id}`);
            
            if (x >= customer.x && x <= customer.x + customerWidth && 
                y >= customer.y && y <= customer.y + customerHeight) {
                console.log('🎯 顾客被点击！状态检查：', {
                    state: customer.state,
                    hasOrdered: customer.hasOrdered,
                    canOrder: customer.state === 'waiting' && !customer.hasOrdered
                });
                
                if (customer.state === 'waiting' && !customer.hasOrdered) {
                    console.log('✅ 顾客可以下单，正在处理订单...');
                this.takeOrder(customer);
                } else {
                    console.log('❌ 顾客不能下单，原因：', 
                        customer.state !== 'waiting' ? `状态不是waiting(当前：${customer.state})` : '已经下过单了');
                }
            }
        });
    }

    // 🎯 检测 hu2 点击：用于选择/取消选择豆浆壶
    checkHu2Click(x, y) {
        try {
            const b = this._hu2RenderBounds;
            if (!b) return false;
            // b.x/b.y 为绘制左上角坐标
            const within = x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
            return !!within;
        } catch (_) { return false; }
    }

    checkTableClick(x, y) {
        this.gameState.tables.forEach(table => {
            if (x >= table.x && x <= table.x + 120 && 
                y >= table.y && y <= table.y + 80 && 
                table.needsCleaning) {
                this.cleanTable(table);
            }
        });
    }

    checkKitchenClick(x, y) {
        if (this.isPointInRect(x, y, this.kitchen.stove)) {
            this.showNotification('点击左侧按钮切换到制作区');
        } else if (this.isPointInRect(x, y, this.kitchen.counter)) {
            this.showNotification('请使用成品槽和餐盘系统');
        }
    }

    isPointInRect(x, y, rect) {
        return x >= rect.x && x <= rect.x + rect.width && 
               y >= rect.y && y <= rect.y + rect.height;
    }

    startDay() {
        console.log('Starting day...');
        // 素材校验：缺少 yingye 素材时禁止开始
        if (!this.assetsReady || !this.assetsReady.yingye) {
            this.showNotification('游戏尚未准备好');
            return;
        }
        if (!this.gameState.isRunning) {
            this.gameState.isRunning = true;
            this.gameState.phase = 'morning';
            this.timeLeft = this.config.dayDuration;
            // 强制切换到大厅界面
            try { this.performViewSwitch('main'); } catch (_) {}
            
            const startBtn = document.getElementById('startDay');
            if (startBtn) {
                startBtn.disabled = true;
                startBtn.textContent = '🔄 营业中...';
            }
            
            this.showNotification('早餐店开始营业！欢迎顾客光临');
            
            // 启动卷帘门动画
            this.startJuanLianMenAnimation();
            
            // 立即生成第一个顾客
            setTimeout(() => {
                this.spawnCustomer();
                this.spawnCustomer();
            }, 2000);
        }
    }

    startJuanLianMenAnimation() {
        console.log('启动卷帘门上升动画');
        this.gameState.juanLianMenState.isVisible = true;
        this.gameState.juanLianMenState.isAnimating = true;
        this.gameState.juanLianMenState.animationStartTime = Date.now();
        this.gameState.juanLianMenState.position = 0; // 从完全遮挡开始
        this.gameState.juanLianMenState.animationDuration = 500; // 0.5秒
        this.gameState.juanLianMenState.animationType = 'up'; // 上升动画
        // 遮挡UI
        const ui = document.getElementById('ui');
        if (ui) ui.style.zIndex = '100';
        const canvasEl = document.getElementById('gameCanvas');
        if (canvasEl) canvasEl.style.zIndex = '500';
        const viewControls = document.getElementById('viewControls');
        if (viewControls) viewControls.style.pointerEvents = 'none';
        // 隐藏右侧三个栏与下方四个按钮
        const mainUI = document.getElementById('mainUI');
        if (mainUI) mainUI.style.visibility = 'hidden';
        if (viewControls) viewControls.style.visibility = 'hidden';

        // 播放卷帘门音效
        this.playShutterSFX();
    }

    // 🎯 新增：界面切换时的卷帘门动画序列（下降-停顿-上升）
    startJuanLianMenViewSwitchAnimation() {
        console.log('启动卷帘门界面切换动画序列');
        this.gameState.juanLianMenState.isVisible = true;
        this.gameState.juanLianMenState.isAnimating = true;
        this.gameState.juanLianMenState.animationStartTime = Date.now();
        this.gameState.juanLianMenState.position = 1; // 从完全移出开始
        this.gameState.juanLianMenState.animationType = 'viewSwitch'; // 界面切换动画
        this.gameState.juanLianMenState.phase = 'down'; // 下降阶段
        this.gameState.juanLianMenState.viewSwitched = false; // 重置界面切换标志
        
        // 动画阶段时长（毫秒）- 加快速度
        this.gameState.juanLianMenState.downDuration = 300; // 下降0.3秒
        this.gameState.juanLianMenState.pauseDuration = 50; // 停顿0.05秒
        this.gameState.juanLianMenState.upDuration = 300; // 上升0.3秒
        // 遮挡UI
        const ui = document.getElementById('ui');
        if (ui) ui.style.zIndex = '100';
        const canvasEl = document.getElementById('gameCanvas');
        if (canvasEl) canvasEl.style.zIndex = '500';
        const viewControls = document.getElementById('viewControls');
        if (viewControls) viewControls.style.pointerEvents = 'none';
        // 隐藏右侧三个栏与下方四个按钮
        const mainUI = document.getElementById('mainUI');
        if (mainUI) mainUI.style.visibility = 'hidden';
        if (viewControls) viewControls.style.visibility = 'hidden';

        // 播放卷帘门音效
        this.playShutterSFX();
    }

    updateJuanLianMenAnimation() {
        if (!this.gameState.juanLianMenState.isAnimating) {
            return;
        }

        const currentTime = Date.now();
        const elapsed = currentTime - this.gameState.juanLianMenState.animationStartTime;

        if (this.gameState.juanLianMenState.animationType === 'up') {
            // 开始营业时的上升动画
            const progress = Math.min(elapsed / this.gameState.juanLianMenState.animationDuration, 1);
        // 使用缓入缓出动画效果
        const easeInOut = 0.5 * (1 - Math.cos(Math.PI * progress));
        this.gameState.juanLianMenState.position = easeInOut;

        // 动画完成
        if (progress >= 1) {
            this.gameState.juanLianMenState.isAnimating = false;
            this.gameState.juanLianMenState.isVisible = false; // 完全移出界面后消失
                console.log('卷帘门上升动画完成，卷帘门已消失');
                    // 恢复UI层级与交互
                    const ui = document.getElementById('ui');
                    if (ui) ui.style.zIndex = '450';
                    const canvasEl = document.getElementById('gameCanvas');
                    if (canvasEl) canvasEl.style.zIndex = '';
                    const viewControls = document.getElementById('viewControls');
                    if (viewControls) {
                        viewControls.style.pointerEvents = 'auto';
                        viewControls.style.visibility = '';
                    }
                    const mainUI = document.getElementById('mainUI');
                    if (mainUI) mainUI.style.visibility = '';
            }
        } else if (this.gameState.juanLianMenState.animationType === 'viewSwitch') {
            // 界面切换时的三阶段动画
            const downDuration = this.gameState.juanLianMenState.downDuration;
            const pauseDuration = this.gameState.juanLianMenState.pauseDuration;
            const upDuration = this.gameState.juanLianMenState.upDuration;
            
            if (this.gameState.juanLianMenState.phase === 'down') {
                // 下降阶段：从1到0
                const progress = Math.min(elapsed / downDuration, 1);
                const easeInOut = 0.5 * (1 - Math.cos(Math.PI * progress));
                this.gameState.juanLianMenState.position = 1 - easeInOut;
                
                if (progress >= 1) {
                    this.gameState.juanLianMenState.phase = 'pause';
                    this.gameState.juanLianMenState.animationStartTime = currentTime; // 重置时间
                    console.log('卷帘门下降完成，开始停顿');
                }
            } else if (this.gameState.juanLianMenState.phase === 'pause') {
                // 停顿阶段：保持在0位置
                this.gameState.juanLianMenState.position = 0;
                
                // 🎯 在停顿阶段的中间执行界面切换
                if (!this.gameState.juanLianMenState.viewSwitched && 
                    this.gameState.juanLianMenState.targetView && 
                    elapsed >= pauseDuration / 2) {
                    console.log('在卷帘门遮挡时执行界面切换:', this.gameState.juanLianMenState.targetView);
                    this.performViewSwitch(this.gameState.juanLianMenState.targetView);
                    this.gameState.juanLianMenState.viewSwitched = true;
                    // 如果这是日终场景，且设置了待显示结算，则在切换后立即显示结算框
                    if (this._pendingShowSummaryAfterShutter && this.gameState.juanLianMenState.targetView === 'summary') {
                        this._pendingShowSummaryAfterShutter = false;
                        // 保证在完全遮挡的一瞬间显示
                        setTimeout(() => this.showDaySummaryModal(), 0);
                    }
                }
                
                if (elapsed >= pauseDuration) {
                    this.gameState.juanLianMenState.phase = 'up';
                    this.gameState.juanLianMenState.animationStartTime = currentTime; // 重置时间
                    console.log('停顿完成，开始上升');
                }
            } else if (this.gameState.juanLianMenState.phase === 'up') {
                // 上升阶段：从0到1
                const progress = Math.min(elapsed / upDuration, 1);
                const easeInOut = 0.5 * (1 - Math.cos(Math.PI * progress));
                this.gameState.juanLianMenState.position = easeInOut;
                
                if (progress >= 1) {
                    this.gameState.juanLianMenState.isAnimating = false;
                    this.gameState.juanLianMenState.isVisible = false;
                    this.gameState.juanLianMenState.targetView = null; // 清理目标界面
                    this.gameState.juanLianMenState.viewSwitched = false; // 重置切换标志
                    console.log('卷帘门界面切换动画完成，卷帘门已消失');
                    // 动画结束恢复UI层级
                    const ui = document.getElementById('ui');
                    if (ui) ui.style.zIndex = '450';
                    const canvasEl = document.getElementById('gameCanvas');
                    if (canvasEl) canvasEl.style.zIndex = '';
                    const viewControls = document.getElementById('viewControls');
                    if (viewControls) {
                        viewControls.style.pointerEvents = 'auto';
                        viewControls.style.visibility = '';
                    }
                    const mainUI = document.getElementById('mainUI');
                    if (mainUI) mainUI.style.visibility = '';
                }
            }
        }
    }

    // togglePause() { /* 暂停按钮已移除 */ }

    showUpgrade() {
        console.log('showUpgrade called!');
        this.showNotification('升级系统开发中...', 2000);
    }

    cleanAllTables() {
        let cleaned = 0;
        this.gameState.tables.forEach(table => {
            if (table.needsCleaning) {
                this.cleanTable(table);
                cleaned++;
            }
        });
        
        if (cleaned === 0) {
            this.showNotification('没有需要清理的餐桌');
        } else {
            this.showNotification('清理了' + cleaned + '张餐桌！');
        }
    }

    // 获取实际游戏区域边界（基于desk图片的范围）
    getGameAreaBounds() {
        // 如果desk图片已加载并且有位置信息，使用desk的边界
        if (this.background1Width && this.background1Height && 
            this.background1OffsetX !== undefined && this.background1OffsetY !== undefined) {
            
            // 添加一些内边距，确保顾客不会贴边
            const padding = 50;
            
            return {
                minX: this.background1OffsetX + padding,
                maxX: this.background1OffsetX + this.background1Width - padding,
                minY: this.background1OffsetY + padding,
                maxY: this.background1OffsetY + this.background1Height - padding,
                width: this.background1Width - 2 * padding,
                height: this.background1Height - 2 * padding
            };
        } else {
            // 如果desk图片未加载，使用默认的游戏区域边界
            const uiPanelWidth = 280;
            const gameAreaWidth = this.canvas.width - uiPanelWidth;
            const gameAreaHeight = this.canvas.height;
            
            return {
                minX: 0,
                maxX: gameAreaWidth,
                minY: 0,
                maxY: gameAreaHeight,
                width: gameAreaWidth,
                height: gameAreaHeight
            };
        }
    }

    // 获取顾客专用的游戏区域边界（考虑顾客高度，确保最下沿不超出desk）
    getCustomerAreaBounds() {
        const gameArea = this.getGameAreaBounds();
        
        // 顾客标准尺寸
        // 使用素材原始尺寸，避免随desk缩放导致尺寸异常
        const customerHeight = 360;
        const customerWidth = 180;
        
        // 额外的安全边距
        const safetyMargin = 20;
        
        return {
            minX: gameArea.minX,
            maxX: gameArea.maxX - customerWidth - safetyMargin,
            minY: gameArea.minY,
            maxY: gameArea.maxY - customerHeight - safetyMargin, // 确保顾客最下沿不超出desk最下沿
            width: gameArea.width - customerWidth - safetyMargin,
            height: gameArea.height - customerHeight - safetyMargin,
            // 原始游戏区域信息（用于参考）
            originalMaxX: gameArea.maxX,
            originalMaxY: gameArea.maxY
        };
    }

    // 🎯 获取顾客统一行走的水平线Y坐标
    getCustomerWalkingLine() {
        const customerArea = this.getCustomerAreaBounds();
        const customerHeight = 360; // 原始像素高度
        
        // 计算一个安全的水平线位置
        // 选择desk区域中下部的位置，确保顾客最下沿不超出desk边界
        const walkingLineY = customerArea.originalMaxY - customerHeight - 30; // 距离底部30px的安全边距
        
        // 确保水平线不会太高（至少在desk中下部）
        const minWalkingY = customerArea.minY + customerArea.height * 0.6; // desk高度的60%处
        
        return Math.max(walkingLineY, minWalkingY);
    }

    // 🎯 获取水平线上的三个固定位置（左中
    getCustomerPositions() {
        const customerArea = this.getCustomerAreaBounds();
        const walkingLineY = this.getCustomerWalkingLine();
        
        // 计算三个位置的X坐标，确保间距合理且不重叠
        const totalWidth = customerArea.width;
        const customerWidth = 180; // 原始像素宽度
        const spacing = Math.max(200, (totalWidth - customerWidth * 3) / 4); // 至少200px间距
        
        // 左侧位置左移15px，中间位置左移8px
        const leftX = customerArea.minX + spacing - 15;
        const centerX = customerArea.minX + spacing + customerWidth + spacing - 8;
        const rightX = customerArea.minX + spacing + (customerWidth + spacing) * 2;
        
        return {
            left: { x: leftX, y: walkingLineY, id: 'left', occupied: false },
            center: { x: centerX, y: walkingLineY, id: 'center', occupied: false },
            right: { x: rightX, y: walkingLineY, id: 'right', occupied: false }
        };
    }

    // 🎯 检查并分配一个可用的顾客位置
    assignCustomerPosition() {
        const positions = this.getCustomerPositions();
        
        // 检查当前已占用的位置
        this.gameState.customers.forEach(customer => {
            if (customer.state === 'waiting' || customer.state === 'walking') {
                if (customer.assignedPosition) {
                    if (positions[customer.assignedPosition]) {
                        positions[customer.assignedPosition].occupied = true;
                    }
                }
            }
        });
        
        // 寻找第一个可用位置（优先级：center > left > right）
        const priorityOrder = ['center', 'left', 'right'];
        for (const positionId of priorityOrder) {
            if (!positions[positionId].occupied) {
                console.log(`🎯 分配位置: ${positionId} (${positions[positionId].x}, ${positions[positionId].y})`);
                return {
                    positionId: positionId,
                    x: positions[positionId].x,
                    y: positions[positionId].y
                };
            }
        }
        
        // 如果所有位置都被占用，返回等待队列位置
        console.log('⚠️ 所有位置已满，顾客将在队列中等待');
        const customerArea = this.getCustomerAreaBounds();
        const walkingLineY = this.getCustomerWalkingLine();
        return {
            positionId: 'queue',
            x: customerArea.minX - 150, // 队列位置在屏幕左侧
            y: walkingLineY
        };
    }

    // 🎯 释放顾客占用的位置
    releaseCustomerPosition(customer) {
        if (customer.assignedPosition && customer.assignedPosition !== 'queue') {
            console.log(`🎯 释放位置: ${customer.assignedPosition} (顾客 ${customer.id})`);
            
            // 清除顾客的位置标记
            customer.assignedPosition = null;
            customer.isInQueue = false;
            
            // 检查是否有在队列中等待的顾客，将其移动到可用位置
            this.moveQueueCustomerToPosition();
        }
    }

    // 🎯 将队列中的顾客移动到可用位置
    moveQueueCustomerToPosition() {
        const queueCustomers = this.gameState.customers.filter(c => 
            c.isInQueue && (c.state === 'waiting' || c.state === 'walking')
        );
        
        if (queueCustomers.length > 0) {
            // 为第一个队列顾客尝试分配新位置
            const firstQueueCustomer = queueCustomers[0];
            const newPosition = this.assignCustomerPosition();
            
            if (newPosition.positionId !== 'queue') {
                // 成功分配到固定位置
                firstQueueCustomer.targetX = newPosition.x;
                firstQueueCustomer.targetY = newPosition.y;
                firstQueueCustomer.assignedPosition = newPosition.positionId;
                firstQueueCustomer.isInQueue = false;
                firstQueueCustomer.state = 'walking'; // 重新开始移动
                // 🎯 重置到达时间，确保顾客到达新位置后能正常点餐
                firstQueueCustomer.arrivalTime = null;
                
                console.log(`🎯 队列顾客 ${firstQueueCustomer.id} 移动到 ${newPosition.positionId} 位置`);
            }
        }
    }

    spawnCustomer() {
        if (this.gameState.customers.length >= this.config.maxCustomers) return;
        
        console.log('重新设计的顾客寻路系统：生成顾客...');
        
        // 获取顾客专用的游戏区域边界
        const customerArea = this.getCustomerAreaBounds();
        
        // 生成顾客编号（基于当前总数+1）
        if (!this.gameState.customerIdCounter) {
            this.gameState.customerIdCounter = 1;
        }
        const customerId = this.gameState.customerIdCounter++;
        
        let customerType = Math.random() > 0.5 ? 'dineIn' : 'takeaway';
        const order = this.generateOrder();
        
        let targetTable = null;
        
        // 顾客尺寸
        const customerHeight = 360;
        const customerWidth = 180;
        
        // 🎯 使用统一的水平线和三个固定位置系统
        const walkingLineY = this.getCustomerWalkingLine();
        
        // 🎯 分配一个可用的位置（左中右三个位置之一）
        const assignedPosition = this.assignCustomerPosition();
        const targetX = assignedPosition.x;
        const targetY = assignedPosition.y;
        
        // 如果分配到队列位置，标记为队列状态
        const isInQueue = assignedPosition.positionId === 'queue';
        
        if (isInQueue) {
            console.log(`🎯 顾客 ${customerId} 被分配到等待队列`);
        } else {
            console.log(`🎯 顾客 ${customerId} 被分配到 ${assignedPosition.positionId} 位置 (${targetX}, ${targetY})`);
        }
        
        // 根据分配的位置确定顾客类型（为了兼容现有逻辑）
        if (assignedPosition.positionId === 'left' || assignedPosition.positionId === 'queue') {
            // 左侧和队列位置通常是外带顾客
            if (customerType === 'dineIn') {
                // 如果原本是堂食但被分配到左侧，检查是否有可用桌子
                const availableTable = this.gameState.tables.find(t => !t.occupied);
                if (!availableTable) {
                    customerType = 'takeaway'; // 没有桌子就转为外带
                } else {
                    availableTable.occupied = true;
                    targetTable = availableTable;
                }
            }
        } else {
            // 中间和右侧位置可以是堂食顾客
        if (customerType === 'dineIn') {
            const availableTable = this.gameState.tables.find(t => !t.occupied);
            if (availableTable) {
                availableTable.occupied = true;
                targetTable = availableTable;
            } else {
                    customerType = 'takeaway'; // 没有桌子就转为外带
                }
            }
        }
        
        // 为该顾客实例随机绑定一个sprite，避免全局同一张图
        const pickedSprite = this.pickCustomerSprite();
        const customer = {
            id: customerId,
            // 让顾客从可见左边界附近进入，避免卡在屏幕最左侧
            x: Math.min(-80, customerArea.minX - 90),
            y: walkingLineY, // 🎯 从水平线高度进入
            targetX: targetX,
            targetY: targetY, // 🎯 目标Y也是水平线
            type: customerType,
            order: order,
            patience: 180000 + Math.random() * 90000, // 180-270秒（大幅增加耐心值）
            maxPatience: 180000 + Math.random() * 90000,
            waitingForOrder: 22500 + Math.random() * 15000, // 22.5-37.5秒
            maxWaitingForOrder: 22500 + Math.random() * 15000,
            state: 'walking',
            hasOrdered: false,
            satisfaction: 100,
            table: targetTable,
            color: this.getRandomColor(),
            speed: 6 + Math.random() * 3,
            width: customerWidth,
            height: customerHeight,
            walkingLine: walkingLineY, // 🎯 记录水平线位置
            assignedPosition: assignedPosition.positionId, // 🎯 记录分配的位置
            isInQueue: isInQueue, // 🎯 标记是否在等待队列
            spriteKey: pickedSprite.key,
            spriteImg: pickedSprite.img
        };
        
        // 如果在队列中，设置一个临时的可见目标以避免停在屏幕外
        if (isInQueue) {
            customer.targetX = customerArea.minX + 20;
            customer.targetY = walkingLineY;
        }
        
        this.gameState.customers.push(customer);
        console.log(`🎯 顾客 ${customerId} 已生成 - 类型: ${customerType}, 位置: ${assignedPosition.positionId}, 目标: (${targetX}, ${targetY})`);
        console.log(`🎯 队列状态: ${isInQueue ? '等待中' : '已分配位置'}`);
        console.log(`🎯 水平线: Y=${walkingLineY}, 顾客最下沿: ${walkingLineY + customerHeight}, Desk最下沿: ${customerArea.originalMaxY}`);
        console.log(`🎯 顾客详细信息:`, {
            id: customer.id,
            state: customer.state,
            hasOrdered: customer.hasOrdered,
            orderItems: customer.order.items,
            patience: customer.patience
        });
    }

    generateOrder() {
        const itemsMap = new Map(); // 使用Map来合并相同类型的食物
        const foodTypes = ['youtiao', 'doujiang', 'congee'];
        const numItems = Math.floor(Math.random() * 3) + 1;
        
        for (let i = 0; i < numItems; i++) {
            const type = foodTypes[Math.floor(Math.random() * foodTypes.length)];
            
            // 🎯 如果是粥且已经有粥了，跳过
            if (type === 'congee' && itemsMap.has('congee')) {
                continue;
            }
            
            const quantity = type === 'congee' ? 1 : Math.floor(Math.random() * 2) + 1; // 粥固定为1份
            
            if (itemsMap.has(type)) {
                // 如果已存在该类型，增加数量（粥不会走这个分支）
                const existingItem = itemsMap.get(type);
                existingItem.quantity += quantity;
            } else {
                // 创建新的食物项
                const item = {
                    type: type,
                    quantity: quantity,
                    special: Math.random() < 0.2
                };
                
                // 🎯 如果是粥，添加小菜配菜（固定1份粥）
                if (type === 'congee') {
                    const sideOptions = ['咸菜', '豆腐', '咸蛋', '黄豆'];
                    const numSides = Math.floor(Math.random() * 2) + 1; // 1-2种小菜
                    item.sides = [];
                    
                    for (let j = 0; j < numSides; j++) {
                        const sideIndex = Math.floor(Math.random() * sideOptions.length);
                        const side = sideOptions[sideIndex];
                        if (!item.sides.includes(side)) {
                            item.sides.push(side);
                        }
                    }
                }
                
                itemsMap.set(type, item);
            }
        }
        
        // 将Map转换为数组
        const items = Array.from(itemsMap.values());
        
        const totalValue = items.reduce((sum, item) => 
            sum + this.config.foodPrices[item.type] * item.quantity, 0);
        
        return { items, totalValue, complexity: items.length > 2 ? 'complex' : 'simple' };
    }

    getRandomColor() {
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    takeOrder(customer) {
        console.log(`🎯 开始接单 - 顾客 ${customer.id}, 原状态: hasOrdered=${customer.hasOrdered}, state=${customer.state}`);
        
        customer.hasOrdered = true;
        customer.state = 'waiting';
        
        console.log(`🎯 接单后状态 - 顾客 ${customer.id}, 新状态: hasOrdered=${customer.hasOrdered}, state=${customer.state}`);
        
        // 🎯 添加到待处理订单列表
        const newOrder = {
            customerId: customer.id,
            customer: customer,
            items: [...customer.order.items],
            startTime: Date.now(),
            status: 'pending',
            id: Date.now(),
            // 🎯 新增：订单耐心值系统（大幅增加耐心值）
            maxPatience: 120000, // 120秒最大耐心值（毫秒）
            currentPatience: 120000 // 当前耐心值
        };
        
        this.gameState.orders.push(newOrder);
        this.gameState.pendingOrders.push(newOrder);
        
        const orderDesc = customer.order.items.map(item => 
            this.getFoodName(item.type) + 'x' + item.quantity).join(', ');
        this.showNotification('新订单：' + orderDesc);
        
        console.log('新订单已添加：', newOrder);
        console.log('当前待处理订单数量：', this.gameState.pendingOrders.length);
        
        // 更新侧边栏订单区域
        this.updateSidebar();
    }

    startCooking(foodType) {
        // 油条不能一键制作，需要手动操作
        if (foodType === 'youtiao') {
            this.showNotification('油条需要手动制作！请点击面团准备台开始');
            return;
        }

        // 粥配菜不能一键制作，需要手动点击粥锅开始
        if (foodType === 'congee') {
            this.showNotification('粥配菜需要手动制作！请点击粥锅开始');
            return;
        }

        const cookingItem = {
            type: foodType,
            startTime: Date.now(),
            cookTime: this.config.cookTimes[foodType] * 1000,
            progress: 0,
            status: 'cooking',
            // 豆浆特殊状态
            isPouring: false,
            fillLevel: 0,
            pourStartTime: 0,
            isPourHeld: false
        };

        this.gameState.cookingItems.push(cookingItem);
        this.showNotification('开始制作' + this.getFoodName(foodType) + '...');
        
        // 注意：视图切换现在由switchAndStartCooking处理
    }

    serveFood() {
        if (this.gameState.completedFood.length === 0) {
            this.showNotification('没有可以上菜的食物！');
            return;
        }

        const food = this.gameState.completedFood.shift();
        const matchingOrders = this.gameState.orders.filter(order => 
            order.status === 'pending' && 
            order.items.some(item => item.type === food.type)
        );

        if (matchingOrders.length > 0) {
            const order = matchingOrders[0];
            const itemIndex = order.items.findIndex(item => item.type === food.type);
            
            if (itemIndex !== -1) {
                order.items[itemIndex].quantity--;
                if (order.items[itemIndex].quantity <= 0) {
                    order.items.splice(itemIndex, 1);
                }
                
                                    if (order.items.length === 0) {
                        order.status = 'completed';
                        order.customer.state = 'eating';
                    this.showNotification('订单完成！');
                    
                    if (order.customer.type === 'dineIn') {
                        setTimeout(() => {
                            this.releaseCustomerPosition(order.customer); // 🎯 释放位置
                            order.customer.state = 'leaving';
                            this.processPayment(order.customer);
                        }, 5000);
                    } else {
                        this.releaseCustomerPosition(order.customer); // 🎯 释放位置
                        order.customer.state = 'leaving';
                        this.processPayment(order.customer);
                    }
                }
            }
        }
    }

    processPayment(customer) {
        const payment = customer.order.totalValue * (customer.satisfaction / 100);
        const earnedMoney = Math.floor(payment);
        
        // 增加金钱
        this.gameState.money += earnedMoney;
        console.log('Payment processed:', earnedMoney, 'Total money:', this.gameState.money);
        
        const reputationGain = Math.floor(customer.satisfaction / 20);
        const oldReputation = this.gameState.reputation;
        this.gameState.reputation = Math.min(100, this.gameState.reputation + reputationGain);
        
        // 如果声誉有变化，立即检查升降级
        if (this.gameState.reputation !== oldReputation) {
            this.updateShopLevel();
        }
        
        if (customer.satisfaction > 80) {
            this.showNotification('顾客满意！获得¥' + earnedMoney);
        }
    }

    cleanTable(table) {
        table.needsCleaning = false;
        table.occupied = false;
        table.customer = null;
        
        this.gameState.money += 5;
        const oldReputation = this.gameState.reputation;
        this.gameState.reputation += 1;
        this.gameState.reputation = Math.min(100, this.gameState.reputation);
        
        // 检查升降级
        if (this.gameState.reputation !== oldReputation) {
            this.updateShopLevel();
        }
        
        this.showNotification('餐桌清理完成！+¥5');
    }

    getFoodName(type) {
        const names = {
            'youtiao': '油条',
            'doujiang': '豆浆',
            'congee': '粥配菜'
        };
        return names[type] || type;
    }



    // showTutorial() { /* 教程已移除 */ }

    // initTutorial() { /* 教程已移除 */ }

    // closeTutorial() { /* 教程已移除 */ }

    // 开始营业方法
    startDay() {
        console.log('Starting day...');
        
        // 防重复：已经在营业中则忽略
        if (this.gameState.isRunning) {
            this.showNotification('已经在营业中', 1500);
            const startBtnExisting = document.getElementById('startDay');
            if (startBtnExisting) {
                startBtnExisting.disabled = true;
                startBtnExisting.textContent = '🔄 营业中...';
            }
            return;
        }
        // 素材校验：缺少 yingye 素材时禁止开始
        if (!this.assetsReady || !this.assetsReady.yingye) {
            this.showNotification('游戏尚未准备好');
            return;
        }
        
        // 立即禁用按钮，防止快速重复点击
        const startBtn = document.getElementById('startDay');
        if (startBtn) {
            startBtn.disabled = true;
            startBtn.textContent = '🔄 营业中...';
            // 开始营业后隐藏按钮
            startBtn.style.display = 'none';
        }
        const topControls = document.getElementById('topGameControls');
        if (topControls) topControls.style.display = 'none';
        
        // 开始前：清空所有顾客与订单、进行区状态
        this.gameState.customers = [];
        this.gameState.orders = [];
        this.gameState.cookingItems = [];
        this.gameState.completedFood = [];
        if (this.gameState.tables && Array.isArray(this.gameState.tables)) {
            this.gameState.tables.forEach(table => {
                table.occupied = false;
                table.needsCleaning = false;
                table.customer = null;
            });
        }
        
        // 设置游戏为运行状态
        this.gameState.isRunning = true;
        this.gameState.isPaused = false;
        this.gameState.phase = 'morning';
        // 强制切回大厅界面
        try { this.performViewSwitch('main'); } catch (_) {}
        this.timeLeft = this.config.dayDuration;
        
        // 立即生成一位顾客
        this.spawnCustomer();
        
        // 显示通知
        this.showNotification('营业开始！欢迎第一位顾客！', 3000);
        
        // 🎯 立即启动卷帘门上升动画
        this.startJuanLianMenAnimation();

        // 🎵 开始营业后随机播放 jianggu（带淡入）
        this.playBackgroundMusic();
        
        // 更新UI
        this.updateUI();
        
        console.log('Day started successfully, customer spawned');
    }

    showNotification(message, duration) {
        duration = duration || 3000;
        const notification = document.getElementById('eventNotification');
        if (notification) {
            // 颜色判定：默认白色，包含✅/信息→白，提示/注意→黄色，错误/警告→红色
            const text = String(message || '');
            let colorClass = 'notif-white';
            const lower = text.toLowerCase();
            const isRed = /❌|错误|失败|超时|不耐烦|警告|over|too\s*late|timeout|error|fail/.test(text) || /red|danger/.test(lower);
            const isYellow = /提示|注意|警示|警告|请先|请/.test(text) || /warn|warning|tip/.test(lower);
            if (isRed) colorClass = 'notif-red'; else if (isYellow) colorClass = 'notif-yellow';

            notification.classList.remove('notif-white', 'notif-yellow', 'notif-red');
            notification.classList.add(colorClass);

            notification.textContent = text;
            notification.style.display = 'block';
            
            clearTimeout(this._notifTimer);
            this._notifTimer = setTimeout(() => {
                notification.style.display = 'none';
            }, duration);
        }
    }

    update(deltaTime) {
        // 卷帘门动画需要在未开始状态也能更新（用于开始前或暂停时的界面切换动画）
        this.updateJuanLianMenAnimation();

        if (this.gameState.isPaused || !this.gameState.isRunning) return;
        
        this.updateCustomers(deltaTime);
        this.updateCooking(deltaTime);
        this.updateYoutiaoInOil(); // 新增：更新油条炸制状态
        this.updatePendingYoutiao(); // 🎯 新增：更新待放置油条
        // 🎵 油锅有油条时播放油锅音效
        this.updateOilSizzleAudio();
        this.updateOrders(deltaTime); // 🎯 新增：更新订单耐心值
        this.updateTime(deltaTime);
        
        // 定期生成顾客（基于当前天数难度的生成率）
        if (this.gameState.customers.length < this.config.maxCustomers && 
            Math.random() < this.config.customerSpawnRate * deltaTime / 1000) {
            this.spawnCustomer();
            console.log(`🎯 生成新顾客，当前顾客数量: ${this.gameState.customers.length}/${this.config.maxCustomers}`);
        }
        
        this.updateUI();
    }

    // 🎵 根据油锅状态播放/停止油锅声音（youguo）
    updateOilSizzleAudio() {
        try {
            const hasYoutiaoInOil = !!(this.gameState && this.gameState.youtiaoState && this.gameState.youtiaoState.youtiaoInOil && this.gameState.youtiaoState.youtiaoInOil.length > 0);
            const shouldPlay = this.gameState.isRunning && hasYoutiaoInOil;
            if (shouldPlay) {
                if (!this.youguoAudio) {
                    this.youguoAudio = new Audio('audio/youguo.mp3');
                    this.youguoAudio.loop = true;
                    this.youguoAudio.volume = 0.6;
                }
                if (this.youguoAudio.paused) {
                    this.youguoAudio.currentTime = 0;
                    this.youguoAudio.play().catch(() => {});
                }
            } else {
                if (this.youguoAudio && !this.youguoAudio.paused) {
                    this.youguoAudio.pause();
                    this.youguoAudio.currentTime = 0;
                }
            }
        } catch (_) { /* 忽略音频错误 */ }
    }

    updateCustomers(deltaTime) {
        // 获取顾客专用的游戏区域边界
        const customerArea = this.getCustomerAreaBounds();
        
        // 定义统一的顾客行走水平线
        const walkingLine = this.getCustomerWalkingLine();
        
        // 使用for循环倒序遍历，避免在删除元素时索引问题
        for (let i = this.gameState.customers.length - 1; i >= 0; i--) {
            const customer = this.gameState.customers[i];
            
            // 🎯 修复：检查是否有顾客卡在队列位置，强制移动他们
            if (customer.isInQueue && customer.state === 'waiting' && customer.x < customerArea.minX) {
                console.log(`🔧 修复：发现顾客 ${customer.id} 卡在队列位置，尝试重新分配`);
                this.moveQueueCustomerToPosition();
            }
            
            // 🎯 修复：检查等待状态但没有到达时间的顾客
            if (customer.state === 'waiting' && !customer.hasOrdered && !customer.arrivalTime) {
                console.log(`🔧 修复：顾客 ${customer.id} 处于等待状态但没有到达时间，设置为当前时间`);
                customer.arrivalTime = Date.now();
            }
            
            // 🎯 修复：检查长时间卡在walking状态的顾客
            if (customer.state === 'walking') {
                if (!customer.stuckCheckTime) {
                    customer.stuckCheckTime = Date.now();
                    customer.lastPosition = { x: customer.x, y: customer.y };
                } else {
                    const stuckTime = Date.now() - customer.stuckCheckTime;
                    const distanceMoved = Math.abs(customer.x - customer.lastPosition.x);
                    
                    // 如果顾客超过5秒没有明显移动，认为是卡住了
                    if (stuckTime > 5000 && distanceMoved < 10) {
                        console.log(`🔧 修复：顾客 ${customer.id} 卡住超过5秒，强制传送到目标位置`);
                        customer.x = customer.targetX;
                        customer.y = walkingLine;
                        customer.state = 'waiting';
                        customer.arrivalTime = Date.now();
                        customer.stuckCheckTime = null;
                        customer.lastPosition = null;
                    } else if (stuckTime > 1000) {
                        // 每秒更新位置检查
                        customer.lastPosition = { x: customer.x, y: customer.y };
                        customer.stuckCheckTime = Date.now();
                    }
                }
            } else {
                // 重置卡住检查
                customer.stuckCheckTime = null;
                customer.lastPosition = null;
            }
            if (customer.state === 'walking') {
                const dx = customer.targetX - customer.x;
                const distanceX = Math.abs(dx);
                
                // 🎯 只允许水平移动，垂直位置固定在水平线上
                let nextX = customer.x;
                const nextY = walkingLine; // 强制Y坐标为水平线
                
                // 水平移动逻辑
                if (distanceX > 5) {
                    nextX += dx > 0 ? customer.speed : -customer.speed;
                }
                
                // 应用水平边界限制（更宽松的边界检查）
                if (customer.state !== 'leaving') {
                    // 进场和等待的顾客，限制在desk水平范围内，但给予额外缓冲空间
                    const rightBoundary = customerArea.maxX + 50; // 允许稍微超出右边界
                    const leftBoundary = customerArea.minX - 60; // 可见区域左侧稍微留缓冲
                    nextX = Math.max(Math.min(nextX, rightBoundary), leftBoundary);
                } else {
                    // 离开的顾客可以走出左边界
                    nextX = Math.max(nextX, -200);
                }
                
                // 应用移动（Y轴始终为水平线）
                customer.x = nextX;
                customer.y = nextY;
                
                // 到达目标X位置检查（更宽松的判定）
                if (distanceX <= 10) { // 从5增加到10，更容易到达
                    customer.state = 'waiting';
                    customer.x = customer.targetX;
                    customer.y = walkingLine; // 确保等待时也在水平线上
                    customer.targetY = walkingLine; // 更新目标Y为水平线
                    
                    customer.arrivalTime = Date.now();
                    customer.stuckCheckTime = null; // 清除卡住检查
                    customer.lastPosition = null;
                    console.log(`🎯 顾客 ${customer.id} 已到达水平线位置 (${customer.x}, ${walkingLine})`);
                    console.log(`🎯 顾客 ${customer.id} 现在可以下单了！状态: ${customer.state}, hasOrdered: ${customer.hasOrdered}`);
                }
            }
            
            // 离开状态的顾客移动（离开时不需要避让，直接移动）
            if (customer.state === 'leaving') {
                const oldX = customer.x;
                customer.x -= customer.speed;
                console.log(`🎯 顾客 ${customer.id} 正在离开: ${oldX.toFixed(1)} -> ${customer.x.toFixed(1)}, 速度: ${customer.speed}`);
                
                // 确保顾客在离开时不会超出Y边界
                customer.y = Math.max(Math.min(customer.y, customerArea.maxY - 100), 100);
                
                // 离开屏幕后删除
                if (customer.x < customerArea.minX - 120) {
                    console.log(`🎯 顾客 ${customer.id} 已离开屏幕，准备删除`);
                    this.releaseCustomerPosition(customer); // 🎯 释放位置
                    this.removeCustomer(customer);
                    continue;
                }
            }
            
            // 等待接单超时检查
            if (customer.state === 'waiting' && !customer.hasOrdered) {
                if (customer.arrivalTime) {
                    const waitingTime = Date.now() - customer.arrivalTime;
                    if (waitingTime >= customer.waitingForOrder) {
                        this.releaseCustomerPosition(customer); // 🎯 释放位置
                        customer.state = 'leaving';
                        const oldReputation = this.gameState.reputation;
                        this.gameState.reputation -= 3;
                        this.gameState.reputation = Math.max(0, this.gameState.reputation);
                        
                        // 检查升降级
                        if (this.gameState.reputation !== oldReputation) {
                            this.updateShopLevel();
                        }
                        
                        this.showNotification('顾客等待太久，没有点单就离开了！');
                        
                        // 释放桌子
                        if (customer.table) {
                            customer.table.occupied = false;
                        }
                        
                        // 重新排列外带顾客队伍
                        if (customer.type === 'takeaway') {
                            this.reorganizeTakeawayQueue();
                        }
                    }
                }
            }
            
            // 已点单顾客的耐心消耗
            if (customer.state === 'waiting' && customer.hasOrdered) {
                customer.patience -= deltaTime;
                customer.satisfaction = Math.max(0, (customer.patience / customer.maxPatience) * 100);
                
                if (customer.patience <= 0) {
                    this.releaseCustomerPosition(customer); // 🎯 释放位置
                    customer.state = 'leaving';
                    const oldReputation = this.gameState.reputation;
                    this.gameState.reputation -= 5;
                    this.gameState.reputation = Math.max(0, this.gameState.reputation);
                    
                    // 检查升降级
                    if (this.gameState.reputation !== oldReputation) {
                        this.updateShopLevel();
                    }
                    
                    this.showNotification('顾客不耐烦离开了！');
                    
                    this.gameState.orders = this.gameState.orders.filter(
                        order => order.customer !== customer
                    );
                    
                    // 重新排列外带顾客队伍
                    this.reorganizeTakeawayQueue();
                }
            }
        }
        
        // 🎯 添加全局顾客状态修复机制
        this.performGlobalCustomerHealthCheck();
        
        // 这行已经不需要了，因为我们在removeCustomer中直接移除顾客
        // this.gameState.customers = this.gameState.customers.filter(c => c.state !== 'left');
    }



    // 🎯 全局顾客状态健康检查和修复机制
    performGlobalCustomerHealthCheck() {
        const customerArea = this.getCustomerAreaBounds();
        const walkingLine = this.getCustomerWalkingLine();
        
        this.gameState.customers.forEach(customer => {
            // 检查顾客是否超出合理边界
            if (customer.x > customerArea.maxX + 100) {
                console.log(`🔧 全局修复：顾客 ${customer.id} 超出右边界 (${customer.x} > ${customerArea.maxX + 100})，重新定位`);
                customer.x = Math.min(customer.x, customerArea.maxX);
                if (customer.state === 'walking') {
                    customer.state = 'waiting';
                    customer.arrivalTime = Date.now();
                }
            }
            
            // 检查顾客是否在错误的Y位置
            if (Math.abs(customer.y - walkingLine) > 50) {
                console.log(`🔧 全局修复：顾客 ${customer.id} Y位置异常 (${customer.y} vs ${walkingLine})，重新定位`);
                customer.y = walkingLine;
            }
            
            // 检查长时间无状态的顾客
            if (!customer.state || customer.state === undefined) {
                console.log(`🔧 全局修复：顾客 ${customer.id} 状态丢失，设置为waiting`);
                customer.state = 'waiting';
                customer.arrivalTime = Date.now();
            }
            
            // 检查目标位置不合理的顾客
            if (customer.targetX > customerArea.maxX + 50) {
                console.log(`🔧 全局修复：顾客 ${customer.id} 目标位置超出边界，重新设置`);
                customer.targetX = Math.min(customer.targetX, customerArea.maxX);
            }
        });
    }

    // 🎯 更新订单耐心值和处理超时订单
    updateOrders(deltaTime) {
        // 倒序遍历，避免删除元素时索引混乱
        for (let i = this.gameState.pendingOrders.length - 1; i >= 0; i--) {
            const order = this.gameState.pendingOrders[i];
            
            // 减少订单耐心值
            order.currentPatience -= deltaTime;
            
            // 检查订单是否超时
            if (order.currentPatience <= 0) {
                console.log(`🎯 订单超时：顾客 #${order.customerId} 的订单已超时`);
                
                // 找到对应的顾客并让其离开
                const customer = this.gameState.customers.find(c => c.id === order.customerId);
                if (customer) {
                    customer.state = 'leaving';
                    customer.patience = 0;
                    customer.satisfaction = 0;
                    
                    // 降低声誉
                    const oldReputation = this.gameState.reputation;
                    this.gameState.reputation -= 8; // 订单超时的惩罚更重
                    this.gameState.reputation = Math.max(0, this.gameState.reputation);
                    
                    // 检查升降级
                    if (this.gameState.reputation !== oldReputation) {
                        this.updateShopLevel();
                    }
                    
                    this.showNotification(`❌ 订单超时！顾客 #${order.customerId} 不耐烦地离开了！`, 3000);
                } else {
                    console.warn(`⚠️ 未找到订单 ${order.customerId} 对应的顾客`);
                }
                
                // 从待处理订单列表中移除
                this.gameState.pendingOrders.splice(i, 1);
                
                // 也从主订单列表中移除
                const orderInMainList = this.gameState.orders.findIndex(o => o.id === order.id);
                if (orderInMainList >= 0) {
                    this.gameState.orders.splice(orderInMainList, 1);
                }
                
                // 标记需要更新UI
                this.needUpdateOrderUI = true;
            }
        }
        
        // 实时更新订单进度条显示
        this.updateOrderProgressBars();
        
        // 如果有订单发生变化，更新UI
        if (this.needUpdateOrderUI) {
            this.updateOrderArea();
            this.needUpdateOrderUI = false;
        }
    }

    // 🎯 实时更新订单进度条显示
    updateOrderProgressBars() {
        const orderContainer = document.getElementById('orderList');
        if (!orderContainer) return;
        
        const orderElements = orderContainer.querySelectorAll('.order-item');
        
        orderElements.forEach((orderElement, index) => {
            const orderIndex = parseInt(orderElement.dataset.orderIndex);
            const order = this.gameState.pendingOrders[orderIndex];
            
            if (!order) return;
            
            // 计算耐心值百分比
            const patiencePercent = Math.max(0, (order.currentPatience / order.maxPatience) * 100);
            const patienceColor = patiencePercent > 50 ? '#4CAF50' : patiencePercent > 25 ? '#FFA500' : '#FF4444';
            
            // 更新进度条
            const patienceBar = orderElement.querySelector('.patience-bar');
            if (patienceBar) {
                patienceBar.style.width = `${patiencePercent}%`;
                patienceBar.style.backgroundColor = patienceColor;
            }
            
            // 更新耐心值文本
            const patienceText = orderElement.querySelector('.patience-text');
            if (patienceText) {
                const remainingSeconds = Math.max(0, Math.ceil(order.currentPatience / 1000));
                patienceText.textContent = `耐心值: ${remainingSeconds}s`;
                
                // 当耐心值很低时，添加警告样式
                if (patiencePercent <= 25) {
                    patienceText.style.color = '#FF4444';
                    patienceText.style.fontWeight = 'bold';
                } else {
                    patienceText.style.color = '#666';
                    patienceText.style.fontWeight = 'normal';
                }
            }
        });
    }

    removeCustomer(customer) {
        console.log(`🎯 移除顾客 #${customer.id}`);
        
        // 释放桌子
        if (customer.table) {
            customer.table.occupied = false;
            console.log(`🎯 释放桌子 #${customer.table.id}`);
        }
        
        // 从顾客数组中移除
        const customerIndex = this.gameState.customers.findIndex(c => c.id === customer.id);
        if (customerIndex !== -1) {
            this.gameState.customers.splice(customerIndex, 1);
            console.log(`🎯 顾客 #${customer.id} 已从数组中移除，当前顾客数量: ${this.gameState.customers.length}`);
        } else {
            console.error(`❌ 未找到要移除的顾客 #${customer.id}`);
        }
        
        // 如果是外带顾客，重新排列队伍
        if (customer.type === 'takeaway') {
            this.reorganizeTakeawayQueue();
        }
        
        // 更新UI
        this.updateSidebar();
    }

    reorganizeTakeawayQueue() {
        // 重新排列外带顾客队伍，避免空隙
        const takeawayCustomers = this.gameState.customers.filter(c => 
            c.type === 'takeaway' && (c.state === 'waiting' || c.state === 'walking') && c.x > -100
        ).sort((a, b) => (a.queuePosition || 0) - (b.queuePosition || 0));
        
        takeawayCustomers.forEach((customer, index) => {
            customer.queuePosition = index;
            const newTargetX = 1500 - (index * 80);
            let newTargetY = 700;
            
            // 如果队伍太长，换行排队
            if (index >= 6) {
                newTargetX = 1500 - ((index - 6) * 80);
                newTargetY = 800;
            }
            
            // 只更新还在等待的顾客位置
            if (customer.state === 'waiting') {
                customer.targetX = newTargetX;
                customer.targetY = newTargetY;
                
                // 如果位置变化较大，让顾客重新移动
                const dx = Math.abs(customer.x - newTargetX);
                const dy = Math.abs(customer.y - newTargetY);
                if (dx > 10 || dy > 10) {
                    customer.state = 'walking';
                }
            }
        });
    }

    updateCooking(deltaTime) {
        this.gameState.cookingItems.forEach(item => {
            if (item.type === 'doujiang') {
                this.updateDoujiangCooking(item, deltaTime);
            } else if (item.type === 'congee') {
                this.updateCongeeCooking(item, deltaTime);
            } else {
                // 其他食物的常规制作逻辑
                const elapsed = Date.now() - item.startTime;
                item.progress = Math.min(1, elapsed / item.cookTime);
                
                if (elapsed >= item.cookTime && item.status === 'cooking') {
                                    item.status = 'completed';
                this.gameState.completedFood.push(item);
                this.showNotification(this.getFoodName(item.type) + '制作完成！');
                this.updateCompletedFoodArea();
                }
            }
        });
        
        this.gameState.cookingItems = this.gameState.cookingItems.filter(item => item.status !== 'completed' && item.status !== 'failed');
    }

    updateDoujiangCooking(item, deltaTime) {
        if (item.isPourHeld) {
            // 🎯 长按时增加豆浆进度（加快速度：1秒填满一碗）
            const progressSpeed = deltaTime / 1000; // 1秒填满
            item.progress = Math.min(1.0, item.progress + progressSpeed);
            
            // 不在这里自动完成，让stopDoujiangPouring处理完成逻辑
        } else if (item.isMaking) {
            // 正在制作时增加进度（保留原有逻辑作为备用）
            const progressSpeed = deltaTime / item.cookTime;
            item.progress = Math.min(1.0, item.progress + progressSpeed);
            
            if (item.progress >= 1.0) {
                item.status = 'completed';
                item.isMaking = false;
                this.gameState.completedFood.push(item);
                this.showNotification('豆浆制作完成！');
                this.updateCompletedFoodArea();
            }
        }
        // 如果不在制作，进度保持不变，允许连续制作
    }

    evaluateDoujiangQuality(item) {
        const fillLevel = item.fillLevel;
        let quality = 'poor';
        let message = '';
        
        if (fillLevel < 0.3) {
            quality = 'poor';
            message = '豆浆太少了！';
        } else if (fillLevel < 0.7) {
            quality = 'normal';
            message = '豆浆制作完成！';
        } else if (fillLevel <= 0.95) {
            quality = 'perfect';
            message = '完美的豆浆！额外奖励！';
        } else {
            quality = 'good';
            message = '差点溢出，但还不错！';
        }
        
        item.status = 'completed';
        item.quality = quality;
        this.gameState.completedFood.push(item);
        this.showNotification(message);
        this.updateCompletedFoodArea();
    }

    updateCongeeCooking(item, deltaTime) {
        if (item.isMaking) {
            // 正在盛粥时增加进度
            const progressSpeed = deltaTime / item.cookTime;
            item.progress = Math.min(1.0, item.progress + progressSpeed);
            
            if (item.progress >= 1.0) {
                item.status = 'completed';
                item.isMaking = false;
                
                // 创建完成的粥配菜，包含配菜信息
                const completedCongee = {
                    type: 'congee',
                    quality: 85 + Math.random() * 15, // 85-100的质量
                    timestamp: Date.now(),
                    sides: item.sides || [], // 包含配菜信息
                    id: Date.now()
                };
                
                this.gameState.completedFood.push(completedCongee);
                
                // 显示配菜信息
                const sidesText = item.sides && item.sides.length > 0 ? 
                    ` (配菜: ${item.sides.join(', ')})` : '';
                this.showNotification(`粥配菜制作完成！${sidesText}`);
                this.updateCompletedFoodArea();
            }
        }
        // 如果不在制作，进度保持不变，允许连续制作
    }

    endPhase() {
        if (this.gameState.phase === 'morning') {
            this.gameState.phase = 'evening';
            this.timeLeft = this.config.dayDuration;
            this.showNotification('现在是日落时段');
        } else {
            this.endDay();
        }
    }

    endDay() {
        const baseEarnings = this.gameState.reputation * 2;
        this.gameState.money += baseEarnings;
        this.gameState.day++;
        
        this.showNotification('第' + (this.gameState.day - 1) + '天结算完成！获得¥' + baseEarnings, 5000);
        
        this.gameState.isRunning = false;
        // 重置当日统计
        this.gameState.completedOrdersToday = 0;
        this.gameState.customers = [];
        this.gameState.orders = [];
        this.gameState.cookingItems = [];
        this.gameState.completedFood = [];
        this.gameState.tables.forEach(table => {
            table.occupied = false;
            table.needsCleaning = false;
            table.customer = null;
        });
        
        const startBtn = document.getElementById('startDay');
        const topControls = document.getElementById('topGameControls');
        if (startBtn) {
            startBtn.disabled = false;
            startBtn.textContent = '🌅 开始营业';
            startBtn.style.display = '';
        }
        if (topControls) topControls.style.display = '';
        // 🎵 营业结束，淡出并停止背景音乐
        this.fadeOutAndStopBGM();
    }



    updateFoodSlots() {
        const slotsContainer = document.getElementById('completedFoodSlots');
        if (!slotsContainer) return;

        slotsContainer.innerHTML = '';

        this.gameState.completedFood.forEach((food, index) => {
            const slot = document.createElement('div');
            slot.className = 'food-slot';
            slot.dataset.foodId = index;
            slot.draggable = true;

            const icon = this.getFoodIcon(food);
            const name = this.getFoodName(food.type);
            
            slot.innerHTML = `
                <div class="food-icon">${icon}</div>
                <div class="food-name">${name}</div>
            `;

            // 添加质量指示器
            if (food.quality) {
                const qualityDiv = document.createElement('div');
                qualityDiv.className = `quality-indicator quality-${food.quality}`;
                qualityDiv.textContent = this.getQualityIcon(food.quality);
                slot.appendChild(qualityDiv);
            }

            // 添加拖拽事件（指针事件，兼容触摸）
            slot.addEventListener('pointerdown', (e) => this.startDrag(e, food, index));

            slotsContainer.appendChild(slot);
        });
    }



    getQualityIcon(quality) {
        const icons = {
            'perfect': '⭐',
            'good': '👍',
            'normal': '👌',
            'poor': '👎'
        };
        return icons[quality] || '';
    }

    startDrag(e, food, index) {
        e.preventDefault();
        this.dragState.isDragging = true;
        this.dragState.draggedItem = { food, index };
        this.dragState.startX = e.clientX;
        this.dragState.startY = e.clientY;

        // 创建拖拽的视觉元素
        const dragElement = e.target.closest('.food-slot').cloneNode(true);
        dragElement.style.position = 'fixed';
        dragElement.style.pointerEvents = 'none';
        dragElement.style.zIndex = '9999';
        dragElement.style.left = e.clientX - 35 + 'px';
        dragElement.style.top = e.clientY - 35 + 'px';
        dragElement.classList.add('dragging');
        
        document.body.appendChild(dragElement);
        this.dragState.draggedElement = dragElement;

        // 标记原始元素
        e.target.closest('.food-slot').style.opacity = '0.3';
        
        // 提示拖拽交餐方式
        if (this.gameState.currentView === 'main') {
            this.showNotification(`拖拽 ${this.getFoodName(food.type)} 到顾客身上交餐，或拖拽到餐盘配菜`);
        } else {
            this.showNotification(`拖拽 ${this.getFoodName(food.type)} 到餐盘配菜，然后到大厅界面拖拽给顾客`);
        }
    }

    // 整个餐盘拖拽功能
    startWholePlateDrag(e) {
        e.preventDefault();
        
        if (this.gameState.currentPlate.length === 0) {
            this.showNotification('餐盘是空的！请先添加食物到餐盘');
            return;
        }
        
        this.dragState.isDragging = true;
        this.dragState.draggedItem = { 
            type: 'whole_plate', 
            plateContents: [...this.gameState.currentPlate] // 复制整个餐盘内容
        };
        this.dragState.startX = e.clientX;
        this.dragState.startY = e.clientY;

        // 创建拖拽的视觉元素 - 整个餐盘的缩小版
        const dragElement = document.createElement('div');
        dragElement.style.cssText = `
            position: fixed;
            pointer-events: none;
            z-index: 1000;
            width: 80px;
            height: 80px;
            background: linear-gradient(135deg, #f0f0f0, #e0e0e0);
            border: 3px solid #8B4513;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: bold;
            color: #333;
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        `;
        
        dragElement.style.left = (e.clientX - 40) + 'px';
        dragElement.style.top = (e.clientY - 40) + 'px';
        dragElement.classList.add('dragging');
        
        // 显示餐盘内容概要
        const foodIcons = this.gameState.currentPlate.map(food => this.getFoodIcon(food)).join('');
        dragElement.innerHTML = `<div style="text-align: center;">${foodIcons}<br><span style="font-size: 10px;">餐盘</span></div>`;
        
        document.body.appendChild(dragElement);
        this.dragState.draggedElement = dragElement;

        // 标记原始餐盘
        const currentPlate = document.getElementById('currentPlate');
        if (currentPlate) {
            currentPlate.style.opacity = '0.5';
            currentPlate.style.cursor = 'grabbing';
        }
        
        this.showNotification(`拖拽整个餐盘到订单上交餐！`);
    }

    startPlateDrag(e, food, index) {
        e.preventDefault();
        this.dragState.isDragging = true;
        this.dragState.draggedItem = { food, index, source: 'plate' }; // 标记来源是餐盘
        this.dragState.startX = e.clientX;
        this.dragState.startY = e.clientY;

        // 创建拖拽的视觉元素
        const dragElement = e.target.cloneNode(true);
        dragElement.style.position = 'fixed';
        dragElement.style.pointerEvents = 'none';
        dragElement.style.zIndex = '9999';
        dragElement.style.left = e.clientX - 25 + 'px';
        dragElement.style.top = e.clientY - 25 + 'px';
        dragElement.classList.add('dragging');
        
        document.body.appendChild(dragElement);
        this.dragState.draggedElement = dragElement;

        // 标记原始元素
        e.target.style.opacity = '0.3';
        
        // 提示拖拽交餐方式
        if (this.gameState.currentView === 'main') {
            this.showNotification(`拖拽 ${this.getFoodName(food.type)} 到顾客身上交餐`);
        } else {
            this.showNotification(`请先切换到大厅界面，然后拖拽给顾客`);
        }
    }

    handleMouseMove(e) {
        // youtiao 专属移动逻辑；但在 doujiang 视图需要跟踪壶位置
        if (this.gameState.currentView !== 'youtiao' && this.gameState.currentView !== 'doujiang') {
            return;
        }

        let adjustedX, adjustedY;
        if (e.isNormalized) {
            adjustedX = e.normalizedX;
            adjustedY = e.normalizedY;
        } else {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
            adjustedX = x * scaleX;
            adjustedY = y * scaleY;
        }

        // 🎯 在豆浆视图下，若选中壶，则让 hu2 跟随鼠标
        if (this.gameState.currentView === 'doujiang' && this.gameState.doujiangState.kettleSelected) {
            this.gameState.doujiangState.kettleX = adjustedX;
            this.gameState.doujiangState.kettleY = adjustedY;
        }

        // 🎯 跟踪状态下：若在面团阶段，结合“按住-拖动”逻辑切换形态
        if (this.gameState.currentView === 'youtiao') {
            const collectingState = this.gameState.youtiaoState.collectingState;
            if (collectingState.isTracking) {
                return;
            }
        }

        // 面团形态切换：按住并拖动
        if (this.gameState.currentView === 'youtiao' && this.gameState.youtiaoState.isPreparingYoutiao) {
            if (this.gameState.youtiaoState.currentStep === 'kneading') {
                this.handleKneadingMotion(adjustedX, adjustedY);
                return;
            }
            if (this.gameState.youtiaoState.currentStep === 'stretching') {
                this.handleStretchingMotion(adjustedX, adjustedY);
            return;
            }
        }

        // 原有的面团制作逻辑（仅在非收集跟踪状态下执行）
        if (!this.gameState.youtiaoState.isPreparingYoutiao) {
            console.log('🎯 不在面团制作状态，跳过鼠标移动处理');
            return;
        }

        console.log(`🎯 面团制作鼠标移动 - 当前步骤: ${this.gameState.youtiaoState.currentStep}`);

        if (this.gameState.youtiaoState.currentStep === 'kneading') {
            this.handleKneadingMotion(adjustedX, adjustedY);
        } else if (this.gameState.youtiaoState.currentStep === 'stretching') {
            this.handleStretchingMotion(adjustedX, adjustedY);
        }
    }

    handleDragEnd(e) {
        if (!this.dragState.isDragging) return;

        // 移除拖拽元素
        if (this.dragState.draggedElement) {
            try { document.body.removeChild(this.dragState.draggedElement); } catch (_) {}
        }

        // 恢复原始元素透明度
        const slots = document.querySelectorAll('.food-slot');
        slots.forEach(slot => slot.style.opacity = '1');

        // 获取鼠标位置
        const rect = this.canvas.getBoundingClientRect();
        const adjustedX = e.isNormalized ? e.normalizedX : (e.clientX - rect.left) * (this.canvas.width / rect.width);
        const adjustedY = e.isNormalized ? e.normalizedY : (e.clientY - rect.top) * (this.canvas.height / rect.height);

        // 🎯 处理面团拖拽结束（采用油条拖拽风格）
        if (this.dragState.draggedItem && this.dragState.draggedItem.type === 'dough_to_oil') {
            // 计算油锅位置和范围
            const youguoPos = this.getYouguoPosition();
            if (adjustedX >= youguoPos.x && adjustedX <= youguoPos.x + youguoPos.width &&
                adjustedY >= youguoPos.y && adjustedY <= youguoPos.y + youguoPos.height) {
                // 🎯 成功拖拽到油锅
                this.addDoughToOil();
                this.showNotification('🎯 面团成功下锅！');
            } else {
                // 🎯 拖拽到其他地方，返回原位
                this.showNotification('❌ 请将面团拖拽到油锅中！');
            }
            this.resetDragState();
            return;
        }

        // 处理油条拖拽结束
        if (this.dragState.draggedItem && this.dragState.draggedItem.type === 'youtiao_from_oil') {
            // 首先检查是否放到餐盘上
            const plateArea = document.getElementById('currentPlate');
            if (plateArea && plateArea.classList.contains('drop-zone')) {
                this.addYoutiaoToPlate(this.dragState.draggedItem);
                plateArea.classList.remove('drop-zone');
                this.resetDragState();
                return;
            }
            // 否则按原来的逻辑处理
            this.handleYoutiaoDropped(adjustedX, adjustedY);
            this.resetDragState();
            return;
        }

        // 检查是否拖拽整个餐盘到订单上
        const targetOrder = document.querySelector('.order-drop-zone');
        if (targetOrder && this.dragState.draggedItem) {
            if (this.dragState.draggedItem.type === 'whole_plate') {
                // 整个餐盘拖拽到订单
                const orderIndex = parseInt(targetOrder.dataset.orderIndex);
                this.serveWholePlateToOrder(orderIndex, this.dragState.draggedItem);
                this.resetDragState();
                return;
            } else if (targetOrder.classList.contains('order-content-target')) {
                // 单个食物拖拽到整个订单（保持兼容性）
                const orderIndex = parseInt(targetOrder.dataset.orderIndex);
                this.fulfillOrderWithSingleFood(orderIndex, this.dragState.draggedItem);
                this.resetDragState();
                return;
            }
        }

        // 检查是否拖拽到顾客处（仅在主界面）
        if (this.gameState.currentView === 'main') {
            const targetCustomer = this.findCustomerAtPosition(adjustedX, adjustedY);
            if (targetCustomer && targetCustomer.hasOrdered && targetCustomer.state === 'waiting') {
                this.serveToCustomer(targetCustomer, this.dragState.draggedItem);
                this.resetDragState();
                return;
            }
        } else {
            // 如果不在大厅界面但试图拖拽到顾客，给出提示
            if (this.dragState.draggedItem) {
                this.showNotification('只能在大厅界面拖拽食物到顾客身上交餐！请先切换到大厅界面。');
            }
        }

        // 检查是否在粥制作界面拖拽食物到粥碗
        if (this.gameState.currentView === 'congee' && this.dragState.draggedItem) {
            const congeeBowlDropped = this.checkCongeeBowlDrop(adjustedX, adjustedY);
            if (congeeBowlDropped) {
                this.addSidesToCongee(this.dragState.draggedItem);
                this.resetDragState();
                return;
            }
        }

        // 🎯 处理粥菜拖拽到餐盘（优先处理）
        if (this.dragState.draggedItem && this.dragState.draggedItem.source === 'completed_congee') {
        const plateArea = document.getElementById('currentPlate');
            if (plateArea) {
                const plateRect = plateArea.getBoundingClientRect();
                if (e.clientX >= plateRect.left && e.clientX <= plateRect.right && 
                    e.clientY >= plateRect.top && e.clientY <= plateRect.bottom) {
                    this.handleCongeeDropToPlate(this.dragState.draggedItem);
                    this.resetDragState();
                    return;
                }
            }
        }

        // 🎯 处理从bucket拖拽的油条
        if (this.dragState.draggedItem && this.dragState.draggedItem.type === 'completed_youtiao') {
            // 首先检查是否放到餐盘上
            const plateArea = document.getElementById('currentPlate');
            if (plateArea && plateArea.classList.contains('drop-zone')) {
                this.handlePendingYoutiaoDropToPlate(this.dragState.draggedItem);
                plateArea.classList.remove('drop-zone');
                this.resetDragState();
                return;
            }
            
            // 否则按原来的逻辑处理（可能拖到顾客或其他地方）
            this.handlePendingYoutiaoDropped(adjustedX, adjustedY);
            this.resetDragState();
            return;
        }

        // 检查是否放到餐盘上（但不是从餐盘拖出来的）
        const plateArea = document.getElementById('currentPlate');
        if (plateArea && plateArea.classList.contains('drop-zone') && 
            this.dragState.draggedItem && this.dragState.draggedItem.source !== 'plate') {
            this.addToPlate(this.dragState.draggedItem);
            plateArea.classList.remove('drop-zone');
        }

        this.resetDragState();
    }

    // 🎯 处理从bucket拖拽的油条放到餐盘
    handlePendingYoutiaoDropToPlate(draggedItem) {
        const youtiao = draggedItem.youtiao;
        const pendingIndex = draggedItem.pendingIndex;
        
        // 添加到餐盘
        this.gameState.currentPlate.push(youtiao);
        
        // 从待放置列表中移除
        this.gameState.youtiaoState.pendingYoutiao.splice(pendingIndex, 1);
        
        // 更新UI
        this.updateCurrentPlateArea();
        
        let qualityText = '';
        if (youtiao.perfectTiming) {
            qualityText = '(完美品质!)';
        } else if (youtiao.overcooked) {
            qualityText = '(过火品质)';
        } else {
            qualityText = '(普通品质)';
        }
        
        this.showNotification(`油条${qualityText}已添加到餐盘！`);
    }

    // 🎯 处理从bucket拖拽的油条到其他位置
    handlePendingYoutiaoDropped(x, y) {
        const draggedItem = this.dragState.draggedItem;
        const youtiao = draggedItem.youtiao;
        const pendingIndex = draggedItem.pendingIndex;
        
        // 直接添加到完成食物列表
        this.gameState.completedFood.push(youtiao);
        
        // 从待放置列表中移除
        this.gameState.youtiaoState.pendingYoutiao.splice(pendingIndex, 1);
        
        // 更新UI
        this.updateCompletedFoodArea();
        
        let qualityText = '';
        if (youtiao.perfectTiming) {
            qualityText = '(完美品质!)';
        } else if (youtiao.overcooked) {
            qualityText = '(过火品质)';
        } else {
            qualityText = '(普通品质)';
        }
        
        this.showNotification(`油条${qualityText}已添加到完成食物！`);
    }

    resetDragState() {
        // 重置拖拽状态
        this.dragState.isDragging = false;
        this.dragState.draggedItem = null;
        if (this.dragState.followRafId) {
            try { cancelAnimationFrame(this.dragState.followRafId); } catch(_) {}
            this.dragState.followRafId = null;
        }
        this.dragState.draggedElement = null;
        
        // 清除所有订单的拖拽样式
        const orderTargets = document.querySelectorAll('.order-content-target');
        orderTargets.forEach(target => {
            target.style.borderColor = 'transparent';
            target.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
            target.style.transform = 'scale(1)';
            target.style.boxShadow = 'none';
            target.classList.remove('order-drop-zone');
        });
        
        // 恢复餐盘样式
        const currentPlate = document.getElementById('currentPlate');
        if (currentPlate) {
            currentPlate.style.opacity = '1';
            currentPlate.style.cursor = this.gameState.currentPlate.length > 0 ? 'grab' : 'default';
        }
    }

    findCustomerAtPosition(x, y) {
        return this.gameState.customers.find(customer => {
            const customerLeft = customer.x;
            const customerRight = customer.x + customer.width;
            const customerTop = customer.y;
            const customerBottom = customer.y + customer.height;
            
            return x >= customerLeft && x <= customerRight && 
                   y >= customerTop && y <= customerBottom;
        });
    }

    serveToCustomer(customer, draggedItem) {
        const { food, index } = draggedItem;
        
        // 创建临时餐盘包含这个食物
        const tempPlate = [food];
        
        // 找到顾客的订单
        const order = this.gameState.orders.find(o => 
            o.customer === customer && o.status === 'pending'
        );

        if (!order) {
            this.showNotification('找不到顾客的订单！');
            return;
        }

        // 评估匹配度
        const matchResult = this.evaluateOrderMatch(order, tempPlate);
        
        // 如果完全不匹配，给出提示
        if (matchResult.percentage < 30) {
            this.showNotification(`${this.getFoodName(food.type)} 不符合顾客需求！顾客想要: ${order.items.map(item => this.getFoodName(item.type)).join(', ')}`);
            return;
        }
        
        // 根据来源移除食物
        if (draggedItem.source === 'plate') {
            // 从餐盘中移除
            this.gameState.currentPlate.splice(index, 1);
            this.updatePlateDisplay();
        } else {
        // 从完成食物列表中移除
        this.gameState.completedFood.splice(index, 1);
            this.updateCompletedFoodArea();
        }
        
        // 处理订单完成
        this.processOrderCompletion(order, matchResult);
        
        this.showNotification(`通过拖拽成功为顾客送上 ${this.getFoodName(food.type)}！匹配度: ${matchResult.percentage.toFixed(1)}%`);
    }
    
    // 新函数：满足特定订单项
    fulfillOrderItem(orderIndex, itemIndex, draggedItem) {
        const order = this.gameState.orders[orderIndex];
        if (!order || order.status !== 'pending') {
            this.showNotification('订单不存在或已完成！');
            return;
        }
        
        const orderItem = order.items[itemIndex];
        if (!orderItem) {
            this.showNotification('订单项不存在！');
            return;
        }
        
        const { food, index } = draggedItem;
        
        // 检查食物类型是否匹配
        if (!this.checkFoodMatch(food, orderItem)) {
            this.showNotification(`${this.getFoodName(food.type)} 不符合订单要求：${this.getFoodName(orderItem.type)}`);
            return;
        }
        
        // 初始化已完成数量
        if (!orderItem.fulfilledQuantity) {
            orderItem.fulfilledQuantity = 0;
        }
        
        // 检查是否已完成
        if (orderItem.fulfilledQuantity >= orderItem.quantity) {
            this.showNotification('该订单项已完成！');
            return;
        }
        
        // 增加已完成数量
        orderItem.fulfilledQuantity++;
        
        // 根据来源移除食物
        if (draggedItem.source === 'plate') {
            this.gameState.currentPlate.splice(index, 1);
            this.updatePlateDisplay();
        } else {
            this.gameState.completedFood.splice(index, 1);
            this.updateCompletedFoodArea();
        }
        
        // 检查订单是否完全完成
        const allItemsFulfilled = order.items.every(item => 
            (item.fulfilledQuantity || 0) >= item.quantity
        );
        
        if (allItemsFulfilled) {
            // 订单完成
            order.status = 'completed';
            order.customer.state = 'satisfied';
            
            // 计算收益
            const basePrice = this.getFoodPrice(orderItem.type);
            const earnings = Math.floor(basePrice * (food.quality || 1.0));
            this.gameState.money += earnings;
            this.gameState.reputation += Math.floor(food.quality || 1.0);
            
            // 顾客离开
            setTimeout(() => {
                order.customer.state = 'leaving';
                if (order.customer.table) {
                    order.customer.table.occupied = false;
                    order.customer.table.needsCleaning = true;
                }
            }, 2000);
            
            this.showNotification(`✅ 订单完成！获得 ${earnings} 金币`);
        } else {
            this.showNotification(`✅ 完成订单项：${this.getFoodName(orderItem.type)} (${orderItem.fulfilledQuantity}/${orderItem.quantity})`);
        }
        
        // 更新UI
        this.updateUI();
    }
    
    // 检查食物是否匹配订单项
    checkFoodMatch(food, orderItem) {
        // 基本类型匹配
        if (food.type !== orderItem.type) {
            return false;
        }
        
        // 如果是粥，检查配菜匹配
        if (food.type === 'congee' && orderItem.sides && orderItem.sides.length > 0) {
            if (!food.sides || food.sides.length === 0) {
                return false;
            }
            
            // 检查是否包含所有需要的配菜
            return orderItem.sides.every(requiredSide => 
                food.sides.some(foodSide => foodSide === requiredSide)
            );
        }
        
        return true;
    }
    
    // 整个餐盘交付到订单
    serveWholePlateToOrder(orderIndex, draggedItem) {
        const order = this.gameState.orders[orderIndex];
        if (!order || order.status !== 'pending') {
            this.showNotification('订单不存在或已完成！');
            return;
        }
        
        const plateContents = draggedItem.plateContents;
        if (!plateContents || plateContents.length === 0) {
            this.showNotification('餐盘是空的！');
            return;
        }
        
        // 评估整个餐盘与订单的匹配度
        const matchResult = this.evaluateOrderMatch(order, plateContents);
        
        if (matchResult.percentage < 30) {
            this.showNotification(`餐盘内容不符合订单要求！匹配度: ${matchResult.percentage.toFixed(1)}%`);
            return;
        }
        
        // 清空当前餐盘
        this.gameState.currentPlate = [];
        this.updatePlateDisplay();
        
        // 处理订单完成
        this.processOrderCompletion(order, matchResult);
        
        this.showNotification(`✅ 成功交付整个餐盘！匹配度: ${matchResult.percentage.toFixed(1)}%`);
    }
    
    // 单个食物交付到整个订单（兼容性功能）
    fulfillOrderWithSingleFood(orderIndex, draggedItem) {
        const order = this.gameState.orders[orderIndex];
        if (!order || order.status !== 'pending') {
            this.showNotification('订单不存在或已完成！');
            return;
        }
        
        const { food, index } = draggedItem;
        
        // 找到最匹配的订单项
        const matchingItemIndex = order.items.findIndex(item => 
            item.type === food.type && (item.fulfilledQuantity || 0) < item.quantity
        );
        
        if (matchingItemIndex === -1) {
            this.showNotification(`订单中没有需要 ${this.getFoodName(food.type)} 的项目！`);
            return;
        }
        
        // 调用原有的单项满足逻辑
        this.fulfillOrderItem(orderIndex, matchingItemIndex, draggedItem);
    }
    
    // 获取食物价格
    getFoodPrice(type) {
        const prices = {
            'youtiao': 2,
            'doujiang': 3,
            'congee': 5,
            'egg': 1
        };
        return prices[type] || 1;
    }

    checkCongeeBowlDrop(x, y) {
        // 检查是否拖拽到粥碗区域 (盛粥区域)
        return x >= 500 && x <= 900 && y >= 650 && y <= 850;
    }

    addSidesToCongee(draggedItem) {
        const { food, index } = draggedItem;
        
        // 检查是否是小菜类型的食物（这里假设小菜都是某种特定类型）
        const isValidSide = this.isValidSideDish(food);
        
        if (!isValidSide) {
            this.showNotification(`${this.getFoodName(food.type)} 不能作为粥的配菜！`);
            return;
        }
        
        // 检查是否有正在制作的粥
        const congeeInProgress = this.gameState.cookingItems.find(item => 
            item.type === 'congee' && item.status === 'cooking'
        );
        
        if (congeeInProgress) {
            // 添加小菜到正在制作的粥中
            if (!congeeInProgress.sides) {
                congeeInProgress.sides = [];
            }
            
            const sideName = this.getFoodName(food.type);
            if (!congeeInProgress.sides.includes(sideName)) {
                congeeInProgress.sides.push(sideName);
                
                // 根据来源移除食物
                if (draggedItem.source === 'plate') {
                    this.gameState.currentPlate.splice(index, 1);
                    this.updatePlateDisplay();
                } else {
                    this.gameState.completedFood.splice(index, 1);
        this.updateCompletedFoodArea();
                }
                
                this.showNotification(`成功将 ${sideName} 添加到粥碗中！`);
            } else {
                this.showNotification(`${sideName} 已经在粥碗中了！`);
            }
        } else {
            this.showNotification('没有正在制作的粥！请先长按空格键开始盛粥。');
        }
    }

    isValidSideDish(food) {
        // 这里定义哪些食物可以作为粥的配菜
        // 目前允许所有类型的食物作为配菜，实际游戏中可以更严格
        const validSides = ['youtiao', 'doujiang']; // 油条和豆浆可以作为粥的配菜
        return validSides.includes(food.type);
    }

    addToPlate(draggedItem) {
        const { food, index } = draggedItem;
        
        // 从完成食物列表中移除
        this.gameState.completedFood.splice(index, 1);
        
        // 添加到餐盘
        this.gameState.currentPlate.push(food);
        
        this.updateCompletedFoodArea();
        this.updatePlateDisplay();
        this.showNotification(`${this.getFoodName(food.type)} 已添加到餐盘`);
    }

    addYoutiaoToPlate(draggedItem) {
        const youtiao = draggedItem.youtiao;
        const index = draggedItem.index;

        // 创建完成的油条，根据炸制状态计算质量
        let quality;
        if (youtiao.overcooked) {
            // 过火的油条质量大幅下降
            quality = Math.max(30, 90 - (youtiao.cookProgress - 1.2) * 100);
        } else if (youtiao.perfectTiming) {
            // 完美时机的油条质量最高
            quality = Math.min(100, 85 + youtiao.cookProgress * 15);
        } else {
            // 一般时机的油条质量中等
            quality = Math.min(90, 60 + youtiao.cookProgress * 30);
        }
        
        const completedYoutiao = {
            type: 'youtiao',
            quality: Math.round(quality),
            timestamp: Date.now(),
            id: youtiao.id,
            perfectTiming: youtiao.perfectTiming || false,
            overcooked: youtiao.overcooked || false,
            cookProgress: youtiao.cookProgress
        };
        
        // 直接添加到餐盘而不是完成食物列表
        this.gameState.currentPlate.push(completedYoutiao);
        
        // 从油锅中移除这根油条
        this.gameState.youtiaoState.youtiaoInOil.splice(index, 1);
        
        // 如果油锅空了，重置制作状态（但保留pendingYoutiao）
        if (this.gameState.youtiaoState.youtiaoInOil.length === 0) {
            const currentPendingYoutiao = this.gameState.youtiaoState.pendingYoutiao || [];
            this.gameState.youtiaoState = {
                isPreparingYoutiao: false,
                currentStep: 'idle',
                doughCircles: 0,
                stretchMoves: 0,
                youtiaoInOil: [],
                youtiaoId: null,
                lastMouseX: 0,
                lastMouseY: 0,
                circleProgress: 0,
                stretchDirection: 0,
                collectingState: {
                    isTracking: false,
                    startX: 0,
                    startY: 0,
                    targetYoutiao: null,
                    targetIndex: -1,
                    moveThreshold: 30
                },
                pendingYoutiao: currentPendingYoutiao // 🎯 保留待放置的油条
            };
        }
        
        // 更新显示
        this.updatePlateDisplay();
        
        const qualityText = youtiao.perfectTiming ? '(完美!)' : youtiao.overcooked ? '(过火)' : '(普通)';
        this.showNotification(`第${index + 1}根油条已添加到餐盘 质量:${Math.round(quality)}% ${qualityText}`);
    }

    updatePlateDisplay() {
        const plateItems = document.getElementById('plateItems');
        const plateBase = document.querySelector('.plate-base');
        const currentPlate = document.getElementById('currentPlate');
        
        if (!plateItems) return;

        plateItems.innerHTML = '';
        
        if (this.gameState.currentPlate.length === 0) {
            plateBase.style.display = 'block';
            // 移除整个餐盘的拖拽功能
            if (currentPlate) {
                currentPlate.draggable = false;
                currentPlate.style.cursor = 'default';
            }
            return;
        }
        
        plateBase.style.display = 'none';

        // 为整个餐盘添加拖拽功能
        if (currentPlate) {
            currentPlate.draggable = true;
            currentPlate.style.cursor = 'grab';
            
            // 移除之前的事件监听器
            currentPlate.removeEventListener('pointerdown', this.plateMouseDownHandler);
            
            // 添加新的事件监听器
            this.plateMouseDownHandler = (e) => {
                if (e.target === currentPlate || e.target.closest('#currentPlate')) {
                    this.startWholePlateDrag(e);
                }
            };
            currentPlate.addEventListener('pointerdown', this.plateMouseDownHandler);
        }

        this.gameState.currentPlate.forEach((food, index) => {
            const item = document.createElement('div');
            item.className = 'plate-item';
            item.textContent = this.getFoodIcon(food);
            item.dataset.foodId = index;
            
            // 圆形排列
            const angle = (index / this.gameState.currentPlate.length) * 2 * Math.PI;
            const radius = 40;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            
            item.style.left = `calc(50% + ${x}px)`;
            item.style.top = `calc(50% + ${y}px)`;
            item.style.transform = 'translate(-50%, -50%)';
            
            plateItems.appendChild(item);
        });
    }

    servePlate() {
        if (this.gameState.currentPlate.length === 0) {
            this.showNotification('餐盘是空的！请先添加食物到餐盘');
            return;
        }

        // 检查当前是否在大厅界面
        if (this.gameState.currentView !== 'main') {
            this.showNotification('请先切换到大厅界面，然后拖拽食物到顾客身上交餐！');
            return;
        }

        // 找到等待的顾客
        const waitingCustomers = this.gameState.customers.filter(c => 
            c.hasOrdered && c.state === 'waiting'
        );

        if (waitingCustomers.length === 0) {
            this.showNotification('没有等待的顾客！餐盘中有: ' + 
                this.gameState.currentPlate.map(food => this.getFoodName(food.type)).join(', '));
            return;
        }

        // 不能点击直接交餐，只能拖拽交餐
        const plateContents = this.gameState.currentPlate.map(food => this.getFoodName(food.type)).join(', ');
        this.showNotification(`餐盘中有: ${plateContents}。请拖拽餐盘中的食物到顾客身上进行交餐！点击按钮无法直接交餐。`);
    }

    evaluateOrderMatch(order, plateItems) {
        let totalScore = 0;
        let maxScore = 0;
        let feedback = [];

        order.items.forEach(orderItem => {
            const requiredType = orderItem.type;
            const requiredQuantity = orderItem.quantity;
            
            // 计算最大可能分数
            maxScore += requiredQuantity * 100;
            
            // 在餐盘中查找匹配的食物
            let foundCount = 0;
            let qualityBonus = 0;
            
            plateItems.forEach(plateFood => {
                if (plateFood.type === requiredType && foundCount < requiredQuantity) {
                    foundCount++;
                    totalScore += 100; // 基础分数
                    
                    // 质量加分
                    if (plateFood.quality) {
                        switch (plateFood.quality) {
                            case 'perfect': qualityBonus += 30; break;
                            case 'good': qualityBonus += 20; break;
                            case 'normal': qualityBonus += 10; break;
                            case 'poor': qualityBonus -= 10; break;
                        }
                    }
                }
            });
            
            totalScore += qualityBonus;
            
            // 记录反馈
            if (foundCount === requiredQuantity) {
                feedback.push(`✅ ${this.getFoodName(requiredType)} 完全匹配`);
            } else if (foundCount > 0) {
                feedback.push(`⚠️ ${this.getFoodName(requiredType)} 部分匹配 (${foundCount}/${requiredQuantity})`);
            } else {
                feedback.push(`❌ 缺少 ${this.getFoodName(requiredType)}`);
            }
        });

        // 检查多余的食物
        const orderTypes = order.items.map(item => item.type);
        const extraItems = plateItems.filter(item => !orderTypes.includes(item.type));
        if (extraItems.length > 0) {
            feedback.push(`⚠️ 多余食物: ${extraItems.map(item => this.getFoodName(item.type)).join(', ')}`);
            totalScore -= extraItems.length * 20; // 多余食物扣分
        }

        const matchPercentage = Math.max(0, Math.min(100, (totalScore / maxScore) * 100));
        
        return {
            score: totalScore,
            maxScore: maxScore,
            percentage: matchPercentage,
            feedback: feedback
        };
    }

    processOrderCompletion(order, matchResult) {
        const basePrice = order.totalValue;
        const multiplier = matchResult.percentage / 100;
        const earnedMoney = Math.floor(basePrice * multiplier);
        
        let reputationChange = 0;
        let message = '';

        if (matchResult.percentage >= 90) {
            reputationChange = 3;
            message = '🌟 完美服务！顾客非常满意！';
        } else if (matchResult.percentage >= 70) {
            reputationChange = 2;
            message = '😊 服务良好！顾客满意';
        } else if (matchResult.percentage >= 50) {
            reputationChange = 1;
            message = '😐 服务一般，顾客基本满意';
        } else if (matchResult.percentage >= 30) {
            reputationChange = 0;
            message = '😕 服务不佳，顾客不太满意';
        } else {
            reputationChange = -2;
            message = '😠 服务很差！顾客非常不满！';
        }

        // 更新游戏状态 - 移除金钱处理，由processPayment处理
        // this.gameState.money += earnedMoney; // 移除重复的金钱处理
        this.gameState.reputation += reputationChange;

        // 完成订单
        order.status = 'completed';
        order.customer.state = 'eating';

        // 显示详细反馈
        const detailedMessage = `${message}\n` +
            `匹配度: ${matchResult.percentage.toFixed(1)}%\n` +
            `获得金钱: ¥${earnedMoney}\n` +
            `声誉变化: ${reputationChange >= 0 ? '+' : ''}${reputationChange}\n` +
            matchResult.feedback.join('\n');

        this.showNotification(detailedMessage, 4000);

        // 如果是堂食顾客，一段时间后离开
        if (order.customer.type === 'dineIn') {
            setTimeout(() => {
                order.customer.state = 'leaving';
                this.processPayment(order.customer);
            }, 3000);
        } else {
            // 外带顾客立即离开
            order.customer.state = 'leaving';
            this.processPayment(order.customer);
        }
    }

    clearPlate() {
        if (this.gameState.currentPlate.length === 0) {
            this.showNotification('餐盘已经是空的了');
            return;
        }

        // 将餐盘中的食物放回成品槽
        this.gameState.currentPlate.forEach(food => {
            this.gameState.completedFood.push(food);
        });

        this.gameState.currentPlate = [];
        this.updatePlateDisplay();
        this.updateSidebar();
        this.showNotification('餐盘已清空，食物已放回成品槽');
    }



    renderMainCookingProgress() {
        // 主界面制作进度显示
        // 可以在这里显示当前制作的食物进度
    }

    renderWorkspaceProgress() {
        // 制作区进度显示
        // 根据当前视图显示制作动画和效果
        if (this.gameState.currentView === 'youtiao') {
            this.renderYoutiaoEffects();
        } else if (this.gameState.currentView === 'doujiang') {
            this.renderDoujiangEffects();
        } else if (this.gameState.currentView === 'congee') {
            this.renderCongeeEffects();
        }
    }

    renderYoutiaoEffects() {
        // 🎯 油条制作效果（只在油条界面显示）
        if (this.gameState.currentView !== 'youtiao') {
            return;
        }
        
        // 显示面团制作状态
        this.renderDoughState();
        
        const youtiaoInOil = this.gameState.youtiaoState.youtiaoInOil;
        
        // 🎯 始终渲染bucket中的油条，即使油锅是空的
        this.renderPendingYoutiaoInBucket();
        
        if (youtiaoInOil.length === 0) return;
        
        // 动态计算油锅区域位置
        const youguoPos = this.getYouguoPosition();
        const oilPotX = youguoPos.x;
        const oilPotY = youguoPos.y;
        const oilPotWidth = youguoPos.width;
        const oilPotHeight = youguoPos.height;
        
        // 🎯 每根油条在油锅中的位置 - 从左到右合理间距排列，支持多根油条
        const positions = [];
        const startX = oilPotX + oilPotWidth * 0.28 + 2 - 20; // 整体往右移动，然后往左移动20px
        const startY = oilPotY + oilPotHeight * 0.06; // 再往上移动一点点
        const spacingX = oilPotWidth * 0.15; // 保持当前间距不变
        
        // 🎯 动态生成位置，支持更多油条
        for (let i = 0; i < youtiaoInOil.length; i++) {
            positions.push({
                x: startX + i * spacingX,
                y: startY
            });
        }
        
        youtiaoInOil.forEach((youtiao, index) => {
            // 🎯 移除4根限制，支持显示所有油条
            
            const pos = positions[index];
            const progress = youtiao.cookProgress || 0;
            
            // 根据炸制进度和状态选择对应的油条图片 (youtiao1.1-1.6)
            let youtiaoImageIndex = 1;
            if (youtiao.overcooked) {
                // 过熟：允许显示到 5/6
                if (progress > 1.0) youtiaoImageIndex = 6; else youtiaoImageIndex = 5;
            } else if (youtiao.perfectTiming) {
                // 正常熟：显示到 4
                youtiaoImageIndex = 4;
            } else {
                // 未熟/正常过程中：仅到 4
                if (progress > 0.1) youtiaoImageIndex = 2;
                if (progress > 0.3) youtiaoImageIndex = 3;
                if (progress > 0.5) youtiaoImageIndex = 4;
            }
            
            const youtiaoImage = this[`youtiao1_${youtiaoImageIndex}Image`];
            
            // 绘制油条图片或备用矩形
            if (youtiaoImage && youtiaoImage.complete) {
                // 启用像素艺术渲染
                this.ctx.imageSmoothingEnabled = false;
                
                // 计算油条图片尺寸（对齐其他素材的缩放比例）
                const imageWidth = youtiaoImage.width * this.backgroundScaleX; // 与其他素材一致，使用原始缩放比例
                const imageHeight = youtiaoImage.height * this.backgroundScaleY;
                
                // 绘制油条图片（往上移动10px）
                this.ctx.drawImage(youtiaoImage, pos.x, pos.y - 10, imageWidth, imageHeight);
                
                // 恢复默认渲染设置
                this.ctx.imageSmoothingEnabled = true;
            } else {
                // 🎯 素材未加载时重新尝试加载
                console.warn(`油条图片 youtiao1_${youtiaoImageIndex} 未正确加载，尝试重新加载...`);
                this.reloadYoutiaoImage(youtiaoImageIndex);
                return; // 跳过此次绘制
            }
            
            // 显示熟度进度条（适应对齐其他素材的图片尺寸）
            const progressBarWidth = youtiaoImage && youtiaoImage.complete ? 
                youtiaoImage.width * this.backgroundScaleX : 80;
            const progressBarHeight = 8;
            const progressBarY = (pos.y - 10) + (youtiaoImage && youtiaoImage.complete ? 
                youtiaoImage.height * this.backgroundScaleY + 5 : 25);
            
            this.ctx.fillStyle = '#333';
            this.ctx.fillRect(pos.x, progressBarY, progressBarWidth, progressBarHeight);
            
            // 进度条填充
            const progressWidth = progressBarWidth * Math.min(1, progress);
            
            // 根据状态设置进度条颜色
            if (youtiao.overcooked) {
                this.ctx.fillStyle = '#FF0000'; // 红色表示过火
            } else if (youtiao.isCooked) {
                if (youtiao.perfectTiming) {
                    this.ctx.fillStyle = '#00FF00'; // 绿色表示最佳时机
                } else {
                    this.ctx.fillStyle = '#FFA500'; // 橙色表示可收集但不是最佳
                }
            } else {
                this.ctx.fillStyle = '#FFFF00'; // 黄色表示还在炸制
            }
            this.ctx.fillRect(pos.x, progressBarY, progressWidth, progressBarHeight);
            
            // 在进度条上显示最佳收集区间（1.3-1.4为完美区间）
            if (progress >= 1.0) {
                const perfectStart = progressBarWidth * (1.3 / 1.5); // 1.3在1.5总进度中的位置
                const perfectEnd = progressBarWidth * (1.4 / 1.5);   // 1.4在1.5总进度中的位置
                this.ctx.strokeStyle = '#00FF00'; // 更亮的绿色表示完美区间
                this.ctx.lineWidth = 3;
                this.ctx.beginPath();
                this.ctx.moveTo(pos.x + perfectStart, progressBarY - 2);
                this.ctx.lineTo(pos.x + perfectEnd, progressBarY - 2);
                this.ctx.stroke();
            }
            
            // 🎯 显示状态文字和点击提示 - 下锅后随时可以捞起
            // 所有油条都显示可拖拽的边框
            const highlightWidth = youtiaoImage && youtiaoImage.complete ? 
                youtiaoImage.width * this.backgroundScaleX + 4 : 84;
            const highlightHeight = youtiaoImage && youtiaoImage.complete ? 
                youtiaoImage.height * this.backgroundScaleY + 4 : 24;
            
            // 🎯 所有油条都显示新的收集提示
            this.ctx.fillStyle = '#FFF';
            this.ctx.font = '10px Arial';
            this.ctx.fillText('拖动收集', pos.x + 15, (pos.y - 10) + 45);
            
            if (youtiao.overcooked) {
                this.ctx.fillStyle = '#FF0000';
                this.ctx.font = '12px Arial';
                this.ctx.fillText('过火!', pos.x + 10, (pos.y - 10) - 5);
                
                // 过火油条用红色边框
                this.ctx.strokeStyle = '#FF4444';
                this.ctx.lineWidth = 3;
                this.ctx.setLineDash([6, 2]);
                this.ctx.strokeRect(pos.x - 2, pos.y - 2, highlightWidth, highlightHeight);
                this.ctx.setLineDash([]);
                this.ctx.lineWidth = 2;
            } else if (youtiao.isCooked) {
                if (youtiao.perfectTiming) {
                    this.ctx.fillStyle = '#00FF00';
                    this.ctx.font = '12px Arial';
                    this.ctx.fillText('完美!', pos.x + 10, pos.y - 5);
                    
                    // 完美油条用金色边框
                    this.ctx.strokeStyle = '#FFD700';
                    this.ctx.lineWidth = 3;
                    this.ctx.setLineDash([4, 4]);
                    this.ctx.strokeRect(pos.x - 2, pos.y - 2, highlightWidth, highlightHeight);
                    this.ctx.setLineDash([]);
                } else {
                    this.ctx.fillStyle = '#FFA500';
                    this.ctx.font = '12px Arial';
                    this.ctx.fillText('已熟', pos.x + 10, pos.y - 5);
                    
                    // 普通熟透油条用橙色边框
                    this.ctx.strokeStyle = '#FFA500';
                    this.ctx.lineWidth = 2;
                    this.ctx.setLineDash([4, 4]);
                    this.ctx.strokeRect(pos.x - 2, pos.y - 2, highlightWidth, highlightHeight);
                    this.ctx.setLineDash([]);
                }
                this.ctx.lineWidth = 2;
            } else {
                // 🎯 未熟的油条也可以拖拽，显示当前熟度
                const progressPercent = Math.floor(progress * 100);
                this.ctx.fillStyle = '#CCCCCC';
                this.ctx.font = '10px Arial';
                this.ctx.fillText(`${progressPercent}%`, pos.x + 10, (pos.y - 10) - 5);
                
                // 未熟油条用白色虚线边框表示可拖拽但未达最佳状态
                this.ctx.strokeStyle = '#CCCCCC';
                this.ctx.lineWidth = 1;
                this.ctx.setLineDash([2, 2]);
                this.ctx.strokeRect(pos.x - 2, (pos.y - 10) - 2, highlightWidth, highlightHeight);
                this.ctx.setLineDash([]);
                this.ctx.lineWidth = 2;
            }
            
                         // 🎯 显示油条判定区域为绿色方块
             if (false && youtiaoImage && youtiaoImage.complete) { // 禁用油条判定区域显示
                 // 🎯 绿框显示在白色虚线框位置（与判定区域一致）
                 const highlightWidth = youtiaoImage.width * this.backgroundScaleX + 4;
                 const highlightHeight = youtiaoImage.height * this.backgroundScaleY + 4;
                 const judgeX = pos.x - 2;
                 const judgeY = (pos.y - 10) - 2;
                 
                 // 绘制半透明绿色方块表示实际判定区域
                 this.ctx.fillStyle = 'rgba(0, 255, 0, 0.3)'; // 半透明绿色
                 this.ctx.fillRect(judgeX, judgeY, highlightWidth, highlightHeight);
                 
                 // 绘制绿色边框
                 this.ctx.strokeStyle = '#00FF00'; // 绿色边框
                 this.ctx.lineWidth = 2;
                 this.ctx.strokeRect(judgeX, judgeY, highlightWidth, highlightHeight);
            }
        });
        
        // 显示油锅状态信息
        this.ctx.fillStyle = '#333';
        this.ctx.font = 'bold 16px Arial';
        this.ctx.fillText(`油锅中: ${youtiaoInOil.length}/4 根油条`, oilPotX + 10, oilPotY - 10);
        
        // 显示操作提示
        this.ctx.fillStyle = '#666';
        this.ctx.font = '14px Arial';
        this.ctx.fillText('每根油条都可以单独点击拖拽收集', oilPotX + 10, oilPotY - 30);
        
        // 如果有熟透的油条，显示特殊提示
        const cookedCount = youtiaoInOil.filter(y => y.isCooked || y.overcooked).length;
        if (cookedCount > 0) {
            this.ctx.fillStyle = '#008000';
            this.ctx.font = 'bold 14px Arial';
            this.ctx.fillText(`${cookedCount} 根油条可以收集！`, oilPotX + 10, oilPotY + oilPotHeight + 20);
        }
    }

    // 🎯 渲染bucket中待放置的油条
    renderPendingYoutiaoInBucket() {
        // 🎯 确保pendingYoutiao存在
        if (!this.gameState.youtiaoState.pendingYoutiao) {
            this.gameState.youtiaoState.pendingYoutiao = [];
            console.log('🎯 初始化pendingYoutiao为空数组');
            return;
        }
        
        const pendingYoutiao = this.gameState.youtiaoState.pendingYoutiao;
        console.log(`🎯 渲染bucket - 当前有${pendingYoutiao.length}根待放置的油条`);
        
        if (pendingYoutiao.length === 0) return;
        
        // 🎯 计算bucket容量信息
        const bucketPos = this.getBucketPosition();
        const itemWidth = 35;
        const itemHeight = 20;
        const padding = 5;
        const availableWidth = bucketPos.width - (padding * 2);
        const itemsPerRow = Math.max(1, Math.floor(availableWidth / itemWidth));
        const maxVisibleRows = Math.floor(120 / itemHeight); // 假设最多向上120px
        const maxCapacity = itemsPerRow * maxVisibleRows;
        
        console.log(`🎯 渲染bucket中的油条，数量: ${pendingYoutiao.length}/${maxCapacity}, 每行: ${itemsPerRow}个`);
        
        // 保存当前渲染状态
        this.ctx.save();
        
        // 🎯 显示bucket容量信息
        if (pendingYoutiao.length > 0) {
            this.ctx.fillStyle = '#333';
            this.ctx.font = 'bold 12px Arial';
            this.ctx.fillText(`bucket: ${pendingYoutiao.length}/${maxCapacity}`, bucketPos.x, bucketPos.y - 50);
        }
        
        pendingYoutiao.forEach((pending, index) => {
            const youtiao = pending.youtiao;
            
            // 🎯 根据油条熟度选择素材：小于0.5时强制显示 shuyoutiao1
            let shuyoutiaoImageIndex;
            if (youtiao.cookProgress !== undefined && youtiao.cookProgress < 0.5) {
                shuyoutiaoImageIndex = 1;
            } else if (youtiao.overcooked) {
                shuyoutiaoImageIndex = 3; // 过熟: shuyoutiao3.png
            } else if (youtiao.perfectTiming) {
                shuyoutiaoImageIndex = 1; // 刚好: shuyoutiao1.png
            } else {
                shuyoutiaoImageIndex = 2; // 未熟: shuyoutiao2.png
            }
            
            console.log(`🎯 油条${index} 状态: ${youtiao.perfectTiming ? '刚好' : youtiao.overcooked ? '过熟' : '未熟'} → shuyoutiao${shuyoutiaoImageIndex}`);
            
            const shuyoutiaoImage = this[`shuyoutiao${shuyoutiaoImageIndex}Image`];
            
            // 🎯 调试shuyoutiao图片加载状态
            console.log(`🔍 检查 shuyoutiao${shuyoutiaoImageIndex} 加载状态:`, {
                exists: !!shuyoutiaoImage,
                complete: shuyoutiaoImage ? shuyoutiaoImage.complete : false,
                naturalWidth: shuyoutiaoImage ? shuyoutiaoImage.naturalWidth : 0,
                src: shuyoutiaoImage ? shuyoutiaoImage.src : 'N/A'
            });
            
            if (shuyoutiaoImage && shuyoutiaoImage.complete) {
                // 启用像素艺术渲染
                this.ctx.imageSmoothingEnabled = false;
                
                // 🎯 优化的位置计算：支持更多油条存放
                const bucketPos = this.getBucketPosition();
                
                // 🎯 更紧密的排列：减小间距，增加容量
                const itemWidth = 35; // 每个油条占用宽度
                const itemHeight = 20; // 每个油条占用高度
                const padding = 5; // 边距
                
                // 计算每行可以放多少个
                const availableWidth = bucketPos.width - (padding * 2);
                const itemsPerRow = Math.max(1, Math.floor(availableWidth / itemWidth));
                
                // 计算当前油条的行和列
                const row = Math.floor(index / itemsPerRow);
                const col = index % itemsPerRow;
                
                // 计算位置
                const offsetX = col * itemWidth;
                const offsetY = row * itemHeight;
                
                // 基于bucket位置计算最终坐标
                const x = bucketPos.x + padding + offsetX;
                const y = bucketPos.y - 45 - offsetY; // 从bucket上方45px开始，向上扩展
                
                // 计算尺寸（与其他素材一致的缩放）
                const assetScale = 0.6; // 稍小一些，适合bucket内部
                const imageWidth = shuyoutiaoImage.width * this.backgroundScaleX * assetScale;
                const imageHeight = shuyoutiaoImage.height * this.backgroundScaleY * assetScale;
                
                // 🎯 检查位置是否在画布内（只在有问题时警告）
                if (x < 0 || y < 0 || x > this.canvas.width || y > this.canvas.height) {
                    console.warn(`⚠️ 油条 ${index} 位置超出画布: (${x.toFixed(1)}, ${y.toFixed(1)})`);
                }
                
                // 🎯 显示行列信息（每行的第一个）
                if (col === 0) {
                    console.log(`📦 bucket第${row + 1}行开始，位置y: ${y.toFixed(1)}`);
                }
                
                // 绘制油条
                this.ctx.drawImage(shuyoutiaoImage, x, y, imageWidth, imageHeight);
                
                // 显示状态信息
                if (pending.readyToDrag) {
                    // 可拖拽状态：显示拖拽提示和发光效果
                    this.ctx.shadowColor = '#FFD700';
                    this.ctx.shadowBlur = 10;
                    this.ctx.strokeStyle = '#FFD700';
                    this.ctx.lineWidth = 2;
                    this.ctx.strokeRect(x - 2, y - 2, imageWidth + 4, imageHeight + 4);
                    this.ctx.shadowBlur = 0;
                    
                    this.ctx.fillStyle = '#00AA00';
                    this.ctx.font = 'bold 12px Arial';
                    this.ctx.fillText('点击', x, y - 5);
                } else {
                    // 等待状态：显示倒计时
                    const remainingTime = Math.max(0, 2000 - (Date.now() - pending.startTime));
                    const remainingSeconds = (remainingTime / 1000).toFixed(1);
                    
                    this.ctx.fillStyle = '#333';
                    this.ctx.font = 'bold 12px Arial';
                    this.ctx.fillText(`${remainingSeconds}s`, x + 10, y - 5);
                }
            } else {
                // 图片未加载时的备用显示
                console.warn(`⚠️ shuyoutiao${shuyoutiaoImageIndex} 图片未加载`);
                
                // 🎯 使用与上面相同的位置计算
                const bucketPos = this.getBucketPosition();
                const itemWidth = 35;
                const itemHeight = 20;
                const padding = 5;
                const availableWidth = bucketPos.width - (padding * 2);
                const itemsPerRow = Math.max(1, Math.floor(availableWidth / itemWidth));
                const row = Math.floor(index / itemsPerRow);
                const col = index % itemsPerRow;
                const offsetX = col * itemWidth;
                const offsetY = row * itemHeight;
                const x = bucketPos.x + padding + offsetX;
                const y = bucketPos.y - 45 - offsetY;
                
                this.ctx.fillStyle = youtiao.overcooked ? '#FF4444' : 
                                   youtiao.perfectTiming ? '#00AA00' : '#888888';
                this.ctx.fillRect(x, y, 40, 15);
                
                this.ctx.fillStyle = '#FFF';
                this.ctx.font = 'bold 10px Arial';
                this.ctx.fillText('油条', x + 5, y + 12);
            }
        });
        
        // 🎯 恢复渲染状态
        this.ctx.restore();
    }

    renderDoujiangEffects() {
        // 🎯 豆浆制作效果 - 支持最多6个碗，4-6位于第一排下方，居左对齐
        const doujiangItems = this.gameState.cookingItems.filter(item => item.type === 'doujiang');
        const maxDoujiangItems = Math.min(doujiangItems.length, 6);
        
        for (let i = 0; i < maxDoujiangItems; i++) {
            const item = doujiangItems[i];
            const index = i;
            
            // 🎯 使用统一的豆浆桌位置计算函数
            const tablePos = this.getDoujiangzhuoPosition();
                
            // 🎯 计算两排布局：每行3个（索引 0-2 第一排，3-5 第二排）
            const cupSpacing = 150;
            const leftOffset = 50;
            const startX = tablePos.x + leftOffset;
            const row = Math.floor(index / 3);
            const col = index % 3;
            const cupX = startX + col * cupSpacing;
            const baseY = tablePos.y - 15;
            const rowGap = 110; // 第二排向下偏移
            const cupY = baseY + row * rowGap;
            
            // 🎯 使用分级素材 doujiang1-4（1空，4满），按进度映射
            let currentImage;
            let level = 1;
            const p = Math.max(0, Math.min(1, item.progress || 0));
            if (p < 0.25) level = 1; else if (p < 0.5) level = 2; else if (p < 0.75) level = 3; else level = 4;
            const key = `doujiang${level}Image`;
            currentImage = this.doujiangBowlImages && this.doujiangBowlImages[key];
            
            if (currentImage && currentImage.complete) {
                // 保持像素艺术效果
                this.ctx.imageSmoothingEnabled = false;
                
                // 🎯 计算图片尺寸（与豆浆桌保持一致的缩放比例）
                const assetScale = 0.85; // 与豆浆桌使用相同的素材缩放系数
                const imageWidth = currentImage.width * this.backgroundScaleX * assetScale;
                const imageHeight = currentImage.height * this.backgroundScaleY * assetScale;
                
                this.ctx.drawImage(currentImage, cupX, cupY, imageWidth, imageHeight);

                // 🎯 若该碗正在倒豆浆，右上角显示 hu 图标，左边缘对齐碗的中线
                // 始终在豆浆区显示 hu 提示（可见性增强）
                const huX = cupX + imageWidth / 2;
                const huY = cupY - 12;
                if (this.huImage && this.huImage.complete) {
                    const huW = this.huImage.width * this.backgroundScaleX * 0.6;
                    const huH = this.huImage.height * this.backgroundScaleY * 0.6;
                    this.ctx.drawImage(this.huImage, Math.round(huX), Math.round(huY - huH), Math.round(huW), Math.round(huH));
                } else {
                    this.ctx.fillStyle = '#FFD700';
                    this.ctx.font = 'bold 16px Arial';
                    this.ctx.fillText('hu', Math.round(huX), Math.round(huY));
                }
                
                // 恢复默认渲染设置
                this.ctx.imageSmoothingEnabled = true;
            } else {
                // 🎯 素材未加载时提示
                console.warn(`豆浆碗图片 doujiang${level} 未正确加载`);
                return; // 跳过此次绘制
            }
            
            // 制作完成效果
            if (item.progress >= 1) {
                // 发光效果
                this.ctx.shadowColor = '#FFD700';
                this.ctx.shadowBlur = 15;
                this.ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
                this.ctx.beginPath();
                this.ctx.arc(cupX + 20, cupY + 20, 35, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.shadowBlur = 0;
                
                // 显示完成提示
                this.ctx.fillStyle = '#00AA00';
                this.ctx.font = 'bold 14px Arial';
                this.ctx.fillText('完成!', cupX - 5, cupY - 10);
            }
            
            // 显示进度百分比
            this.ctx.fillStyle = '#333';
            this.ctx.font = '12px Arial';
            this.ctx.fillText(`${Math.floor(item.progress * 100)}%`, cupX, cupY + 50);
            
            // 🎯 显示豆浆碗绿色方框，贴合图片显示
            if (false && currentImage && currentImage.complete) { // 禁用豆浆碗绿色方框显示
                // 🎯 绿框直接贴合图片位置
                const assetScale = 0.85;
                const bowlWidth = currentImage.width * this.backgroundScaleX * assetScale;
                const bowlHeight = currentImage.height * this.backgroundScaleY * assetScale;
                
                // 绘制半透明绿色方块，直接贴合图片
                this.ctx.fillStyle = 'rgba(0, 255, 0, 0.3)'; // 半透明绿色
                this.ctx.fillRect(cupX, cupY, bowlWidth, bowlHeight);
                
                // 绘制绿色边框，直接贴合图片
                this.ctx.strokeStyle = '#00FF00'; // 绿色边框
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(cupX, cupY, bowlWidth, bowlHeight);
            }
        }
        
        // 🎯 渲染wandui（碗堆），用于添加新的空碗（始终显示）
            this.renderWandui();
    }

    // 🎯 渲染wandui（碗堆）
    renderWandui() {
        if (!this.wanduiImage || !this.wanduiImage.complete) {
            console.warn('Wandui图片未加载完成，跳过渲染');
            return;
        }
        
        // 计算wandui的位置：第四个碗的右边35px，下方15px处
        const tablePos = this.getDoujiangzhuoPosition();
        const cupSpacing = 150;
        const leftOffset = 50;
        const startX = tablePos.x + leftOffset;
        
        // 第四个碗的位置（index 3）
        const fourthBowlX = startX + 3 * cupSpacing;
        const fourthBowlY = tablePos.y - 15;
        
        // wandui的位置
        const wanduiX = fourthBowlX + 35; // 右边35px
        const wanduiY = fourthBowlY - 110; // 上方110px（相比原来的+15，总共往上移动了125px）
        
        // 计算wandui的尺寸
        const assetScale = 0.85;
        const wanduiWidth = this.wanduiImage.width * this.backgroundScaleX * assetScale;
        const wanduiHeight = this.wanduiImage.height * this.backgroundScaleY * assetScale;
        
        // 保持像素艺术效果
        this.ctx.imageSmoothingEnabled = false;
        
        // 绘制wandui图片
        this.ctx.drawImage(this.wanduiImage, wanduiX, wanduiY, wanduiWidth, wanduiHeight);
        
        // 恢复默认渲染设置
        this.ctx.imageSmoothingEnabled = true;
        
        // 🎯 显示wandui的绿色调试框（如果需要）
        if (false) { // 禁用wandui调试框显示
            // 绘制半透明绿色方块
            this.ctx.fillStyle = 'rgba(255, 255, 0, 0.3)'; // 黄色表示wandui
            this.ctx.fillRect(wanduiX, wanduiY, wanduiWidth, wanduiHeight);
            
            // 绘制黄色边框
            this.ctx.strokeStyle = '#FFFF00';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(wanduiX, wanduiY, wanduiWidth, wanduiHeight);
        }
        
        // 显示提示文字
        this.ctx.fillStyle = '#333';
        this.ctx.font = 'bold 12px Arial';
        this.ctx.fillText('点击添加碗', wanduiX, wanduiY - 5);
    }

    renderCongeeEffects() {
        // 🎯 新的粥制作状态显示
        const congeeState = this.gameState.congeeState;
        const zhouImagePos = this.getZhouImagePosition();
        
        // 🎯 显示制作步骤提示
        this.renderCongeeStepIndicator();
        
        // 🎯 高亮当前可点击的元素
        this.renderCongeeHighlights();
        
        // 🎯 渲染完成的粥（可拖拽）- 已移除浅黄色方块代指
        // this.renderCompletedCongee();
        
        // 🎯 显示当前制作中的粥信息
        if (congeeState.congeeInProgress) {
            this.renderCongeeInProgress();
        }

        // 在豆浆视图底部渲染 hu2 并支持选中后跟随鼠标（始终可见）
        if (this.gameState.currentView === 'doujiang') {
            const tablePos = this.getDoujiangzhuoPosition();
            const assetScale = 0.7;
            const baseX = tablePos.x + 20;
            const baseY = tablePos.y + tablePos.height - 80; // 左下
            const img = this.hu2Image && this.hu2Image.complete ? this.hu2Image : null;
            if (img) {
                const w = img.width * this.backgroundScaleX * assetScale;
                const h = img.height * this.backgroundScaleY * assetScale;
                // 若未选中，画在固定位置；选中则画在鼠标处
                const drawX = this.gameState.doujiangState.kettleSelected ? (this.gameState.doujiangState.kettleX - w / 2) : baseX;
                const drawY = this.gameState.doujiangState.kettleSelected ? (this.gameState.doujiangState.kettleY - h / 2) : baseY;
                this.ctx.drawImage(img, Math.round(drawX), Math.round(drawY), Math.round(w), Math.round(h));
                // 保存用于点击检测
                this._hu2RenderBounds = { x: drawX, y: drawY, w, h };
            } else {
                // 备用矩形提示（素材未加载时）
                const w = 60, h = 40;
                const drawX = baseX, drawY = baseY;
                this.ctx.fillStyle = '#FFD700';
                this.ctx.fillRect(drawX, drawY, w, h);
                this._hu2RenderBounds = { x: drawX, y: drawY, w, h };
            }
        }
    }

    // 🎯 显示制作步骤指示器
    renderCongeeStepIndicator() {
        const step = this.gameState.congeeState.currentStep;
        let text = '';
        let color = '#2F4F4F';
        
        switch (step) {
            case 'idle':
                text = '1️⃣ 点击电饭煲开始制作';
                color = '#FF6B6B';
                break;
            case 'dianfanbao_clicked':
                text = '2️⃣ 点击粥开始制作粥底';
                color = '#4ECDC4';
                break;
            case 'zhou_ready':
                text = '3️⃣ 点击配菜进行选择';
                color = '#45B7D1';
                break;
            case 'selecting_sides':
                text = '4️⃣ 继续选择配菜或点击粥完成';
                color = '#96CEB4';
                break;
        }
        
        this.ctx.fillStyle = color;
        this.ctx.font = 'bold 24px Arial';
        this.ctx.fillText(text, 50, 50);
    }

    // 🎯 高亮当前可点击的元素
    renderCongeeHighlights() {
        const step = this.gameState.congeeState.currentStep;
        const sideItemPositions = this.getSideItemPositions();
        const dianfanbaoItem = sideItemPositions.find(item => item.name === '点饭包');
        const zhouItem = sideItemPositions.find(item => item.name === '粥');
        const configItems = sideItemPositions.filter(item => 
            ['咸菜', '咸蛋', '黄豆', '豆腐'].includes(item.name)
        );

        this.ctx.strokeStyle = '#FFD700';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([10, 5]);

        // 高亮当前应该点击的元素
        if (step === 'idle' && dianfanbaoItem) {
            this.ctx.strokeRect(dianfanbaoItem.x - 5, dianfanbaoItem.y - 5, 
                              dianfanbaoItem.width + 10, dianfanbaoItem.height + 10);
        } else if (step === 'dianfanbao_clicked' && zhouItem) {
            this.ctx.strokeRect(zhouItem.x - 5, zhouItem.y - 5, 
                              zhouItem.width + 10, zhouItem.height + 10);
        } else if (step === 'zhou_ready' || step === 'selecting_sides') {
            // 高亮所有配菜
            configItems.forEach(item => {
                this.ctx.strokeRect(item.x - 3, item.y - 3, 
                                  item.width + 6, item.height + 6);
            });
            
            // 如果已选择配菜，也高亮粥（完成按钮）
            if (step === 'selecting_sides' && zhouItem) {
                this.ctx.strokeStyle = '#4CAF50';
                this.ctx.strokeRect(zhouItem.x - 5, zhouItem.y - 5, 
                                  zhouItem.width + 10, zhouItem.height + 10);
            }
        }

        this.ctx.setLineDash([]);
    }

    // 🎯 渲染当前制作中的粥信息
    renderCongeeInProgress() {
        const congee = this.gameState.congeeState.congeeInProgress;
        if (!congee || congee.sides.length === 0) return;

        // 显示已选择的配菜
        this.ctx.fillStyle = '#000';
        this.ctx.font = '18px Arial';
        this.ctx.fillText('已选配菜：' + congee.sides.join('、'), 50, 120);
    }

    // 🎯 渲染完成的粥（可拖拽到餐盘）- 已移除浅黄色方块代指
    /*
    renderCompletedCongee() {
        const completedCongee = this.gameState.congeeState.completedCongee;
        if (completedCongee.length === 0) return;

        const zhouImagePos = this.getZhouImagePosition();
        if (!zhouImagePos) return;

        completedCongee.forEach((congee, index) => {
            const offsetX = index * 60;
            const offsetY = index * 30;
            const x = zhouImagePos.x + offsetX;
            const y = zhouImagePos.y - 50 + offsetY;

            // 绘制完成的粥碗（发光效果）
            this.ctx.shadowColor = '#FFD700';
            this.ctx.shadowBlur = 10;
            this.ctx.fillStyle = '#F5F5DC';
            this.ctx.fillRect(x, y, 40, 30);
            this.ctx.strokeStyle = '#8B4513';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(x, y, 40, 30);
            this.ctx.shadowBlur = 0;

            // 显示配菜信息
            this.ctx.fillStyle = '#000';
            this.ctx.font = '12px Arial';
            this.ctx.fillText(congee.sides.join(','), x - 10, y - 5);

            // 拖拽提示
            this.ctx.fillStyle = '#4CAF50';
            this.ctx.font = 'bold 10px Arial';
            this.ctx.fillText('可拖拽', x + 5, y + 45);
        });
    }
    */

    updateUI() {
        const elements = {
            money: document.getElementById('money'),
            reputation: document.getElementById('reputation'),
            shopLevel: document.getElementById('shopLevel'),
            timePhase: document.getElementById('timePhase'),
            dayCount: document.getElementById('dayCount'),
            customerCount: document.getElementById('customerCount'),
            timeLeft: document.getElementById('timeLeft'),
            orderList: document.getElementById('orderList')
        };
        
        if (elements.money) {
            // 确保金钱是数字，并格式化显示
            const moneyValue = Number(this.gameState.money) || 0;
            elements.money.textContent = moneyValue.toFixed(0);
            // 🎯 删除金钱更新日志
        // console.log('Money updated:', moneyValue, 'Original:', this.gameState.money);
        }
        if (elements.reputation) elements.reputation.textContent = this.gameState.reputation;
        if (elements.shopLevel) elements.shopLevel.textContent = this.gameState.shopName;
        if (elements.timePhase) elements.timePhase.textContent = this.gameState.phase === 'morning' ? '早晨' : '日落';
        if (elements.dayCount) elements.dayCount.textContent = this.gameState.day;
        if (elements.customerCount) elements.customerCount.textContent = this.gameState.customers.length;
        if (elements.timeLeft) elements.timeLeft.textContent = Math.ceil(this.timeLeft);
        
        // 检查店铺升降级
        this.updateShopLevel();
        
        // 更新订单列表 - 使用updateOrderArea方法避免重复逻辑
        // updateOrderArea方法已经处理了订单列表的显示，这里不再重复处理
        // 避免覆盖带有交餐按钮的订单元素
    }

    gameLoop() {
        const currentTime = Date.now();
        const deltaTime = currentTime - this.lastUpdate;
        this.lastUpdate = currentTime;

        console.log('GameLoop running at:', currentTime);

        // 更新游戏逻辑
        this.update(deltaTime);
        
        // 渲染画面
        this.render();

        // 继续循环
        requestAnimationFrame(() => this.gameLoop());
    }

    startCongeePreparation() {
        if (this.gameState.congeeState.isPreparingCongee) {
            this.showNotification('已经在制作粥了');
            return;
        }



        // 生成一个唯一的粥制作ID
        const congeeId = 'congee_' + Date.now();
        
        this.gameState.congeeState = {
            isPreparingCongee: true,
            hasBase: true,
            selectedSides: [],
            congeeId: congeeId
        };

        this.showNotification('开始盛粥...请选择配菜');
    }

    handleVegetableClick(x, y) {
        if (!this.gameState.congeeState.isPreparingCongee) {
            this.showNotification('请先点击粥锅开始制作');
            return;
        }

        const vegetables = [
            { name: '咸菜', x: 600 },
            { name: '萝卜', x: 800 },
            { name: '腌菜', x: 1000 },
            { name: '豆腐', x: 1200 },
            { name: '咸蛋', x: 1400 }
        ];

        // 计算点击的是哪种配菜
        const clickedIndex = Math.floor((x - 600) / 200);
        if (clickedIndex >= 0 && clickedIndex < vegetables.length) {
            const vegetable = vegetables[clickedIndex];
            
            // 检查是否已经选择过这种配菜
            if (this.gameState.congeeState.selectedSides.includes(vegetable.name)) {
                // 取消选择
                this.gameState.congeeState.selectedSides = this.gameState.congeeState.selectedSides.filter(
                    side => side !== vegetable.name
                );
                this.showNotification('取消选择 ' + vegetable.name);
            } else {
                // 添加选择
                this.gameState.congeeState.selectedSides.push(vegetable.name);
                this.showNotification('选择了 ' + vegetable.name);
            }
        }
    }

    completeCongeePreparation() {
        if (!this.gameState.congeeState.isPreparingCongee) {
            this.showNotification('没有在制作粥');
            return;
        }

        if (this.gameState.congeeState.selectedSides.length === 0) {
            this.showNotification('请至少选择一种配菜');
            return;
        }

        // 创建完成的粥配菜
        const completedCongee = {
            type: 'congee',
            quality: 85 + Math.random() * 15, // 85-100的质量
            timestamp: Date.now(),
            sides: [...this.gameState.congeeState.selectedSides],
            id: this.gameState.congeeState.congeeId
        };

        // 添加到完成食物列表
        this.gameState.completedFood.push(completedCongee);

        // 重置粥制作状态
        this.gameState.congeeState = {
            isPreparingCongee: false,
            hasBase: false,
            selectedSides: [],
            congeeId: null
        };

        this.updateCompletedFoodArea();
        this.showNotification('粥配菜制作完成！已放入成品槽');
    }

    startYoutiaoPreparation() {
        if (this.gameState.youtiaoState.isPreparingYoutiao) {
            this.showNotification('已经在制作油条了');
            return;
        }



        const youtiaoId = 'youtiao_' + Date.now();
        
        // 🎯 保留当前状态，只重置面团制作相关的状态
        const currentPendingYoutiao = this.gameState.youtiaoState.pendingYoutiao || [];
        const currentYoutiaoInOil = this.gameState.youtiaoState.youtiaoInOil || [];
        const currentCollectingState = this.gameState.youtiaoState.collectingState || {
            isTracking: false,
            startX: 0,
            startY: 0,
            targetYoutiao: null,
            targetIndex: -1,
            moveThreshold: 30
        };
        const currentPreparedDough = this.gameState.youtiaoState.preparedDough || 0;
        const currentMaxDoughPerBatch = this.gameState.youtiaoState.maxDoughPerBatch || 4;
        
        this.gameState.youtiaoState = {
            isPreparingYoutiao: true,
            currentStep: 'kneading',
            doughCircles: 0,
            stretchMoves: 0,
            youtiaoInOil: currentYoutiaoInOil, // 🎯 保留当前在油锅中的油条
            youtiaoId: youtiaoId,
            lastMouseX: 0,
            lastMouseY: 0,
            circleProgress: 0,
            stretchDirection: 0,
            // 🎯 保留油条收集状态
            collectingState: currentCollectingState,
            // 🎯 保留面团批次管理状态
            preparedDough: currentPreparedDough, // 保留已制作的面团数量
            maxDoughPerBatch: currentMaxDoughPerBatch, // 保留每批最大数量
            // 🎯 保留待放置的油条
            pendingYoutiao: currentPendingYoutiao
        };

        // 🎯 调试：确认状态保留
        const finalPendingCount = this.gameState.youtiaoState.pendingYoutiao ? this.gameState.youtiaoState.pendingYoutiao.length : 0;
        const finalOilCount = this.gameState.youtiaoState.youtiaoInOil ? this.gameState.youtiaoState.youtiaoInOil.length : 0;
        console.log(`🎯 开始制作面团后 - bucket中有${finalPendingCount}根油条，油锅中有${finalOilCount}根油条`);
        
        this.showNotification('开始制作油条！请用鼠标画圈揉面团');
    }

    handleKneadingMotion(x, y) {
        // 检查是否在面团区域内（基于miantuan位置的偏上区域）
        const miantuanPos = this.getMiantuanPosition();
        const doughAreaX = miantuanPos.x;
        const doughAreaY = miantuanPos.y;
        const doughAreaWidth = miantuanPos.width;
        const doughAreaHeight = miantuanPos.height * 0.6; // 只使用上部分60%的区域
        
        if (x < doughAreaX || x > doughAreaX + doughAreaWidth || 
            y < doughAreaY || y > doughAreaY + doughAreaHeight) return;

        const centerX = doughAreaX + doughAreaWidth / 2;
        const centerY = doughAreaY + doughAreaHeight / 2;
        const currentAngle = Math.atan2(y - centerY, x - centerX);
        
        if (this.gameState.youtiaoState.lastMouseX !== 0) {
            const lastAngle = Math.atan2(this.gameState.youtiaoState.lastMouseY - centerY, 
                                       this.gameState.youtiaoState.lastMouseX - centerX);
            
            let angleDiff = currentAngle - lastAngle;
            
            // 处理角度跳跃
            if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
            if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
            
            this.gameState.youtiaoState.circleProgress += Math.abs(angleDiff);
            
            // 检查是否完成一圈
            if (this.gameState.youtiaoState.circleProgress >= 2 * Math.PI) {
                this.gameState.youtiaoState.doughCircles++;
                this.gameState.youtiaoState.circleProgress = 0;
                this.showNotification(`完成第${this.gameState.youtiaoState.doughCircles}圈！`);
                
                if (this.gameState.youtiaoState.doughCircles >= 2) {
                    this.gameState.youtiaoState.currentStep = 'stretching';
                    this.showNotification('揉面完成！现在请上下移动鼠标拉伸面团');
                }
            }
        }
        
        this.gameState.youtiaoState.lastMouseX = x;
        this.gameState.youtiaoState.lastMouseY = y;
    }

    handleStretchingMotion(x, y) {
        // 检查是否在面团区域内（基于miantuan位置的偏上区域）
        const miantuanPos = this.getMiantuanPosition();
        const doughAreaX = miantuanPos.x;
        const doughAreaY = miantuanPos.y;
        const doughAreaWidth = miantuanPos.width;
        const doughAreaHeight = miantuanPos.height * 0.6; // 只使用上部分60%的区域
        
        if (x < doughAreaX || x > doughAreaX + doughAreaWidth || 
            y < doughAreaY || y > doughAreaY + doughAreaHeight) return;

        if (this.gameState.youtiaoState.lastMouseY !== 0) {
            const deltaY = y - this.gameState.youtiaoState.lastMouseY;
            
            if (Math.abs(deltaY) > 10) { // 最小移动距离
                if (deltaY > 0 && this.gameState.youtiaoState.stretchDirection !== 1) {
                    // 向下移动
                    this.gameState.youtiaoState.stretchDirection = 1;
                    this.gameState.youtiaoState.stretchMoves++;
                } else if (deltaY < 0 && this.gameState.youtiaoState.stretchDirection !== -1) {
                    // 向上移动
                    this.gameState.youtiaoState.stretchDirection = -1;
                    this.gameState.youtiaoState.stretchMoves++;
                }
                
                if (this.gameState.youtiaoState.stretchMoves >= 8) {
                    this.gameState.youtiaoState.currentStep = 'ready_to_fry';
                    // 🎯 增加已制作的面团数量计数
                    if (!this.gameState.youtiaoState.preparedDough) {
                        this.gameState.youtiaoState.preparedDough = 0;
                    }
                    this.gameState.youtiaoState.preparedDough++;
                    this.showNotification('拉伸完成！请拖拽面团到油锅下锅炸制');
                }
            }
        }
        
        this.gameState.youtiaoState.lastMouseY = y;
    }

    handleYoutiaoFrying(x, y) {
        // 确保面团制作步骤已完成
        if (this.gameState.youtiaoState.currentStep !== 'frying') {
            this.showNotification('请先完成面团的揉制和拉伸！');
            return;
        }

        if (this.gameState.youtiaoState.youtiaoInOil.length < 4) {
            // 添加油条到油锅
            const youtiao = {
                id: this.gameState.youtiaoState.youtiaoId + '_' + this.gameState.youtiaoState.youtiaoInOil.length,
                x: x,
                y: y,
                cookProgress: 0,
                isCooked: false,
                startTime: Date.now()
            };
            
            this.gameState.youtiaoState.youtiaoInOil.push(youtiao);
            this.showNotification('油条下锅了！注意观察熟度');
        } else {
            this.showNotification('油锅已满！最多同时炸4根油条');
        }
    }

    // 🎯 移除批量收集功能 - 保留函数但提示单个收集
    collectFinishedYoutiao() {
        this.showNotification('请拖拽单根油条进行收集！不再支持批量收集');
    }



    // 🎯 检查点击位置是否在油条上（用于收集检测）
    checkYoutiaoClickForCollection(x, y) {
        const youtiaoInOil = this.gameState.youtiaoState.youtiaoInOil;
        if (youtiaoInOil.length === 0) return null;
        
        // 🎯 使用与renderYoutiaoEffects完全相同的位置计算逻辑
        const youguoPos = this.getYouguoPosition();
        const oilPotX = youguoPos.x;
        const oilPotY = youguoPos.y;
        const oilPotWidth = youguoPos.width;
        const oilPotHeight = youguoPos.height;
        
        // 🎯 与renderYoutiaoEffects中positions计算完全一致
        const positions = [];
        const startX = oilPotX + oilPotWidth * 0.28 + 2 - 20; // 整体往右移动，然后往左移动20px
        const startY = oilPotY + oilPotHeight * 0.06; // 再往上移动一点点
        const spacingX = oilPotWidth * 0.15; // 保持当前间距不变
        
        // 🎯 动态生成位置，支持更多油条
        for (let i = 0; i < youtiaoInOil.length; i++) {
            positions.push({
                x: startX + i * spacingX,
                y: startY
            });
        }
        
        for (let i = 0; i < youtiaoInOil.length; i++) {
            const youtiao = youtiaoInOil[i];
            const pos = positions[i]; // 🎯 使用预计算的位置数组
            
            const progress = youtiao.cookProgress || 0;
            let youtiaoImageIndex = 1;
            if (youtiao.overcooked) {
                // 过熟的油条显示图片5.6
                youtiaoImageIndex = 6;
            } else if (youtiao.perfectTiming) {
                // 刚好的油条显示图片3.4
                youtiaoImageIndex = 4;
            } else {
                // 根据进度选择图片
                if (progress > 0.1) youtiaoImageIndex = 2;
                if (progress > 0.3) youtiaoImageIndex = 3;
                if (progress > 0.5) youtiaoImageIndex = 4;
                if (progress > 0.7) youtiaoImageIndex = 5;
                if (progress > 1.0) youtiaoImageIndex = 6;
            }
            
            const youtiaoImage = this[`youtiao1_${youtiaoImageIndex}Image`];
            
            // 🎯 只使用正确加载的图片尺寸，未加载时不进行判定
            if (!youtiaoImage || !youtiaoImage.complete) {
                console.warn(`油条图片 youtiao1_${youtiaoImageIndex} 未正确加载，跳过判定`);
                continue; // 跳过未加载的油条
            }
            const imageWidth = youtiaoImage.width * this.backgroundScaleX;
            const imageHeight = youtiaoImage.height * this.backgroundScaleY;
            
            // 🎯 判定区域位置移到白色虚线框位置
            const highlightWidth = youtiaoImage && youtiaoImage.complete ? 
                youtiaoImage.width * this.backgroundScaleX + 4 : 84;
            const highlightHeight = youtiaoImage && youtiaoImage.complete ? 
                youtiaoImage.height * this.backgroundScaleY + 4 : 24;
            const clickBoxLeft = pos.x - 2;
            const clickBoxRight = pos.x - 2 + highlightWidth;
            const clickBoxTop = (pos.y - 10) - 2;
            const clickBoxBottom = (pos.y - 10) - 2 + highlightHeight;
            
            // 调试信息
            console.log(`🔍 油条${i+1} 图片判定区域: [${clickBoxLeft.toFixed(1)}, ${clickBoxRight.toFixed(1)}, ${clickBoxTop.toFixed(1)}, ${clickBoxBottom.toFixed(1)}], 点击位置: [${x.toFixed(1)}, ${y.toFixed(1)}]`);
            
            // 🎯 判定区域完全匹配油条图片位置
            if (x >= clickBoxLeft && x <= clickBoxRight && y >= clickBoxTop && y <= clickBoxBottom) {
                console.log(`✅ 成功点击第${i+1}根油条图片！`);
                return { youtiao: youtiao, index: i };
            }
        }
        
        return null;
    }

    // 🎯 重新加载油条图片
    reloadYoutiaoImage(imageIndex) {
        const imageName = `youtiao1_${imageIndex}Image`;
        const imagePath = `images/youtiao1.${imageIndex}.png`;
        
        console.log(`正在重新加载油条图片: ${imagePath}`);
        
        if (this[imageName]) {
            this[imageName].src = imagePath; // 重新设置src触发重新加载
        } else {
            // 如果图片对象不存在，创建新的
            this[imageName] = new Image();
            this[imageName].onload = () => {
                console.log(`油条图片 ${imagePath} 重新加载成功`);
            };
            this[imageName].onerror = () => {
                console.error(`油条图片 ${imagePath} 重新加载失败`);
            };
            this[imageName].src = imagePath;
        }
    }

    // 🎯 重新加载豆浆图片
    reloadDoujiangImage(imageName) {
        const imagePath = `images/${imageName}.png`;
        
        console.log(`正在重新加载豆浆图片: ${imagePath}`);
        
        const imageProperty = `${imageName}Image`;
        if (this[imageProperty]) {
            this[imageProperty].src = imagePath; // 重新设置src触发重新加载
        } else {
            // 如果图片对象不存在，创建新的
            this[imageProperty] = new Image();
            this[imageProperty].onload = () => {
                console.log(`豆浆图片 ${imagePath} 重新加载成功`);
            };
            this[imageProperty].onerror = () => {
                console.error(`豆浆图片 ${imagePath} 重新加载失败`);
            };
            this[imageProperty].src = imagePath;
        }
    }

    // 🎯 基于移动距离收集油条
    collectYoutiaoByMovement(youtiao, index) {
        console.log(`🎯 基于移动距离收集油条 - 索引: ${index}`);
        
        // 创建完成的油条，根据炸制状态计算质量
        let quality;
        if (youtiao.overcooked) {
            quality = Math.max(30, 90 - (youtiao.cookProgress - 2.0) * 100);
        } else if (youtiao.perfectTiming) {
            quality = Math.min(100, 85 + youtiao.cookProgress * 15);
        } else {
            quality = Math.min(90, 60 + youtiao.cookProgress * 30);
        }
        
        const completedYoutiao = {
            type: 'youtiao',
            quality: Math.round(quality),
            timestamp: Date.now(),
            id: youtiao.id || Date.now(),
            perfectTiming: youtiao.perfectTiming || false,
            overcooked: youtiao.overcooked || false,
            // 保留炸制进度，供 bucket 渲染判断 < 0.5 显示 shuyoutiao1
            cookProgress: youtiao.cookProgress
        };
        
        // 🎯 新逻辑：先添加到待放置油条列表，而不是直接添加到完成食物
        const bucketPos = this.getBucketPosition();
        const pendingYoutiao = {
            youtiao: completedYoutiao,
            startTime: Date.now(),
            position: {
                x: bucketPos.x + bucketPos.width * 0.5 - 20, // bucket内部中心偏左
                y: bucketPos.y - 30 // bucket上方30px
            }
        };
        
        this.gameState.youtiaoState.pendingYoutiao.push(pendingYoutiao);
        
        // 从油锅中移除这根油条
        this.gameState.youtiaoState.youtiaoInOil.splice(index, 1);
        
        // 🎯 油锅空了，只重置油锅相关状态，保留面团和bucket状态
        if (this.gameState.youtiaoState.youtiaoInOil.length === 0) {
            // 🎯 调试：记录当前pending油条数量
            const currentPendingCount = this.gameState.youtiaoState.pendingYoutiao ? this.gameState.youtiaoState.pendingYoutiao.length : 0;
            console.log(`🎯 油锅空了！当前bucket中有${currentPendingCount}根油条`);
            
            // 只重置必要的油锅状态，保留面团制作进度和bucket中的油条
            this.gameState.youtiaoState.youtiaoInOil = [];
            this.gameState.youtiaoState.collectingState = {
                isTracking: false,
                startX: 0,
                startY: 0,
                targetYoutiao: null,
                targetIndex: -1,
                moveThreshold: 30
            };
            
            // 🎯 调试：确认pending油条仍然存在
            const afterPendingCount = this.gameState.youtiaoState.pendingYoutiao ? this.gameState.youtiaoState.pendingYoutiao.length : 0;
            console.log(`🎯 重置后bucket中有${afterPendingCount}根油条`);
        }
        
        // 更新显示
        this.updateSidebar();
        
        // 根据状态显示不同提示
        let qualityText = '';
        if (youtiao.overcooked) {
            qualityText = '(过火品质)';
        } else if (youtiao.perfectTiming) {
            qualityText = '(完美品质!)';
        } else {
            qualityText = '(普通品质)';
        }
        this.showNotification(`第${index + 1}根油条收集成功！${qualityText} 正在bucket中等待...`);
    }

    // 保留原有的点击处理逻辑（用于兼容性）
    // 🎯 面团拖拽到油锅的功能（使用油条拖拽逻辑）
    startDoughDrag(x, y) {
        if (this.gameState.youtiaoState.youtiaoInOil.length >= 4) {
            this.showNotification('油锅已满！最多同时炸4根油条');
            return;
        }

        // 🎯 设置拖拽状态（类似油条拖拽）
        this.dragState.isDragging = true;
        this.dragState.draggedItem = { 
            type: 'dough_to_oil',
            data: 'dough'
        };
        
        // 🎯 获取面团条图片尺寸（进一步放大一点）
        let dragWidth = 90, dragHeight = 60; // 默认更大
        
        if (this.miantuantiaoImage && this.miantuantiaoImage.complete && this.backgroundScaleX && this.backgroundScaleY) {
            // 使用与其他素材一致的缩放比例，并在基础上放大 1.1 倍
            dragWidth = Math.min(this.miantuantiaoImage.width * this.backgroundScaleX * 1.1, 140);
            dragHeight = Math.min(this.miantuantiaoImage.height * this.backgroundScaleY * 1.1, 84);
        }

        // 🎯 创建拖拽的视觉元素（使用miantuantiao图片）
        const dragElement = document.createElement('div');
        dragElement.style.position = 'fixed';
        dragElement.style.pointerEvents = 'none';
        dragElement.style.zIndex = '9999';
        dragElement.style.width = dragWidth + 'px';
        dragElement.style.height = dragHeight + 'px';
        
        // 🎯 使用miantuantiao图片作为背景
        if (this.miantuantiaoImage && this.miantuantiaoImage.complete) {
            dragElement.style.backgroundImage = `url(${this.miantuantiaoImage.src})`;
            dragElement.style.backgroundSize = 'contain';
            dragElement.style.backgroundRepeat = 'no-repeat';
            dragElement.style.backgroundPosition = 'center';
            dragElement.style.imageRendering = 'pixelated';
        } else {
            // 备用样式（如果图片未加载）
            dragElement.style.backgroundColor = '#D2B48C';
            dragElement.style.border = '2px solid #8B4513';
            dragElement.style.borderRadius = '20px';
            dragElement.textContent = '🥖面团';
            dragElement.style.textAlign = 'center';
            dragElement.style.lineHeight = dragHeight + 'px';
            dragElement.style.fontSize = '14px';
            dragElement.style.fontWeight = 'bold';
            dragElement.style.color = '#FFF';
            dragElement.style.textShadow = '1px 1px 2px rgba(0,0,0,0.7)';
        }
        
        dragElement.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
        
        // 🎯 修正坐标转换 - x,y已经是canvas内的坐标，需要转换为屏幕坐标
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = rect.width / this.canvas.width;
        const scaleY = rect.height / this.canvas.height;
        const screenX = rect.left + x * scaleX;
        const screenY = rect.top + y * scaleY;
        
        // 🎯 使用 transform 居中并跟随（更顺滑，GPU 加速）
        dragElement.style.left = '0px';
        dragElement.style.top = '0px';
        dragElement.style.transform = `translate(-50%, -50%) translate3d(${Math.round(screenX)}px, ${Math.round(screenY)}px, 0)`;
        dragElement.style.willChange = 'transform';
        dragElement.classList.add('dragging');
        
        document.body.appendChild(dragElement);
        this.dragState.draggedElement = dragElement;

        this.showNotification('拖到油锅内松手，才能下锅');

        // 启动拖动跟随一致性检测RAF
        const ensureFollow = () => {
            if (!this.dragState.isDragging || !this.dragState.draggedElement) {
                this.dragState.followRafId = null;
                return;
            }
            const ex = this.dragState.pointerScreenX;
            const ey = this.dragState.pointerScreenY;
            if (typeof ex === 'number' && typeof ey === 'number') {
                // 通过getBoundingClientRect评估偏差
                const rect = this.dragState.draggedElement.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                const dx = Math.abs(centerX - ex);
                const dy = Math.abs(centerY - ey);
                if (dx > 2 || dy > 2) {
                    // 轻微偏差则强制矫正一次
                    this.dragState.draggedElement.style.transform = `translate(-50%, -50%) translate3d(${Math.round(ex)}px, ${Math.round(ey)}px, 0)`;
                }
            }
            this.dragState.followRafId = requestAnimationFrame(ensureFollow);
        };
        if (this.dragState.followRafId) cancelAnimationFrame(this.dragState.followRafId);
        this.dragState.followRafId = requestAnimationFrame(ensureFollow);
    }

    handleYoutiaoClick(x, y) {
        // 这个函数现在主要用于处理非移动距离的直接点击
        // 实际的收集逻辑已经转移到基于移动距离的方式
        console.log('🎯 油条点击处理（现在使用移动距离收集机制）');
    }

    // 🎯 面团下锅处理函数（采用油条拖拽风格）
    addDoughToOil() {
        if (this.gameState.youtiaoState.youtiaoInOil.length >= 4) {
            this.showNotification('⚠️ 油锅已满！最多同时炸4根油条');
            return;
        }

        // 🎯 创建新的油条对象
        const youtiao = {
            id: this.gameState.youtiaoState.youtiaoId + '_' + this.gameState.youtiaoState.youtiaoInOil.length,
            cookProgress: 0,
            isCooked: false,
            startTime: Date.now(),
            perfectTiming: false,
            overcooked: false
        };
        
        this.gameState.youtiaoState.youtiaoInOil.push(youtiao);
        
        // 🎯 显示成功信息（类似油条拖拽风格）
        this.showNotification(`🥖 第${this.gameState.youtiaoState.youtiaoInOil.length}根油条下锅成功！(${this.gameState.youtiaoState.youtiaoInOil.length}/4)`);

        // 🎯 检查是否需要重新制作面团
        if (this.gameState.youtiaoState.youtiaoInOil.length >= this.gameState.youtiaoState.maxDoughPerBatch) {
            // 4条油条下锅完成，面团消失，重置制作状态
            this.gameState.youtiaoState.currentStep = 'idle';
            this.gameState.youtiaoState.isPreparingYoutiao = false;
            this.gameState.youtiaoState.preparedDough = 0;
            this.gameState.youtiaoState.doughCircles = 0;
            this.gameState.youtiaoState.stretchMoves = 0;
            this.showNotification('已下锅4根油条！面团用完，请制作新的面团');
        } else {
            // 继续使用当前面团制作下一根，保持ready_to_fry状态，面团mian3继续显示
            this.gameState.youtiaoState.currentStep = 'ready_to_fry';
            this.showNotification(`已下锅${this.gameState.youtiaoState.youtiaoInOil.length}根，还可下锅${this.gameState.youtiaoState.maxDoughPerBatch - this.gameState.youtiaoState.youtiaoInOil.length}根油条`);
        }
    }

    startYoutiaoLinking(youtiao, index, x, y) {
        // 设置拖拽状态
        this.dragState.isDragging = true;
        this.dragState.draggedItem = { 
            type: 'youtiao_from_oil',
            youtiao: youtiao,
            index: index
        };
        
        // 根据油条状态获取对应的图片尺寸
        const progress = youtiao.cookProgress || 0;
        let youtiaoImageIndex = 1;
        if (youtiao.overcooked) {
            // 过熟：允许显示到 5/6
            if (progress > 1.0) youtiaoImageIndex = 6; else youtiaoImageIndex = 5;
        } else if (youtiao.perfectTiming) {
            // 正常熟：显示到 4
            youtiaoImageIndex = 4;
        } else {
            // 未熟/正常过程中：仅到 4
            if (progress > 0.1) youtiaoImageIndex = 2;
            if (progress > 0.3) youtiaoImageIndex = 3;
            if (progress > 0.5) youtiaoImageIndex = 4;
        }
        
        const youtiaoImage = this[`youtiao1_${youtiaoImageIndex}Image`];
        let dragWidth = 110, dragHeight = 28; // 默认更大
        
        if (youtiaoImage && youtiaoImage.complete && this.backgroundScaleX && this.backgroundScaleY) {
            // 使用与其他素材一致的缩放比例，保持长宽比
            dragWidth = Math.min(youtiaoImage.width * this.backgroundScaleX * 1.1, 150);
            dragHeight = Math.min(youtiaoImage.height * this.backgroundScaleY * 1.1, 40);
        }
        
        // 创建拖拽的视觉元素
        const dragElement = document.createElement('div');
        dragElement.style.position = 'fixed';
        dragElement.style.pointerEvents = 'none';
        dragElement.style.zIndex = '9999';
        dragElement.style.width = dragWidth + 'px';
        dragElement.style.height = dragHeight + 'px';
        dragElement.style.backgroundColor = '#FFA500';
        dragElement.style.border = '2px solid #8B4513';
        dragElement.style.borderRadius = '8px';
        dragElement.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
        
        // 修正坐标转换 - x,y已经是canvas内的坐标，需要转换为屏幕坐标
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = rect.width / this.canvas.width;
        const scaleY = rect.height / this.canvas.height;
        const screenX = (x * scaleX) + rect.left;
        const screenY = (y * scaleY) + rect.top;
        
        // 使用 transform 跟随鼠标（更顺滑）
        dragElement.style.left = '0px';
        dragElement.style.top = '0px';
        dragElement.style.transform = `translate(-50%, -50%) translate3d(${Math.round(screenX)}px, ${Math.round(screenY)}px, 0)`;
        dragElement.style.willChange = 'transform';
        dragElement.classList.add('dragging');
        dragElement.textContent = `🥖${index + 1}`;
        dragElement.style.textAlign = 'center';
        dragElement.style.lineHeight = dragHeight + 'px';
        dragElement.style.fontSize = '14px';
        dragElement.style.fontWeight = 'bold';
        dragElement.style.color = '#FFF';
        dragElement.style.textShadow = '1px 1px 2px rgba(0,0,0,0.7)';
        
        document.body.appendChild(dragElement);
        this.dragState.draggedElement = dragElement;
        
        // 根据油条质量显示不同提示
        let qualityText = '';
        if (youtiao.perfectTiming) {
            qualityText = '完美品质';
        } else if (youtiao.overcooked) {
            qualityText = '过火品质';
        } else {
            qualityText = '普通品质';
        }
        this.showNotification(`拖拽第${index + 1}根油条(${qualityText})到顾客处或餐盘上`);
    }

    // 🎯 检测bucket中待放置油条的点击
    checkPendingYoutiaoClick(x, y) {
        const pendingYoutiao = this.gameState.youtiaoState.pendingYoutiao;
        
        for (let i = 0; i < pendingYoutiao.length; i++) {
            const pending = pendingYoutiao[i];
            
            // 只有可拖拽状态的油条才能被点击
            if (!pending.readyToDrag) continue;
            
            // 🎯 使用与渲染相同的位置计算
            const bucketPos = this.getBucketPosition();
            const itemWidth = 35;
            const itemHeight = 20;
            const padding = 5;
            const availableWidth = bucketPos.width - (padding * 2);
            const itemsPerRow = Math.max(1, Math.floor(availableWidth / itemWidth));
            const row = Math.floor(i / itemsPerRow);
            const col = i % itemsPerRow;
            const offsetX = col * itemWidth;
            const offsetY = row * itemHeight;
            const youtiaoX = bucketPos.x + padding + offsetX;
            const youtiaoY = bucketPos.y - 45 - offsetY;
            
            // 计算尺寸
            const assetScale = 0.6;
            let imageWidth = 40; // 默认宽度
            let imageHeight = 15; // 默认高度
            
            // 🎯 选择对应的shuyoutiao素材计算尺寸
            let shuyoutiaoImageIndex;
            if (pending.youtiao.overcooked) {
                shuyoutiaoImageIndex = 3; // 过熟: shuyoutiao3.png
            } else if (pending.youtiao.perfectTiming) {
                shuyoutiaoImageIndex = 1; // 刚好: shuyoutiao1.png
            } else {
                shuyoutiaoImageIndex = 2; // 未熟: shuyoutiao2.png
            }
            
            const shuyoutiaoImage = this[`shuyoutiao${shuyoutiaoImageIndex}Image`];
            
            // 🎯 调试shuyoutiao图片加载状态（点击检测）
            console.log(`🔍 点击检测 - shuyoutiao${shuyoutiaoImageIndex} 加载状态:`, {
                exists: !!shuyoutiaoImage,
                complete: shuyoutiaoImage ? shuyoutiaoImage.complete : false,
                naturalWidth: shuyoutiaoImage ? shuyoutiaoImage.naturalWidth : 0,
                src: shuyoutiaoImage ? shuyoutiaoImage.src : 'N/A'
            });
            
            if (shuyoutiaoImage && shuyoutiaoImage.complete) {
                imageWidth = shuyoutiaoImage.width * this.backgroundScaleX * assetScale;
                imageHeight = shuyoutiaoImage.height * this.backgroundScaleY * assetScale;
            }
            
            // 检测点击
            if (x >= youtiaoX && x <= youtiaoX + imageWidth &&
                y >= youtiaoY && y <= youtiaoY + imageHeight) {
                console.log(`🎯 点击到bucket中的油条索引: ${i}`);
                return { pending: pending, index: i };
            }
        }
        
        return null;
    }

    // 🎯 直接将bucket中的油条移动到完成餐食
    movePendingYoutiaoToCompleted(pending, index) {
        console.log(`🎯 直接移动bucket中的油条到完成餐食，索引: ${index}`);
        
        const youtiao = pending.youtiao;
        
        // 添加到完成餐食
        this.gameState.completedFood.push(youtiao);
        
        // 从待放置列表中移除
        this.gameState.youtiaoState.pendingYoutiao.splice(index, 1);
        
        // 更新UI
        this.updateCompletedFoodArea();
        
        // 根据油条质量显示不同提示
        let qualityText = '';
        if (youtiao.perfectTiming) {
            qualityText = '完美品质！';
        } else if (youtiao.overcooked) {
            qualityText = '有点焦了...';
        } else {
            qualityText = '还不错';
        }
        
        this.showNotification(`🥖 油条已放入完成餐食！${qualityText}`);
        
        // 播放成功音效（如果有的话）
        if (this.successSound && this.successSound.currentTime !== undefined) {
            this.successSound.currentTime = 0;
            this.successSound.play().catch(e => console.log('音效播放失败:', e));
        }
    }

    // 🎯 开始拖拽bucket中的油条
    startPendingYoutiaoDrag(e, pending, index) {
        console.log(`🎯 开始拖拽bucket中的油条，索引: ${index}`);
        
        this.dragState = {
            isDragging: true,
            draggedItem: {
                type: 'completed_youtiao',
                youtiao: pending.youtiao,
                pendingIndex: index
            },
            startX: e.clientX,
            startY: e.clientY,
            offsetX: 0,
            offsetY: 0
        };
        
        // 设置鼠标样式
        this.canvas.style.cursor = 'grabbing';
        
        let qualityText = '';
        if (pending.youtiao.perfectTiming) {
            qualityText = '(完美品质!)';
        } else if (pending.youtiao.overcooked) {
            qualityText = '(过火品质)';
        } else {
            qualityText = '(普通品质)';
        }
        
        this.showNotification(`拖拽油条${qualityText}到顾客处或餐盘上`);
    }

    handleYoutiaoDropped(x, y) {
        const draggedItem = this.dragState.draggedItem;
        const youtiao = draggedItem.youtiao;
        const index = draggedItem.index;

        // 创建完成的油条，根据炸制状态计算质量
        let quality;
        if (youtiao.overcooked) {
            // 过火的油条质量大幅下降
            quality = Math.max(30, 90 - (youtiao.cookProgress - 1.2) * 100);
        } else if (youtiao.perfectTiming) {
            // 完美时机的油条质量最高
            quality = Math.min(100, 85 + youtiao.cookProgress * 15);
        } else {
            // 一般时机的油条质量中等
            quality = Math.min(90, 60 + youtiao.cookProgress * 30);
        }
        
        const completedYoutiao = {
            type: 'youtiao',
            quality: Math.round(quality),
            timestamp: Date.now(),
            id: youtiao.id,
            perfectTiming: youtiao.perfectTiming || false,
            overcooked: youtiao.overcooked || false,
            cookProgress: youtiao.cookProgress
        };
        
        // 🎯 新逻辑：先添加到待放置油条列表，而不是直接添加到完成食物
        const bucketPos = this.getBucketPosition();
        const pendingYoutiao = {
            youtiao: completedYoutiao,
            startTime: Date.now(),
            position: {
                x: bucketPos.x + bucketPos.width * 0.5 - 20, // bucket内部中心偏左
                y: bucketPos.y - 30 // bucket上方30px
            }
        };
        
        this.gameState.youtiaoState.pendingYoutiao.push(pendingYoutiao);

        // 从油锅中移除这根油条
        this.gameState.youtiaoState.youtiaoInOil.splice(index, 1);
        
        // 🎯 油锅空了，只重置油锅相关状态，保留面团和bucket状态
        if (this.gameState.youtiaoState.youtiaoInOil.length === 0) {
            // 🎯 调试：记录当前pending油条数量
            const currentPendingCount = this.gameState.youtiaoState.pendingYoutiao ? this.gameState.youtiaoState.pendingYoutiao.length : 0;
            console.log(`🎯 油锅空了！当前bucket中有${currentPendingCount}根油条`);
            
            // 只重置必要的油锅状态，保留面团制作进度和bucket中的油条
            this.gameState.youtiaoState.youtiaoInOil = [];
            this.gameState.youtiaoState.collectingState = {
                isTracking: false,
                startX: 0,
                startY: 0,
                targetYoutiao: null,
                targetIndex: -1,
                moveThreshold: 30
            };
            
            // 🎯 调试：确认pending油条仍然存在
            const afterPendingCount = this.gameState.youtiaoState.pendingYoutiao ? this.gameState.youtiaoState.pendingYoutiao.length : 0;
            console.log(`🎯 重置后bucket中有${afterPendingCount}根油条`);
        }

        // 根据油条质量显示不同的收集消息
        let qualityText = '';
        if (youtiao.perfectTiming) {
            qualityText = '(完美品质!)';
        } else if (youtiao.overcooked) {
            qualityText = '(过火品质)';
        } else {
            qualityText = '(普通品质)';
        }
        this.showNotification(`第${index + 1}根油条收集成功！${qualityText} 正在bucket中等待...`);
    }

    renderDoughState() {
        const youtiaoState = this.gameState.youtiaoState;
        
        // 面团准备台区域（基于miantuan位置的偏上区域）
        const miantuanPos = this.getMiantuanPosition();
        const doughAreaX = miantuanPos.x;
        const doughAreaY = miantuanPos.y;
        const doughAreaWidth = miantuanPos.width;
        const doughAreaHeight = miantuanPos.height * 0.6; // 使用上部分60%的区域
        
        // 如果没有在制作油条，显示空台面
        if (!youtiaoState.isPreparingYoutiao || youtiaoState.currentStep === 'idle') {
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = 'bold 18px Arial';
            this.ctx.fillText('点击面团台开始制作油条', doughAreaX + 20, doughAreaY + 28);
            return;
        }
        
        // 计算面团图片的显示位置和尺寸（使用与其他素材一致的缩放比例）
        let imageWidth, imageHeight;
        
        // 根据当前状态选择对应的图片来计算尺寸
        let currentImage;
        if (youtiaoState.currentStep === 'kneading' && this.mian1Image && this.mian1Image.complete) {
            currentImage = this.mian1Image;
        } else if (youtiaoState.currentStep === 'stretching' && this.mian2Image && this.mian2Image.complete) {
            currentImage = this.mian2Image;
        } else if ((youtiaoState.currentStep === 'ready_to_fry' || youtiaoState.currentStep === 'frying') && this.mian3Image && this.mian3Image.complete) {
            currentImage = this.mian3Image;
        }
        
        if (currentImage && this.backgroundScaleX && this.backgroundScaleY) {
            // 使用与背景相同的缩放比例，保持图片原始长宽比
            imageWidth = currentImage.width * this.backgroundScaleX;
            imageHeight = currentImage.height * this.backgroundScaleY;
        } else {
            // 备用尺寸（如果图片未加载或缩放比例未设置）
            imageWidth = Math.min(doughAreaWidth * 0.8, 150);
            imageHeight = Math.min(doughAreaHeight * 0.7, 100);
        }
        
        // 确保图片不会超出面团台区域
        const maxWidth = doughAreaWidth * 0.9;
        const maxHeight = doughAreaHeight * 0.8;
        
        if (imageWidth > maxWidth) {
            const scale = maxWidth / imageWidth;
            imageWidth = maxWidth;
            imageHeight = imageHeight * scale;
        }
        
        if (imageHeight > maxHeight) {
            const scale = maxHeight / imageHeight;
            imageHeight = maxHeight;
            imageWidth = imageWidth * scale;
        }
        
        const imageX = doughAreaX + (doughAreaWidth - imageWidth) / 2; // 居中显示
        const imageY = doughAreaY + (doughAreaHeight - imageHeight) / 2; // 居中显示
        
        // 启用像素完美渲染
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.webkitImageSmoothingEnabled = false;
        this.ctx.mozImageSmoothingEnabled = false;
        this.ctx.msImageSmoothingEnabled = false;
        
        if (youtiaoState.currentStep === 'kneading') {
            // 显示揉面状态 - 使用mian1.png
            if (this.mian1Image && this.mian1Image.complete) {
                this.ctx.drawImage(this.mian1Image, imageX, imageY, imageWidth, imageHeight);
            } else {
                // 备用绘制（如果图片未加载）
                this.ctx.fillStyle = '#F5DEB3';
                this.ctx.beginPath();
                this.ctx.arc(imageX + imageWidth/2, imageY + imageHeight/2, 30, 0, Math.PI * 2);
                this.ctx.fill();
            }
            
            const completedCircles = youtiaoState.doughCircles;
            const progress = youtiaoState.circleProgress / (2 * Math.PI);
            
            // 显示进度文字（白色，整体上移）
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = 'bold 16px Arial';
            this.ctx.fillText(`揉面进度: ${completedCircles}/2 圈`, doughAreaX + 20, doughAreaY + 18);
            this.ctx.fillText('用鼠标画圈揉面团', doughAreaX + 20, doughAreaY + 36);
            
            // 显示进度圈（大幅加粗）
            if (progress > 0) {
                this.ctx.strokeStyle = '#DAA520';
                this.ctx.lineWidth = 6;
                this.ctx.beginPath();
                const radius = Math.max(10, Math.min(imageWidth, imageHeight) * 0.18);
                this.ctx.arc(imageX + imageWidth/2, imageY + imageHeight/2, radius, 0, progress * 2 * Math.PI);
                this.ctx.stroke();
            }
            
        } else if (youtiaoState.currentStep === 'stretching') {
            // 显示拉伸状态 - 使用mian2.png
            if (this.mian2Image && this.mian2Image.complete) {
                this.ctx.drawImage(this.mian2Image, imageX, imageY, imageWidth, imageHeight);
            } else {
                // 备用绘制（如果图片未加载）
                this.ctx.fillStyle = '#F5DEB3';
                this.ctx.fillRect(imageX, imageY + imageHeight/2 - 10, imageWidth, 20);
            }
            
            const stretchProgress = Math.min(1, youtiaoState.stretchMoves / 8);
            
            // 显示进度文字（白色，整体上移）
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = 'bold 16px Arial';
            this.ctx.fillText(`拉伸进度: ${youtiaoState.stretchMoves}/8`, doughAreaX + 20, doughAreaY + 18);
            this.ctx.fillText('上下移动鼠标拉伸面团', doughAreaX + 20, doughAreaY + 36);
            
            if (stretchProgress >= 1) {
                this.ctx.fillStyle = '#00AA00';
                this.ctx.fillText('拉伸完成！点击油锅下锅炸制', doughAreaX + 20, doughAreaY + 70);
            }
            
        } else if (youtiaoState.currentStep === 'ready_to_fry' || youtiaoState.currentStep === 'frying') {
            // 显示炸制准备状态 - 使用mian3.png
            if (this.mian3Image && this.mian3Image.complete) {
                this.ctx.drawImage(this.mian3Image, imageX, imageY, imageWidth, imageHeight);
            } else {
                // 备用绘制（如果图片未加载）
                this.ctx.fillStyle = '#F5DEB3';
                this.ctx.fillRect(imageX, imageY + imageHeight/2 - 10, imageWidth, 20);
            }
            
            // 🎯 显示下锅提示和剩余可制作数量
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = 'bold 16px Arial';
            this.ctx.fillText('拖拽面团到油锅下锅炸制', doughAreaX + 20, doughAreaY + 56);
            this.ctx.font = '14px Arial';
            this.ctx.fillText(`锅内: ${youtiaoState.youtiaoInOil.length}/4根`, doughAreaX + 20, doughAreaY + 74);
            this.ctx.font = '12px Arial';
            this.ctx.fillText(`还可下锅: ${4 - youtiaoState.youtiaoInOil.length}根`, doughAreaX + 20, doughAreaY + 92);
        }
        
        // 恢复默认渲染设置
        this.ctx.imageSmoothingEnabled = false; // 保持像素风格
    }

    // 🎯 更新待放置的油条（2秒后变成可拖拽状态）
    updatePendingYoutiao() {
        // 🎯 确保pendingYoutiao存在
        if (!this.gameState.youtiaoState.pendingYoutiao) {
            this.gameState.youtiaoState.pendingYoutiao = [];
            return;
        }
        
        const currentTime = Date.now();
        
        // 检查哪些油条已经等待了2秒，将其标记为可拖拽
        this.gameState.youtiaoState.pendingYoutiao.forEach(pending => {
            if (currentTime - pending.startTime >= 2000 && !pending.readyToDrag) {
                pending.readyToDrag = true; // 标记为可拖拽
                
                let qualityText = '';
                if (pending.youtiao.perfectTiming) {
                    qualityText = '(完美品质!)';
                } else if (pending.youtiao.overcooked) {
                    qualityText = '(过火品质)';
                } else {
                    qualityText = '(普通品质)';
                }
                this.showNotification(`油条${qualityText}可以拖拽了！`);
            }
        });
    }

    updateYoutiaoInOil() {
        const currentTime = Date.now();
        
        this.gameState.youtiaoState.youtiaoInOil.forEach(youtiao => {
            const timePassed = currentTime - youtiao.startTime;
            youtiao.cookProgress = Math.min(2.5, timePassed / 6000); // 6秒完全熟透，15秒过火上限
            
            // 🎯 更精细的熟度控制 - 扩大完美区间
            if (youtiao.cookProgress >= 0.7 && youtiao.cookProgress < 2.0 && !youtiao.isCooked) {
                youtiao.isCooked = true;
                // 🎯 扩大完美时机区间：从1.0-1.6（6-9.6秒）
                youtiao.perfectTiming = youtiao.cookProgress >= 1.0 && youtiao.cookProgress <= 1.6;
            }
            
            // 🎯 过火警告 - 改为12s以后才显示（进度2.0对应12秒）
            if (youtiao.cookProgress >= 2.0 && !youtiao.overcooked) {
                youtiao.overcooked = true;
                this.showNotification('⚠️ 油条过火了！质量会下降！', 2000);
            }
        });
    }

    handleDragMouseMove(e) {
        if (!this.dragState.isDragging) return;

        if (this.dragState.draggedElement) {
            // 🎯 对于油条拖拽，使用元素中心对齐鼠标
            if (this.dragState.draggedItem && this.dragState.draggedItem.type === 'youtiao_from_oil') {
                this.dragState.draggedElement.style.transform = `translate(-50%, -50%) translate3d(${Math.round(e.clientX)}px, ${Math.round(e.clientY)}px, 0)`;
            }
            // 🎯 对于面团拖拽，使用 transform 跟随（更跟手）
            else if (this.dragState.draggedItem && this.dragState.draggedItem.type === 'dough_to_oil') {
                // 先设置到目标位置
                this.dragState.draggedElement.style.transform = `translate(-50%, -50%) translate3d(${Math.round(e.clientX)}px, ${Math.round(e.clientY)}px, 0)`;
                // 立刻检测是否贴合，如不贴合则强制纠正一次
                const rect = this.dragState.draggedElement.getBoundingClientRect();
                const cx = rect.left + rect.width / 2;
                const cy = rect.top + rect.height / 2;
                if (Math.abs(cx - e.clientX) > 1 || Math.abs(cy - e.clientY) > 1) {
                    this.dragState.draggedElement.style.transform = `translate(-50%, -50%) translate3d(${Math.round(e.clientX)}px, ${Math.round(e.clientY)}px, 0)`;
                }
            } else {
                // 普通食物拖拽
                this.dragState.draggedElement.style.left = (e.clientX - 45) + 'px';
                this.dragState.draggedElement.style.top = (e.clientY - 45) + 'px';
            }
        }

        // 计算鼠标相对于容器的坐标（提高精度）
        const containerRect = document.getElementById('gameContainer').getBoundingClientRect();
        const mouseX = e.clientX - containerRect.left;
        const mouseY = e.clientY - containerRect.top;

        // 检查是否悬停在餐盘上 (对所有拖拽物品都启用)
        const plateArea = document.getElementById('currentPlate');
        if (plateArea) {
            const plateRect = plateArea.getBoundingClientRect();
            
            const plateX = plateRect.left - containerRect.left;
            const plateY = plateRect.top - containerRect.top;
            const plateWidth = plateRect.width;
            const plateHeight = plateRect.height;
            
            if (mouseX >= plateX && mouseX <= plateX + plateWidth && 
                mouseY >= plateY && mouseY <= plateY + plateHeight) {
                plateArea.classList.add('drop-zone');
            } else {
                plateArea.classList.remove('drop-zone');
            }
        }
        
        // 检查是否悬停在订单上（整个订单作为拖拽目标）
        const orderTargets = document.querySelectorAll('.order-content-target');
        orderTargets.forEach(target => {
            const rect = target.getBoundingClientRect();
            const targetX = rect.left - containerRect.left;
            const targetY = rect.top - containerRect.top;
            const targetWidth = rect.width;
            const targetHeight = rect.height;
            
            // 扩大检测区域，提高灵敏度（增加8像素的容差）
            const tolerance = 8;
            if (mouseX >= targetX - tolerance && mouseX <= targetX + targetWidth + tolerance && 
                mouseY >= targetY - tolerance && mouseY <= targetY + targetHeight + tolerance) {
                target.style.borderColor = '#4CAF50';
                target.style.backgroundColor = 'rgba(76, 175, 80, 0.2)';
                target.style.transform = 'scale(1.02)'; // 轻微缩放效果
                target.style.boxShadow = '0 4px 12px rgba(76, 175, 80, 0.3)';
                target.classList.add('order-drop-zone');
            } else {
                target.style.borderColor = 'transparent';
                target.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                target.style.transform = 'scale(1)';
                target.style.boxShadow = 'none';
                target.classList.remove('order-drop-zone');
            }
        });
    }

    updateTime(deltaTime) {
        if (!this.gameState.isRunning || this.gameState.isPaused) return;
        
        // 启用按单量结束时，也增加超时判定：超过60秒强制结束
        if (this.config.useOrderTargetEnd) {
            this.timeLeft = Math.max(0, this.timeLeft - deltaTime / 1000);
            // 以配置的 dayDuration 为上限
            const limitMs = Math.max(0, (this.config && this.config.dayDuration ? this.config.dayDuration : 60) * 1000);
            if ((this._elapsedDayMs || 0) >= limitMs) {
                this.triggerEndOfDayByOrders();
                return;
            }
            this._elapsedDayMs = (this._elapsedDayMs || 0) + deltaTime;
            return;
        }
        
        this.timeLeft -= deltaTime / 1000;
        if (this.timeLeft <= 0) {
            this.endPhase();
        }
    }

    updateShopLevel() {
        const reputation = this.gameState.reputation;
        let newLevel = 1;
        let newName = '普通店';
        
        // 根据声誉确定店铺等级
        if (reputation >= 90) {
            newLevel = 5;
            newName = '五星名店';
        } else if (reputation >= 70) {
            newLevel = 4;
            newName = '知名店铺';
        } else if (reputation >= 50) {
            newLevel = 3;
            newName = '受欢迎店';
        } else if (reputation >= 30) {
            newLevel = 2;
            newName = '小有名气';
        } else {
            newLevel = 1;
            newName = '普通店';
        }
        
        // 检查是否升级或降级
        if (newLevel > this.gameState.shopLevel) {
            this.gameState.shopLevel = newLevel;
            this.gameState.shopName = newName;
            this.showNotification(`🎉 店铺升级到${newName}！顾客更愿意光顾了！`, 4000);
        } else if (newLevel < this.gameState.shopLevel) {
            this.gameState.shopLevel = newLevel;
            this.gameState.shopName = newName;
            this.showNotification(`⚠️ 店铺降级到${newName}，需要提高服务质量！`, 4000);
        }
        
        // 根据店铺等级调整顾客生成率
        this.adjustGameplayByShopLevel();
    }

    adjustGameplayByShopLevel() {
        const level = this.gameState.shopLevel;
        
        // 根据店铺等级调整最大顾客数和生成率
        switch(level) {
            case 5: // 五星名店
                this.config.maxCustomers = 4;
                this.config.customerSpawnRate = 0.4;
                break;
            case 4: // 知名店铺
                this.config.maxCustomers = 3;
                this.config.customerSpawnRate = 0.3;
                break;
            case 3: // 受欢迎店
                this.config.maxCustomers = 3;
                this.config.customerSpawnRate = 0.25;
                break;
            case 2: // 小有名气
                this.config.maxCustomers = 2;
                this.config.customerSpawnRate = 0.2;
                break;
            case 1: // 普通店
            default:
                this.config.maxCustomers = 2;
                this.config.customerSpawnRate = 0.15;
                break;
        }
    }

    stopPouring() {
        this.gameState.cookingItems.forEach(item => {
            if (item.type === 'doujiang' && item.isPourHeld) {
                item.isPourHeld = false;
            }
        });
    }

    startDoujiangMaking() {
        // 🎯 检查是否已经有任何豆浆项目（不管状态）
        const existingItem = this.gameState.cookingItems.find(item => item.type === 'doujiang');

        if (existingItem) {
            // 继续制作现有的豆浆
            existingItem.isMaking = true;
            existingItem.status = 'cooking'; // 确保状态正确
            this.showNotification('继续制作豆浆...', 500);
        } else {
            // 开始新的豆浆制作
            const newItem = {
                id: Date.now() + Math.random(), // 添加唯一ID
                type: 'doujiang',
                startTime: Date.now(),
                cookTime: 3000, // 3秒制作时间
                progress: 0,
                status: 'cooking',
                isMaking: true,
                quality: 'perfect' // 简化质量系统
            };

            this.gameState.cookingItems.push(newItem);
            this.showNotification('开始制作豆浆...', 1000);
        }
    }

    stopDoujiangMaking() {
        this.gameState.cookingItems.forEach(item => {
            if (item.type === 'doujiang' && item.isMaking) {
                item.isMaking = false;
            }
        });
    }

    startCongeeServing() {

        // 检查是否准备了粥底
        if (!this.gameState.congeeState.isPreparingCongee) {
            this.showNotification('请先点击粥锅制作粥底！', 2000);
            return;
        }

        // 计算总需求数量
        let totalNeed = 0;
        pendingOrders.forEach(order => {
            order.items.forEach(item => {
                if (item.type === 'congee') {
                    totalNeed += item.quantity;
                }
            });
        });

        // 计算已制作的粥数量
        const existingCongee = this.gameState.completedFood.filter(food => food.type === 'congee').length;
        const currentMaking = this.gameState.cookingItems.filter(item => item.type === 'congee').length;

        if (existingCongee + currentMaking >= totalNeed) {
            this.showNotification(`粥配菜已经够了！需要:${totalNeed}碗 已有:${existingCongee + currentMaking}碗`, 2000);
            return;
        }

        // 检查是否已经有正在盛制的粥
        const existingItem = this.gameState.cookingItems.find(item => 
            item.type === 'congee' && item.status === 'cooking'
        );

        if (existingItem) {
            // 继续盛制现有的粥
            existingItem.isMaking = true;
            this.showNotification('继续盛粥...', 500);
        } else {
            // 开始新的粥盛制
            const newItem = {
                type: 'congee',
                startTime: Date.now(),
                cookTime: 1500, // 1.5秒盛粥时间
                progress: 0,
                status: 'cooking',
                isMaking: true,
                quality: 'perfect',
                sides: [...this.gameState.congeeState.selectedSides] // 包含配菜信息
            };

            this.gameState.cookingItems.push(newItem);
            const remaining = totalNeed - existingCongee - currentMaking - 1;
            this.showNotification(`盛粥中... 还需要:${remaining}碗`, 1000);
        }
    }

    stopCongeeServing() {
        this.gameState.cookingItems.forEach(item => {
            if (item.type === 'congee' && item.isMaking) {
                item.isMaking = false;
            }
        });
    }

    render() {
        // 清空画布
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 根据当前视图渲染不同的背景和内容
        if (this.gameState.currentView === 'main') {
            if (this.sprites.background) {
                this.ctx.drawImage(this.sprites.background, 0, 0);
            } else {
                console.error('Background sprite not found! Attempting to reload...');
                this.retryLoadAsset('background');
                return; // 跳过此次渲染，等待重新加载
            }
            this.renderMainView();
            // 在主界面也显示制作进度
            this.renderMainCookingProgress();

            // 🎯 先绘制卷帘门，再绘制front，保证front不被遮挡
            this.renderJuanLianMen();
            this.renderFront();
            
            // 🎯 最后绘制标题（最上层）
            this.renderBiaoTi();
            
            // 🎯 绘制金钱显示（最上层）
            this.renderMoneyDisplay();

            // 开始前也绘制front和UI：当还未营业时确保可见
            if (!this.gameState.isRunning) {
                this.renderFront();
                this.renderBiaoTi();
                this.renderMoneyDisplay();
            }
        } else if (this.gameState.currentView === 'youtiao') {
            if (this.sprites.youtiaoWorkspace) {
                this.ctx.drawImage(this.sprites.youtiaoWorkspace, 0, 0);
            } else {
                console.error('YoutiaoWorkspace sprite not found! Attempting to reload...');
                this.retryLoadAsset('youtiaoWorkspace');
                return; // 跳过此次渲染，等待重新加载
            }
            this.renderWorkspaceProgress();
            
            // 🎯 绘制卷帘门（在其他界面也需要显示）
            this.renderJuanLianMen();
            
            // 🎯 在其他界面也显示标题和金钱（最上层）
            this.renderBiaoTi();
            this.renderMoneyDisplay();
        } else if (this.gameState.currentView === 'doujiang') {
            if (this.sprites.doujiangWorkspace) {
                this.ctx.drawImage(this.sprites.doujiangWorkspace, 0, 0);
            } else {
                console.error('DoujiangWorkspace sprite not found! Attempting to reload...');
                this.retryLoadAsset('doujiangWorkspace');
                return; // 跳过此次渲染，等待重新加载
            }
            this.renderWorkspaceProgress();
            
            // 🎯 绘制卷帘门（在其他界面也需要显示）
            this.renderJuanLianMen();
            
            // 🎯 在其他界面也显示标题和金钱（最上层）
            this.renderBiaoTi();
            this.renderMoneyDisplay();
        } else if (this.gameState.currentView === 'congee') {
            if (this.sprites.congeeWorkspace) {
                this.ctx.drawImage(this.sprites.congeeWorkspace, 0, 0);
            } else {
                console.error('CongeeWorkspace sprite not found! Attempting to reload...');
                this.retryLoadAsset('congeeWorkspace');
                return; // 跳过此次渲染，等待重新加载
            }
            this.renderWorkspaceProgress();
            
            // 🎯 绘制卷帘门（在其他界面也需要显示）
            this.renderJuanLianMen();
            
            // 🎯 在其他界面也显示标题和金钱（最上层）
            this.renderBiaoTi();
            this.renderMoneyDisplay();
        }
        
        this.updateUI();
    }

    gameLoop() {
        const currentTime = Date.now();
        const deltaTime = currentTime - this.lastUpdate;
        this.lastUpdate = currentTime;

        // 更新游戏逻辑
        this.update(deltaTime);
        
        // 渲染画面
        this.render();

        // 继续循环
        requestAnimationFrame(() => this.gameLoop());
    }

    renderMainView() {
        // 绘制桌子状态（桌子图像已在background中）
        this.gameState.tables.forEach((table, index) => {
            // 桌号标签
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            this.ctx.fillRect(table.x + table.width - 35, table.y - 25, 30, 20);
            this.ctx.fillStyle = '#FFF';
            this.ctx.font = 'bold 14px Arial';
            this.ctx.fillText((index + 1).toString(), table.x + table.width - 25, table.y - 10);
            
            // 清理状态指示
            if (table.needsCleaning) {
                this.ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
                this.ctx.fillRect(table.x, table.y, table.width, table.height);
                
                this.ctx.fillStyle = '#FFF';
                this.ctx.font = 'bold 16px Arial';
                this.ctx.fillText('需清理', table.x + table.width/2 - 30, table.y + table.height/2);
                
                // 清理提示闪烁
                const flashTime = Date.now() % 1000;
                if (flashTime < 500) {
                    this.ctx.strokeStyle = '#FF0000';
                    this.ctx.lineWidth = 3;
                    this.ctx.strokeRect(table.x - 2, table.y - 2, table.width + 4, table.height + 4);
                }
            }
        });
        
        // 绘制顾客（使用guke1，保持原生像素尺寸，完美像素）
        this.gameState.customers.forEach(customer => {
            this.ctx.save();
            
            // 不再换色，保持原图
            this.ctx.globalAlpha = 1;
            this.ctx.filter = 'none';

            // 开启像素风格渲染（关闭平滑）
            this.ctx.imageSmoothingEnabled = false;
            if (this.ctx.webkitImageSmoothingEnabled !== undefined) this.ctx.webkitImageSmoothingEnabled = false;
            if (this.ctx.mozImageSmoothingEnabled !== undefined) this.ctx.mozImageSmoothingEnabled = false;
            if (this.ctx.msImageSmoothingEnabled !== undefined) this.ctx.msImageSmoothingEnabled = false;

            // 使用顾客的判定区尺寸进行绘制，使素材贴合判定区
            const img = (customer.spriteImg && customer.spriteImg.complete) ? customer.spriteImg : this.sprites.customer;
            const drawW = (customer.width && Number.isFinite(customer.width)) ? customer.width : 180;
            const drawH = (customer.height && Number.isFinite(customer.height)) ? customer.height : 360;

            // 对齐到整数坐标，避免子像素导致的渲染模糊
            const drawX = Math.round(customer.x);
            const drawY = Math.round(customer.y);

            this.ctx.drawImage(img, drawX, drawY, drawW, drawH);
            
            // 调试：显示顾客点击区域（半透明边框） - 已禁用
            if (false && customer.state === 'waiting' && !customer.hasOrdered) {
                this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(customer.x, customer.y, customer.width || 180, customer.height || 360);
            }
            
            // 顾客状态显示
            if (customer.hasOrdered && customer.state === 'waiting') {
                // 耐心条
                const barWidth = 50;
                const barHeight = 8;
                const barX = customer.x + 5;
                const barY = customer.y - 15;
                const patienceRatio = customer.patience / customer.maxPatience;
                
                // 耐心条背景
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                this.ctx.fillRect(barX, barY, barWidth, barHeight);
                
                // 耐心条填充
                this.ctx.fillStyle = patienceRatio > 0.5 ? '#4CAF50' : 
                                   patienceRatio > 0.3 ? '#FFA500' : '#FF4444';
                this.ctx.fillRect(barX, barY, barWidth * patienceRatio, barHeight);
                
                // 订单类型指示
                this.ctx.fillStyle = customer.type === 'takeaway' ? '#2196F3' : '#FF9800';
                this.ctx.font = 'bold 12px Arial';
                this.ctx.fillText(customer.type === 'takeaway' ? '外带' : '堂食', 
                                customer.x + 14, customer.y - 60); // 按3倍调整位置
            }
            
            // 可点击提示（使用woo素材替代原气泡，按顾客拉伸比例渲染）
            if (customer.state === 'waiting' && !customer.hasOrdered) {
                // 降低调试频率，只在每秒打印一次
                if (Math.floor(Date.now() / 1000) % 2 === 0) {
                    console.log(`🎯 显示接单提示 - 顾客 ${customer.id}: state=${customer.state}, hasOrdered=${customer.hasOrdered}`);
                }
                const time = Date.now() / 1000;
                
                // 计算等待接单的剩余时间
                let remainingWaitTime = '';
                let remaining = 0;
                if (customer.arrivalTime) {
                    const waitingTime = Date.now() - customer.arrivalTime;
                    remaining = Math.max(0, customer.waitingForOrder - waitingTime);
                    remainingWaitTime = Math.ceil(remaining / 1000) + 's';
                    // 去除全局滤镜，改为进度条颜色体现紧迫度
                }
                
                // 载入woo素材（若未加载则触发重试）
                const wooImg = this.wooImage && this.wooImage.complete ? this.wooImage : null;
                if (!wooImg) {
                    this.retryLoadAsset('wooImage');
                }

                // 计算与guke相同的拉伸比例（使用顾客的判定宽高相对素材原始尺寸）
                const gukeW = (customer.width && Number.isFinite(customer.width)) ? customer.width : 180;
                const gukeH = (customer.height && Number.isFinite(customer.height)) ? customer.height : 360;
                const baseW = 180, baseH = 360; // guke基准尺寸
                const stretchX = gukeW / baseW;
                const stretchY = gukeH / baseH;

                // woo基准显示尺寸（保持原图高宽比），按guke的拉伸比例缩放
                const wooBaseH = 54;   // 基准高度（用于整体缩放，保持小巧）
                const aspect = wooImg ? (wooImg.width / wooImg.height) : (4 / 3);
                const drawWooH = Math.round(wooBaseH * stretchY);
                const drawWooW = Math.round(drawWooH * aspect);

                // 位置关系如图：woo在guke头部右侧，略高一些且不重叠
                let drawWooX = Math.round(customer.x + gukeW + 20); // 右移20px
                let drawWooY = Math.round(customer.y + Math.round(gukeH * 0.08)); // 贴近头顶高度

                // 若右侧越界，则回退到头顶右上（贴边）
                if (drawWooX + drawWooW > this.canvas.width - 2) {
                    drawWooX = Math.round(customer.x + gukeW - drawWooW - Math.round(6 * stretchX));
                }
                // 若上方越界，微调到头顶正上
                if (drawWooY < 2) {
                    drawWooY = Math.round(customer.y - drawWooH - Math.round(2 * stretchY));
                }

                // 保证可见：限制在画布范围内
                const pad = 2;
                drawWooX = Math.max(pad, Math.min(drawWooX, this.canvas.width - drawWooW - pad));
                drawWooY = Math.max(pad, Math.min(drawWooY, this.canvas.height - drawWooH - pad));

                // 以woo图替代原气泡
                if (wooImg) {
                    this.ctx.drawImage(wooImg, drawWooX, drawWooY, drawWooW, drawWooH);
                }
                
                // 倒计时进度条（从绿色→黄色→红色），放在guke正头顶居中
                if (remainingWaitTime) {
                    const total = Math.max(1, customer.waitingForOrder || 1);
                    const ratio = Math.max(0, Math.min(1, remaining / total));
                    const barW = Math.max(60, Math.round(gukeW * 0.5));
                    const barH = Math.max(6, Math.round(8 * stretchY));
                    let barX = Math.round(customer.x + gukeW / 2 - barW / 2);
                    let barY = Math.round(customer.y - barH - Math.round(6 * stretchY));

                    // 边界保护
                    if (barX < 2) barX = 2;
                    if (barX + barW > this.canvas.width - 2) barX = this.canvas.width - 2 - barW;
                    if (barY < 2) barY = 2;

                    // 背景
                    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                    this.ctx.fillRect(barX, barY, barW, barH);

                    // 颜色按比例变化：>0.5 绿，>0.2 黄，其余红
                    const fillColor = ratio > 0.5 ? '#4CAF50' : (ratio > 0.2 ? '#FFC107' : '#F44336');
                    this.ctx.fillStyle = fillColor;
                    this.ctx.fillRect(barX, barY, Math.round(barW * ratio), barH);

                    // 描边
                    this.ctx.strokeStyle = '#FFFFFF';
                    this.ctx.lineWidth = 1;
                    this.ctx.strokeRect(barX, barY, barW, barH);
                }
            }
            
            // 顾客类型图标
            this.ctx.fillStyle = '#FFF';
            this.ctx.font = '16px Arial';
            if (customer.type === 'takeaway') {
                this.ctx.fillText('📦', customer.x + 135, customer.y + 45); // 按3倍调整位置
            } else {
                this.ctx.fillText('🍽️', customer.x + 135, customer.y + 45); // 按3倍调整位置
            }
            
            // 显示顾客编号
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            this.ctx.fillRect(customer.x + 5, customer.y - 35, 25, 20);
            this.ctx.fillStyle = '#FFD700';
            this.ctx.font = 'bold 14px Arial';
            this.ctx.fillText(customer.id.toString(), customer.x + 17, customer.y - 20);
            
            this.ctx.restore();
        });
        
        // 绘制制作进度（主界面小窗口显示）
        this.renderMainCookingProgress();
    }

    // 🎯 渲染标题（最上层）
    renderBiaoTi() {
        if (!this.biaoTiImage || !this.biaoTiImage.complete) {
            return; // 图片未加载完成，跳过绘制
        }

        // 保持像素艺术效果
        this.ctx.imageSmoothingEnabled = false;

        // 🎯 使用与background1相同的缩放比例
        const scaledBiaoTiWidth = this.biaoTiImage.width * this.backgroundScaleX;
        const scaledBiaoTiHeight = this.biaoTiImage.height * this.backgroundScaleY;

        // 🎯 计算位置：background1的中间顶处，往左偏移30px
        const centerX = (this.canvas.width - scaledBiaoTiWidth) / 2 - 30;
        const topY = 0; // 放在最顶部

        // 绘制标题
        this.ctx.drawImage(
            this.biaoTiImage,
            centerX,
            topY,
            scaledBiaoTiWidth,
            scaledBiaoTiHeight
        );

        // 恢复默认渲染设置
        this.ctx.imageSmoothingEnabled = true;

        console.log(`🎯 标题已绘制 - 位置: (${centerX.toFixed(1)}, ${topY}), 尺寸: ${scaledBiaoTiWidth.toFixed(1)} x ${scaledBiaoTiHeight.toFixed(1)}`);
    }

    // 🎯 渲染金钱显示（qian图片 + 金钱数量文字）
    renderMoneyDisplay() {
        if (!this.qianImage || !this.qianImage.complete) {
            return; // 图片未加载完成，跳过绘制
        }

        // 保持像素艺术效果
        this.ctx.imageSmoothingEnabled = false;

        // 🎯 使用与background1相同的缩放比例，但缩小30%
        const scaledQianWidth = this.qianImage.width * this.backgroundScaleX * 0.7;
        const scaledQianHeight = this.qianImage.height * this.backgroundScaleY * 0.7;

        // 🎯 计算位置：desk和background1的左上角，往右14px，往下6px
        const qianX = (this.background1OffsetX || 0) + 14;
        const qianY = (this.background1OffsetY || 0) + 6;

        // 绘制qian图片
        this.ctx.drawImage(
            this.qianImage,
            qianX,
            qianY,
            scaledQianWidth,
            scaledQianHeight
        );

        // 🎯 设置圆润字体样式，字体高度与qian图片高度一致
        const fontSize = scaledQianHeight;
        this.ctx.font = `bold ${fontSize}px Arial, sans-serif`; // 使用圆润字体
        this.ctx.fillStyle = '#FFFFFF'; // 纯白色
        // 移除描边设置

        // 获取当前金钱数量
        const moneyText = `${this.gameState.money}`;
        
        // 🎯 计算文字位置：qian图片右侧，垂直居中对齐
        const textX = qianX + scaledQianWidth + 10; // qian图片右侧 + 10px间距
        const textY = qianY + scaledQianHeight / 2 + fontSize / 3; // 垂直居中，稍微调整基线

        // 绘制文字（纯白色无描边圆润字体）
        this.ctx.fillText(moneyText, textX, textY);

        // 恢复默认渲染设置
        this.ctx.imageSmoothingEnabled = true;

        console.log(`🎯 金钱显示已绘制 - qian位置: (${qianX.toFixed(1)}, ${qianY.toFixed(1)}), 文字位置: (${textX.toFixed(1)}, ${textY.toFixed(1)}), 金额: ${moneyText}`);
    }

    // 🎯 渲染front图层
    renderFront() {
        if (this.sprites.front) {
            this.ctx.drawImage(this.sprites.front, 0, 0);
        }
    }

    // 🎯 渲染卷帘门
    renderJuanLianMen() {
        // 只在卷帘门可见时渲染
        if (!this.gameState.juanLianMenState.isVisible && !this.gameState.juanLianMenState.isAnimating) {
            return;
        }

        if (!this.juanLianMenImage) {
            return;
        }

        // 保存画布状态
        this.ctx.save();

        // 设置为像素完美渲染
        this.ctx.imageSmoothingEnabled = false;

        // 计算卷帘门的位置和大小
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        
        // 卷帘门布满整个界面
        const juanLianMenWidth = canvasWidth;
        const juanLianMenHeight = canvasHeight;

        // 根据动画进度计算Y位置
        // position: 0 = 完全遮挡（Y=0）, 1 = 完全移出（Y=-canvasHeight）
        const animationProgress = this.gameState.juanLianMenState.position;
        const juanLianMenY = -canvasHeight * animationProgress;

        // 绘制卷帘门，拉伸以覆盖整个屏幕
        this.ctx.drawImage(
            this.juanLianMenImage,
            0, juanLianMenY,
            juanLianMenWidth, juanLianMenHeight
        );

        // 恢复画布状态
        this.ctx.restore();
    }

    // 🎯 重新加载失败的素材
    retryLoadAsset(assetType) {
        // 避免频繁重试，设置最小间隔
        const now = Date.now();
        const lastRetry = this.lastAssetRetry || {};
        if (lastRetry[assetType] && now - lastRetry[assetType] < 2000) {
            return; // 2秒内不重复重试同一素材
        }
        
        lastRetry[assetType] = now;
        this.lastAssetRetry = lastRetry;
        
        console.log(`🔄 重新加载素材: ${assetType}`);
        
        switch (assetType) {
            case 'frontImage':
                this.loadFrontImage();
                break;
            case 'deskImage':
                this.loadDeskImage();
                break;
            case 'background1Image':
                this.loadBackground1Image();
                break;
            case 'backgroundImage':
                this.loadBackgroundImage();
                break;
            case 'background':
                this.loadBackgroundImage();
                break;
            case 'youtiaoWorkspace':
                this.loadBackgroundImage(); // 工作区依赖背景图
                break;
            case 'doujiangWorkspace':
                this.loadBackgroundImage(); // 工作区依赖背景图
                break;
            case 'congeeWorkspace':
                this.loadBackgroundImage(); // 工作区依赖背景图
                break;
            case 'doujiangzhuoImage':
                // 重新加载豆浆桌图片
                this.doujiangzhuoImage = new Image();
                this.doujiangzhuoImage.onload = () => {
                    console.log('✅ Doujiangzhuo image reloaded successfully');
                    this.render(); // 重新渲染
                };
                this.doujiangzhuoImage.onerror = () => {
                    console.error('❌ Failed to reload doujiangzhuo image');
                };
                this.doujiangzhuoImage.style.imageRendering = 'pixelated';
                this.doujiangzhuoImage.src = 'images/doujiangzhuo.png?t=' + Date.now();
                break;
            case 'zhoucaizhuoImage':
                // 重新加载粥菜桌图片
                this.zhoucaizhuoImage = new Image();
                this.zhoucaizhuoImage.onload = () => {
                    console.log('✅ Zhoucaizhuo image reloaded successfully');
                    this.render(); // 重新渲染
                };
                this.zhoucaizhuoImage.onerror = () => {
                    console.error('❌ Failed to reload zhoucaizhuo image');
                };
                this.zhoucaizhuoImage.style.imageRendering = 'pixelated';
                this.zhoucaizhuoImage.src = 'images/zhoucaizhuo.png?t=' + Date.now();
                break;
            case 'xiancaiImage':
            case 'xiandanImage':
            case 'huangdouImage':
            case 'doufuImage':
            case 'dianfanbaoImage':
                // 重新加载配菜图片
                this.createSprites();
                break;
            case 'guke1Image':
                this.loadGuke1Image();
                break;
            case 'guke2Image':
                this.loadGuke2Image();
                break;
            case 'guke3Image':
                this.loadGuke3Image();
                break;
            case 'wooImage':
                this.loadWooImage();
                break;
            case 'guke1Image':
                // 重新加载顾客图片
                this.loadGuke1Image();
                break;
            default:
                console.warn(`未知的素材类型: ${assetType}`);
                // 尝试通用的重新加载
                this.createSprites();
        }
        
        // 一定时间后强制重新渲染
        setTimeout(() => {
            this.render();
        }, 500);
    }
}

// 游戏现在由开始界面控制初始化
// 不再自动启动
console.log('BreakfastShop2D 类已加载，等待开始界面调用'); 