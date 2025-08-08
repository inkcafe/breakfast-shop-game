class BreakfastShopGame {
    constructor() {
        this.gameState = {
            money: 100,
            reputation: 50,
            day: 1,
            phase: 'morning', // 'morning', 'evening'
            isRunning: false,
            isPaused: false,
            customers: [],
            orders: [],
            currentEvent: null,
            upgrades: {
                kitchen: 0,
                seating: 0,
                equipment: 0
            }
        };

        this.gameConfig = {
            dayDuration: 120000, // 2分钟一个时段
            maxCustomers: 8,
            customerSpawnRate: 0.3,
            upgradeCosts: {
                kitchen: [100, 200, 400],
                seating: [150, 300, 600],
                equipment: [80, 160, 320]
            }
        };

        this.foodPrices = {
            youtiao: 3,
            doujiang: 5,
            congee: 8,
            egg: 2
        };

        this.init();
    }

    init() {
        this.initThreeJS();
        this.initGameSystems();
        this.initEventListeners();
        this.animate();
        this.updateOrderUI();
    }

    initThreeJS() {
        // 基础Three.js设置
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // 天蓝色背景

        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 8, 12);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        document.getElementById('gameContainer').appendChild(this.renderer.domElement);

        // 光照设置
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 10, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 1024;
        directionalLight.shadow.mapSize.height = 1024;
        this.scene.add(directionalLight);

        // 创建基础场景
        this.createShopEnvironment();
    }

    createShopEnvironment() {
        // 地面
        const floorGeometry = new THREE.PlaneGeometry(20, 15);
        const floorMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x8B4513,
            transparent: true,
            opacity: 0.9
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);

        // 厨房区域
        this.createKitchen();
        
        // 用餐区域
        this.createDiningArea();
        
        // 收银台
        this.createCounter();
    }

    createKitchen() {
        // 炉灶
        const stoveGeometry = new THREE.BoxGeometry(2, 1, 1);
        const stoveMaterial = new THREE.MeshLambertMaterial({ color: 0x666666 });
        const stove = new THREE.Mesh(stoveGeometry, stoveMaterial);
        stove.position.set(-6, 0.5, -3);
        stove.castShadow = true;
        this.scene.add(stove);

        // 油锅指示器
        const oilPotGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.2);
        const oilPotMaterial = new THREE.MeshLambertMaterial({ color: 0xFFD700 });
        const oilPot = new THREE.Mesh(oilPotGeometry, oilPotMaterial);
        oilPot.position.set(-6, 1.1, -3);
        this.scene.add(oilPot);

        // 工作台
        const counterGeometry = new THREE.BoxGeometry(4, 1, 1.5);
        const counterMaterial = new THREE.MeshLambertMaterial({ color: 0xDEB887 });
        const workCounter = new THREE.Mesh(counterGeometry, counterMaterial);
        workCounter.position.set(-4, 0.5, -5);
        workCounter.castShadow = true;
        this.scene.add(workCounter);

        this.kitchen = { stove, workCounter, oilPot };
    }

    createDiningArea() {
        this.tables = [];
        this.chairs = [];

        // 创建餐桌和椅子
        for (let i = 0; i < 4; i++) {
            const tableGeometry = new THREE.CylinderGeometry(0.8, 0.8, 0.1);
            const tableMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
            const table = new THREE.Mesh(tableGeometry, tableMaterial);
            
            const x = (i % 2) * 4 + 2;
            const z = Math.floor(i / 2) * 3 + 1;
            table.position.set(x, 0.8, z);
            table.castShadow = true;
            
            this.scene.add(table);
            this.tables.push({
                mesh: table,
                occupied: false,
                needsCleaning: false,
                customer: null,
                position: { x, z },
                id: i
            });

            // 为每张桌子添加椅子
            for (let j = 0; j < 4; j++) {
                const chairGeometry = new THREE.BoxGeometry(0.4, 0.8, 0.4);
                const chairMaterial = new THREE.MeshLambertMaterial({ color: 0x654321 });
                const chair = new THREE.Mesh(chairGeometry, chairMaterial);
                
                const angle = (j / 4) * Math.PI * 2;
                const chairX = x + Math.cos(angle) * 1.2;
                const chairZ = z + Math.sin(angle) * 1.2;
                
                chair.position.set(chairX, 0.4, chairZ);
                chair.castShadow = true;
                this.scene.add(chair);
                this.chairs.push(chair);
            }
        }
    }

    createCounter() {
        const counterGeometry = new THREE.BoxGeometry(6, 1.2, 1);
        const counterMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const counter = new THREE.Mesh(counterGeometry, counterMaterial);
        counter.position.set(0, 0.6, -1);
        counter.castShadow = true;
        this.scene.add(counter);

        this.counter = counter;
    }

    initGameSystems() {
        this.customerSystem = new CustomerSystem(this);
        this.foodSystem = new FoodSystem(this);
        this.eventSystem = new EventSystem(this);

        this.phaseTimer = 0;
        this.lastCustomerSpawn = 0;
    }

    initEventListeners() {
        // 窗口大小调整
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        // 游戏控制按钮
        document.getElementById('startDay').addEventListener('click', () => {
            this.startDay();
        });

        document.getElementById('pauseGame').addEventListener('click', () => {
            this.togglePause();
        });

        document.getElementById('upgradeShop').addEventListener('click', () => {
            this.showUpgradeMenu();
        });

        // 鼠标点击事件
        this.renderer.domElement.addEventListener('click', (event) => {
            this.onMouseClick(event);
        });

        // 键盘事件
        window.addEventListener('keydown', (event) => {
            this.onKeyPress(event);
        });
    }

    startDay() {
        if (!this.gameState.isRunning) {
            this.gameState.isRunning = true;
            this.gameState.phase = 'morning';
            this.phaseTimer = 0;
            this.updateUI();
            
            document.getElementById('startDay').disabled = true;
            document.getElementById('startDay').textContent = '营业中...';
        }
    }

    togglePause() {
        this.gameState.isPaused = !this.gameState.isPaused;
        const btn = document.getElementById('pauseGame');
        btn.textContent = this.gameState.isPaused ? '继续' : '暂停';
    }

    onMouseClick(event) {
        if (this.gameState.isPaused) return;

        const mouse = new THREE.Vector2();
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);

        // 检测点击的物体
        const intersects = raycaster.intersectObjects(this.scene.children, true);
        
        if (intersects.length > 0) {
            const clickedObject = intersects[0].object;
            this.handleObjectClick(clickedObject);
        }
    }

    onKeyPress(event) {
        if (this.gameState.isPaused) return;

        switch(event.key) {
            case '1':
                this.foodSystem.startCooking('youtiao');
                break;
            case '2':
                this.foodSystem.startCooking('doujiang');
                break;
            case '3':
                this.foodSystem.startCooking('congee');
                break;
            case '4':
                this.foodSystem.startCooking('egg');
                break;
            case 'q':
                this.foodSystem.serveFood();
                break;
        }
    }

    handleObjectClick(object) {
        // 处理点击不同游戏物体的逻辑
        if (this.isTable(object)) {
            this.handleTableClick(object);
        } else if (this.isKitchenEquipment(object)) {
            this.handleKitchenClick(object);
        } else if (this.isCustomer(object)) {
            this.handleCustomerClick(object);
        }
    }

    isTable(object) {
        return this.tables.some(table => table.mesh === object);
    }

    isKitchenEquipment(object) {
        return object === this.kitchen.stove || object === this.kitchen.workCounter || object === this.kitchen.oilPot;
    }

    isCustomer(object) {
        return this.gameState.customers.some(customer => customer.mesh === object);
    }

    handleTableClick(table) {
        const tableData = this.tables.find(t => t.mesh === table);
        if (tableData && tableData.needsCleaning) {
            this.cleanTable(tableData);
        }
    }

    handleKitchenClick(equipment) {
        if (equipment === this.kitchen.stove || equipment === this.kitchen.oilPot) {
            this.showNotification('按数字键制作：1-油条 2-豆浆 3-粥 4-蛋', 3000);
        } else if (equipment === this.kitchen.workCounter) {
            this.foodSystem.serveFood();
        }
    }

    handleCustomerClick(customer) {
        const customerData = this.gameState.customers.find(c => c.mesh === customer);
        if (customerData) {
            this.customerSystem.takeOrder(customerData);
        }
    }

    cleanTable(tableData) {
        tableData.needsCleaning = false;
        tableData.occupied = false;
        tableData.customer = null;
        
        // 移除餐具
        if (tableData.dishes) {
            tableData.dishes.forEach(dish => this.scene.remove(dish));
            tableData.dishes = [];
        }
        
        this.addMoney(5);
        this.addReputation(1);
        this.showNotification('餐桌清理完成！');
    }

    showUpgradeMenu() {
        let upgradeText = '升级选项：\n';
        upgradeText += `厨房 Lv${this.gameState.upgrades.kitchen} -> 成本：¥${this.gameConfig.upgradeCosts.kitchen[this.gameState.upgrades.kitchen] || '已满级'}\n`;
        upgradeText += `座位 Lv${this.gameState.upgrades.seating} -> 成本：¥${this.gameConfig.upgradeCosts.seating[this.gameState.upgrades.seating] || '已满级'}\n`;
        upgradeText += `设备 Lv${this.gameState.upgrades.equipment} -> 成本：¥${this.gameConfig.upgradeCosts.equipment[this.gameState.upgrades.equipment] || '已满级'}`;
        
        this.showNotification(upgradeText, 5000);
    }

    update(deltaTime) {
        if (!this.gameState.isRunning || this.gameState.isPaused) return;

        this.phaseTimer += deltaTime;
        
        // 检查是否需要切换时段
        if (this.phaseTimer >= this.gameConfig.dayDuration) {
            this.switchPhase();
        }

        // 更新各个系统
        this.customerSystem.update(deltaTime);
        this.foodSystem.update(deltaTime);
        this.eventSystem.update(deltaTime);

        // 生成新顾客
        this.spawnCustomers(deltaTime);

        this.updateUI();
        this.updateOrderUI();
    }

    switchPhase() {
        if (this.gameState.phase === 'morning') {
            this.gameState.phase = 'evening';
            this.showNotification('现在是日落时段');
        } else {
            this.gameState.phase = 'morning';
            this.gameState.day++;
            this.settleDayEarnings();
        }
        
        this.phaseTimer = 0;
        this.updateUI();
    }

    spawnCustomers(deltaTime) {
        this.lastCustomerSpawn += deltaTime;
        
        if (this.lastCustomerSpawn >= 3000 && // 3秒间隔
            this.gameState.customers.length < this.gameConfig.maxCustomers &&
            Math.random() < this.gameConfig.customerSpawnRate) {
            
            this.customerSystem.spawnCustomer();
            this.lastCustomerSpawn = 0;
        }
    }

    settleDayEarnings() {
        // 日结算
        const baseEarnings = this.gameState.reputation * 2;
        this.addMoney(baseEarnings);
        
        this.showNotification(`第${this.gameState.day}天结算完成！获得 ¥${baseEarnings}`, 5000);
        
        // 重置某些状态
        this.cleanupDay();
        
        document.getElementById('startDay').disabled = false;
        document.getElementById('startDay').textContent = '开始营业';
        this.gameState.isRunning = false;
    }

    cleanupDay() {
        // 清理顾客
        this.gameState.customers.forEach(customer => {
            this.scene.remove(customer.mesh);
        });
        this.gameState.customers = [];
        
        // 清理订单
        this.gameState.orders = [];
        
        // 清理餐桌
        this.tables.forEach(table => {
            table.occupied = false;
            table.needsCleaning = false;
            table.customer = null;
            if (table.dishes) {
                table.dishes.forEach(dish => this.scene.remove(dish));
                table.dishes = [];
            }
        });
    }

    addMoney(amount) {
        this.gameState.money += amount;
        this.updateUI();
    }

    addReputation(amount) {
        this.gameState.reputation = Math.max(0, Math.min(100, this.gameState.reputation + amount));
        this.updateUI();
    }

    showNotification(message, duration = 3000) {
        const notification = document.getElementById('eventNotification');
        notification.textContent = message;
        notification.style.display = 'block';
        
        setTimeout(() => {
            notification.style.display = 'none';
        }, duration);
    }

    updateUI() {
        document.getElementById('money').textContent = this.gameState.money;
        document.getElementById('reputation').textContent = this.gameState.reputation;
        document.getElementById('timePhase').textContent = 
            this.gameState.phase === 'morning' ? '早晨' : '日落';
        document.getElementById('dayCount').textContent = this.gameState.day;
        document.getElementById('customerCount').textContent = this.gameState.customers.length;
        
        // 升级按钮状态
        const upgradeBtn = document.getElementById('upgradeShop');
        upgradeBtn.disabled = this.gameState.money < 100;
    }

    updateOrderUI() {
        const orderList = document.getElementById('orderList');
        orderList.innerHTML = '';
        
        this.gameState.orders.forEach((order, index) => {
            if (order.status === 'pending') {
                const orderDiv = document.createElement('div');
                orderDiv.className = 'order-item';
                
                const itemsText = order.items.map(item => 
                    `${this.getFoodName(item.type)}x${item.quantity}`
                ).join(', ');
                
                const urgency = order.customer.patience < 10000 ? '紧急' : '正常';
                const urgencyColor = order.customer.patience < 10000 ? 'red' : 'white';
                
                orderDiv.innerHTML = `
                    <div style="color: ${urgencyColor}; font-weight: bold;">${urgency}</div>
                    <div>${itemsText}</div>
                    <div>桌号: ${order.customer.type === 'dineIn' ? order.customer.tableId + 1 : '外带'}</div>
                `;
                
                orderList.appendChild(orderDiv);
            }
        });
    }

    getFoodName(type) {
        const names = {
            'youtiao': '油条',
            'doujiang': '豆浆',
            'congee': '粥',
            'egg': '蛋'
        };
        return names[type] || type;
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        const deltaTime = 16; // 假设60FPS
        this.update(deltaTime);
        
        this.renderer.render(this.scene, this.camera);
    }
}

// 顾客系统
class CustomerSystem {
    constructor(game) {
        this.game = game;
        this.customerTypes = ['dineIn', 'takeaway'];
        this.orderTypes = ['youtiao', 'doujiang', 'congee', 'egg'];
    }

    spawnCustomer() {
        const customerType = this.customerTypes[Math.floor(Math.random() * this.customerTypes.length)];
        const order = this.generateOrder();
        
        // 创建顾客外观
        const customerGeometry = new THREE.CapsuleGeometry(0.3, 1.2);
        const customerMaterial = new THREE.MeshLambertMaterial({ 
            color: new THREE.Color().setHSL(Math.random(), 0.5, 0.5)
        });
        const customerMesh = new THREE.Mesh(customerGeometry, customerMaterial);
        
        // 随机入口位置
        const entryX = Math.random() > 0.5 ? -8 : 8;
        const entryZ = Math.random() * 4 + 2;
        customerMesh.position.set(entryX, 1, entryZ);
        customerMesh.castShadow = true;
        
        this.game.scene.add(customerMesh);

        let targetPosition;
        let tableId = null;
        
        if (customerType === 'dineIn') {
            const availableTable = this.game.tables.find(table => !table.occupied);
            if (availableTable) {
                availableTable.occupied = true;
                targetPosition = availableTable.position;
                tableId = availableTable.id;
            } else {
                // 没有空桌子，转为外带
                targetPosition = { x: 0, z: 1 };
                customerType = 'takeaway';
            }
        } else {
            targetPosition = { x: 0, z: 1 };
        }

        const customer = {
            mesh: customerMesh,
            type: customerType,
            order: order,
            patience: 180000 + Math.random() * 90000, // 大幅增加：180-270秒耐心
            maxPatience: 180000 + Math.random() * 90000,
            waitTime: 0,
            state: 'entering', // 'entering', 'waiting', 'ordering', 'eating', 'leaving'
            targetPosition: targetPosition,
            hasOrdered: false,
            satisfaction: 100,
            tableId: tableId
        };

        this.game.gameState.customers.push(customer);
    }

    generateOrder() {
        const items = [];
        const numItems = Math.floor(Math.random() * 3) + 1; // 1-3个物品
        
        for (let i = 0; i < numItems; i++) {
            const item = this.orderTypes[Math.floor(Math.random() * this.orderTypes.length)];
            items.push({
                type: item,
                quantity: Math.floor(Math.random() * 2) + 1,
                special: Math.random() < 0.2 // 20%概率特殊要求
            });
        }
        
        const totalValue = items.reduce((sum, item) => 
            sum + (this.game.foodPrices[item.type] || 5) * item.quantity, 0
        );
        
        return {
            items: items,
            totalValue: totalValue,
            complexity: items.length > 2 ? 'complex' : 'simple'
        };
    }

    takeOrder(customer) {
        if (customer.state === 'waiting' && !customer.hasOrdered) {
            customer.hasOrdered = true;
            customer.state = 'ordering';
            
            this.game.gameState.orders.push({
                customer: customer,
                items: customer.order.items,
                startTime: Date.now(),
                status: 'pending',
                id: Date.now()
            });

            const orderDesc = this.getOrderDescription(customer.order);
            this.game.showNotification(`新订单：${orderDesc}`);
        }
    }

    getOrderDescription(order) {
        return order.items.map(item => 
            `${this.game.getFoodName(item.type)}x${item.quantity}`
        ).join(', ');
    }

    update(deltaTime) {
        this.game.gameState.customers.forEach(customer => {
            this.updateCustomerMovement(customer, deltaTime);
            this.updateCustomerPatience(customer, deltaTime);
            this.updateCustomerState(customer, deltaTime);
            this.updateCustomerVisuals(customer);
        });

        // 移除离开的顾客
        this.game.gameState.customers = this.game.gameState.customers.filter(customer => {
            if (customer.state === 'left') {
                this.game.scene.remove(customer.mesh);
                
                // 释放餐桌
                if (customer.tableId !== null) {
                    const table = this.game.tables[customer.tableId];
                    if (table) {
                        table.occupied = false;
                        if (customer.satisfaction < 50) {
                            table.needsCleaning = true;
                            this.addDishesToTable(table);
                        }
                    }
                }
                
                return false;
            }
            return true;
        });
    }

    updateCustomerMovement(customer, deltaTime) {
        if (customer.state === 'entering' || customer.state === 'leaving') {
            const speed = 0.002;
            const target = customer.state === 'entering' ? 
                customer.targetPosition : { x: customer.mesh.position.x > 0 ? 10 : -10, z: 8 };
            
            const dx = target.x - customer.mesh.position.x;
            const dz = target.z - customer.mesh.position.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            
            if (distance > 0.1) {
                customer.mesh.position.x += (dx / distance) * speed * deltaTime;
                customer.mesh.position.z += (dz / distance) * speed * deltaTime;
            } else {
                if (customer.state === 'entering') {
                    customer.state = 'waiting';
                } else {
                    customer.state = 'left';
                }
            }
        }
    }

    updateCustomerPatience(customer, deltaTime) {
        if (customer.state === 'waiting' || customer.state === 'ordering') {
            customer.waitTime += deltaTime;
            customer.patience -= deltaTime;
            
            // 更新满意度
            const patienceRatio = customer.patience / customer.maxPatience;
            customer.satisfaction = Math.max(0, patienceRatio * 100);
            
            if (customer.patience <= 0) {
                customer.state = 'leaving';
                customer.satisfaction = 0;
                this.game.addReputation(-5);
                this.game.showNotification('顾客不耐烦离开了！');
                
                // 移除订单
                this.game.gameState.orders = this.game.gameState.orders.filter(
                    order => order.customer !== customer
                );
            }
        }
    }

    updateCustomerState(customer, deltaTime) {
        // 根据订单状态更新顾客状态
        const order = this.game.gameState.orders.find(o => o.customer === customer);
        if (order && order.status === 'completed') {
            customer.state = 'eating';
            setTimeout(() => {
                customer.state = 'leaving';
                this.processPayment(customer);
            }, 10000); // 吃饭10秒
        }
    }

    updateCustomerVisuals(customer) {
        // 根据耐心程度改变颜色
        const patienceRatio = customer.patience / customer.maxPatience;
        if (patienceRatio < 0.3) {
            customer.mesh.material.color.setHex(0xff0000); // 红色：不耐烦
        } else if (patienceRatio < 0.6) {
            customer.mesh.material.color.setHex(0xffff00); // 黄色：有点急
        } else {
            customer.mesh.material.color.setHSL(0.3, 0.5, 0.5); // 绿色：平静
        }
    }

    addDishesToTable(table) {
        if (!table.dishes) {
            table.dishes = [];
        }
        
        // 添加脏盘子
        for (let i = 0; i < 2; i++) {
            const dishGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.05);
            const dishMaterial = new THREE.MeshLambertMaterial({ color: 0x888888 });
            const dish = new THREE.Mesh(dishGeometry, dishMaterial);
            
            dish.position.set(
                table.position.x + (Math.random() - 0.5) * 0.5,
                0.9,
                table.position.z + (Math.random() - 0.5) * 0.5
            );
            
            this.game.scene.add(dish);
            table.dishes.push(dish);
        }
    }

    processPayment(customer) {
        const payment = customer.order.totalValue * (customer.satisfaction / 100);
        this.game.addMoney(Math.floor(payment));
        
        const reputationGain = Math.floor(customer.satisfaction / 20);
        this.game.addReputation(reputationGain);
        
        if (customer.satisfaction > 80) {
            this.game.showNotification(`顾客很满意！获得¥${Math.floor(payment)}`);
        }
    }
}

// 餐食系统
class FoodSystem {
    constructor(game) {
        this.game = game;
        this.cookingQueue = [];
        this.completedFood = [];
        this.activeRecipes = {
            youtiao: { time: 6000, difficulty: 'medium', name: '油条' }, // 调整油条炸制时间为6秒
            doujiang: { time: 5000, difficulty: 'hard', name: '豆浆' },
            congee: { time: 3000, difficulty: 'easy', name: '粥' },
            egg: { time: 4000, difficulty: 'easy', name: '蛋' }
        };
    }

    startCooking(foodType) {
        const recipe = this.activeRecipes[foodType];
        if (!recipe) return;

        const cookingItem = {
            type: foodType,
            startTime: Date.now(),
            cookTime: recipe.time,
            status: 'cooking',
            id: Date.now()
        };

        this.cookingQueue.push(cookingItem);
        this.game.showNotification(`开始制作${recipe.name}...预计${recipe.time/1000}秒`);
        
        // 视觉效果 - 在炉灶上添加烹饪指示器
        this.addCookingIndicator(cookingItem);
    }

    addCookingIndicator(cookingItem) {
        const indicatorGeometry = new THREE.SphereGeometry(0.2);
        const indicatorMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xff6600,
            transparent: true,
            opacity: 0.8
        });
        const indicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
        indicator.position.set(-6, 1.5, -3);
        
        this.game.scene.add(indicator);
        cookingItem.indicator = indicator;
        
        // 添加动画效果
        const animate = () => {
            if (cookingItem.status === 'cooking') {
                indicator.rotation.y += 0.1;
                indicator.position.y = 1.5 + Math.sin(Date.now() * 0.01) * 0.1;
                requestAnimationFrame(animate);
            }
        };
        animate();
    }

    serveFood() {
        if (this.completedFood.length === 0) {
            this.game.showNotification('没有可以上菜的食物！');
            return;
        }

        const food = this.completedFood.shift();
        const matchingOrders = this.game.gameState.orders.filter(order => 
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
                    this.game.showNotification(`订单完成！`);
                } else {
                    this.game.showNotification(`${this.activeRecipes[food.type].name}已上菜`);
                }
            }
        }
    }

    update(deltaTime) {
        this.cookingQueue.forEach(item => {
            const elapsed = Date.now() - item.startTime;
            
            if (elapsed >= item.cookTime && item.status === 'cooking') {
                item.status = 'ready';
                this.completeFood(item);
            }
        });

        // 清理完成的烹饪项目
        this.cookingQueue = this.cookingQueue.filter(item => item.status !== 'completed');
    }

    completeFood(cookingItem) {
        cookingItem.status = 'completed';
        this.completedFood.push(cookingItem);
        
        // 移除烹饪指示器
        if (cookingItem.indicator) {
            this.game.scene.remove(cookingItem.indicator);
        }
        
        // 在工作台添加完成的食物指示器
        this.addCompletedFoodIndicator(cookingItem);
        
        this.game.showNotification(`${this.activeRecipes[cookingItem.type].name}制作完成！按Q键上菜`);
    }

    addCompletedFoodIndicator(cookingItem) {
        const foodGeometry = new THREE.BoxGeometry(0.3, 0.1, 0.3);
        const foodMaterial = new THREE.MeshLambertMaterial({ 
            color: this.getFoodColor(cookingItem.type) 
        });
        const foodMesh = new THREE.Mesh(foodGeometry, foodMaterial);
        
        const offsetX = (this.completedFood.length - 1) * 0.4;
        foodMesh.position.set(-4 + offsetX, 1.1, -5);
        
        this.game.scene.add(foodMesh);
        cookingItem.foodMesh = foodMesh;
    }

    getFoodColor(foodType) {
        const colors = {
            'youtiao': 0xFFD700, // 金黄色
            'doujiang': 0xFFF8DC, // 米白色
            'congee': 0xF5F5DC,   // 米色
            'egg': 0xFFFFE0       // 淡黄色
        };
        return colors[foodType] || 0xFFFFFF;
    }
}

// 事件系统
class EventSystem {
    constructor(game) {
        this.game = game;
        this.events = [
            {
                name: 'rushHour',
                description: '上班高峰：顾客增多',
                probability: 0.1,
                duration: 30000,
                effect: () => {
                    this.game.gameConfig.customerSpawnRate *= 2;
                    this.game.showNotification('上班高峰期开始！顾客增多', 5000);
                }
            },
            {
                name: 'lateTrucks',
                description: '快迟到了：全员等待时间减少',
                probability: 0.15,
                duration: 20000,
                effect: () => {
                    this.game.gameState.customers.forEach(customer => {
                        customer.patience *= 0.7;
                    });
                    this.game.showNotification('大家都要迟到了！顾客变得急躁', 5000);
                }
            },
            {
                name: 'truckBlocking',
                description: '大货车通过：店铺暂停营业',
                probability: 0.05,
                duration: 15000,
                effect: () => {
                    this.game.gameState.isPaused = true;
                    this.game.showNotification('大货车通过，请顾客避让！暂停营业', 5000);
                    
                    setTimeout(() => {
                        if (this.game.gameState.isRunning) {
                            this.game.gameState.isPaused = false;
                            this.game.showNotification('可以继续营业了！');
                        }
                    }, 15000);
                }
            },
            {
                name: 'bigOrder',
                description: '大单：大批量相同需求',
                probability: 0.08,
                duration: 5000,
                effect: () => {
                    const foodType = ['youtiao', 'doujiang', 'congee'][Math.floor(Math.random() * 3)];
                    const quantity = Math.floor(Math.random() * 5) + 3; // 3-7个
                    
                    // 创建大单顾客
                    this.createBigOrderCustomer(foodType, quantity);
                    this.game.showNotification(`大单来了！${quantity}个${this.game.getFoodName(foodType)}`, 5000);
                }
            }
        ];
        
        this.activeEvents = [];
        this.lastEventCheck = 0;
    }

    createBigOrderCustomer(foodType, quantity) {
        const customerGeometry = new THREE.CapsuleGeometry(0.4, 1.5); // 稍大一些
        const customerMaterial = new THREE.MeshLambertMaterial({ color: 0x800080 }); // 紫色表示大单
        const customerMesh = new THREE.Mesh(customerGeometry, customerMaterial);
        
        customerMesh.position.set(-8, 1, 2);
        customerMesh.castShadow = true;
        this.game.scene.add(customerMesh);

        const customer = {
            mesh: customerMesh,
            type: 'takeaway',
            order: {
                items: [{ type: foodType, quantity: quantity, special: false }],
                totalValue: this.game.foodPrices[foodType] * quantity * 1.2, // 大单加价
                complexity: 'big'
            },
                            patience: 240000, // 大单给更多时间（大幅增加到240秒）
                maxPatience: 240000,
            waitTime: 0,
            state: 'entering',
            targetPosition: { x: 0, z: 1 },
            hasOrdered: false,
            satisfaction: 100,
            tableId: null
        };

        this.game.gameState.customers.push(customer);
    }

    update(deltaTime) {
        this.lastEventCheck += deltaTime;
        
        // 每30秒检查一次随机事件
        if (this.lastEventCheck >= 30000) {
            this.checkRandomEvents();
            this.lastEventCheck = 0;
        }

        // 更新活动事件
        this.activeEvents.forEach(event => {
            event.timeLeft -= deltaTime;
            if (event.timeLeft <= 0) {
                this.endEvent(event);
            }
        });

        // 移除结束的事件
        this.activeEvents = this.activeEvents.filter(event => event.timeLeft > 0);
    }

    checkRandomEvents() {
        if (this.activeEvents.length > 0) return; // 一次只能有一个事件

        this.events.forEach(eventTemplate => {
            if (Math.random() < eventTemplate.probability) {
                this.triggerEvent(eventTemplate);
            }
        });
    }

    triggerEvent(eventTemplate) {
        const event = {
            ...eventTemplate,
            timeLeft: eventTemplate.duration
        };

        this.activeEvents.push(event);
        event.effect();
    }

    endEvent(event) {
        // 恢复事件效果
        if (event.name === 'rushHour') {
            this.game.gameConfig.customerSpawnRate /= 2;
            this.game.showNotification('上班高峰期结束');
        }
    }
}

// 启动游戏
const game = new BreakfastShopGame(); 