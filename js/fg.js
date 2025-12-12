// Контроллер ФГ
class FgController {
    constructor() {
        this.fgData = [];
        this.prepaymentsData = [];
        this.fgStats = {};
        this.sortColumn = 'agent';
        this.sortDirection = 'asc';
        this.collapsedAgents = new Set();
    }

    async loadData() {
        this.fgData = await db.getAll('fgData');
        this.prepaymentsData = await db.getAll('prepaymentsData');
        this.calculateStats();
    }

    calculateStats() {
        const statsByFg = {};

        this.prepaymentsData.forEach(payment => {
            const fgNumber = payment['Номер фин. группы'];
            
            if (!statsByFg[fgNumber]) {
                statsByFg[fgNumber] = {
                    totalPrepayments: 0,
                    commission: 0
                };
            }

            let amount = 0;
            const prepaymentStr = payment['Пополнения $'] || payment['Пополнения'] || '0';
            if (typeof prepaymentStr === 'string') {
                amount = parseFloat(prepaymentStr.replace(',', '.').replace(/[^\d.-]/g, '')) || 0;
            } else {
                amount = parseFloat(prepaymentStr) || 0;
            }

            statsByFg[fgNumber].totalPrepayments += amount;
        });

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

                const applicableRules = rulesCtrl.rules.filter(r => 
                    r.managerIds && r.managerIds.includes(managerId)
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

                let totalCommission = 0;
                applicableRules.forEach(rule => {
                    let ruleCommission = 0;
                    
                    if (rule.commissionType === 'percentage' || rule.commissionType === 'firstPrepaymentOnly') {
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

    sortBy(column) {
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
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

    async render() {
        await this.loadData();
        
        const tbody = document.getElementById('fg-tbody');
        
        if (this.fgData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-tertiary); padding: 2rem;">Загрузите данные по ФГ</td></tr>';
            return;
        }

        // Группировка по агентам
        const agentGroups = {};
        this.fgData.forEach(fg => {
            const fgName = fg['ФГ'] || 'Без названия';
            const agent = fg.agent || app.extractAgentName(fgName);
            
            if (!agentGroups[agent]) {
                agentGroups[agent] = [];
            }
            agentGroups[agent].push(fg);
        });

        // Сортировка агентов
        const sortedAgents = Object.keys(agentGroups).sort((a, b) => {
            if (this.sortColumn === 'agent') {
                return this.sortDirection === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
            }
            // Для других колонок - суммируем по агенту
            const sumA = agentGroups[a].reduce((sum, fg) => {
                const stats = this.fgStats[fg['Номер ФГ'] || fg['id']] || { totalPrepayments: 0, commission: 0 };
                return sum + (this.sortColumn === 'prepayments' ? stats.totalPrepayments : stats.commission);
            }, 0);
            const sumB = agentGroups[b].reduce((sum, fg) => {
                const stats = this.fgStats[fg['Номер ФГ'] || fg['id']] || { totalPrepayments: 0, commission: 0 };
                return sum + (this.sortColumn === 'prepayments' ? stats.totalPrepayments : stats.commission);
            }, 0);
            return this.sortDirection === 'asc' ? sumA - sumB : sumB - sumA;
        });

        let html = '';

        // Обновляем заголовки с индикаторами сортировки
        const thead = document.querySelector('#fg-table thead');
        thead.innerHTML = `
            <tr>
                <th>ФГ</th>
                <th>Номер ФГ</th>
                <th style="cursor: pointer;" onclick="fgCtrl.sortBy('agent')">
                    Агент ${this.sortColumn === 'agent' ? (this.sortDirection === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th>Реф</th>
                <th>Источник</th>
                <th>Менеджер</th>
                <th style="cursor: pointer; text-align: right;" onclick="fgCtrl.sortBy('prepayments')">
                    Сумма предоплат ${this.sortColumn === 'prepayments' ? (this.sortDirection === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th style="cursor: pointer; text-align: right;" onclick="fgCtrl.sortBy('commission')">
                    Выплачено комиссии ${this.sortColumn === 'commission' ? (this.sortDirection === 'asc' ? '▲' : '▼') : ''}
                </th>
            </tr>
        `;

        sortedAgents.forEach(agentName => {
            const agentFgs = agentGroups[agentName];
            const isCollapsed = this.collapsedAgents.has(agentName);
            const collapseIcon = isCollapsed ? '▶' : '▼';

            // Подсчёт общих сумм для агента
            let agentTotalPrepayments = 0;
            let agentTotalCommission = 0;
            agentFgs.forEach(fg => {
                const stats = this.fgStats[fg['Номер ФГ'] || fg['id']] || { totalPrepayments: 0, commission: 0 };
                agentTotalPrepayments += stats.totalPrepayments;
                agentTotalCommission += stats.commission;
            });

            // Заголовок агента
            html += `
                <tr style="background: var(--bg-tertiary); font-weight: 600; cursor: pointer;" onclick="fgCtrl.toggleAgent('${agentName.replace(/'/g, "\\'")}')">
                    <td colspan="2">
                        <span style="margin-right: 0.5rem;">${collapseIcon}</span>
                        ${agentName}
                    </td>
                    <td>${agentFgs.length} ФГ</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td style="text-align: right; font-family: monospace; color: var(--accent-primary);">
                        $${agentTotalPrepayments.toFixed(2)}
                    </td>
                    <td style="text-align: right; font-family: monospace; color: var(--success);">
                        $${agentTotalCommission.toFixed(2)}
                    </td>
                </tr>
            `;

            // ФГ агента (показываем только если не свёрнуто)
            if (!isCollapsed) {
                agentFgs.forEach(fg => {
                    const fgName = fg['ФГ'] || 'Без названия';
                    const fgNumber = fg['Номер ФГ'] || fg['id'] || '—';
                    const ref = fg['Реф'] || '—';
                    const source = fg.source || '—';
                    const managerName = fg.manager ? fg.manager.name : '—';
                    
                    const stats = this.fgStats[fgNumber] || { totalPrepayments: 0, commission: 0 };

                    html += `
                        <tr style="background: var(--bg-primary); opacity: 0.9;">
                            <td style="padding-left: 2rem; font-size: 0.9rem;">└ ${fgName}</td>
                            <td style="font-size: 0.85rem; color: var(--text-tertiary);">${fgNumber}</td>
                            <td></td>
                            <td style="font-size: 0.85rem; color: var(--text-tertiary);">${ref}</td>
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
                            <td style="text-align: right; font-family: monospace; color: var(--accent-primary); font-size: 0.9rem;">
                                $${stats.totalPrepayments.toFixed(2)}
                            </td>
                            <td style="text-align: right; font-family: monospace; color: var(--success); font-size: 0.9rem;">
                                $${stats.commission.toFixed(2)}
                            </td>
                        </tr>
                    `;
                });
            }
        });

        tbody.innerHTML = html;
    }
}

let fgCtrl;
