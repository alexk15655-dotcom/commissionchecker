// Контроллер менеджеров
class ManagersController {
    constructor() {
        this.recruiters = [];
        this.accountManagers = [];
        this.init();
    }

    async init() {
        await this.loadManagers();
        this.setupEventListeners();
        this.render();
    }

    async loadManagers() {
        this.recruiters = await db.getAll('recruiters');
        this.accountManagers = await db.getAll('accountManagers');
    }

    setupEventListeners() {
        document.getElementById('add-recruiter-btn').addEventListener('click', () => {
            this.showAddModal('recruiter');
        });

        document.getElementById('add-account-btn').addEventListener('click', () => {
            this.showAddModal('account');
        });
    }

    showAddModal(type) {
        const modal = document.getElementById('modal');
        const modalBody = document.getElementById('modal-body');
        
        modalBody.innerHTML = `
            <h2>Добавить ${type === 'recruiter' ? 'рекрутера' : 'аккаунт-менеджера'}</h2>
            
            <div class="form-group">
                <label>Имя</label>
                <input type="text" id="manager-name" placeholder="Например: Иванов Иван">
            </div>

            <button class="btn btn-primary" id="save-manager-btn">Сохранить</button>
        `;

        modal.classList.add('active');

        document.getElementById('save-manager-btn').addEventListener('click', async () => {
            const name = document.getElementById('manager-name').value.trim();
            
            if (!name) {
                alert('Заполните имя менеджера');
                return;
            }

            await this.addManager(type, name);
            modal.classList.remove('active');
        });

        document.querySelector('.modal-close').addEventListener('click', () => {
            modal.classList.remove('active');
        });
    }

    async addManager(type, name) {
        const manager = { name, personRules: [] };
        const id = await db.save(type === 'recruiter' ? 'recruiters' : 'accountManagers', manager);
        
        if (type === 'recruiter') {
            this.recruiters.push({ ...manager, id });
        } else {
            this.accountManagers.push({ ...manager, id });
        }
        
        this.render();
    }

    async deleteManager(type, id) {
        if (!confirm('Удалить менеджера?')) return;
        
        await db.delete(type === 'recruiter' ? 'recruiters' : 'accountManagers', id);
        
        if (type === 'recruiter') {
            this.recruiters = this.recruiters.filter(m => m.id !== id);
        } else {
            this.accountManagers = this.accountManagers.filter(m => m.id !== id);
        }
        
        this.render();
    }

    addPersonalRule(managerId, managerType) {
        const manager = this.getAllManagers().find(m => m.id === managerId);
        if (!manager) return;
        
        // Создаём заготовку правила с предзаполнением
        const ruleTemplate = {
            name: `Персональное: ${manager.name}`,
            managerType: managerType,
            managerIds: [managerId],
            paymentType: 'percentage',
            paymentValue: app.defaultCommission,
            applyTo: 'all',
            constraints: {
                maxPerPayment: null,
                minGroupThreshold: null,
                periodOnly: false,
                newAgentsOnly: false,
                newAgentsMonths: null
            },
            constraintsLogic: 'AND',
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0]
        };
        
        // Открываем форму правил с предзаполнением и флагом isPersonal
        rulesCtrl.showAddModal(ruleTemplate, managerId, true);
    }

    async savePersonalRule(managerId, managerType, rule) {
        const storeName = managerType === 'recruiter' ? 'recruiters' : 'accountManagers';
        const manager = this.getAllManagers().find(m => m.id === managerId);
        
        if (!manager) return;

        if (!manager.personRules) {
            manager.personRules = [];
        }
        
        manager.personRules.push(rule);
        await db.update(storeName, manager);
        
        if (managerType === 'recruiter') {
            const idx = this.recruiters.findIndex(m => m.id === managerId);
            if (idx !== -1) this.recruiters[idx] = manager;
        } else {
            const idx = this.accountManagers.findIndex(m => m.id === managerId);
            if (idx !== -1) this.accountManagers[idx] = manager;
        }
        
        this.render();
    }

    async deletePersonalRule(managerId, managerType, ruleIndex) {
        if (!confirm('Удалить персональное правило?')) return;
        
        const storeName = managerType === 'recruiter' ? 'recruiters' : 'accountManagers';
        const manager = this.getAllManagers().find(m => m.id === managerId);
        
        if (!manager || !manager.personRules) return;

        manager.personRules.splice(ruleIndex, 1);
        await db.update(storeName, manager);
        
        if (managerType === 'recruiter') {
            const idx = this.recruiters.findIndex(m => m.id === managerId);
            if (idx !== -1) this.recruiters[idx] = manager;
        } else {
            const idx = this.accountManagers.findIndex(m => m.id === managerId);
            if (idx !== -1) this.accountManagers[idx] = manager;
        }
        
        this.render();
    }

    getAllManagers() {
        return [...this.recruiters, ...this.accountManagers];
    }

    render() {
        this.renderRecruiters();
        this.renderAccounts();
    }

    renderRecruiters() {
        const container = document.getElementById('recruiters-list');
        
        if (this.recruiters.length === 0) {
            container.innerHTML = '<p style="color: var(--text-tertiary); text-align: center; padding: 2rem;">Рекрутеры не добавлены</p>';
            return;
        }

        container.innerHTML = this.recruiters.map(r => `
            <div class="manager-item">
                <div class="manager-header">
                    <span class="manager-name">${r.name}</span>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-small btn-primary" onclick="managersCtrl.addPersonalRule(${r.id}, 'recruiter')">+ Правило</button>
                        <button class="btn btn-small btn-danger" onclick="managersCtrl.deleteManager('recruiter', ${r.id})">Удалить</button>
                    </div>
                </div>
                ${r.personRules && r.personRules.length > 0 ? `
                    <div class="personal-rules">
                        <h4 style="margin-top: 1rem; margin-bottom: 0.5rem; font-size: 0.9rem; color: var(--text-secondary);">Персональные правила:</h4>
                        ${r.personRules.map((rule, idx) => `
                            <div class="personal-rule-item">
                                <div>
                                    <span style="font-weight: 500;">${rule.name}</span>
                                    <span style="margin-left: 0.5rem; color: var(--text-tertiary); font-size: 0.85rem;">
                                        ${rule.paymentType === 'fixed' ? `$${rule.paymentValue}` : `${rule.paymentValue}%`}
                                    </span>
                                </div>
                                <button class="btn btn-small btn-danger" onclick="managersCtrl.deletePersonalRule(${r.id}, 'recruiter', ${idx})">×</button>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `).join('');
    }

    renderAccounts() {
        const container = document.getElementById('accounts-list');
        
        if (this.accountManagers.length === 0) {
            container.innerHTML = '<p style="color: var(--text-tertiary); text-align: center; padding: 2rem;">Аккаунт-менеджеры не добавлены</p>';
            return;
        }

        container.innerHTML = this.accountManagers.map(a => `
            <div class="manager-item">
                <div class="manager-header">
                    <span class="manager-name">${a.name}</span>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-small btn-primary" onclick="managersCtrl.addPersonalRule(${a.id}, 'account')">+ Правило</button>
                        <button class="btn btn-small btn-danger" onclick="managersCtrl.deleteManager('account', ${a.id})">Удалить</button>
                    </div>
                </div>
                ${a.personRules && a.personRules.length > 0 ? `
                    <div class="personal-rules">
                        <h4 style="margin-top: 1rem; margin-bottom: 0.5rem; font-size: 0.9rem; color: var(--text-secondary);">Персональные правила:</h4>
                        ${a.personRules.map((rule, idx) => `
                            <div class="personal-rule-item">
                                <div>
                                    <span style="font-weight: 500;">${rule.name}</span>
                                    <span style="margin-left: 0.5rem; color: var(--text-tertiary); font-size: 0.85rem;">
                                        ${rule.paymentType === 'fixed' ? `$${rule.paymentValue}` : `${rule.paymentValue}%`}
                                    </span>
                                </div>
                                <button class="btn btn-small btn-danger" onclick="managersCtrl.deletePersonalRule(${a.id}, 'account', ${idx})">×</button>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `).join('');
    }
}

let managersCtrl;
