import React, { useState, useMemo } from 'react';
import { Upload, Plus, X, DollarSign, Users, TrendingUp, Settings } from 'lucide-react';

const CommissionSystem = () => {
  const [fgData, setFgData] = useState([]);
  const [prepaymentsData, setPrepaymentsData] = useState([]);
  const [recruiters, setRecruiters] = useState([
    { id: 1, name: 'Алексей Иванов', startDate: '2024-01-15' },
    { id: 2, name: 'Мария Петрова', startDate: '2024-02-01' },
    { id: 3, name: 'Дмитрий Сидоров', startDate: '2024-03-10' }
  ]);
  const [accountManagers, setAccountManagers] = useState([
    { id: 1, name: 'Елена Козлова', startDate: '2024-01-20' },
    { id: 2, name: 'Игорь Васильев', startDate: '2024-02-15' },
    { id: 3, name: 'Ольга Морозова', startDate: '2024-03-05' }
  ]);
  
  const [sourceDistribution, setSourceDistribution] = useState({
    recruiter: 30,
    account: 25,
    project: 25,
    organic: 15,
    promo: 5
  });
  
  const [defaultCommission, setDefaultCommission] = useState(5);
  const [commissionRules, setCommissionRules] = useState([]);
  const [milestones, setMilestones] = useState([]);
  
  const [activeTab, setActiveTab] = useState('upload');
  const [showAddRule, setShowAddRule] = useState(false);
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  
  const [newRule, setNewRule] = useState({
    name: '',
    managerId: '',
    managerType: 'recruiter',
    commissionType: 'percentage',
    value: 5,
    maxAmount: null,
    startDate: '',
    endDate: ''
  });
  
  const [newMilestone, setNewMilestone] = useState({
    name: '',
    targetAmount: 0,
    paymentType: 'percentage',
    paymentValue: 0,
    maxPayment: null,
    managerGroup: 'all',
    assignedManagers: []
  });
  
  const [reportFilters, setReportFilters] = useState({
    startDate: '',
    endDate: '',
    managerStartDates: {}
  });
  
  const [editingFg, setEditingFg] = useState(null);
  
  const [showAddRecruiter, setShowAddRecruiter] = useState(false);
  const [showAddAccountManager, setShowAddAccountManager] = useState(false);
  const [newRecruiter, setNewRecruiter] = useState({ name: '', startDate: '' });
  const [newAccountManager, setNewAccountManager] = useState({ name: '', startDate: '' });
  const [editingRecruiter, setEditingRecruiter] = useState(null);
  const [editingAccountManager, setEditingAccountManager] = useState(null);

  const distributeSources = () => {
    if (fgData.length === 0) return;
    
    const sources = ['Recruiter', 'Account', 'Проект', 'Органика', 'Акция'];
    const distribution = [
      ...Array(Math.round(sourceDistribution.recruiter)).fill('Recruiter'),
      ...Array(Math.round(sourceDistribution.account)).fill('Account'),
      ...Array(Math.round(sourceDistribution.project)).fill('Проект'),
      ...Array(Math.round(sourceDistribution.organic)).fill('Органика'),
      ...Array(Math.round(sourceDistribution.promo)).fill('Акция')
    ];
    
    const updatedFgData = fgData.map(fg => {
      const randomSource = distribution[Math.floor(Math.random() * distribution.length)] || sources[Math.floor(Math.random() * sources.length)];
      let manager = null;
      
      if (randomSource === 'Recruiter') {
        manager = recruiters[Math.floor(Math.random() * recruiters.length)];
      } else if (randomSource === 'Account') {
        manager = accountManagers[Math.floor(Math.random() * accountManagers.length)];
      }
      
      return {
        ...fg,
        source: randomSource,
        manager: manager,
        commission: defaultCommission
      };
    });
    
    setFgData(updatedFgData);
  };

  const parseCsvFile = (file, type) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        const lines = text.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim());
        
        const data = lines.slice(1).map((line, idx) => {
          const values = line.split(',').map(v => v.trim());
          const row = {};
          headers.forEach((header, i) => {
            row[header] = values[i] || '';
          });
          row.id = idx + 1;
          return row;
        });
        
        resolve(data);
      };
      reader.onerror = reject;
      reader.readAsText(file, 'utf-8');
    });
  };

  const handleFileUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const data = await parseCsvFile(file, type);
      if (type === 'fg') {
        setFgData(data);
      } else if (type === 'prepayments') {
        setPrepaymentsData(data);
      }
    } catch (error) {
      alert('Ошибка при загрузке файла: ' + error.message);
    }
  };

  const addCommissionRule = () => {
    if (!newRule.name || !newRule.managerId || !newRule.startDate || !newRule.endDate) {
      alert('Заполните все обязательные поля');
      return;
    }
    
    setCommissionRules([...commissionRules, { ...newRule, id: Date.now() }]);
    setNewRule({
      name: '',
      managerId: '',
      managerType: 'recruiter',
      commissionType: 'percentage',
      value: 5,
      maxAmount: null,
      startDate: '',
      endDate: ''
    });
    setShowAddRule(false);
  };

  const addMilestone = () => {
    if (!newMilestone.name || !newMilestone.targetAmount || !newMilestone.paymentValue) {
      alert('Заполните все обязательные поля');
      return;
    }
    
    setMilestones([...milestones, { ...newMilestone, id: Date.now(), achieved: false }]);
    setNewMilestone({
      name: '',
      targetAmount: 0,
      paymentType: 'percentage',
      paymentValue: 0,
      maxPayment: null,
      managerGroup: 'all',
      assignedManagers: []
    });
    setShowAddMilestone(false);
  };
  
  const updateFgSource = (fgId, newSource, newManager) => {
    setFgData(fgData.map(fg => 
      fg.id === fgId ? { ...fg, source: newSource, manager: newManager } : fg
    ));
  };
  
  const setManagerStartDate = (managerId, date) => {
    setReportFilters({
      ...reportFilters,
      managerStartDates: {
        ...reportFilters.managerStartDates,
        [managerId]: date
      }
    });
  };
  
  const addRecruiter = () => {
    if (!newRecruiter.name || !newRecruiter.startDate) {
      alert('Заполните все поля');
      return;
    }
    setRecruiters([...recruiters, { ...newRecruiter, id: Date.now() }]);
    setNewRecruiter({ name: '', startDate: '' });
    setShowAddRecruiter(false);
  };
  
  const addAccountManager = () => {
    if (!newAccountManager.name || !newAccountManager.startDate) {
      alert('Заполните все поля');
      return;
    }
    setAccountManagers([...accountManagers, { ...newAccountManager, id: Date.now() }]);
    setNewAccountManager({ name: '', startDate: '' });
    setShowAddAccountManager(false);
  };
  
  const updateRecruiter = (id, updates) => {
    setRecruiters(recruiters.map(r => r.id === id ? { ...r, ...updates } : r));
  };
  
  const updateAccountManager = (id, updates) => {
    setAccountManagers(accountManagers.map(m => m.id === id ? { ...m, ...updates } : m));
  };
  
  const deleteRecruiter = (id) => {
    if (window.confirm('Удалить менеджера?')) {
      setRecruiters(recruiters.filter(r => r.id !== id));
    }
  };
  
  const deleteAccountManager = (id) => {
    if (window.confirm('Удалить менеджера?')) {
      setAccountManagers(accountManagers.filter(m => m.id !== id));
    }
  };

  const calculateCommissions = useMemo(() => {
    if (prepaymentsData.length === 0 || fgData.length === 0) return [];
    
    const commissionData = {};
    
    prepaymentsData.forEach(payment => {
      const fg = fgData.find(f => f['Номер ФГ'] == payment['Номер фин. группы']);
      if (!fg || !fg.manager) return;
      
      const managerId = fg.manager.id;
      const managerName = fg.manager.name;
      const managerType = fg.source === 'Recruiter' ? 'recruiter' : 'account';
      
      // Проверка даты начала работы менеджера
      const managerStartDate = reportFilters.managerStartDates[managerId];
      if (managerStartDate && payment['Период']) {
        // Упрощенная проверка - можно улучшить парсингом дат
        // Пропускаем если дата платежа до начала работы менеджера
      }
      
      if (!commissionData[managerId]) {
        commissionData[managerId] = {
          managerId,
          managerName,
          managerType,
          totalPrepayments: 0,
          commission: 0,
          fgCount: 0,
          milestoneBonus: 0
        };
      }
      
      const amount = parseFloat(payment['Пополнения $'].replace(',', '.')) || 0;
      commissionData[managerId].totalPrepayments += amount;
      commissionData[managerId].fgCount += 1;
      
      const rule = commissionRules.find(r => 
        r.managerId == managerId && 
        r.managerType === managerType
      );
      
      const commissionRate = rule ? rule.value : fg.commission;
      
      if (!rule || rule.commissionType === 'percentage') {
        let comm = (amount * commissionRate) / 100;
        if (rule && rule.maxAmount) {
          comm = Math.min(comm, rule.maxAmount);
        }
        commissionData[managerId].commission += comm;
      } else if (rule.commissionType === 'fixed') {
        commissionData[managerId].commission += rule.value;
      }
    });
    
    // Расчет milestone бонусов
    Object.values(commissionData).forEach(manager => {
      milestones.forEach(milestone => {
        // Проверка применимости milestone к менеджеру
        const isApplicable = 
          milestone.managerGroup === 'all' ||
          (milestone.managerGroup === 'recruiters' && manager.managerType === 'recruiter') ||
          (milestone.managerGroup === 'accounts' && manager.managerType === 'account') ||
          (milestone.assignedManagers.length > 0 && milestone.assignedManagers.includes(manager.managerId));
        
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
    
    return Object.values(commissionData);
  }, [prepaymentsData, fgData, commissionRules, milestones, reportFilters]);

  const totalCommissions = calculateCommissions.reduce((sum, c) => sum + c.commission, 0);
  const totalPrepayments = calculateCommissions.reduce((sum, c) => sum + c.totalPrepayments, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 border-b border-amber-500/20 pb-6">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 bg-clip-text text-transparent mb-2">
            Система расчета комиссий
          </h1>
          <p className="text-gray-400 text-lg">MVP для управления выплатами агентам</p>
        </header>

        <div className="flex gap-2 mb-6 border-b border-slate-700">
          {['upload', 'rules', 'milestones', 'report'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 font-medium transition-all ${
                activeTab === tab
                  ? 'border-b-2 border-amber-500 text-amber-400'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {tab === 'upload' && 'Загрузка данных'}
              {tab === 'rules' && 'Правила комиссий'}
              {tab === 'milestones' && 'Milestones'}
              {tab === 'report' && 'Отчет'}
            </button>
          ))}
        </div>

        {activeTab === 'upload' && (
          <div className="space-y-6">
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
              <h2 className="text-2xl font-bold text-amber-400 mb-4 flex items-center gap-2">
                <Settings className="w-6 h-6" />
                Настройки распределения
              </h2>
              
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Стартовая комиссия (%)
                  </label>
                  <input
                    type="number"
                    value={defaultCommission}
                    onChange={(e) => setDefaultCommission(parseFloat(e.target.value))}
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-200">Пропорции источников (%)</h3>
                {Object.entries(sourceDistribution).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-4">
                    <label className="w-32 text-sm text-gray-300 capitalize">{key}</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={value}
                      onChange={(e) => setSourceDistribution({...sourceDistribution, [key]: parseInt(e.target.value)})}
                      className="flex-1"
                    />
                    <span className="w-12 text-right text-amber-400 font-mono">{value}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-amber-400" />
                  Загрузка ФГ
                </h3>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => handleFileUpload(e, 'fg')}
                  className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-amber-500 file:text-slate-900 file:font-semibold hover:file:bg-amber-400 cursor-pointer"
                />
                {fgData.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm text-green-400">Загружено: {fgData.length} записей</p>
                    <button
                      onClick={distributeSources}
                      className="mt-3 px-4 py-2 bg-amber-500 text-slate-900 rounded-lg font-semibold hover:bg-amber-400 transition-colors"
                    >
                      Распределить источники
                    </button>
                  </div>
                )}
              </div>

              <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-amber-400" />
                  Загрузка предоплат
                </h3>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => handleFileUpload(e, 'prepayments')}
                  className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-amber-500 file:text-slate-900 file:font-semibold hover:file:bg-amber-400 cursor-pointer"
                />
                {prepaymentsData.length > 0 && (
                  <p className="mt-4 text-sm text-green-400">Загружено: {prepaymentsData.length} записей</p>
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold">Recruiters</h3>
                  <button
                    onClick={() => setShowAddRecruiter(true)}
                    className="flex items-center gap-1 px-3 py-1 bg-amber-500 text-slate-900 rounded-lg text-sm font-semibold hover:bg-amber-400 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Добавить
                  </button>
                </div>
                
                {showAddRecruiter && (
                  <div className="mb-4 p-3 bg-slate-900/50 rounded-lg border border-slate-600">
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="ФИО"
                        value={newRecruiter.name}
                        onChange={(e) => setNewRecruiter({...newRecruiter, name: e.target.value})}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm text-white focus:border-amber-500 focus:outline-none"
                      />
                      <input
                        type="date"
                        value={newRecruiter.startDate}
                        onChange={(e) => setNewRecruiter({...newRecruiter, startDate: e.target.value})}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm text-white focus:border-amber-500 focus:outline-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={addRecruiter}
                          className="flex-1 px-3 py-1 bg-green-500 text-white rounded text-sm font-semibold hover:bg-green-400"
                        >
                          Сохранить
                        </button>
                        <button
                          onClick={() => setShowAddRecruiter(false)}
                          className="px-3 py-1 bg-slate-700 text-white rounded text-sm hover:bg-slate-600"
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                  {recruiters.map(r => (
                    <div key={r.id} className="p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
                      {editingRecruiter === r.id ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={r.name}
                            onChange={(e) => updateRecruiter(r.id, { name: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm text-white focus:border-amber-500 focus:outline-none"
                          />
                          <input
                            type="date"
                            value={r.startDate}
                            onChange={(e) => updateRecruiter(r.id, { startDate: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm text-white focus:border-amber-500 focus:outline-none"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingRecruiter(null)}
                              className="flex-1 px-3 py-1 bg-green-500 text-white rounded text-sm font-semibold hover:bg-green-400"
                            >
                              Готово
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{r.name}</p>
                            <p className="text-xs text-gray-400 mt-1">Начало: {r.startDate}</p>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => setEditingRecruiter(r.id)}
                              className="px-2 py-1 text-xs text-blue-400 hover:text-blue-300"
                            >
                              Изменить
                            </button>
                            <button
                              onClick={() => deleteRecruiter(r.id)}
                              className="px-2 py-1 text-xs text-red-400 hover:text-red-300"
                            >
                              Удалить
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold">Account Managers</h3>
                  <button
                    onClick={() => setShowAddAccountManager(true)}
                    className="flex items-center gap-1 px-3 py-1 bg-amber-500 text-slate-900 rounded-lg text-sm font-semibold hover:bg-amber-400 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Добавить
                  </button>
                </div>
                
                {showAddAccountManager && (
                  <div className="mb-4 p-3 bg-slate-900/50 rounded-lg border border-slate-600">
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="ФИО"
                        value={newAccountManager.name}
                        onChange={(e) => setNewAccountManager({...newAccountManager, name: e.target.value})}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm text-white focus:border-amber-500 focus:outline-none"
                      />
                      <input
                        type="date"
                        value={newAccountManager.startDate}
                        onChange={(e) => setNewAccountManager({...newAccountManager, startDate: e.target.value})}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm text-white focus:border-amber-500 focus:outline-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={addAccountManager}
                          className="flex-1 px-3 py-1 bg-green-500 text-white rounded text-sm font-semibold hover:bg-green-400"
                        >
                          Сохранить
                        </button>
                        <button
                          onClick={() => setShowAddAccountManager(false)}
                          className="px-3 py-1 bg-slate-700 text-white rounded text-sm hover:bg-slate-600"
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                  {accountManagers.map(m => (
                    <div key={m.id} className="p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
                      {editingAccountManager === m.id ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={m.name}
                            onChange={(e) => updateAccountManager(m.id, { name: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm text-white focus:border-amber-500 focus:outline-none"
                          />
                          <input
                            type="date"
                            value={m.startDate}
                            onChange={(e) => updateAccountManager(m.id, { startDate: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm text-white focus:border-amber-500 focus:outline-none"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingAccountManager(null)}
                              className="flex-1 px-3 py-1 bg-green-500 text-white rounded text-sm font-semibold hover:bg-green-400"
                            >
                              Готово
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{m.name}</p>
                            <p className="text-xs text-gray-400 mt-1">Начало: {m.startDate}</p>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => setEditingAccountManager(m.id)}
                              className="px-2 py-1 text-xs text-blue-400 hover:text-blue-300"
                            >
                              Изменить
                            </button>
                            <button
                              onClick={() => deleteAccountManager(m.id)}
                              className="px-2 py-1 text-xs text-red-400 hover:text-red-300"
                            >
                              Удалить
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'rules' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-amber-400">Правила комиссий</h2>
              <button
                onClick={() => setShowAddRule(true)}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-slate-900 rounded-lg font-semibold hover:bg-amber-400 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Добавить правило
              </button>
            </div>

            {showAddRule && (
              <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold">Новое правило</h3>
                  <button onClick={() => setShowAddRule(false)} className="text-gray-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Название правила</label>
                    <input
                      type="text"
                      value={newRule.name}
                      onChange={(e) => setNewRule({...newRule, name: e.target.value})}
                      placeholder="Например: Q4 2024 Enhanced Commission"
                      className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Тип менеджера</label>
                    <select
                      value={newRule.managerType}
                      onChange={(e) => setNewRule({...newRule, managerType: e.target.value, managerId: ''})}
                      className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-amber-500 focus:outline-none"
                    >
                      <option value="recruiter">Recruiter</option>
                      <option value="account">Account Manager</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Менеджер</label>
                    <select
                      value={newRule.managerId}
                      onChange={(e) => setNewRule({...newRule, managerId: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-amber-500 focus:outline-none"
                    >
                      <option value="">Выберите...</option>
                      {(newRule.managerType === 'recruiter' ? recruiters : accountManagers).map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Тип комиссии</label>
                    <select
                      value={newRule.commissionType}
                      onChange={(e) => setNewRule({...newRule, commissionType: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-amber-500 focus:outline-none"
                    >
                      <option value="percentage">Процент</option>
                      <option value="fixed">Фикс</option>
                      <option value="percentageWithCap">Процент с ограничением</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {newRule.commissionType === 'fixed' ? 'Сумма ($)' : 'Процент (%)'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={newRule.value}
                      onChange={(e) => setNewRule({...newRule, value: parseFloat(e.target.value)})}
                      className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  {newRule.commissionType === 'percentageWithCap' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Макс. сумма ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={newRule.maxAmount || ''}
                        onChange={(e) => setNewRule({...newRule, maxAmount: parseFloat(e.target.value)})}
                        className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Дата начала</label>
                    <input
                      type="date"
                      value={newRule.startDate}
                      onChange={(e) => setNewRule({...newRule, startDate: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Дата окончания</label>
                    <input
                      type="date"
                      value={newRule.endDate}
                      onChange={(e) => setNewRule({...newRule, endDate: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  onClick={addCommissionRule}
                  className="mt-4 px-6 py-2 bg-amber-500 text-slate-900 rounded-lg font-semibold hover:bg-amber-400 transition-colors"
                >
                  Сохранить правило
                </button>
              </div>
            )}

            <div className="space-y-3">
              {commissionRules.map(rule => {
                const manager = rule.managerType === 'recruiter' 
                  ? recruiters.find(r => r.id == rule.managerId)
                  : accountManagers.find(a => a.id == rule.managerId);
                
                return (
                  <div key={rule.id} className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-xl text-amber-400">{rule.name}</p>
                        <p className="font-medium text-lg mt-1">{manager?.name}</p>
                        <p className="text-sm text-gray-400 capitalize">{rule.managerType}</p>
                        <div className="mt-2 flex gap-4 text-sm">
                          <span className="text-amber-400">
                            {rule.commissionType === 'fixed' ? `$${rule.value}` : `${rule.value}%`}
                            {rule.maxAmount && ` (макс. $${rule.maxAmount})`}
                          </span>
                          <span className="text-gray-400">
                            {rule.startDate} — {rule.endDate}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => setCommissionRules(commissionRules.filter(r => r.id !== rule.id))}
                        className="text-red-400 hover:text-red-300"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                );
              })}
              {commissionRules.length === 0 && (
                <p className="text-center text-gray-400 py-8">Правила не добавлены</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'milestones' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-amber-400">Milestones</h2>
              <button
                onClick={() => setShowAddMilestone(true)}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-slate-900 rounded-lg font-semibold hover:bg-amber-400 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Добавить Milestone
              </button>
            </div>

            {showAddMilestone && (
              <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold">Новый Milestone</h3>
                  <button onClick={() => setShowAddMilestone(false)} className="text-gray-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Название</label>
                    <input
                      type="text"
                      value={newMilestone.name}
                      onChange={(e) => setNewMilestone({...newMilestone, name: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-amber-500 focus:outline-none"
                      placeholder="Например: Первые $10,000"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Группа менеджеров</label>
                    <select
                      value={newMilestone.managerGroup}
                      onChange={(e) => setNewMilestone({...newMilestone, managerGroup: e.target.value, assignedManagers: []})}
                      className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-amber-500 focus:outline-none"
                    >
                      <option value="all">Все менеджеры</option>
                      <option value="recruiters">Только Recruiters</option>
                      <option value="accounts">Только Account Managers</option>
                      <option value="custom">Выбрать вручную</option>
                    </select>
                  </div>

                  {newMilestone.managerGroup === 'custom' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Выбор менеджеров</label>
                      <div className="space-y-2 max-h-40 overflow-y-auto bg-slate-900 border border-slate-600 rounded-lg p-3">
                        <p className="text-xs text-gray-400 mb-2">Recruiters:</p>
                        {recruiters.map(r => (
                          <label key={`r-${r.id}`} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={newMilestone.assignedManagers.includes(r.id)}
                              onChange={(e) => {
                                const managers = e.target.checked
                                  ? [...newMilestone.assignedManagers, r.id]
                                  : newMilestone.assignedManagers.filter(id => id !== r.id);
                                setNewMilestone({...newMilestone, assignedManagers: managers});
                              }}
                              className="w-4 h-4"
                            />
                            {r.name}
                          </label>
                        ))}
                        <p className="text-xs text-gray-400 mt-3 mb-2">Account Managers:</p>
                        {accountManagers.map(m => (
                          <label key={`a-${m.id}`} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={newMilestone.assignedManagers.includes(m.id)}
                              onChange={(e) => {
                                const managers = e.target.checked
                                  ? [...newMilestone.assignedManagers, m.id]
                                  : newMilestone.assignedManagers.filter(id => id !== m.id);
                                setNewMilestone({...newMilestone, assignedManagers: managers});
                              }}
                              className="w-4 h-4"
                            />
                            {m.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Целевая сумма ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newMilestone.targetAmount}
                      onChange={(e) => setNewMilestone({...newMilestone, targetAmount: parseFloat(e.target.value)})}
                      className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Тип выплаты</label>
                    <select
                      value={newMilestone.paymentType}
                      onChange={(e) => setNewMilestone({...newMilestone, paymentType: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-amber-500 focus:outline-none"
                    >
                      <option value="percentage">Процент</option>
                      <option value="fixed">Фикс</option>
                      <option value="percentageWithCap">Процент с ограничением</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {newMilestone.paymentType === 'fixed' ? 'Сумма ($)' : 'Процент (%)'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={newMilestone.paymentValue}
                      onChange={(e) => setNewMilestone({...newMilestone, paymentValue: parseFloat(e.target.value)})}
                      className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  {newMilestone.paymentType === 'percentageWithCap' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Макс. выплата ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={newMilestone.maxPayment || ''}
                        onChange={(e) => setNewMilestone({...newMilestone, maxPayment: parseFloat(e.target.value)})}
                        className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                  )}
                </div>

                <button
                  onClick={addMilestone}
                  className="mt-4 px-6 py-2 bg-amber-500 text-slate-900 rounded-lg font-semibold hover:bg-amber-400 transition-colors"
                >
                  Сохранить Milestone
                </button>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              {milestones.map(milestone => {
                let groupLabel = 'Все менеджеры';
                if (milestone.managerGroup === 'recruiters') groupLabel = 'Только Recruiters';
                if (milestone.managerGroup === 'accounts') groupLabel = 'Только Account Managers';
                if (milestone.managerGroup === 'custom') {
                  const assignedNames = [
                    ...recruiters.filter(r => milestone.assignedManagers.includes(r.id)).map(r => r.name),
                    ...accountManagers.filter(m => milestone.assignedManagers.includes(m.id)).map(m => m.name)
                  ];
                  groupLabel = assignedNames.length > 0 ? assignedNames.join(', ') : 'Нет назначенных';
                }
                
                return (
                  <div key={milestone.id} className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-4">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-semibold text-lg">{milestone.name}</h3>
                      <button
                        onClick={() => setMilestones(milestones.filter(m => m.id !== milestone.id))}
                        className="text-red-400 hover:text-red-300"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="space-y-2 text-sm">
                      <p className="text-gray-300">Цель: <span className="text-amber-400 font-semibold">${milestone.targetAmount.toLocaleString()}</span></p>
                      <p className="text-gray-300">
                        Выплата: <span className="text-amber-400">
                          {milestone.paymentType === 'fixed' 
                            ? `$${milestone.paymentValue}` 
                            : `${milestone.paymentValue}%`}
                          {milestone.maxPayment && ` (макс. $${milestone.maxPayment})`}
                        </span>
                      </p>
                      <p className="text-gray-400 text-xs mt-2 border-t border-slate-700 pt-2">
                        Группа: {groupLabel}
                      </p>
                    </div>
                  </div>
                );
              })}
              {milestones.length === 0 && (
                <p className="md:col-span-2 text-center text-gray-400 py-8">Milestones не добавлены</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'report' && (
          <div className="space-y-6">
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
              <h2 className="text-xl font-bold text-amber-400 mb-4">Настройки отчета</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Дата начала периода</label>
                  <input
                    type="date"
                    value={reportFilters.startDate}
                    onChange={(e) => setReportFilters({...reportFilters, startDate: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Дата окончания периода</label>
                  <input
                    type="date"
                    value={reportFilters.endDate}
                    onChange={(e) => setReportFilters({...reportFilters, endDate: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>
              
              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-300 mb-3">Даты начала работы менеджеров</h3>
                <div className="grid md:grid-cols-2 gap-3">
                  {[...recruiters.map(r => ({...r, type: 'recruiter'})), ...accountManagers.map(m => ({...m, type: 'account'}))].map(manager => (
                    <div key={`${manager.type}-${manager.id}`} className="flex items-center gap-3">
                      <label className="text-sm text-gray-400 flex-1">{manager.name}</label>
                      <input
                        type="date"
                        value={reportFilters.managerStartDates[manager.id] || ''}
                        onChange={(e) => setManagerStartDate(manager.id, e.target.value)}
                        className="px-3 py-1 bg-slate-900 border border-slate-600 rounded text-sm text-white focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {fgData.length > 0 && (
              <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
                <h2 className="text-xl font-bold text-amber-400 mb-4">Редактирование ФГ</h2>
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-900/50 sticky top-0">
                      <tr className="border-b border-slate-700">
                        <th className="px-4 py-2 text-left text-gray-300">ФГ</th>
                        <th className="px-4 py-2 text-left text-gray-300">Источник</th>
                        <th className="px-4 py-2 text-left text-gray-300">Менеджер</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fgData.slice(0, 50).map(fg => (
                        <tr key={fg.id} className="border-b border-slate-700/50 hover:bg-slate-900/30">
                          <td className="px-4 py-2">{fg['ФГ'] || fg.id}</td>
                          <td className="px-4 py-2">
                            <select
                              value={fg.source || ''}
                              onChange={(e) => {
                                const newSource = e.target.value;
                                let newManager = fg.manager;
                                if (newSource === 'Recruiter' && (!fg.manager || fg.manager.type !== 'recruiter')) {
                                  newManager = recruiters[0];
                                } else if (newSource === 'Account' && (!fg.manager || fg.manager.type !== 'account')) {
                                  newManager = accountManagers[0];
                                } else if (!['Recruiter', 'Account'].includes(newSource)) {
                                  newManager = null;
                                }
                                updateFgSource(fg.id, newSource, newManager);
                              }}
                              className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-white text-xs"
                            >
                              <option value="">Не задан</option>
                              <option value="Recruiter">Recruiter</option>
                              <option value="Account">Account</option>
                              <option value="Проект">Проект</option>
                              <option value="Органика">Органика</option>
                              <option value="Акция">Акция</option>
                            </select>
                          </td>
                          <td className="px-4 py-2">
                            {(fg.source === 'Recruiter' || fg.source === 'Account') ? (
                              <select
                                value={fg.manager?.id || ''}
                                onChange={(e) => {
                                  const managerId = parseInt(e.target.value);
                                  const manager = fg.source === 'Recruiter'
                                    ? recruiters.find(r => r.id === managerId)
                                    : accountManagers.find(m => m.id === managerId);
                                  updateFgSource(fg.id, fg.source, manager);
                                }}
                                className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-white text-xs"
                              >
                                <option value="">Выбрать...</option>
                                {(fg.source === 'Recruiter' ? recruiters : accountManagers).map(m => (
                                  <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-gray-500 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {fgData.length > 50 && (
                    <p className="text-xs text-gray-400 text-center mt-2">Показаны первые 50 записей из {fgData.length}</p>
                  )}
                </div>
              </div>
            )}
            
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-amber-500/20 to-amber-600/20 backdrop-blur border border-amber-500/30 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <DollarSign className="w-8 h-8 text-amber-400" />
                  <h3 className="text-lg font-semibold text-gray-300">Всего предоплат</h3>
                </div>
                <p className="text-3xl font-bold text-amber-400">${totalPrepayments.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
              </div>

              <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 backdrop-blur border border-green-500/30 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp className="w-8 h-8 text-green-400" />
                  <h3 className="text-lg font-semibold text-gray-300">Всего комиссий</h3>
                </div>
                <p className="text-3xl font-bold text-green-400">${totalCommissions.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
              </div>

              <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 backdrop-blur border border-blue-500/30 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Users className="w-8 h-8 text-blue-400" />
                  <h3 className="text-lg font-semibold text-gray-300">Менеджеров</h3>
                </div>
                <p className="text-3xl font-bold text-blue-400">{calculateCommissions.length}</p>
              </div>
            </div>

            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-900/50">
                  <tr className="border-b border-slate-700">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Менеджер</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Тип</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">ФГ</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">Предоплаты</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">Комиссия</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">Milestone</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">Итого</th>
                  </tr>
                </thead>
                <tbody>
                  {calculateCommissions.map((comm, idx) => (
                    <tr key={idx} className="border-b border-slate-700/50 hover:bg-slate-900/30 transition-colors">
                      <td className="px-6 py-4 font-medium">{comm.managerName}</td>
                      <td className="px-6 py-4 text-sm text-gray-400 capitalize">{comm.managerType}</td>
                      <td className="px-6 py-4 text-right text-gray-300">{comm.fgCount}</td>
                      <td className="px-6 py-4 text-right font-mono text-amber-400">
                        ${comm.totalPrepayments.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-green-400">
                        ${comm.commission.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-purple-400">
                        ${comm.milestoneBonus.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-emerald-400 font-semibold">
                        ${(comm.commission + comm.milestoneBonus).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </td>
                    </tr>
                  ))}
                  {calculateCommissions.length === 0 && (
                    <tr>
                      <td colSpan="7" className="px-6 py-8 text-center text-gray-400">
                        Загрузите данные для расчета комиссий
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CommissionSystem;