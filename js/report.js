// Контроллер отчетов и расчетов
class ReportController {
    constructor() {
        this.fgData = [];
        this.prepaymentsData = [];
        this.calculatedReport = [];
        this.collapsedManagers = new Set();
        this.collapsedAgents = new Set();
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
                const dateA = new Date(a['Начало работы'] || '9999-12-31');
                const dateB = new Date(b['Начало работы'] || '9999-12-31');
                return dateA - dateB;
            });
            
            if (sortedByDate.length > 0) {
                agentEarliestFgDate[agent] = new Date(sortedByDate[0]['Начало работы'] || '9999-12-31');
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
            
            let amount = 0;
            const prepaymentStr = payment['Пополнения $'] || payment['Пополнения'] || '0';
            if (typeof prepaymentStr === 'string') {
                amount = parseFloat(prepaymentStr.replace(',', '.').replace(/[^\d.-]/g, '')) || 0;
            } else {
                amount = parseFloat(prepaymentStr) || 0;
            }

            const paymentDate = new Date(payment['Период'] || '1970-01-01');
            const isInPeriod = (!startDate || paymentDate >= startDate) && (!endDate || paymentDate <= endDate);

            if (agentData[agent]) {
                agentData[agent].totalPrepayments += amount;
                
                if (isInPeriod) {
                    agentData[agent].prepaymentsInPeriod += amount;
                }

                // Фиксируем первую предоплату агента
                if (!agentData[agent].firstPrepaymentDate || paymentDate < agentData[agent].firstPrepaymentDate) {
                    agentData[agent].firstPrepaymentDate = paymentDate;
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
                    commission: 0,
                    milestoneBonus: 0,
                    agentsCount: 0,
                    agents: []
                };
            }

            commissionData[managerId].totalPrepayments += data.totalPrepayments;
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
                            // Находим сумму первой предоплаты
                            const firstPayment = this.prepaymentsData.find(p => {
                                const fg = this.fgData.find(f => (f['Номер ФГ'] || f['id']) == p['Номер фин. группы']);
                                if (!fg) return false;
                                const payAgent = fg.agent || app.extractAgentName(fg['ФГ']);
                                const payDate = new Date(p['Период'] || '1970-01-01');
                                return payAgent === agent && payDate.getTime() === data.firstPrepaymentDate.getTime();
                            });
                            
                            if (firstPayment) {
                                const prepaymentStr = firstPayment['Пополнения $'] || firstPayment['Пополнения'] || '0';
                                if (typeof prepaymentStr === 'string') {
                                    amountToCalculate = parseFloat(prepaymentStr.replace(',', '.').replace(/[^\d.-]/g, '')) || 0;
                                } else {
                                    amountToCalculate = parseFloat(prepaymentStr) || 0;
                                }
                            }
                        }
                    }
                } else if (rule.applyTo === 'earlyFg') {
                    // Предоплаты самой ранней ФГ
                    const earliestFg = data.fgs.sort((a, b) => {
                        const dateA = new Date(a['Начало работы'] || '9999-12-31');
                        const dateB = new Date(b['Начало работы'] || '9999-12-31');
                        return dateA - dateB;
                    })[0];
                    
                    if (earliestFg) {
                        const earliestFgNumber = earliestFg['Номер ФГ'] || earliestFg['id'];
                        this.prepaymentsData.forEach(p => {
                            if (p['Номер фин. группы'] == earliestFgNumber) {
                                const payDate = new Date(p['Период'] || '1970-01-01');
                                const inPeriod = (!startDate || payDate >= startDate) && (!endDate || payDate <= endDate);
                                
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
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-tertiary); padding: 2rem;">Загрузите данные для расчета комиссий</td></tr>';
            this.updateStats(0, 0, 0);
            return;
        }

        let html = '';
        
        this.calculatedReport.forEach(comm => {
            const managerTotal = comm.commission + comm.milestoneBonus;
            const isCollapsed = this.collapsedManagers.has(comm.managerId);
            const collapseIcon = isCollapsed ? '▶' : '▼';
            
            html += `
                <tr style="background: var(--bg-tertiary); font-weight: 600; cursor: pointer;" onclick="reportCtrl.toggleManager(${comm.managerId})">
                    <td colspan="4">
                        <span style="margin-right: 0.5rem;">${collapseIcon}</span>
                        ${comm.managerName} (${comm.managerType})
                    </td>
                    <td style="text-align: right; font-family: monospace;">$${comm.totalPrepayments.toFixed(2)}</td>
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
                    
                    const agentFgs = this.agentData[agentInfo.name] ? this.agentData[agentInfo.name].fgs : [];
                    const isAgentCollapsed = this.collapsedAgents.has(agentInfo.name);
                    const agentCollapseIcon = isAgentCollapsed ? '▶' : '▼';
                    
                    html += `
                        <tr style="background: var(--bg-primary); opacity: 0.9; cursor: pointer;" onclick="reportCtrl.toggleAgent('${agentInfo.name.replace(/'/g, "\\'")}')">
                            <td style="padding-left: 2rem; font-size: 0.9rem; color: var(--text-secondary);" colspan="4">
                                <span style="margin-right: 0.5rem;">${agentCollapseIcon}</span>
                                └ ${agentInfo.name}
                            </td>
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
                            const fgCreated = fg['Начало работы'] ? new Date(fg['Начало работы']).toLocaleDateString('ru-RU') : '—';
                            const source = fg.source || '—';
                            
                            html += `
                                <tr style="background: var(--bg-primary); opacity: 0.7;">
                                    <td style="padding-left: 4rem; font-size: 0.85rem; color: var(--text-tertiary);" colspan="2">
                                        └ ${fgName}
                                    </td>
                                    <td style="font-size: 0.85rem; color: var(--text-tertiary);">${fgNumber}</td>
                                    <td style="font-size: 0.85rem; color: var(--text-tertiary);">${source}</td>
                                    <td style="font-size: 0.85rem; color: var(--text-tertiary);">${fgCreated}</td>
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

        const totalPrepayments = this.calculatedReport.reduce((sum, c) => sum + c.totalPrepayments, 0);
        const totalCommissions = this.calculatedReport.reduce((sum, c) => sum + c.commission + c.milestoneBonus, 0);
        const totalManagers = this.calculatedReport.length;

        this.updateStats(totalPrepayments, totalCommissions, totalManagers);
    }

    updateStats(prepayments, commissions, managers) {
        document.getElementById('total-prepayments').textContent = `$${prepayments.toFixed(2)}`;
        document.getElementById('total-commissions').textContent = `$${commissions.toFixed(2)}`;
        document.getElementById('total-managers').textContent = managers;
    }
}

let reportCtrl;
