// Управление правилами комиссий
class RulesController {
    constructor() {
        this.rules = [];
        this.init();
    }

    async init() {
        await this.loadRules();
        this.setupEventListeners();
        this.render();
    }

    async loadRules() {
        this.rules = await db.getAll('rules');
    }

    setupEventListeners() {
        document.getElementById('add-rule-btn').addEventListener('click', () => {
            this.showAddModal();
        });
    }

    showAddModal(existingRule = null) {
        const modal = document.getElementById('modal');
        const modalBody = document.getElementById('modal-body');
        
        const recruiters = managersCtrl.recruiters;
        const accounts = managersCtrl.accountManagers;
        const defaultCommission = app.defaultCommission;
        const isEdit = !!existingRule;
        
        modalBody.innerHTML = `
            <h2>${isEdit ? 'Редактировать правило' : 'Новое правило комиссии'}</h2>
            
            <div class="form-group">
                <label>Название правила</label>
                <input type="text" id="rule-name" placeholder="Например: Q4 2024 Enhanced Commission" value="${existingRule ? existingRule.name : ''}">
            </div>

            <div class="form-group">
                <label>Тип менеджера</label>
                <select id="rule-manager-type">
                    <option value="recruiter" ${existingRule && existingRule.managerType === 'recruiter' ? 'selected' : ''}>Recruiter</option>
                    <option value="account" ${existingRule && existingRule.managerType === 'account' ? 'selected' : ''}>Account Manager</option>
                </select>
            </div>

            <div class="form-group">
                <label>Выбор менеджеров (можно несколько)</label>
                <div class="checkbox-group" id="managers-checkboxes">
                    <!-- Заполнится динамически -->
                </div>
            </div>

            <hr style="margin: 1.5rem 0; border: none; border-top: 1px solid var(--bg-tertiary);">
            <h3 style="margin-bottom: 1rem; color: var(--accent-primary);">Шаг 1: Тип начисления</h3>

            <div class="form-group">
                <label>
                    <input type="radio" name="payment-type" value="percentage" ${!existingRule || existingRule.paymentType === 'percentage' ? 'checked' : ''} style="width: auto; margin-right: 0.5rem;">
                    Процент от суммы (%)
                </label>
                <input type="number" id="payment-percentage" value="${existingRule && existingRule.paymentType === 'percentage' ? existingRule.paymentValue : defaultCommission}" step="0.1" min="0" style="margin-top: 0.5rem;" ${existingRule && existingRule.paymentType !== 'percentage' ? 'disabled' : ''}>
            </div>

            <div class="form-group">
                <label>
                    <input type="radio" name="payment-type" value="fixed" ${existingRule && existingRule.paymentType === 'fixed' ? 'checked' : ''} style="width: auto; margin-right: 0.5rem;">
                    Фиксированная сумма ($)
                </label>
                <input type="number" id="payment-fixed" value="${existingRule && existingRule.paymentType === 'fixed' ? existingRule.paymentValue : 100}" step="0.01" min="0" style="margin-top: 0.5rem;" ${!existingRule || existingRule.paymentType !== 'fixed' ? 'disabled' : ''}>
            </div>

            <hr style="margin: 1.5rem 0; border: none; border-top: 1px solid var(--bg-tertiary);">
            <h3 style="margin-bottom: 1rem; color: var(--accent-primary);">Шаг 2: Условие применения</h3>

            <div class="form-group">
                <label>
                    <input type="radio" name="apply-to" value="all" ${!existingRule || existingRule.applyTo === 'all' ? 'checked' : ''} style="width: auto; margin-right: 0.5rem;">
                    За все предоплаты
                </label>
                <small style="display: block; margin-top: 0.25rem; color: var(--text-tertiary);">
                    Комиссия начисляется за каждую предоплату ФГ с менеджером
                </small>
            </div>

            <div class="form-group">
                <label>
                    <input type="radio" name="apply-to" value="firstPrepayment" ${existingRule && existingRule.applyTo === 'firstPrepayment' ? 'checked' : ''} style="width: auto; margin-right: 0.5rem;">
                    За первую предоплату агента
                </label>
                <small style="display: block; margin-top: 0.25rem; color: var(--text-tertiary);">
                    Начисляется только за самую первую предоплату каждого агента
                </small>
            </div>

            <div class="form-group">
                <label>
                    <input type="radio" name="apply-to" value="earlyFg" ${existingRule && existingRule.applyTo === 'earlyFg' ? 'checked' : ''} style="width: auto; margin-right: 0.5rem;">
                    За раннюю ФГ группы
                </label>
                <small style="display: block; margin-top: 0.25rem; color: var(--text-tertiary);">
                    Комиссия за предоплаты самой ранней ФГ с менеджером
                </small>
            </div>

            <div class="form-group">
                <label>
                    <input type="radio" name="apply-to" value="groupWithThreshold" ${existingRule && existingRule.applyTo === 'groupWithThreshold' ? 'checked' : ''} style="width: auto; margin-right: 0.5rem;">
                    За группу при достижении порога
                </label>
                <small style="display: block; margin-top: 0.25rem; color: var(--text-tertiary);">
                    Комиссия за все ФГ с менеджером, когда их общая сумма достигнет порога
                </small>
            </div>

            <hr style="margin: 1.5rem 0; border: none; border-top: 1px solid var(--bg-tertiary);">
            <h3 style="margin-bottom: 1rem; color: var(--accent-primary);">Шаг 3: Ограничения (опционально)</h3>

            <div class="form-group">
                <label>Логика комбинирования ограничений</label>
                <div style="display: flex; gap: 1rem; margin-top: 0.5rem;">
                    <label>
                        <input type="radio" name="constraints-logic" value="AND" ${!existingRule || existingRule.constraintsLogic === 'AND' ? 'checked' : ''} style="width: auto; margin-right: 0.5rem;">
                        AND (все условия)
                    </label>
                    <label>
                        <input type="radio" name="constraints-logic" value="OR" ${existingRule && existingRule.constraintsLogic === 'OR' ? 'checked' : ''} style="width: auto; margin-right: 0.5rem;">
                        OR (любое условие)
                    </label>
                </div>
            </div>

            <div class="form-group">
                <label>
                    <input type="checkbox" id="constraint-max" ${existingRule && existingRule.constraints.maxPerPayment ? 'checked' : ''} style="width: auto; margin-right: 0.5rem;">
                    Максимальная выплата за агента ($)
                </label>
                <input type="number" id="constraint-max-value" step="0.01" min="0" placeholder="Например: 500" value="${existingRule && existingRule.constraints.maxPerPayment ? existingRule.constraints.maxPerPayment : ''}" style="margin-top: 0.5rem;" ${!existingRule || !existingRule.constraints.maxPerPayment ? 'disabled' : ''}>
                <small style="display: block; margin-top: 0.25rem; color: var(--text-tertiary);">
                    Ограничение применяется к общей сумме комиссии за агента
                </small>
            </div>

            <div class="form-group">
                <label>
                    <input type="checkbox" id="constraint-threshold" ${existingRule && existingRule.constraints.minGroupThreshold ? 'checked' : ''} style="width: auto; margin-right: 0.5rem;">
                    Минимальный порог группы ($)
                </label>
                <input type="number" id="constraint-threshold-value" step="0.01" min="0" placeholder="Например: 1000" value="${existingRule && existingRule.constraints.minGroupThreshold ? existingRule.constraints.minGroupThreshold : ''}" style="margin-top: 0.5rem;" ${!existingRule || !existingRule.constraints.minGroupThreshold ? 'disabled' : ''}>
                <small style="display: block; margin-top: 0.25rem; color: var(--text-tertiary);">
                    Не начислять пока сумма ФГ с менеджером не достигнет порога
                </small>
            </div>

            <div class="form-group">
                <label>
                    <input type="checkbox" id="constraint-period" ${existingRule && existingRule.constraints.periodOnly ? 'checked' : ''} style="width: auto; margin-right: 0.5rem;">
                    Только если создано в период отчёта
                </label>
                <small style="display: block; margin-top: 0.25rem; color: var(--text-tertiary);">
                    Фильтрация по периоду отчёта в зависимости от условия применения
                </small>
            </div>

            <div class="form-group">
                <label>
                    <input type="checkbox" id="constraint-new-agents" ${existingRule && existingRule.constraints.newAgentsOnly ? 'checked' : ''} style="width: auto; margin-right: 0.5rem;">
                    Только новые агенты (первая ФГ не старше X месяцев)
                </label>
                <input type="number" id="constraint-new-agents-months" step="1" min="1" placeholder="Например: 3" value="${existingRule && existingRule.constraints.newAgentsMonths ? existingRule.constraints.newAgentsMonths : ''}" style="margin-top: 0.5rem;" ${!existingRule || !existingRule.constraints.newAgentsOnly ? 'disabled' : ''}>
                <small style="display: block; margin-top: 0.25rem; color: var(--text-tertiary);">
                    Считаются только агенты, чья первая ФГ появилась не раньше указанного количества месяцев от даты расчёта
                </small>
            </div>

            <hr style="margin: 1.5rem 0; border: none; border-top: 1px solid var(--bg-tertiary);">

            <div class="form-group">
                <label>Дата начала действия правила</label>
                <input type="date" id="rule-start-date" value="${existingRule ? existingRule.startDate : ''}">
            </div>

            <div class="form-group">
                <label>Дата окончания действия правила</label>
                <input type="date" id="rule-end-date" value="${existingRule ? existingRule.endDate : ''}">
            </div>

            <button class="btn btn-primary" id="save-rule-btn">${isEdit ? 'Сохранить изменения' : 'Сохранить правило'}</button>
        `;

        modal.classList.add('active');

        // Динамическое обновление списка менеджеров
        const managerTypeSelect = document.getElementById('rule-manager-type');
        const managersCheckboxes = document.getElementById('managers-checkboxes');
        
        const updateManagersList = () => {
            const type = managerTypeSelect.value;
            const managers = type === 'recruiter' ? recruiters : accounts;
            
            managersCheckboxes.innerHTML = managers.map(m => `
                <label>
                    <input type="checkbox" value="${m.id}" class="manager-checkbox" ${existingRule && existingRule.managerIds && existingRule.managerIds.includes(m.id) ? 'checked' : ''}>
                    ${m.name}
                </label>
            `).join('');
        };
        
        updateManagersList();
        managerTypeSelect.addEventListener('change', updateManagersList);

        // Переключение типа начисления
        document.querySelectorAll('input[name="payment-type"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const percentageInput = document.getElementById('payment-percentage');
                const fixedInput = document.getElementById('payment-fixed');
                
                if (e.target.value === 'percentage') {
                    percentageInput.disabled = false;
                    fixedInput.disabled = true;
                } else {
                    percentageInput.disabled = true;
                    fixedInput.disabled = false;
                }
            });
        });

        // Переключение условия применения
        document.querySelectorAll('input[name="apply-to"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const thresholdCheckbox = document.getElementById('constraint-threshold');
                const thresholdValue = document.getElementById('constraint-threshold-value');
                
                // Для "За группу при достижении порога" - порог обязателен
                if (e.target.value === 'groupWithThreshold') {
                    thresholdCheckbox.checked = true;
                    thresholdCheckbox.disabled = true;
                    thresholdValue.disabled = false;
                } else {
                    thresholdCheckbox.disabled = false;
                }
            });
        });

        // Включение/выключение полей ограничений
        document.getElementById('constraint-max').addEventListener('change', (e) => {
            document.getElementById('constraint-max-value').disabled = !e.target.checked;
        });

        document.getElementById('constraint-threshold').addEventListener('change', (e) => {
            document.getElementById('constraint-threshold-value').disabled = !e.target.checked;
        });

        document.getElementById('constraint-new-agents').addEventListener('change', (e) => {
            document.getElementById('constraint-new-agents-months').disabled = !e.target.checked;
        });

        // Сохранение правила
        document.getElementById('save-rule-btn').addEventListener('click', async () => {
            const name = document.getElementById('rule-name').value.trim();
            const managerType = document.getElementById('rule-manager-type').value;
            
            const selectedCheckboxes = document.querySelectorAll('.manager-checkbox:checked');
            const managerIds = Array.from(selectedCheckboxes).map(cb => parseInt(cb.value));
            
            const paymentType = document.querySelector('input[name="payment-type"]:checked').value;
            const paymentValue = paymentType === 'percentage' 
                ? parseFloat(document.getElementById('payment-percentage').value)
                : parseFloat(document.getElementById('payment-fixed').value);
            
            const applyTo = document.querySelector('input[name="apply-to"]:checked').value;
            
            const constraintsLogic = document.querySelector('input[name="constraints-logic"]:checked').value;
            
            const constraints = {
                maxPerPayment: document.getElementById('constraint-max').checked 
                    ? parseFloat(document.getElementById('constraint-max-value').value) || null
                    : null,
                minGroupThreshold: document.getElementById('constraint-threshold').checked
                    ? parseFloat(document.getElementById('constraint-threshold-value').value) || null
                    : null,
                periodOnly: document.getElementById('constraint-period').checked,
                newAgentsOnly: document.getElementById('constraint-new-agents').checked,
                newAgentsMonths: document.getElementById('constraint-new-agents').checked
                    ? parseInt(document.getElementById('constraint-new-agents-months').value) || null
                    : null
            };
            
            const startDate = document.getElementById('rule-start-date').value;
            const endDate = document.getElementById('rule-end-date').value;

            if (!name || managerIds.length === 0 || !startDate || !endDate) {
                alert('Заполните все обязательные поля и выберите хотя бы одного менеджера');
                return;
            }

            // Валидация для groupWithThreshold
            if (applyTo === 'groupWithThreshold' && !constraints.minGroupThreshold) {
                alert('Для условия "За группу при достижении порога" необходимо указать минимальный порог');
                return;
            }

            // Валидация для новых агентов
            if (constraints.newAgentsOnly && !constraints.newAgentsMonths) {
                alert('Укажите количество месяцев для условия "Только новые агенты"');
                return;
            }

            const rule = {
                name,
                managerType,
                managerIds,
                paymentType,
                paymentValue,
                applyTo,
                constraints,
                constraintsLogic,
                startDate,
                endDate
            };

            if (isEdit) {
                await this.updateRule(existingRule.id, rule);
            } else {
                await this.addRule(rule);
            }
            modal.classList.remove('active');
        });

        document.querySelector('.modal-close').addEventListener('click', () => {
            modal.classList.remove('active');
        });

        // Убрано закрытие по клику вне окна
    }

    async addRule(rule) {
        const id = await db.save('rules', rule);
        this.rules.push({ ...rule, id });
        this.render();
    }

    async updateRule(id, rule) {
        await db.update('rules', { ...rule, id });
        const index = this.rules.findIndex(r => r.id === id);
        if (index !== -1) {
            this.rules[index] = { ...rule, id };
        }
        this.render();
    }

    editRule(id) {
        const rule = this.rules.find(r => r.id === id);
        if (!rule) return;
        
        this.showAddModal(rule);
    }

    async deleteRule(id) {
        if (!confirm('Удалить правило?')) return;
        
        await db.delete('rules', id);
        this.rules = this.rules.filter(r => r.id !== id);
        this.render();
    }

    render() {
        const container = document.getElementById('rules-list');
        
        if (this.rules.length === 0) {
            container.innerHTML = '<p style="color: var(--text-tertiary); text-align: center; padding: 2rem;">Правила не добавлены</p>';
            return;
        }

        container.innerHTML = this.rules.map(rule => {
            const allManagers = managersCtrl.getAllManagers();
            const assignedManagers = allManagers.filter(m => rule.managerIds && rule.managerIds.includes(m.id));
            const managerNames = assignedManagers.map(m => m.name).join(', ') || 'Неизвестно';
            
            const applyToLabels = {
                'all': 'За все предоплаты',
                'firstPrepayment': 'За первую предоплату агента',
                'earlyFg': 'За раннюю ФГ группы',
                'groupWithThreshold': 'За группу при достижении порога'
            };
            
            const constraintsText = [];
            if (rule.constraints.maxPerPayment) {
                constraintsText.push(`Макс. $${rule.constraints.maxPerPayment}`);
            }
            if (rule.constraints.minGroupThreshold) {
                constraintsText.push(`Порог $${rule.constraints.minGroupThreshold}`);
            }
            if (rule.constraints.periodOnly) {
                constraintsText.push('Только в периоде отчёта');
            }
            if (rule.constraints.newAgentsOnly) {
                constraintsText.push(`Новые агенты (≤${rule.constraints.newAgentsMonths} мес.)`);
            }
            
            return `
                <div class="rule-item">
                    <div class="rule-header">
                        <div>
                            <h3 class="rule-title">${rule.name}</h3>
                            <p style="color: var(--text-secondary); margin-top: 0.25rem;">${managerNames}</p>
                        </div>
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn btn-small btn-primary" onclick="rulesCtrl.editRule(${rule.id})">Изменить</button>
                            <button class="btn btn-small btn-danger" onclick="rulesCtrl.deleteRule(${rule.id})">Удалить</button>
                        </div>
                    </div>
                    <div class="rule-details">
                        <div class="rule-detail">
                            <span class="rule-detail-label">Начисление</span>
                            <span class="rule-detail-value">
                                ${rule.paymentType === 'fixed' ? `$${rule.paymentValue}` : `${rule.paymentValue}%`}
                            </span>
                        </div>
                        <div class="rule-detail">
                            <span class="rule-detail-label">Условие</span>
                            <span class="rule-detail-value">${applyToLabels[rule.applyTo] || rule.applyTo}</span>
                        </div>
                        <div class="rule-detail">
                            <span class="rule-detail-label">Тип менеджера</span>
                            <span class="rule-detail-value">${rule.managerType === 'recruiter' ? 'Recruiter' : 'Account Manager'}</span>
                        </div>
                        ${constraintsText.length > 0 ? `
                        <div class="rule-detail">
                            <span class="rule-detail-label">Ограничения (${rule.constraintsLogic})</span>
                            <span class="rule-detail-value">${constraintsText.join(' • ')}</span>
                        </div>
                        ` : ''}
                        <div class="rule-detail">
                            <span class="rule-detail-label">Период</span>
                            <span class="rule-detail-value">${rule.startDate} — ${rule.endDate}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
}

let rulesCtrl;
