// Управление Milestones
class MilestonesController {
    constructor() {
        this.milestones = [];
        this.init();
    }

    async init() {
        await this.loadMilestones();
        this.setupEventListeners();
        this.render();
    }

    async loadMilestones() {
        this.milestones = await db.getAll('milestones');
    }

    setupEventListeners() {
        document.getElementById('add-milestone-btn').addEventListener('click', () => {
            this.showAddModal();
        });
    }

    showAddModal() {
        const modal = document.getElementById('modal');
        const modalBody = document.getElementById('modal-body');
        
        const allManagers = managersCtrl.getAllManagers();
        
        modalBody.innerHTML = `
            <h2>Новый Milestone</h2>
            
            <div class="form-group">
                <label>Название</label>
                <input type="text" id="milestone-name" placeholder="Например: Первые $10,000">
            </div>

            <div class="form-group">
                <label>Группа менеджеров</label>
                <select id="milestone-group">
                    <option value="all">Все менеджеры</option>
                    <option value="recruiters">Только Recruiters</option>
                    <option value="accounts">Только Account Managers</option>
                    <option value="custom">Выбрать вручную</option>
                </select>
            </div>

            <div class="form-group" id="custom-managers-group" style="display: none;">
                <label>Выбор менеджеров</label>
                <div class="checkbox-group" id="managers-checkboxes">
                    <p style="font-size: 0.85rem; color: var(--text-tertiary); margin-bottom: 0.5rem;">Recruiters:</p>
                    ${managersCtrl.recruiters.map(r => `
                        <label>
                            <input type="checkbox" value="${r.id}" data-type="recruiter">
                            ${r.name}
                        </label>
                    `).join('')}
                    <p style="font-size: 0.85rem; color: var(--text-tertiary); margin: 0.75rem 0 0.5rem 0;">Account Managers:</p>
                    ${managersCtrl.accountManagers.map(m => `
                        <label>
                            <input type="checkbox" value="${m.id}" data-type="account">
                            ${m.name}
                        </label>
                    `).join('')}
                </div>
            </div>

            <div class="form-group">
                <label>Целевая сумма ($)</label>
                <input type="number" id="milestone-target" step="0.01" min="0">
            </div>

            <div class="form-group">
                <label>Тип выплаты</label>
                <select id="milestone-payment-type">
                    <option value="percentage">Процент</option>
                    <option value="fixed">Фикс</option>
                    <option value="percentageWithCap">Процент с ограничением</option>
                </select>
            </div>

            <div class="form-group">
                <label id="milestone-value-label">Процент (%)</label>
                <input type="number" id="milestone-payment-value" value="5" step="0.1" min="0">
            </div>

            <div class="form-group" id="milestone-max-group" style="display: none;">
                <label>Максимальная выплата ($)</label>
                <input type="number" id="milestone-max-payment" step="0.01" min="0">
            </div>

            <button class="btn btn-primary" id="save-milestone-btn">Сохранить Milestone</button>
        `;

        modal.classList.add('active');

        // Показ/скрытие custom managers
        const groupSelect = document.getElementById('milestone-group');
        const customGroup = document.getElementById('custom-managers-group');
        
        groupSelect.addEventListener('change', (e) => {
            customGroup.style.display = e.target.value === 'custom' ? 'block' : 'none';
        });

        // Динамическое изменение формы по типу выплаты
        const paymentTypeSelect = document.getElementById('milestone-payment-type');
        const valueLabel = document.getElementById('milestone-value-label');
        const maxGroup = document.getElementById('milestone-max-group');
        
        paymentTypeSelect.addEventListener('change', (e) => {
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

        document.getElementById('save-milestone-btn').addEventListener('click', async () => {
            const name = document.getElementById('milestone-name').value.trim();
            const managerGroup = document.getElementById('milestone-group').value;
            const targetAmount = parseFloat(document.getElementById('milestone-target').value);
            const paymentType = document.getElementById('milestone-payment-type').value;
            const paymentValue = parseFloat(document.getElementById('milestone-payment-value').value);
            const maxPayment = document.getElementById('milestone-max-payment').value ? 
                parseFloat(document.getElementById('milestone-max-payment').value) : null;

            if (!name || !targetAmount || !paymentValue) {
                alert('Заполните все обязательные поля');
                return;
            }

            let assignedManagers = [];
            if (managerGroup === 'custom') {
                const checkboxes = document.querySelectorAll('#managers-checkboxes input[type="checkbox"]:checked');
                assignedManagers = Array.from(checkboxes).map(cb => parseInt(cb.value));
            }

            const milestone = {
                name,
                managerGroup,
                assignedManagers,
                targetAmount,
                paymentType,
                paymentValue,
                maxPayment,
                achieved: false
            };

            await this.addMilestone(milestone);
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

    async addMilestone(milestone) {
        const id = await db.save('milestones', milestone);
        this.milestones.push({ ...milestone, id });
        this.render();
    }

    async deleteMilestone(id) {
        if (!confirm('Удалить milestone?')) return;
        
        await db.delete('milestones', id);
        this.milestones = this.milestones.filter(m => m.id !== id);
        this.render();
    }

    render() {
        const container = document.getElementById('milestones-list');
        
        if (this.milestones.length === 0) {
            container.innerHTML = '<p style="color: var(--text-tertiary); text-align: center; padding: 2rem; grid-column: 1/-1;">Milestones не добавлены</p>';
            return;
        }

        container.innerHTML = this.milestones.map(milestone => {
            let groupLabel = 'Все менеджеры';
            if (milestone.managerGroup === 'recruiters') {
                groupLabel = 'Только Recruiters';
            } else if (milestone.managerGroup === 'accounts') {
                groupLabel = 'Только Account Managers';
            } else if (milestone.managerGroup === 'custom') {
                const assignedNames = managersCtrl.getAllManagers()
                    .filter(m => milestone.assignedManagers.includes(m.id))
                    .map(m => m.name);
                groupLabel = assignedNames.length > 0 ? assignedNames.join(', ') : 'Нет назначенных';
            }

            return `
                <div class="milestone-item">
                    <div class="milestone-header">
                        <h3 class="milestone-title">${milestone.name}</h3>
                        <button class="btn btn-small btn-danger" onclick="milestonesCtrl.deleteMilestone(${milestone.id})">×</button>
                    </div>
                    <div class="milestone-details">
                        <p><strong>Цель:</strong> <span style="color: var(--accent-primary);">$${milestone.targetAmount.toLocaleString()}</span></p>
                        <p><strong>Выплата:</strong> <span style="color: var(--accent-primary);">
                            ${milestone.paymentType === 'fixed' ? `$${milestone.paymentValue}` : `${milestone.paymentValue}%`}
                            ${milestone.maxPayment ? ` (макс. $${milestone.maxPayment})` : ''}
                        </span></p>
                    </div>
                    <div class="milestone-group">
                        Группа: ${groupLabel}
                    </div>
                </div>
            `;
        }).join('');
    }
}

let milestonesCtrl;
