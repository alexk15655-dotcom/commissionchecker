// Управление менеджерами
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
        const managers = await db.getAll('managers');
        this.recruiters = managers.filter(m => m.type === 'recruiter');
        this.accountManagers = managers.filter(m => m.type === 'account');
        
        // Инициализация дефолтными данными если пусто
        if (this.recruiters.length === 0) {
            await this.addDefaultRecruiters();
        }
        if (this.accountManagers.length === 0) {
            await this.addDefaultAccountManagers();
        }
    }

    async addDefaultRecruiters() {
        const defaults = [
            { name: 'Алексей Иванов', startDate: '2024-01-15', type: 'recruiter' },
            { name: 'Мария Петрова', startDate: '2024-02-01', type: 'recruiter' },
            { name: 'Дмитрий Сидоров', startDate: '2024-03-10', type: 'recruiter' }
        ];
        
        for (const manager of defaults) {
            const id = await db.save('managers', manager);
            this.recruiters.push({ ...manager, id });
        }
    }

    async addDefaultAccountManagers() {
        const defaults = [
            { name: 'Елена Козлова', startDate: '2024-01-20', type: 'account' },
            { name: 'Игорь Васильев', startDate: '2024-02-15', type: 'account' },
            { name: 'Ольга Морозова', startDate: '2024-03-05', type: 'account' }
        ];
        
        for (const manager of defaults) {
            const id = await db.save('managers', manager);
            this.accountManagers.push({ ...manager, id });
        }
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
            <h2>Добавить ${type === 'recruiter' ? 'Recruiter' : 'Account Manager'}</h2>
            <div class="form-group">
                <label>ФИО</label>
                <input type="text" id="manager-name" placeholder="Введите ФИО">
            </div>
            <div class="form-group">
                <label>Дата начала работы</label>
                <input type="date" id="manager-start-date">
            </div>
            <button class="btn btn-primary" id="save-manager-btn">Сохранить</button>
        `;

        modal.classList.add('active');

        document.getElementById('save-manager-btn').addEventListener('click', async () => {
            const name = document.getElementById('manager-name').value.trim();
            const startDate = document.getElementById('manager-start-date').value;

            if (!name || !startDate) {
                alert('Заполните все поля');
                return;
            }

            await this.addManager(name, startDate, type);
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

    async addManager(name, startDate, type) {
        const manager = { name, startDate, type };
        const id = await db.save('managers', manager);
        manager.id = id;

        if (type === 'recruiter') {
            this.recruiters.push(manager);
        } else {
            this.accountManagers.push(manager);
        }

        this.render();
    }

    async updateManager(id, updates) {
        const manager = await db.get('managers', id);
        const updated = { ...manager, ...updates };
        await db.update('managers', updated);

        if (updated.type === 'recruiter') {
            const idx = this.recruiters.findIndex(m => m.id === id);
            if (idx !== -1) this.recruiters[idx] = updated;
        } else {
            const idx = this.accountManagers.findIndex(m => m.id === id);
            if (idx !== -1) this.accountManagers[idx] = updated;
        }

        this.render();
    }

    async deleteManager(id, type) {
        if (!confirm('Удалить менеджера?')) return;

        await db.delete('managers', id);

        if (type === 'recruiter') {
            this.recruiters = this.recruiters.filter(m => m.id !== id);
        } else {
            this.accountManagers = this.accountManagers.filter(m => m.id !== id);
        }

        this.render();
    }

    render() {
        this.renderList(this.recruiters, 'recruiters-list');
        this.renderList(this.accountManagers, 'accounts-list');
    }

    renderList(managers, containerId) {
        const container = document.getElementById(containerId);
        
        if (managers.length === 0) {
            container.innerHTML = '<p style="color: var(--text-tertiary); text-align: center; padding: 2rem;">Менеджеры не добавлены</p>';
            return;
        }

        container.innerHTML = managers.map(manager => `
            <div class="manager-item" data-id="${manager.id}">
                <div class="manager-item-view" id="view-${manager.id}">
                    <div class="manager-info">
                        <h4>${manager.name}</h4>
                        <p>Начало: ${manager.startDate}</p>
                    </div>
                    <div class="manager-actions">
                        <button class="btn btn-small btn-primary" onclick="managersCtrl.startEdit(${manager.id})">Изменить</button>
                        <button class="btn btn-small btn-danger" onclick="managersCtrl.deleteManager(${manager.id}, '${manager.type}')">Удалить</button>
                    </div>
                </div>
                <div class="manager-item-edit" id="edit-${manager.id}" style="display: none;">
                    <input type="text" value="${manager.name}" id="edit-name-${manager.id}">
                    <input type="date" value="${manager.startDate}" id="edit-date-${manager.id}">
                    <div class="btn-group">
                        <button class="btn btn-small btn-success" onclick="managersCtrl.saveEdit(${manager.id})">Готово</button>
                        <button class="btn btn-small" onclick="managersCtrl.cancelEdit(${manager.id})">Отмена</button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    startEdit(id) {
        document.getElementById(`view-${id}`).style.display = 'none';
        document.getElementById(`edit-${id}`).style.display = 'flex';
    }

    cancelEdit(id) {
        document.getElementById(`view-${id}`).style.display = 'flex';
        document.getElementById(`edit-${id}`).style.display = 'none';
    }

    async saveEdit(id) {
        const name = document.getElementById(`edit-name-${id}`).value.trim();
        const startDate = document.getElementById(`edit-date-${id}`).value;

        if (!name || !startDate) {
            alert('Заполните все поля');
            return;
        }

        await this.updateManager(id, { name, startDate });
        this.cancelEdit(id);
    }

    getAllManagers() {
        return [...this.recruiters, ...this.accountManagers];
    }
}

let managersCtrl;
