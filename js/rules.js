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

    showAddModal() {
        const modal = document.getElementById('modal');
        const modalBody = document.getElementById('modal-body');
        
        const recruiters = managersCtrl.recruiters;
        const accounts = managersCtrl.accountManagers;
        const defaultCommission = app.defaultCommission;
        
        modalBody.innerHTML = `
            <h2>Новое правило комиссии</h2>
            
            <div class="form-group">
                <label>Название правила</label>
                <input type="text" id="rule-name" placeholder="Например: Q4 2024 Enhanced Commission">
            </div>

            <div class="form-group">
                <label>Тип менеджера</label>
                <select id="rule-manager-type">
                    <option value="recruiter">Recruiter</option>
                    <option value="account">Account Manager</option>
                </select>
            </div>

            <div class="form-group">
                <label>Выбор менеджеров (можно несколько)</label>
                <div class="checkbox-group" id="managers-checkboxes">
                    <!-- Заполнится динамически -->
                </div>
            </div>

            <div class="form-group">
                <label>Тип комиссии</label>
                <select id="rule-commission-type">
                    <option value="percentage">Процент</option>
                    <option value="fixed">Фикс</option>
                    <option value="percentageWithCap">Процент с ограничением</option>
                </select>
            </div>

            <div class="form-group">
                <label id="rule-value-label">Процент (%)</label>
                <input type="number" id="rule-value" value="${defaultCommission}" step="0.1" min="0">
            </div>

            <div class="form-group" id="rule-max-group" style="display: none;">
                <label>Максимальная сумма ($)</label>
                <input type="number" id="rule-max-amount" step="0.01" min="0">
            </div>

            <div class="form-group">
                <label>Дата начала</label>
                <input type="date" id="rule-start-date">
            </div>

            <div class="form-group">
                <label>Дата окончания</label>
                <input type="date" id="rule-end-date">
            </div>

            <button class="btn btn-primary" id="save-rule-btn">Сохранить правило</button>
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
                    <input type="checkbox" value="${m.id}" class="manager-checkbox">
                    ${m.name}
                </label>
            `).join('');
        };
        
        updateManagersList();
        managerTypeSelect.addEventListener('change', updateManagersList);

        // Динамическое изменение формы по типу комиссии
        const commissionTypeSelect = document.getElementById('rule-commission-type');
        const valueLabel = document.getElementById('rule-value-label');
        const maxGroup = document.getElementById('rule-max-group');
        
        commissionTypeSelect.addEventListener('change', (e) => {
            const type = e.target.value;
            if (type === 'fixed') {
                valueLabel.textContent = 'Сумма ($)';
                maxGroup.style.display = 'none';
            } else if (type === 'percentageWithCap') {
                valueLabel.textContent = 'Процент (%)';
                maxGroup.style.display = 'block';
            } else {
                valueLabel.textContent = 'Процент (%)';
                maxGroup.style.display = 'none';
            }
        });

        document.getElementById('save-rule-btn').addEventListener('click', async () => {
            const name = document.getElementById('rule-name').value.trim();
            const managerType = document.getElementById('rule-manager-type').value;
            
            // Собираем выбранных менеджеров
            const selectedCheckboxes = document.querySelectorAll('.manager-checkbox:checked');
            const managerIds = Array.from(selectedCheckboxes).map(cb => parseInt(cb.value));
            
            const commissionType = document.getElementById('rule-commission-type').value;
            const value = parseFloat(document.getElementById('rule-value').value);
            const maxAmount = document.getElementById('rule-max-amount').value ? 
                parseFloat(document.getElementById('rule-max-amount').value) : null;
            const startDate = document.getElementById('rule-start-date').value;
            const endDate = document.getElementById('rule-end-date').value;

            if (!name || managerIds.length === 0 || !startDate || !endDate) {
                alert('Заполните все обязательные поля и выберите хотя бы одного менеджера');
                return;
            }

            const rule = {
                name,
                managerType,
                managerIds,
                commissionType,
                value,
                maxAmount,
                startDate,
                endDate
            };

            await this.addRule(rule);
            modal.classList.remove('active');
        });

        document.querySelector('.modal-close').addEventListener('click', () => {
            modal.classList.remove('active');
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    }

    async addRule(rule) {
        const id = await db.save('rules', rule);
        this.rules.push({ ...rule, id });
        this.render();
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
            
            return `
                <div class="rule-item">
                    <div class="rule-header">
                        <div>
                            <h3 class="rule-title">${rule.name}</h3>
                            <p style="color: var(--text-secondary); margin-top: 0.25rem;">${managerNames}</p>
                        </div>
                        <button class="btn btn-small btn-danger" onclick="rulesCtrl.deleteRule(${rule.id})">Удалить</button>
                    </div>
                    <div class="rule-details">
                        <div class="rule-detail">
                            <span class="rule-detail-label">Тип менеджера</span>
                            <span class="rule-detail-value">${rule.managerType === 'recruiter' ? 'Recruiter' : 'Account Manager'}</span>
                        </div>
                        <div class="rule-detail">
                            <span class="rule-detail-label">Менеджеров</span>
                            <span class="rule-detail-value">${assignedManagers.length}</span>
                        </div>
                        <div class="rule-detail">
                            <span class="rule-detail-label">Комиссия</span>
                            <span class="rule-detail-value">
                                ${rule.commissionType === 'fixed' ? `$${rule.value}` : `${rule.value}%`}
                                ${rule.maxAmount ? ` (макс. $${rule.maxAmount})` : ''}
                            </span>
                        </div>
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
