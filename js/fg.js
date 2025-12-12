// Контроллер ФГ
class FgController {
    constructor() {
        this.fgData = [];
        this.prepaymentsData = [];
        this.fgStats = {};
    }

    async loadData() {
        this.fgData = await db.getAll('fgData');
        this.prepaymentsData = await db.getAll('prepaymentsData');
        this.calculateStats();
    }

    calculateStats() {
        // Группируем предоплаты по ФГ
        const statsByFg = {};

        this.prepaymentsData.forEach(payment => {
            const fgNumber = payment['Номер фин. группы'];
            
            if (!statsByFg[fgNumber]) {
                statsByFg[fgNumber] = {
                    totalPrepayments: 0,
                    commission: 0
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

            statsByFg[fgNumber].totalPrepayments += amount;
        });

        // Расчет комиссий для каждой ФГ
        this.fgData.forEach(fg => {
            const fgNumber = fg['Номер ФГ'] || fg['id'];
            
            if (!statsByFg[fgNumber]) {
                statsByFg[fgNumber] = {
                    totalPrepayments: 0,
                    commission: 0
                };
            }

            if (fg.manager) {
                const managerId = fg.manager.id;
                const amount = statsByFg[fgNumber].totalPrepayments;

                // Находим все правила для менеджера
                const applicableRules = rulesCtrl.rules.filter(r => 
                    r.managerIds && r.managerIds.includes(managerId)
                );

                // Добавляем персональные правила
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

                // Суммируем комиссии
                let totalCommission = 0;
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
                    
                    totalCommission += ruleCommission;
                });

                statsByFg[fgNumber].commission = totalCommission;
            }
        });

        this.fgStats = statsByFg;
    }

    async render() {
        await this.loadData();
        
        const tbody = document.getElementById('fg-tbody');
        
        if (this.fgData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-tertiary); padding: 2rem;">Загрузите данные по ФГ</td></tr>';
            return;
        }

        tbody.innerHTML = this.fgData.map(fg => {
            const fgName = fg['ФГ'] || 'Без названия';
            const fgNumber = fg['Номер ФГ'] || fg['id'] || '—';
            const source = fg.source || '—';
            const managerName = fg.manager ? fg.manager.name : '—';
            
            const stats = this.fgStats[fgNumber] || { totalPrepayments: 0, commission: 0 };

            return `
                <tr>
                    <td>${fgName}</td>
                    <td>${fgNumber}</td>
                    <td>
                        <span style="
                            padding: 0.25rem 0.5rem; 
                            border-radius: 4px; 
                            font-size: 0.85rem;
                            background: ${source === 'Recruiter' || source === 'Account' ? 'var(--accent-primary)' : 'var(--bg-tertiary)'};
                            color: ${source === 'Recruiter' || source === 'Account' ? '#0f172a' : 'var(--text-primary)'};
                        ">
                            ${source}
                        </span>
                    </td>
                    <td>${managerName}</td>
                    <td style="text-align: right; font-family: monospace; color: var(--accent-primary);">
                        $${stats.totalPrepayments.toFixed(2)}
                    </td>
                    <td style="text-align: right; font-family: monospace; color: var(--success);">
                        $${stats.commission.toFixed(2)}
                    </td>
                </tr>
            `;
        }).join('');
    }
}

let fgCtrl;
