// Контроллер отчетов и расчетов
class ReportController {
    constructor() {
        this.fgData = [];
        this.prepaymentsData = [];
        this.calculatedReport = [];
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

        // Расчет базовых комиссий
        this.prepaymentsData.forEach(payment => {
            const fg = this.fgData.find(f => {
                const fgNumber = f['Номер ФГ'] || f['id'];
                const paymentNumber = payment['Номер фин. группы'];
                return fgNumber == paymentNumber;
            });

            if (!fg || !fg.manager) return;

            const managerId = fg.manager.id;
            const managerName = fg.manager.name;
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
                    appliedRules: []
                };
            }

            // Парсинг суммы
            let amount = 0;
            const prepaymentStr = payment['Пополнения $'] || payment['Пополнения'] || '0';
            if (typeof prepaymentStr === 'string') {
                amount = parseFloat(prepaymentStr.replace(',', '.').replace(/[^\d.-]/g, '')) || 0;
            } else {
                amount = parseFloat(prepaymentStr) || 0;
            }

            commissionData[managerId].totalPrepayments += amount;
            commissionData[managerId].fgCount += 1;

            // НОВАЯ ЛОГИКА: Находим ВСЕ правила для этого менеджера (общие + персональные)
            const applicableRules = rulesCtrl.rules.filter(r => 
                (r.managerIds && r.managerIds.includes(managerId)) // Групповые правила
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

            // Суммируем комиссии от всех правил
            if (applicableRules.length > 0) {
                applicableRules.forEach(rule => {
                    let ruleCommission = 0;
                    
                    if (rule.commissionType === 'percentage') {
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
                    
                    commissionData[managerId].commission += ruleCommission;
                    
                    // Записываем примененное правило
                    if (!commissionData[managerId].appliedRules.find(r => r.id === rule.id)) {
                        commissionData[managerId].appliedRules.push(rule);
                    }
                });
            } else {
                // Если нет правил - комиссия = 0 (стартовая комиссия больше не используется)
                commissionData[managerId].commission += 0;
            }
        });

        // Расчет milestone бонусов
        Object.values(commissionData).forEach(manager => {
            milestonesCtrl.milestones.forEach(milestone => {
                const isApplicable = 
                    milestone.managerGroup === 'all' ||
                    (milestone.managerGroup === 'recruiters' && manager.managerType === 'recruiter') ||
                    (milestone.managerGroup === 'accounts' && manager.managerType === 'account') ||
                    (milestone.managerGroup === 'custom' && milestone.assignedManagers.includes(manager.managerId));

                if (isApplicable && manager.totalPrepayments >= milestone.targetAmount) {
                    if (milestone.paymentType === 'fixed') {
                        manager.milestoneBonus += milestone.paymentValue;
                    } else if (milestone.paymentType === 'percentage') {
                        let bonus = (manager.totalPrepayments * milestone.paymentValue) / 100;
                        if (milestone.maxPayment) {
                            bonus = Math.min(bonus, milestone.maxPayment);
                        }
                        manager.milestoneBonus += bonus;
                    } else if (milestone.paymentType === 'percentageWithCap') {
                        let bonus = (manager.totalPrepayments * milestone.paymentValue) / 100;
                        if (milestone.maxPayment) {
                            bonus = Math.min(bonus, milestone.maxPayment);
                        }
                        manager.milestoneBonus += bonus;
                    }
                }
            });
        });

        this.calculatedReport = Object.values(commissionData);
        this.render();
    }

    render() {
        const tbody = document.getElementById('report-tbody');
        
        if (this.calculatedReport.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-tertiary); padding: 2rem;">Загрузите данные для расчета комиссий</td></tr>';
            this.updateStats(0, 0, 0);
            return;
        }

        tbody.innerHTML = this.calculatedReport.map(comm => {
            const total = comm.commission + comm.milestoneBonus;
            
            return `
                <tr>
                    <td>${comm.managerName}</td>
                    <td style="text-transform: capitalize; color: var(--text-secondary);">${comm.managerType}</td>
                    <td style="text-align: right;">${comm.fgCount}</td>
                    <td style="text-align: right; color: var(--accent-primary); font-family: monospace;">$${comm.totalPrepayments.toFixed(2)}</td>
                    <td style="text-align: right; color: var(--success); font-family: monospace;">$${comm.commission.toFixed(2)}</td>
                    <td style="text-align: right; color: #a78bfa; font-family: monospace;">$${comm.milestoneBonus.toFixed(2)}</td>
                    <td style="text-align: right; color: var(--success); font-family: monospace; font-weight: 600;">$${total.toFixed(2)}</td>
                </tr>
            `;
        }).join('');

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
