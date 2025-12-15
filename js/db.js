// IndexedDB управление (session-only через sessionStorage для синхронизации)
class Database {
    constructor() {
        this.dbName = 'CommissionSystemDB';
        this.version = 2; // Увеличена версия для обновления структуры
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(request.error);
            request.onsuccess = async () => {
                this.db = request.result;
                // Инициализируем стартовые данные после открытия БД
                await this.initDefaultData();
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Создаем хранилища
                if (!db.objectStoreNames.contains('fgData')) {
                    db.createObjectStore('fgData', { keyPath: 'id', autoIncrement: true });
                }
                if (!db.objectStoreNames.contains('prepaymentsData')) {
                    db.createObjectStore('prepaymentsData', { keyPath: 'id', autoIncrement: true });
                }
                // ИСПРАВЛЕНО: Отдельные хранилища для recruiters и accountManagers
                if (!db.objectStoreNames.contains('recruiters')) {
                    db.createObjectStore('recruiters', { keyPath: 'id', autoIncrement: true });
                }
                if (!db.objectStoreNames.contains('accountManagers')) {
                    db.createObjectStore('accountManagers', { keyPath: 'id', autoIncrement: true });
                }
                if (!db.objectStoreNames.contains('rules')) {
                    db.createObjectStore('rules', { keyPath: 'id', autoIncrement: true });
                }
                if (!db.objectStoreNames.contains('milestones')) {
                    db.createObjectStore('milestones', { keyPath: 'id', autoIncrement: true });
                }
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
            };
        });
    }

    async initDefaultData() {
        // Проверяем, есть ли уже менеджеры
        const recruiters = await this.getAll('recruiters');
        const accountManagers = await this.getAll('accountManagers');

        // Если нет данных, создаём стартовых менеджеров
        if (recruiters.length === 0) {
            const defaultRecruiters = [
                { name: 'Recruiter 1', personRules: [] },
                { name: 'Recruiter 2', personRules: [] },
                { name: 'Recruiter 3', personRules: [] }
            ];

            for (const recruiter of defaultRecruiters) {
                await this.save('recruiters', recruiter);
            }
        }

        if (accountManagers.length === 0) {
            const defaultAccounts = [
                { name: 'Account Manager 1', personRules: [] }
            ];

            for (const account of defaultAccounts) {
                await this.save('accountManagers', account);
            }
        }
    }

    async save(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.add(data);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async saveAll(storeName, dataArray) {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        // Очищаем перед массовой записью
        await this.clear(storeName);
        
        return Promise.all(dataArray.map(data => {
            return new Promise((resolve, reject) => {
                const request = store.add(data);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }));
    }

    async getAll(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async get(storeName, id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async update(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async delete(storeName, id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async clear(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getByIndex(storeName, indexName, value) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.getAll(value);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
}

const db = new Database();
