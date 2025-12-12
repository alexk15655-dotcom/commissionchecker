// Контроллер отчетов и расчетов
class ReportController {
    constructor() {
        this.fgData = [];
        this.prepaymentsData = [];
        this.calculatedReport = [];
        this.fgDetails = [];
        this.collapsedManagers = new Set();
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
        const fgData = {};
        const agentFirstPrepayments = {};
        const agentGroups = {}; // Группы агентов с их ФГ
        const agentManagers = {}; // Менеджеры по агентам

        const startDateStr = document.getElementById('report-start-date').value;
        const endDateStr = document.getElementById('report-end-date').value;
        const startDate = startDateStr ? new Date(startDateStr) : null;
        const endDate = endDateStr ? new Date(endDateStr) : null;

        // Группируем ФГ по агентам и определяем менеджера группы
        this.fgData.forEach(fg => {
            const fgName = fg['ФГ'] || 'Без названия';
            const agent = fg.agent || app.extractAgentName(fgName);
            
            if (!agentGroups[agent]) {
                agentGroups[agent] = [];
            }
            agentGroups[agent].push(fg);

            // Если у ФГ есть менеджер (Recruiter/Account) - он становится менеджером группы
            if (fg.manager && !agentManagers[agent]) {
                agentManagers[agent] = fg.manager;
            }
        });

        const sortedPrepayments = [...this.prepaymentsData].sort((a, b) => {
            const dateA = new Date(a['Период'] || '1970-01-01');
            const dateB = new Date(b['Период'] || '1970-01-01');
            return dateA - dateB;
        });

        // Подсчитываем суммы по агентам для правил с порогом
        const agentTotals = {};
        sortedPrepayments.forEach(payment => {
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

            if (!agentTotals[agent]) {
                agentTotals[agent] = 0;
            }
            agentTotals[agent] += amount;
        });

        // Определяем самую раннюю ФГ с менеджером для каждого агента
        const agentEarliestManagedFg = {};
        Object.keys(agentGroups).forEach(agent => {
            const fgsWithManager = agentGroups[agent]
                .filter(fg => fg.manager)
                .sort((a, b) => {
                    const dateA = new Date(a['Начало работы'] || '9999-12-31');
                    const dateB = new Date(b['Начало работы'] || '9999-12-31');
                    return dateA - dateB;
                });
            
            if (fgsWithManager.length > 0) {
                agentEarliestManagedFg[agent] = fgsWithManager[0]['Номер ФГ'] || fgsWithManager[0]['id'];
            }
        });

        sortedPrepayments.forEach(payment => {
            const fg = this.fgData.find(f => {
                const fgNumber = f['Номер ФГ'] || f['id'];
                const paymentNumber = payment['Номер фин. группы'];
                return fgNumber == paymentNumber;
            });

            if (!fg) return;

            const fgNumber = fg['Номер ФГ'] || fg['id'];
            const fgName = fg['ФГ'] || 'Без названия';
            const agent = fg.agent || app.extractAgentName(fgName);
            
            const paymentDate = new Date(payment['Период'] || '1970-01-01');
            const isInPeriod = (!startDate || paymentDate >= startDate) && (!endDate || paymentDate <= endDate);

            let amount = 0;
            const prepaymentStr = payment['Пополнения $'] || payment['Пополнения'] || '0';
            if (typeof prepaymentStr === 'string') {
                amount = parseFloat(prepaymentStr.replace(',', '.').replace(/[^\d.-]/g, '')) || 0;
            } else {
                amount = parseFloat(prepaymentStr) || 0;
            }

            if (!agentFirstPrepayments[agent]) {
                agentFirstPrepayments[agent] = {
                    fgNumber: fgNumber,
                    date: paymentDate,
                    amount: amount
                };
            }

            if (!fgData[fgNumber]) {
                fgData[fgNumber] = {
                    fgNumber,
                    fgName,
                    agent,
                    manager: fg.manager,
                    source: fg.source,
                    totalPrepayments: 0,
                    commission: 0
                };
            }

            fgData[fgNumber].totalPrepayments += amount;

            // КЛЮЧЕВАЯ ЛОГИКА: Если в группе есть менеджер, то начисляем комиссию
            // только ФГ с этим менеджером (или ранней ФГ при достижении порога)
            const groupManager = agentManagers[agent];
            
            if (groupManager) {
                // Проверяем: эта ФГ имеет того же менеджера или это ранняя ФГ при earlyFgWithThreshold
                const shouldCalculateCommission = fg.manager && fg.manager.id === groupManager.id;

                if (shouldCalculateCommission) {
                    const managerId = groupManager.id;
                    const managerName = groupManager.name;
                    const managerType = fg.source === 'Recruiter' ? 'recruiter' : 'account';

                    if (!commissionData[managerId]) {
                        commissionData[managerId] = {
                            managerId,
                            managerName,
                            managerType,
                            totalPrepayments: 0,
                            commission: 0,
                            milestoneBonus: 0,
                            fgCount: 0,
                            fgList: [],
                            agentsList: new Set(),
                            appliedRules: []
                        };
                    }

                    commissionData[managerId].totalPrepayments += amount;
                    commissionData[managerId].agentsList.add(agent);
                    
                    if (!commissionData[managerId].fgList.includes(fgNumber)) {
                        commissionData[managerId].fgList.push(fgNumber);
                        commissionData[managerId].fgCount += 1;
                    }

                    const applicableRules = rulesCtrl.rules.filter(r => 
                        (r.managerIds && r.managerIds.includes(managerId))
                    );

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

                    let fgCommission = 0;
                    if (applicableRules.length > 0) {
                        applicableRules.forEach(rule => {
                            if (rule.periodOnly && !isInPeriod) {
                                return;
                            }

                            // Правило "только первая предоплата агента"
                            if (rule.commissionType === 'firstPrepaymentOnly') {
                                const firstPrepayment = agentFirstPrepayments[agent];
                                if (!firstPrepayment || firstPrepayment.fgNumber !== fgNumber) {
                                    return;
                                }
                                
                                if (rule.periodOnly && !isInPeriod) {
                                    return;
                                }
                            }

                            // Правило "ранняя ФГ при достижении порога"
                            if (rule.commissionType === 'earlyFgWithThreshold') {
                                // Проверяем: это ранняя ФГ с менеджером?
                                const earliestFg = agentEarliestManagedFg[agent];
                                if (!earliestFg || earliestFg !== fgNumber) {
                                    return;
                                }

                                // Проверяем порог
                                if (rule.threshold && agentTotals[agent] < rule.threshold) {
                                    return;
                                }

                                if (rule.periodOnly && !isInPeriod) {
                                    return;
                                }
                            }

                            let ruleCommission = 0;
                            
                            if (rule.commissionType === 'percentage' || 
                                rule.commissionType === 'firstPrepaymentOnly' ||
                                rule.commissionType === 'earlyFgWithThreshold') {
                                ruleCommission = (amount * rule.value) / 100;
                                if (rule.maxAmount) {
                                    ruleCommission = Math.min(ruleCommission, rule.maxAmount);
                                }
                            } else if (rule.commissionType === 'fixed') {
                                ruleCommission = rule.value;
                            } else if (rule.commissionType === 'percentageWithCap') {
                                ruleCommission = (amount * rule.value) / 100;
                                if (rule.maxAmount) {
                                    ruleCommission = Math.min(ruleCommission, rule.maxAmount);
                                }
                            }
                            
                            fgCommission += ruleCommission;
                            
                            if (!commissionData[managerId].appliedRules.find(r => r.id === rule.id)) {
                                commissionData[managerId].appliedRules.push(rule);
                            }
                        });
                    }

                    commissionData[managerId].commission += fgCommission;
                    fgData[fgNumber].commission = fgCommission;
                }
            }
        });

        // Расчет milestone бонусов
        // Milestones считаются по группам агентов: сумма всех ФГ в группе
        Object.values(commissionData).forEach(manager => {
            // Для каждого агента считаем milestone отдельно
            manager.agentsList.forEach(agent => {
                const agentTotal = agentTotals[agent] || 0;

                milestonesCtrl.milestones.forEach(milestone => {
                    const isApplicable = 
                        milestone.managerGroup === 'all' ||
                        (milestone.managerGroup === 'recruiters' && manager.managerType === 'recruiter') ||
                        (milestone.managerGroup === 'accounts' && manager.managerType === 'account') ||
                        (milestone.managerGroup === 'custom' && milestone.assignedManagers.includes(manager.managerId));

                    if (isApplicable && agentTotal >= milestone.targetAmount) {
                        if (milestone.paymentType === 'fixed') {
                            manager.milestoneBonus += milestone.paymentValue;
                        } else if (milestone.paymentType === 'percentage') {
                            let bonus = (agentTotal * milestone.paymentValue) / 100;
                            if (milestone.maxPayment) {
                                bonus = Math.min(bonus, milestone.maxPayment);
                            }
                            manager.milestoneBonus += bonus;
                        } else if (milestone.paymentType === 'percentageWithCap') {
                            let bonus = (agentTotal * milestone.paymentValue) / 100;
                            if (milestone.maxPayment) {
                                bonus = Math.min(bonus, milestone.maxPayment);
                            }
                            manager.milestoneBonus += bonus;
                        }
                    }
                });
            });
        });

        this.calculatedReport = Object.values(commissionData);
        this.fgDetails = Object.values(fgData);
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
                    <td colspan="2">
                        <span style="margin-right: 0.5rem;">${collapseIcon}</span>
                        ${comm.managerName}
                    </td>
                    <td style="text-transform: capitalize;">${comm.managerType}</td>
                    <td style="text-align: right;">${comm.fgCount} ФГ</td>
                    <td style="text-align: right; font-family: monospace;">$${comm.totalPrepayments.toFixed(2)}</td>
                    <td style="text-align: right; color: var(--success); font-family: monospace;">$${comm.commission.toFixed(2)}</td>
                    <td style="text-align: right; color: #a78bfa; font-family: monospace;">$${comm.milestoneBonus.toFixed(2)}</td>
                    <td style="text-align: right; color: var(--success); font-family: monospace; font-weight: 700;">$${managerTotal.toFixed(2)}</td>
                </tr>
            `;
            
            if (!isCollapsed) {
                comm.fgList.forEach(fgNumber => {
                    const fgDetail = this.fgDetails.find(f => f.fgNumber == fgNumber);
                    if (fgDetail) {
                        html += `
                            <tr style="background: var(--bg-primary); opacity: 0.9;">
                                <td style="padding-left: 2rem; font-size: 0.9rem; color: var(--text-secondary);">└ ${fgDetail.fgName}</td>
                                <td style="font-size: 0.85rem; color: var(--text-tertiary);">${fgDetail.fgNumber}</td>
                                <td style="font-size: 0.85rem; color: var(--accent-secondary);">${fgDetail.agent}</td>
                                <td>
                                    <span style="
                                        padding: 0.15rem 0.4rem; 
                                        border-radius: 3px; 
                                        font-size: 0.75rem;
                                        background: ${fgDetail.source === 'Recruiter' || fgDetail.source === 'Account' ? 'var(--accent-primary)' : 'var(--bg-tertiary)'};
                                        color: ${fgDetail.source === 'Recruiter' || fgDetail.source === 'Account' ? '#0f172a' : 'var(--text-primary)'};
                                    ">
                                        ${fgDetail.source}
                                    </span>
                                </td>
                                <td style="text-align: right; font-family: monospace; font-size: 0.9rem;">$${fgDetail.totalPrepayments.toFixed(2)}</td>
                                <td style="text-align: right; font-family: monospace; font-size: 0.9rem;">$${fgDetail.commission.toFixed(2)}</td>
                                <td></td>
                                <td></td>
                            </tr>
                        `;
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
