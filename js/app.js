// Главное приложение
class App {
    constructor() {
        this.theme = localStorage.getItem('theme') || 'dark';
        this.sourceDistribution = {
            recruiter: 30,
            account: 25,
            project: 25,
            organic: 15,
            promo: 5
        };
        this.defaultCommission = 5;
        this.init();
    }

    // Извлечение имени агента из названия ФГ
    extractAgentName(fgName) {
        if (!fgName) return 'Unknown';
        // Берём первые два слова
        const words = fgName.trim().split(/\s+/);
        return words.slice(0, 2).join(' ');
    }

    // Расстояние Левенштейна для сравнения строк
    levenshteinDistance(str1, str2) {
        const len1 = str1.length;
        const len2 = str2.length;
        const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));

        for (let i = 0; i <= len1; i++) matrix[i][0] = i;
        for (let j = 0; j <= len2; j++) matrix[0][j] = j;

        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j - 1] + cost
                );
            }
        }

        return matrix[len1][len2];
    }

    // Группировка агентов с учётом похожих имён
    groupAgents(fgData) {
        const agentGroups = {};
        const agentNames = [];

        fgData.forEach(fg => {
            const extractedName = this.extractAgentName(fg['ФГ']);
            let matchedGroup = null;

            // Ищем похожие имена (отличие на 1-2 символа)
            for (const existingName of agentNames) {
                const distance = this.levenshteinDistance(
                    extractedName.toLowerCase(),
                    existingName.toLowerCase()
                );
                
                if (distance <= 2) {
                    matchedGroup = existingName;
                    break;
                }
            }

            if (matchedGroup) {
                agentGroups[matchedGroup].push(fg);
            } else {
                agentNames.push(extractedName);
                agentGroups[extractedName] = [fg];
            }
        });

        return agentGroups;
    }

    async init() {
        // Инициализация БД
        await db.init();

        // Инициализация контроллеров
        managersCtrl = new ManagersController();
        rulesCtrl = new RulesController();
        milestonesCtrl = new MilestonesController();
        fgCtrl = new FgController();
        reportCtrl = new ReportController();

        // Применение темы
        this.applyTheme();
        
        // Настройка слушателей
        this.setupEventListeners();
        
        // Загрузка настроек
        await this.loadSettings();
    }

    async loadSettings() {
        const settings = await db.get('settings', 'distribution');
        if (settings) {
            this.sourceDistribution = settings.value;
            this.updateSliders();
        }

        const commission = await db.get('settings', 'defaultCommission');
        if (commission) {
            this.defaultCommission = commission.value;
            document.getElementById('default-commission').value = this.defaultCommission;
        }
    }

    async saveSettings() {
        await db.update('settings', {
            key: 'distribution',
            value: this.sourceDistribution
        });

        await db.update('settings', {
            key: 'defaultCommission',
            value: this.defaultCommission
        });
    }

    setupEventListeners() {
        // Табы
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.switchTab(tabName);
            });
        });

        // Тема
        document.getElementById('theme-toggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        // Слайдеры распределения
        ['recruiter', 'account', 'project', 'organic', 'promo'].forEach(source => {
            const slider = document.getElementById(`${source}-slider`);
            const valueSpan = document.getElementById(`${source}-value`);
            
            slider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                this.sourceDistribution[source] = value;
                valueSpan.textContent = value;
                this.saveSettings();
            });
        });

        // Дефолтная комиссия
        document.getElementById('default-commission').addEventListener('change', (e) => {
            this.defaultCommission = parseFloat(e.target.value);
            this.saveSettings();
        });

        // Загрузка файлов
        document.getElementById('fg-upload').addEventListener('change', (e) => {
            this.handleFileUpload(e, 'fg');
        });

        document.getElementById('prepayments-upload').addEventListener('change', (e) => {
            this.handleFileUpload(e, 'prepayments');
        });

        // Распределение источников
        document.getElementById('distribute-btn').addEventListener('click', () => {
            this.distributeSources();
        });

        // Генерация недостающих данных
        document.getElementById('generate-missing-data-btn').addEventListener('click', () => {
            this.generateMissingData();
        });

        // Фильтры отчета
        document.getElementById('report-start-date').addEventListener('change', () => {
            reportCtrl.calculate();
        });

        document.getElementById('report-end-date').addEventListener('change', () => {
            reportCtrl.calculate();
        });
    }

    switchTab(tabName) {
        // Скрыть все табы
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });

        // Показать выбранный таб
        document.getElementById(`${tabName}-tab`).classList.add('active');
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Пересчитать данные при переходе на таб
        if (tabName === 'fg') {
            fgCtrl.render();
        } else if (tabName === 'report') {
            reportCtrl.calculate();
        } else if (tabName === 'managers') {
            managersCtrl.render();
        }
    }

    toggleTheme() {
        this.theme = this.theme === 'dark' ? 'light' : 'dark';
        this.applyTheme();
        localStorage.setItem('theme', this.theme);
    }

    applyTheme() {
        if (this.theme === 'light') {
            document.body.setAttribute('data-theme', 'light');
            document.querySelector('.theme-icon').textContent = '☀️';
        } else {
            document.body.removeAttribute('data-theme');
            document.querySelector('.theme-icon').textContent = '🌙';
        }
    }

    updateSliders() {
        ['recruiter', 'account', 'project', 'organic', 'promo'].forEach(source => {
            const slider = document.getElementById(`${source}-slider`);
            const valueSpan = document.getElementById(`${source}-value`);
            slider.value = this.sourceDistribution[source];
            valueSpan.textContent = this.sourceDistribution[source];
        });
    }

    handleFileUpload(event, type) {
        const file = event.target.files[0];
        if (!file) return;

        const statusEl = document.getElementById(`${type}-status`);
        statusEl.textContent = 'Загрузка...';
        statusEl.className = 'status';

        Papa.parse(file, {
            header: true,
            encoding: 'UTF-8',
            skipEmptyLines: true,
            complete: async (results) => {
                try {
                    if (type === 'fg') {
                        await this.processFgData(results.data);
                        statusEl.textContent = `Загружено: ${results.data.length} записей`;
                        statusEl.classList.add('success');
                        document.getElementById('distribute-btn').disabled = false;
                    } else if (type === 'prepayments') {
                        await this.processPrepaymentsData(results.data);
                        statusEl.textContent = `Загружено: ${results.data.length} записей`;
                        statusEl.classList.add('success');
                    }
                } catch (error) {
                    statusEl.textContent = `Ошибка: ${error.message}`;
                    statusEl.classList.add('error');
                }
            },
            error: (error) => {
                statusEl.textContent = `Ошибка парсинга: ${error.message}`;
                statusEl.classList.add('error');
            }
        });
    }

    async processFgData(data) {
        console.log('processFgData вызван, строк:', data.length);
        
        // Очищаем старые данные
        await db.clear('fgData');

        // Добавляем поле агента к каждой записи
        const processedData = data.map(row => ({
            ...row,
            agent: this.extractAgentName(row['ФГ'])
        }));

        console.log('Обработано ФГ:', processedData.length);
        console.log('Первая ФГ:', processedData[0]);

        // Сохраняем новые
        for (const row of processedData) {
            await db.save('fgData', row);
        }
        
        // Проверяем что сохранилось
        const saved = await db.getAll('fgData');
        console.log('Сохранено в БД:', saved.length);
    }

    async processPrepaymentsData(data) {
        // Очищаем старые данные
        await db.clear('prepaymentsData');

        // Сохраняем новые
        for (const row of data) {
            await db.save('prepaymentsData', row);
        }
        
        // ИСПРАВЛЕНО: Убрана автоматическая фильтрация, т.к. номера ФГ могут не совпадать
    }

    async distributeSources() {
        const fgData = await db.getAll('fgData');
        console.log('distributeSources: ФГ в базе:', fgData.length);
        
        if (fgData.length === 0) {
            alert('Сначала загрузите данные по ФГ');
            return;
        }

        // Группируем ФГ по агентам
        const agentGroups = this.groupAgents(fgData);
        console.log('Агентов найдено:', Object.keys(agentGroups).length);

        // Создаем массив источников по пропорциям
        const sources = [];
        sources.push(...Array(Math.round(this.sourceDistribution.recruiter)).fill('Recruiter'));
        sources.push(...Array(Math.round(this.sourceDistribution.account)).fill('Account'));
        sources.push(...Array(Math.round(this.sourceDistribution.project)).fill('Проект'));
        sources.push(...Array(Math.round(this.sourceDistribution.organic)).fill('Органика'));
        sources.push(...Array(Math.round(this.sourceDistribution.promo)).fill('Акция'));

        const updatedData = [];

        // Распределяем источники по агентам заново
        for (const [agentName, agentFgs] of Object.entries(agentGroups)) {
            const randomSource = sources[Math.floor(Math.random() * sources.length)] || 'Проект';
            let manager = null;

            // Для Recruiter/Account выбираем менеджера один раз на агента
            if (randomSource === 'Recruiter' && managersCtrl.recruiters.length > 0) {
                manager = managersCtrl.recruiters[Math.floor(Math.random() * managersCtrl.recruiters.length)];
            } else if (randomSource === 'Account' && managersCtrl.accountManagers.length > 0) {
                manager = managersCtrl.accountManagers[Math.floor(Math.random() * managersCtrl.accountManagers.length)];
            }

            // Назначаем источник и менеджера всем ФГ агента
            agentFgs.forEach(fg => {
                updatedData.push({
                    ...fg,
                    source: randomSource,
                    manager: (randomSource === 'Recruiter' || randomSource === 'Account') ? manager : null,
                    commission: this.defaultCommission
                });
            });
        }

        console.log('Обновленных ФГ:', updatedData.length);
        console.log('Первая обновленная ФГ:', updatedData[0]);

        // Сохраняем обновленные данные
        await db.clear('fgData');
        for (const item of updatedData) {
            await db.save('fgData', item);
        }

        // Проверяем что сохранилось
        const savedAfter = await db.getAll('fgData');
        console.log('После распределения в БД:', savedAfter.length);

        alert(`Источники распределены! Найдено агентов: ${Object.keys(agentGroups).length}`);
        
        // Обновляем отображение на вкладке ФГ
        if (fgCtrl) {
            console.log('Вызываем fgCtrl.render()');
            await fgCtrl.render();
        } else {
            console.error('fgCtrl не инициализирован!');
        }
    }

    // Генерация недостающих данных
    async generateMissingData() {
        const fgData = await db.getAll('fgData');
        const prepaymentsData = await db.getAll('prepaymentsData');

        if (fgData.length === 0) {
            alert('Сначала загрузите данные по ФГ');
            return;
        }

        let updatedFgCount = 0;
        let generatedPrepaymentsCount = 0;

        // Функция для генерации случайной даты в диапазоне
        const randomDate = (start, end) => {
            const startTime = start.getTime();
            const endTime = end.getTime();
            const randomTime = startTime + Math.random() * (endTime - startTime);
            return new Date(randomTime);
        };

        // Функция для форматирования даты в DD.MM.YYYY
        const formatDate = (date) => {
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}.${month}.${year}`;
        };

        // Диапазон для генерации дат начала работы: последние 12 месяцев
        const now = new Date();
        const twelveMonthsAgo = new Date(now);
        twelveMonthsAgo.setMonth(now.getMonth() - 12);

        // 1. Генерация дат начала работы для ФГ без даты
        for (const fg of fgData) {
            if (!fg['Начало работы'] || fg['Начало работы'].trim() === '') {
                const randomStartDate = randomDate(twelveMonthsAgo, now);
                fg['Начало работы'] = formatDate(randomStartDate);
                updatedFgCount++;
            }
        }

        // Сохраняем обновленные ФГ
        if (updatedFgCount > 0) {
            await db.clear('fgData');
            for (const fg of fgData) {
                await db.save('fgData', fg);
            }
        }

        // 2. Генерация первых предоплат для ФГ без предоплат
        const fgWithPrepayments = new Set();
        prepaymentsData.forEach(payment => {
            const fgNumber = payment['Номер фин. группы'];
            if (fgNumber) {
                fgWithPrepayments.add(String(fgNumber));
            }
        });

        const newPrepayments = [];
        for (const fg of fgData) {
            const fgNumber = String(fg['Номер ФГ'] || fg['id'] || '');

            // Проверяем есть ли уже предоплаты для этой ФГ
            if (fgNumber && !fgWithPrepayments.has(fgNumber)) {
                // Парсим дату начала работы
                let startDate = null;
                const startDateStr = fg['Начало работы'];
                if (startDateStr) {
                    const match = startDateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
                    if (match) {
                        const day = parseInt(match[1]);
                        const month = parseInt(match[2]) - 1;
                        let year = parseInt(match[3]);
                        if (year < 100) {
                            year = year > 50 ? 1900 + year : 2000 + year;
                        }
                        startDate = new Date(year, month, day);
                    }
                }

                // Если нет даты начала работы, используем случайную дату из прошлого года
                if (!startDate || isNaN(startDate.getTime())) {
                    startDate = randomDate(twelveMonthsAgo, now);
                }

                // Дата первой предоплаты: от 0 до 30 дней после начала работы
                const firstPrepaymentDate = new Date(startDate);
                firstPrepaymentDate.setDate(firstPrepaymentDate.getDate() + Math.floor(Math.random() * 31));

                // Сумма первой предоплаты: от 100 до 5000
                const amount = Math.floor(Math.random() * 4900) + 100;

                // Создаём запись о предоплате
                newPrepayments.push({
                    'Номер фин. группы': fgNumber,
                    'Фин. группа': fg['ФГ'] || 'Без названия',
                    'Период': formatDate(firstPrepaymentDate),
                    'Пополнения $': String(amount)
                });

                generatedPrepaymentsCount++;
            }
        }

        // Сохраняем новые предоплаты
        if (newPrepayments.length > 0) {
            for (const prepayment of newPrepayments) {
                await db.save('prepaymentsData', prepayment);
            }
        }

        // Показываем результат
        let message = 'Генерация завершена!\n\n';
        if (updatedFgCount > 0) {
            message += `✅ Сгенерировано дат начала работы: ${updatedFgCount}\n`;
        }
        if (generatedPrepaymentsCount > 0) {
            message += `✅ Сгенерировано первых предоплат: ${generatedPrepaymentsCount}\n`;
        }
        if (updatedFgCount === 0 && generatedPrepaymentsCount === 0) {
            message += '✅ Все данные уже заполнены, генерация не требуется';
        }

        alert(message);

        // Обновляем отображение
        if (fgCtrl) {
            await fgCtrl.render();
        }
        if (reportCtrl) {
            await reportCtrl.calculate();
        }
    }
}

// Запуск приложения
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new App();
});
