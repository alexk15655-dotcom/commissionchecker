// Контроллер отчетов и расчетов
class ReportController {
    constructor() {
        this.fgData = [];
        this.prepaymentsData = [];
        this.calculatedReport = [];
        this.collapsedManagers = new Set();
        this.collapsedAgents = new Set();
        this.fgFirstPrepaymentDates = {}; // { fgNumber: Date }
        this.hideZeroCommissionAgents = false;

        // Добавляем обработчик чекбокса после загрузки DOM
        document.addEventListener('DOMContentLoaded', () => {
            const checkbox = document.getElementById('hide-zero-commission-agents');
            if (checkbox) {
                checkbox.addEventListener('change', (e) => {
                    this.hideZeroCommissionAgents = e.target.checked;
                    this.render();
                });
            }
        });
    }

    formatDate(dateStr) {
        if (!dateStr) return '—';

        // Если это уже объект Date, форматируем напрямую
        if (dateStr instanceof Date) {
            if (isNaN(dateStr.getTime())) return '—';
            return dateStr.toLocaleDateString('ru-RU');
        }

        // Преобразуем в строку если это не строка
        if (typeof dateStr !== 'string') {
            dateStr = String(dateStr);
        }

        // Проверка формата DD.MM.YYYY или DD.MM.YY
        const ddmmyyyyMatch = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
        if (ddmmyyyyMatch) {
            const day = ddmmyyyyMatch[1].padStart(2, '0');
            const month = ddmmyyyyMatch[2].padStart(2, '0');
            let year = ddmmyyyyMatch[3];
            if (year.length === 2) {
                year = parseInt(year) > 50 ? `19${year}` : `20${year}`;
            }
            return `${day}.${month}.${year}`;
        }

        // Стандартный парсинг ISO дат
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return '—';
        return date.toLocaleDateString('ru-RU');
    }

    parseRussianDate(dateStr) {
        if (!dateStr) return null;

        // Формат DD.MM.YYYY или DD.MM.YY
        const ddmmyyyyMatch = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
        if (ddmmyyyyMatch) {
            const day = parseInt(ddmmyyyyMatch[1]);
            const month = parseInt(ddmmyyyyMatch[2]) - 1;
            let year = parseInt(ddmmyyyyMatch[3]);
            if (year < 100) {
                year = year > 50 ? 1900 + year : 2000 + year;
            }
            return new Date(year, month, day);
        }

        // Формат "нояб. 25 г." или "нояб. 2025 г."
        const ruMonthMatch = dateStr.match(/(янв|февр|мар|апр|ма[йя]|июн|июл|авг|сент|окт|нояб|дек)\w*\.?\s+(\d{2,4})\s*г?\.?/i);
        if (ruMonthMatch) {
            const monthMap = {
                'янв': 0, 'февр': 1, 'мар': 2, 'апр': 3, 'май': 4, 'мая': 4,
                'июн': 5, 'июл': 6, 'авг': 7, 'сент': 8, 'окт': 9, 'нояб': 10, 'дек': 11
            };

            const monthKey = ruMonthMatch[1].toLowerCase().substring(0, 4);
            const monthIndex = monthMap[monthKey];
            let year = parseInt(ruMonthMatch[2]);

            if (year < 100) {
                year = year > 50 ? 1900 + year : 2000 + year;
            }

            if (monthIndex !== undefined) {
                return new Date(year, monthIndex, 1);
            }
        }

        // Стандартный парсинг
        const date = new Date(dateStr);
        return isNaN(date.getTime()) ? null : date;
    }

    parseFgDate(dateStr) {
        if (!dateStr) return null;
        
        // Формат DD.MM.YYYY
        const ddmmyyyyMatch = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
        if (ddmmyyyyMatch) {
            const day = parseInt(ddmmyyyyMatch[1]);
            const month = parseInt(ddmmyyyyMatch[2]) - 1;
            let year = parseInt(ddmmyyyyMatch[3]);
            if (year < 100) {
                year = year > 50 ? 1900 + year : 2000 + year;
            }
            return new Date(year, month, day);
        }
        
        // Стандартный парсинг
        const date = new Date(dateStr);
        return isNaN(date.getTime()) ? null : date;
    }

    async loadData() {
        this.fgData = await db.getAll('fgData');
        this.prepaymentsData = await db.getAll('prepaymentsData');
    }

    async calculate() {
        await this.loadData();

        if (this.fgData.length === 0 || this.prepaymentsData.length === 0) {
            this.render();
            return;
        }

        const commissionData = {};
        const agentData = {}; // { agent: { fgs: [], totalPrepayments, manager, earliestFgDate } }
        const agentManagers = {};

        // Очищаем даты первой предоплаты для ФГ
        this.fgFirstPrepaymentDates = {};

        const startDateStr = document.getElementById('report-start-date').value;
        const endDateStr = document.getElementById('report-end-date').value;
        const startDate = startDateStr ? new Date(startDateStr) : null;
        const endDate = endDateStr ? new Date(endDateStr) : null;
        const reportDate = endDate || new Date();

        // Группируем ФГ по агентам
        const agentGroups = {};
        this.fgData.forEach(fg => {
            const fgName = fg['ФГ'] || 'Без названия';
            const agent = fg.agent || app.extractAgentName(fgName);
            
            if (!agentGroups[agent]) {
                agentGroups[agent] = [];
            }
            agentGroups[agent].push(fg);

            // Определяем менеджера группы (первый с менеджером)
            if (fg.manager && !agentManagers[agent]) {
                agentManagers[agent] = fg.manager;
            }
        });

        // Определяем самую раннюю ФГ для каждого агента (для условия "новые агенты")
        const agentEarliestFgDate = {};
        Object.keys(agentGroups).forEach(agent => {
            const sortedByDate = agentGroups[agent].sort((a, b) => {
                const dateA = this.parseFgDate(a['Начало работы']);
                const dateB = this.parseFgDate(b['Начало работы']);
                if (!dateA) return 1;
                if (!dateB) return -1;
                return dateA - dateB;
            });
            
            if (sortedByDate.length > 0) {
                agentEarliestFgDate[agent] = this.parseFgDate(sortedByDate[0]['Начало работы']);
            }
        });

        // Инициализируем данные агентов
        Object.keys(agentGroups).forEach(agent => {
            agentData[agent] = {
                fgs: agentGroups[agent],
                totalPrepayments: 0,
                prepaymentsInPeriod: 0,
                manager: agentManagers[agent],
                earliestFgDate: agentEarliestFgDate[agent],
                firstPrepaymentDate: null,
                firstPrepaymentAmount: 0,
                commissions: {} // { ruleId: amount }
            };
        });

        // Обрабатываем предоплаты
        this.prepaymentsData.forEach(payment => {
            const fg = this.fgData.find(f => {
                const fgNumber = f['Номер ФГ'] || f['id'];
                const paymentNumber = payment['Номер фин. группы'];
                return fgNumber == paymentNumber;
            });

            if (!fg) return;

            const fgName = fg['ФГ'] || 'Без названия';
            const agent = fg.agent || app.extractAgentName(fgName);
            const fgNumber = fg['Номер ФГ'] || fg['id'];

            let amount = 0;
            const prepaymentStr = payment['Пополнения $'] || payment['Пополнения'] || '0';
            if (typeof prepaymentStr === 'string') {
                amount = parseFloat(prepaymentStr.replace(',', '.').replace(/[^\d.-]/g, '')) || 0;
            } else {
                amount = parseFloat(prepaymentStr) || 0;
            }

            const paymentDate = this.parseRussianDate(payment['Период']);
            const isInPeriod = paymentDate && (!startDate || paymentDate >= startDate) && (!endDate || paymentDate <= endDate);

            // Фиксируем первую предоплату для ФГ
            if (paymentDate && fgNumber) {
                if (!this.fgFirstPrepaymentDates[fgNumber] || paymentDate < this.fgFirstPrepaymentDates[fgNumber]) {
                    this.fgFirstPrepaymentDates[fgNumber] = paymentDate;
                }
            }

            if (agentData[agent]) {
                agentData[agent].totalPrepayments += amount;

                if (isInPeriod) {
                    agentData[agent].prepaymentsInPeriod += amount;
                }

                // Фиксируем первую предоплату агента
                if (paymentDate && (!agentData[agent].firstPrepaymentDate || paymentDate < agentData[agent].firstPrepaymentDate)) {
                    agentData[agent].firstPrepaymentDate = paymentDate;
                    agentData[agent].firstPrepaymentAmount = amount;
                }
            }
        });

        // Расчёт комиссий по агентам
        Object.keys(agentData).forEach(agent => {
            const data = agentData[agent];
            
            if (!data.manager) return; // Только агенты с менеджером

            const managerId = data.manager.id;
            const managerName = data.manager.name;
            const managerType = data.fgs[0].source === 'Recruiter' ? 'recruiter' : 'account';

            // Инициализация данных менеджера
            if (!commissionData[managerId]) {
                commissionData[managerId] = {
                    managerId,
                    managerName,
                    managerType,
                    totalPrepayments: 0,
                    prepaymentsInPeriod: 0,
                    commission: 0,
                    milestoneBonus: 0,
                    agentsCount: 0,
                    agents: []
                };
            }

            commissionData[managerId].totalPrepayments += data.totalPrepayments;
            commissionData[managerId].prepaymentsInPeriod += data.prepaymentsInPeriod;
            commissionData[managerId].agentsCount += 1;
            commissionData[managerId].agents.push({
                name: agent,
                prepayments: data.totalPrepayments
            });

            // Применяем правила
            const applicableRules = rulesCtrl.rules.filter(r => 
                r.managerIds && r.managerIds.includes(managerId)
            );

            // Добавляем персональные правила менеджера
            const manager = managersCtrl.getAllManagers().find(m => m.id === managerId);
            if (manager && manager.personRules) {
                manager.personRules.forEach(personRule => {
                    applicableRules.push({
                        ...personRule,
                        managerId: managerId,
                        isPersonal: true
                    });
                });
            }

            applicableRules.forEach(rule => {
                // Проверка условия "Только новые агенты"
                if (rule.constraints.newAgentsOnly && rule.constraints.newAgentsMonths) {
                    const monthsAgo = new Date(reportDate);
                    monthsAgo.setMonth(monthsAgo.getMonth() - rule.constraints.newAgentsMonths);
                    
                    if (!data.earliestFgDate || data.earliestFgDate < monthsAgo) {
                        return; // Агент слишком старый
                    }
                }

                // Проверка минимального порога
                if (rule.constraints.minGroupThreshold) {
                    if (data.totalPrepayments < rule.constraints.minGroupThreshold) {
                        return; // Порог не достигнут
                    }
                }

                // Проверка условия "только в период отчёта"
                if (rule.constraints.periodOnly) {
                    if (!startDate || !data.firstPrepaymentDate) return;
                    
                    const firstInPeriod = data.firstPrepaymentDate >= startDate && 
                                         (!endDate || data.firstPrepaymentDate <= endDate);
                    
                    if (!firstInPeriod) return;
                }

                // Условие применения (какие предоплаты считаем)
                let amountToCalculate = 0;
                
                if (rule.applyTo === 'all') {
                    amountToCalculate = data.prepaymentsInPeriod || data.totalPrepayments;
                } else if (rule.applyTo === 'firstPrepayment') {
                    // Только первая предоплата агента (если в периоде)
                    if (data.firstPrepaymentDate) {
                        const firstInPeriod = (!startDate || data.firstPrepaymentDate >= startDate) && 
                                             (!endDate || data.firstPrepaymentDate <= endDate);
                        if (firstInPeriod) {
                            amountToCalculate = data.firstPrepaymentAmount;
                        }
                    }
                } else if (rule.applyTo === 'earlyFg') {
                    // Предоплаты самой ранней ФГ
                    const earliestFg = data.fgs.sort((a, b) => {
                        const dateA = this.parseFgDate(a['Начало работы']);
                        const dateB = this.parseFgDate(b['Начало работы']);
                        if (!dateA) return 1;
                        if (!dateB) return -1;
                        return dateA - dateB;
                    })[0];
                    
                    if (earliestFg) {
                        const earliestFgNumber = earliestFg['Номер ФГ'] || earliestFg['id'];
                        this.prepaymentsData.forEach(p => {
                            if (p['Номер фин. группы'] == earliestFgNumber) {
                                const payDate = this.parseRussianDate(p['Период']);
                                const inPeriod = payDate && (!startDate || payDate >= startDate) && (!endDate || payDate <= endDate);
                                
                                if (inPeriod) {
                                    const prepaymentStr = p['Пополнения $'] || p['Пополнения'] || '0';
                                    let amt = 0;
                                    if (typeof prepaymentStr === 'string') {
                                        amt = parseFloat(prepaymentStr.replace(',', '.').replace(/[^\d.-]/g, '')) || 0;
                                    } else {
                                        amt = parseFloat(prepaymentStr) || 0;
                                    }
                                    amountToCalculate += amt;
                                }
                            }
                        });
                    }
                } else if (rule.applyTo === 'groupWithThreshold') {
                    amountToCalculate = data.prepaymentsInPeriod || data.totalPrepayments;
                }

                if (amountToCalculate <= 0) return;

                // Расчёт комиссии
                let commission = 0;
                
                if (rule.paymentType === 'percentage') {
                    commission = (amountToCalculate * rule.paymentValue) / 100;
                } else if (rule.paymentType === 'fixed') {
                    commission = rule.paymentValue;
                }

                // Применяем кэп (КРИТИЧНО: к комиссии агента)
                if (rule.constraints.maxPerPayment) {
                    commission = Math.min(commission, rule.constraints.maxPerPayment);
                }

                // Добавляем к менеджеру
                commissionData[managerId].commission += commission;

                // Записываем в агента для отладки
                const ruleKey = rule.id || `personal_${rule.name}`;
                if (!data.commissions[ruleKey]) {
                    data.commissions[ruleKey] = 0;
                }
                data.commissions[ruleKey] += commission;
            });

            // Расчёт Milestones за агента
            milestonesCtrl.milestones.forEach(milestone => {
                const isApplicable = 
                    milestone.managerGroup === 'all' ||
                    (milestone.managerGroup === 'recruiters' && managerType === 'recruiter') ||
                    (milestone.managerGroup === 'accounts' && managerType === 'account') ||
                    (milestone.managerGroup === 'custom' && milestone.assignedManagers.includes(managerId));

                if (isApplicable && data.totalPrepayments >= milestone.targetAmount) {
                    let milestoneBonus = 0;
                    
                    if (milestone.paymentType === 'fixed') {
                        milestoneBonus = milestone.paymentValue;
                    } else if (milestone.paymentType === 'percentage') {
                        milestoneBonus = (data.totalPrepayments * milestone.paymentValue) / 100;
                        if (milestone.maxPayment) {
                            milestoneBonus = Math.min(milestoneBonus, milestone.maxPayment);
                        }
                    } else if (milestone.paymentType === 'percentageWithCap') {
                        milestoneBonus = (data.totalPrepayments * milestone.paymentValue) / 100;
                        if (milestone.maxPayment) {
                            milestoneBonus = Math.min(milestoneBonus, milestone.maxPayment);
                        }
                    }

                    commissionData[managerId].milestoneBonus += milestoneBonus;
                }
            });
        });

        this.calculatedReport = Object.values(commissionData);
        this.agentData = agentData; // Сохраняем для отладки
        this.render();
    }

    toggleManager(managerId) {
        if (this.collapsedManagers.has(managerId)) {
            this.collapsedManagers.delete(managerId);
        } else {
            this.collapsedManagers.add(managerId);
        }
        this.render();
    }

    toggleAgent(agentName) {
        if (this.collapsedAgents.has(agentName)) {
            this.collapsedAgents.delete(agentName);
        } else {
            this.collapsedAgents.add(agentName);
        }
        this.render();
    }

    render() {
        const tbody = document.getElementById('report-tbody');
        
        if (this.calculatedReport.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: var(--text-tertiary); padding: 2rem;">Загрузите данные для расчета комиссий</td></tr>';
            this.updateStats(0, 0, 0);
            return;
        }

        let html = '';
        
        this.calculatedReport.forEach(comm => {
            const managerTotal = comm.commission + comm.milestoneBonus;
            const isCollapsed = this.collapsedManagers.has(comm.managerId);
            const collapseIcon = isCollapsed ? '▶' : '▼';

            // Подсчёт статистики
            const totalAgents = comm.agents.length;
            let totalFgs = 0;
            let agentsWithCommission = 0;

            comm.agents.forEach(agentInfo => {
                if (this.agentData[agentInfo.name]) {
                    totalFgs += this.agentData[agentInfo.name].fgs.length;
                    const agentCommission = Object.values(this.agentData[agentInfo.name].commissions).reduce((sum, c) => sum + c, 0);
                    if (agentCommission > 0) {
                        agentsWithCommission++;
                    }
                }
            });

            html += `
                <tr style="background: var(--bg-tertiary); font-weight: 600; cursor: pointer;" onclick="reportCtrl.toggleManager(${comm.managerId})">
                    <td colspan="2">
                        <span style="margin-right: 0.5rem;">${collapseIcon}</span>
                        ${comm.managerName} (${comm.managerType})
                        <span style="color: var(--text-secondary); font-size: 0.85rem; font-weight: normal; margin-left: 0.5rem;">
                            • Агентов: ${totalAgents} • ФГ: ${totalFgs} • Выплата за: ${agentsWithCommission}
                        </span>
                    </td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td style="text-align: right; font-family: monospace;">$${comm.prepaymentsInPeriod.toFixed(2)}</td>
                    <td style="text-align: right; color: var(--success); font-family: monospace;">$${comm.commission.toFixed(2)}</td>
                    <td style="text-align: right; color: #a78bfa; font-family: monospace;">$${comm.milestoneBonus.toFixed(2)}</td>
                    <td style="text-align: right; color: var(--success); font-family: monospace; font-weight: 700;">$${managerTotal.toFixed(2)}</td>
                </tr>
            `;
            
            if (!isCollapsed) {
                // Показываем агентов
                comm.agents.forEach(agentInfo => {
                    const agentCommission = this.agentData[agentInfo.name] ?
                        Object.values(this.agentData[agentInfo.name].commissions).reduce((sum, c) => sum + c, 0) : 0;

                    // Пропускаем агентов с нулевой комиссией, если включён фильтр
                    if (this.hideZeroCommissionAgents && agentCommission === 0) {
                        return;
                    }

                    const agentFgs = this.agentData[agentInfo.name] ? this.agentData[agentInfo.name].fgs : [];
                    const isAgentCollapsed = this.collapsedAgents.has(agentInfo.name);
                    const agentCollapseIcon = isAgentCollapsed ? '▶' : '▼';
                    
                    html += `
                        <tr style="background: var(--bg-primary); opacity: 0.9; cursor: pointer;" onclick="reportCtrl.toggleAgent('${agentInfo.name.replace(/'/g, "\\'")}')">
                            <td style="padding-left: 2rem; font-size: 0.9rem; color: var(--text-secondary);" colspan="2">
                                <span style="margin-right: 0.5rem;">${agentCollapseIcon}</span>
                                └ ${agentInfo.name}
                            </td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td style="text-align: right; font-family: monospace; font-size: 0.9rem;">
                                $${agentInfo.prepayments.toFixed(2)}
                            </td>
                            <td style="text-align: right; font-family: monospace; font-size: 0.9rem; color: var(--success);">
                                $${agentCommission.toFixed(2)}
                            </td>
                            <td></td>
                            <td></td>
                        </tr>
                    `;
                    
                    // Показываем ФГ агента если не свёрнуто
                    if (!isAgentCollapsed && agentFgs.length > 0) {
                        agentFgs.forEach(fg => {
                            const fgNumber = fg['Номер ФГ'] || fg['id'];
                            const fgName = fg['ФГ'] || 'Без названия';
                            const fgCreated = this.formatDate(fg['Начало работы']);
                            const source = fg.source || '—';

                            // Используем предвычисленную дату первой предоплаты
                            const firstPrepaymentDate = this.fgFirstPrepaymentDates[fgNumber] || null;
                            const firstPrepayment = this.formatDate(firstPrepaymentDate);

                            html += `
                                <tr style="background: var(--bg-primary); opacity: 0.7;">
                                    <td style="padding-left: 4rem; font-size: 0.85rem; color: var(--text-tertiary);">
                                        └ ${fgName}
                                    </td>
                                    <td></td>
                                    <td style="font-size: 0.85rem; color: var(--text-tertiary);">${fgNumber}</td>
                                    <td style="font-size: 0.85rem; color: var(--text-tertiary);">${source}</td>
                                    <td style="font-size: 0.85rem; color: var(--text-tertiary);">${fgCreated}</td>
                                    <td style="font-size: 0.85rem; color: var(--text-tertiary);">${firstPrepayment}</td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                </tr>
                            `;
                        });
                    }
                });
            }
        });

        tbody.innerHTML = html;

        const totalPrepaymentsInPeriod = this.calculatedReport.reduce((sum, c) => sum + c.prepaymentsInPeriod, 0);
        const totalCommissions = this.calculatedReport.reduce((sum, c) => sum + c.commission + c.milestoneBonus, 0);
        const totalManagers = this.calculatedReport.length;

        this.updateStats(totalPrepaymentsInPeriod, totalCommissions, totalManagers);
    }

    updateStats(prepayments, commissions, managers) {
        document.getElementById('total-prepayments').textContent = `$${prepayments.toFixed(2)}`;
        document.getElementById('total-commissions').textContent = `$${commissions.toFixed(2)}`;
        document.getElementById('total-managers').textContent = managers;
    }
}

let reportCtrl;
